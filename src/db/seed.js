/**
 * SoleMate — Database Seed Script
 * Connects to Supabase, extends schema with dashboard columns,
 * then inserts realistic shoe-firm data.
 *
 * Run: node src/db/seed.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
});

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🔗 Connected to Supabase...\n');

        // ─────────────────────────────────────────────
        // STEP 1: Extend tables with extra dashboard cols
        //         (safe — IF NOT EXISTS won't break anything)
        // ─────────────────────────────────────────────
        console.log('🔧 Adding extra dashboard columns (IF NOT EXISTS)...');
        await client.query(`
      ALTER TABLE products_table  ADD COLUMN IF NOT EXISTS category VARCHAR(80) DEFAULT 'Casual';
      ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS size    VARCHAR(10);
      ALTER TABLE orders_table    ADD COLUMN IF NOT EXISTS channel         VARCHAR(50) DEFAULT 'Online Website';
      ALTER TABLE orders_table    ADD COLUMN IF NOT EXISTS payment_method  VARCHAR(50) DEFAULT 'UPI';
      ALTER TABLE customers       ADD COLUMN IF NOT EXISTS city   VARCHAR(80);
      ALTER TABLE customers       ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
      ALTER TABLE customers       ADD COLUMN IF NOT EXISTS age    INT;
    `);
        console.log('✅ Columns ready.\n');

        // ─────────────────────────────────────────────
        // STEP 2: Wipe existing seed data (order matters)
        // ─────────────────────────────────────────────
        console.log('🗑️  Clearing old data...');
        await client.query('SET session_replication_role = replica;'); // disable FK checks
        await client.query('TRUNCATE order_items, orders_table, customers, product_variants, products_table, seller_table RESTART IDENTITY CASCADE;');
        await client.query('SET session_replication_role = DEFAULT;');
        console.log('✅ Tables cleared.\n');

        // ─────────────────────────────────────────────
        // STEP 3: Seller
        // ─────────────────────────────────────────────
        console.log('👟 Seeding seller...');
        const sellerRes = await client.query(`
      INSERT INTO seller_table (name, email, phone, address)
      VALUES ('SoleMate Shoes', 'admin@solemate.in', '9876543210', '42 MG Road, Mumbai, Maharashtra')
      RETURNING seller_id;
    `);
        const sellerId = sellerRes.rows[0].seller_id;
        console.log(`✅ Seller ID: ${sellerId}\n`);

        // ─────────────────────────────────────────────
        // STEP 4: Products
        // ─────────────────────────────────────────────
        console.log('👟 Seeding products...');
        const productsData = [
            { name: 'Nike Air Max 270', description: 'Lightweight running shoe with Air Max cushioning.', price: 7999, category: 'Running' },
            { name: 'Adidas Ultraboost 22', description: 'Premium energy-return running experience.', price: 10499, category: 'Running' },
            { name: 'Puma RS-X³', description: 'Bold and chunky retro-inspired trainer.', price: 5699, category: 'Sports' },
            { name: 'Reebok Classic Leather', description: 'Timeless everyday casual sneaker.', price: 4299, category: 'Casual' },
            { name: 'New Balance 574', description: 'Heritage silhouette with modern comfort.', price: 5599, category: 'Casual' },
            { name: 'Converse All Star', description: 'Iconic canvas hi-top sneaker.', price: 3799, category: 'Casual' },
            { name: 'Skechers GoRun 7', description: 'Ultra-lightweight go-to running shoe.', price: 3299, category: 'Running' },
            { name: 'ASICS Gel-Nimbus 25', description: 'Maximum cushioning for long-distance running.', price: 8999, category: 'Running' },
            { name: 'Bata Power Mesh', description: 'Affordable breathable sports shoe.', price: 1799, category: 'Sports' },
            { name: 'Red Tape Oxford', description: 'Formal lace-up leather Oxford shoe.', price: 2999, category: 'Formal' },
        ];

        const productIds = [];
        for (const p of productsData) {
            const res = await client.query(`
        INSERT INTO products_table (seller_id, name, description, base_price, category, is_active)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        RETURNING product_id;
      `, [sellerId, p.name, p.description, p.price, p.category]);
            productIds.push({ id: res.rows[0].product_id, price: p.price, name: p.name });
        }
        console.log(`✅ ${productIds.length} products seeded.\n`);

        // ─────────────────────────────────────────────
        // STEP 5: Product Variants (sizes 6–12)
        // ─────────────────────────────────────────────
        console.log('📦 Seeding product variants...');
        const sizes = ['6', '7', '8', '9', '10', '11', '12'];
        // Stock weights: sizes 8-10 sell most
        const stockBySize = { '6': 18, '7': 42, '8': 65, '9': 80, '10': 72, '11': 38, '12': 15 };

        const variantIds = []; // [{ variantId, price }]
        let skuCounter = 1000;
        for (const product of productIds) {
            for (const size of sizes) {
                const sku = `SM-${skuCounter++}`;
                const price = product.price + (parseInt(size) - 8) * 50; // slight price variation by size
                const stock = stockBySize[size] + Math.floor(Math.random() * 10) - 5;
                const finalStock = Math.max(0, stock);
                const res = await client.query(`
          INSERT INTO product_variants (product_id, sku, variant_name, price, stock_quantity, size)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING variant_id;
        `, [product.id, sku, `${product.name} — Size ${size}`, price, finalStock, size]);
                variantIds.push({ variantId: res.rows[0].variant_id, price });
            }
        }
        console.log(`✅ ${variantIds.length} variants seeded.\n`);

        // ─────────────────────────────────────────────
        // STEP 6: Customers
        // ─────────────────────────────────────────────
        console.log('👥 Seeding customers...');
        const customersData = [
            { name: 'Aisha Patel', email: 'aisha@email.com', phone: '9876501001', city: 'Mumbai', gender: 'Female', age: 28 },
            { name: 'Rohan Sharma', email: 'rohan@email.com', phone: '9876501002', city: 'Delhi', gender: 'Male', age: 32 },
            { name: 'Priya Singh', email: 'priya@email.com', phone: '9876501003', city: 'Bangalore', gender: 'Female', age: 24 },
            { name: 'Vikram Nair', email: 'vikram@email.com', phone: '9876501004', city: 'Mumbai', gender: 'Male', age: 38 },
            { name: 'Sneha Iyer', email: 'sneha@email.com', phone: '9876501005', city: 'Chennai', gender: 'Female', age: 26 },
            { name: 'Karan Mehta', email: 'karan@email.com', phone: '9876501006', city: 'Hyderabad', gender: 'Male', age: 29 },
            { name: 'Deepa Rao', email: 'deepa@email.com', phone: '9876501007', city: 'Pune', gender: 'Female', age: 35 },
            { name: 'Arjun Kapoor', email: 'arjun@email.com', phone: '9876501008', city: 'Delhi', gender: 'Male', age: 22 },
            { name: 'Nisha Gupta', email: 'nisha@email.com', phone: '9876501009', city: 'Mumbai', gender: 'Female', age: 31 },
            { name: 'Amit Kumar', email: 'amit@email.com', phone: '9876501010', city: 'Bangalore', gender: 'Male', age: 27 },
            { name: 'Riya Desai', email: 'riya@email.com', phone: '9876501011', city: 'Pune', gender: 'Female', age: 23 },
            { name: 'Sanjay Bhat', email: 'sanjay@email.com', phone: '9876501012', city: 'Mumbai', gender: 'Male', age: 45 },
            { name: 'Kavya Reddy', email: 'kavya@email.com', phone: '9876501013', city: 'Hyderabad', gender: 'Female', age: 30 },
            { name: 'Nikhil Joshi', email: 'nikhil@email.com', phone: '9876501014', city: 'Delhi', gender: 'Male', age: 33 },
            { name: 'Tanvi Malhotra', email: 'tanvi@email.com', phone: '9876501015', city: 'Chennai', gender: 'Female', age: 21 },
            { name: 'Manish Tiwari', email: 'manish@email.com', phone: '9876501016', city: 'Mumbai', gender: 'Male', age: 40 },
            { name: 'Pooja Verma', email: 'pooja@email.com', phone: '9876501017', city: 'Bangalore', gender: 'Female', age: 36 },
            { name: 'Rahul Mishra', email: 'rahul@email.com', phone: '9876501018', city: 'Pune', gender: 'Male', age: 25 },
            { name: 'Swati Kulkarni', email: 'swati@email.com', phone: '9876501019', city: 'Delhi', gender: 'Female', age: 29 },
            { name: 'Akash Pandey', email: 'akash@email.com', phone: '9876501020', city: 'Mumbai', gender: 'Male', age: 34 },
        ];

        const customerIds = [];
        for (const c of customersData) {
            const res = await client.query(`
        INSERT INTO customers (seller_id, name, email, phone, city, gender, age)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING customer_id;
      `, [sellerId, c.name, c.email, c.phone, c.city, c.gender, c.age]);
            customerIds.push(res.rows[0].customer_id);
        }
        console.log(`✅ ${customerIds.length} customers seeded.\n`);

        // ─────────────────────────────────────────────
        // STEP 7: Orders (spread over 12 months)
        // ─────────────────────────────────────────────
        console.log('🛒 Seeding orders + order items...');

        const statuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        const statusWeights = [5, 10, 15, 60, 10]; // 60% delivered
        const paymentStatuses = { DELIVERED: 'PAID', SHIPPED: 'PAID', CONFIRMED: 'PAID', PENDING: 'UNPAID', CANCELLED: 'REFUNDED' };

        const channels = ['Online Website', 'Mobile App', 'Retail Store', 'Wholesale'];
        const channelWeights = [48, 29, 16, 7];

        const paymentMethods = ['UPI', 'Credit/Debit Card', 'Cash on Delivery', 'Wallet', 'Net Banking'];
        const paymentWeights = [41, 28, 18, 8, 5];

        function weightedRandom(items, weights) {
            const total = weights.reduce((a, b) => a + b, 0);
            let r = Math.random() * total;
            for (let i = 0; i < items.length; i++) {
                r -= weights[i];
                if (r <= 0) return items[i];
            }
            return items[items.length - 1];
        }

        // Generate ~200 orders across last 12 months
        const now = new Date();
        let totalOrders = 0;

        for (let monthOffset = 11; monthOffset >= 0; monthOffset--) {
            const ordersThisMonth = 12 + Math.floor(monthOffset * 2.5) + Math.floor(Math.random() * 8);

            for (let o = 0; o < ordersThisMonth; o++) {
                const orderDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, Math.floor(Math.random() * 28) + 1);
                const status = weightedRandom(statuses, statusWeights);
                const payStatus = paymentStatuses[status];
                const channel = weightedRandom(channels, channelWeights);
                const payMethod = weightedRandom(paymentMethods, paymentWeights);
                const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];

                // Pick 1–3 random variants for this order
                const itemCount = Math.floor(Math.random() * 3) + 1;
                let orderTotal = 0;
                const orderVariants = [];
                for (let i = 0; i < itemCount; i++) {
                    const v = variantIds[Math.floor(Math.random() * variantIds.length)];
                    const qty = Math.floor(Math.random() * 2) + 1;
                    orderTotal += v.price * qty;
                    orderVariants.push({ variantId: v.variantId, qty, price: v.price });
                }

                const orderRes = await client.query(`
          INSERT INTO orders_table
            (seller_id, customer_id, order_status, total_amount, payment_status, channel, payment_method, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
          RETURNING order_id;
        `, [sellerId, customerId, status, orderTotal, payStatus, channel, payMethod, orderDate.toISOString()]);

                const orderId = orderRes.rows[0].order_id;

                for (const item of orderVariants) {
                    await client.query(`
            INSERT INTO order_items (order_id, variant_id, quantity, price_at_purchase)
            VALUES ($1, $2, $3, $4);
          `, [orderId, item.variantId, item.qty, item.price]);
                }

                totalOrders++;
            }
        }
        console.log(`✅ ${totalOrders} orders + items seeded.\n`);

        console.log('🎉 ===== SEED COMPLETE =====');
        console.log(`   Seller:    1`);
        console.log(`   Products:  ${productIds.length}`);
        console.log(`   Variants:  ${variantIds.length}`);
        console.log(`   Customers: ${customerIds.length}`);
        console.log(`   Orders:    ${totalOrders}`);

    } catch (err) {
        console.error('❌ Seed failed:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
