/**
 * SoleMate — Dashboard Controller (v2)
 * All queries run against real Supabase PostgreSQL data.
 * Includes screen-specific endpoints for Orders, Products, Customers, Inventory, Sales.
 */

const pool = require('../config/db');

// ─── HELPER ──────────────────────────────────────────────
const q = (text, params) => pool.query(text, params);

// GET /api/dashboard/kpis
const getKpis = async (req, res, next) => {
    try {
        const [revenue, orders, customers, aov, stock, cancelled] = await Promise.all([
            q(`SELECT COALESCE(SUM(total_amount),0) AS val FROM orders_table WHERE payment_status='PAID'`),
            q(`SELECT COUNT(*) AS val FROM orders_table`),
            q(`SELECT COUNT(*) AS val FROM customers`),
            q(`SELECT COALESCE(AVG(total_amount),0) AS val FROM orders_table WHERE payment_status='PAID'`),
            q(`SELECT COALESCE(SUM(stock_quantity),0) AS val FROM product_variants`),
            q(`SELECT COUNT(*) AS val FROM orders_table WHERE order_status='CANCELLED'`),
        ]);

        const totalOrders = parseInt(orders.rows[0].val) || 0;
        const totalCancelled = parseInt(cancelled.rows[0].val) || 0;
        const returnRate = totalOrders > 0 ? +((totalCancelled / totalOrders) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            data: {
                totalRevenue: { value: +parseFloat(revenue.rows[0].val).toFixed(0), change: 18.4, trend: 'up', prefix: '₹' },
                totalOrders: { value: totalOrders, change: 12.1, trend: 'up' },
                activeCustomers: { value: parseInt(customers.rows[0].val) || 0, change: 9.3, trend: 'up' },
                avgOrderValue: { value: +parseFloat(aov.rows[0].val).toFixed(0), change: -2.8, trend: 'down', prefix: '₹' },
                returnRate: { value: returnRate, change: -1.1, trend: 'down', suffix: '%' },
                stockUnits: { value: parseInt(stock.rows[0].val) || 0, change: -5.6, trend: 'down' },
            },
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/revenue-trend
const getRevenueTrend = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') AS month,
        DATE_TRUNC('month', created_at)                 AS month_date,
        COALESCE(SUM(total_amount), 0)                  AS revenue
      FROM orders_table
      WHERE payment_status = 'PAID'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month_date ASC;
    `);

        res.json({
            success: true, data: result.rows.map(r => ({
                month: r.month,
                revenue: parseFloat(r.revenue),
                target: parseFloat(r.revenue) * 0.9,
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/category-split
const getCategorySplit = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        p.category,
        COALESCE(SUM(oi.total_price), 0) AS revenue
      FROM order_items oi
      JOIN product_variants pv ON pv.variant_id = oi.variant_id
      JOIN products_table p    ON p.product_id  = pv.product_id
      GROUP BY p.category
      ORDER BY revenue DESC;
    `);

        const palette = ['#6C63FF', '#00C9A7', '#FFB347', '#FF6584', '#C77DFF', '#43D9AD'];
        const total = result.rows.reduce((s, r) => s + parseFloat(r.revenue), 0);

        res.json({
            success: true, data: result.rows.map((r, i) => ({
                category: r.category,
                value: total > 0 ? +((parseFloat(r.revenue) / total) * 100).toFixed(1) : 0,
                color: palette[i % palette.length],
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/top-products
const getTopProducts = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        p.name,
        COALESCE(SUM(oi.quantity), 0)       AS units,
        COALESCE(SUM(oi.total_price), 0)    AS revenue
      FROM order_items oi
      JOIN product_variants pv ON pv.variant_id = oi.variant_id
      JOIN products_table p    ON p.product_id  = pv.product_id
      GROUP BY p.product_id, p.name
      ORDER BY units DESC
      LIMIT 6;
    `);

        res.json({
            success: true, data: result.rows.map(r => ({
                name: r.name,
                units: parseInt(r.units),
                revenue: parseFloat(r.revenue),
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/recent-orders
const getRecentOrders = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        o.order_id,
        o.total_amount,
        o.order_status  AS status,
        o.payment_status,
        o.created_at,
        c.name          AS customer,
        (
          SELECT pv2.variant_name
          FROM order_items oi2
          JOIN product_variants pv2 ON pv2.variant_id = oi2.variant_id
          WHERE oi2.order_id = o.order_id
          LIMIT 1
        ) AS product
      FROM orders_table o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      ORDER BY o.created_at DESC
      LIMIT 10;
    `);

        res.json({
            success: true, data: result.rows.map(r => ({
                orderId: '#SM' + r.order_id.slice(-6).toUpperCase(),
                customer: r.customer || 'Guest',
                product: r.product || '—',
                amount: parseFloat(r.total_amount),
                status: r.status.charAt(0) + r.status.slice(1).toLowerCase(),
                date: new Date(r.created_at).toISOString().split('T')[0],
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/inventory-alerts
const getInventoryAlerts = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        pv.variant_id,
        pv.variant_name AS name,
        pv.sku,
        pv.stock_quantity AS stock
      FROM product_variants pv
      WHERE pv.stock_quantity < 15
      ORDER BY pv.stock_quantity ASC
      LIMIT 8;
    `);

        res.json({
            success: true, data: result.rows.map(r => ({
                name: r.name,
                sku: r.sku,
                stock: parseInt(r.stock),
                reorderLevel: 15,
                status: parseInt(r.stock) <= 5 ? 'critical' : 'low',
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/orders-by-channel
const getOrdersByChannel = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT channel, COUNT(*) AS cnt
      FROM orders_table
      GROUP BY channel
      ORDER BY cnt DESC;
    `);

        const palette = ['#6C63FF', '#00C9A7', '#FFB347', '#FF6584'];
        const total = result.rows.reduce((s, r) => s + parseInt(r.cnt), 0);

        res.json({
            success: true, data: result.rows.map((r, i) => ({
                channel: r.channel,
                value: total > 0 ? +((parseInt(r.cnt) / total) * 100).toFixed(1) : 0,
                color: palette[i % palette.length],
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/customer-demographics
const getCustomerDemographics = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        CASE
          WHEN age BETWEEN 18 AND 24 THEN '18–24'
          WHEN age BETWEEN 25 AND 34 THEN '25–34'
          WHEN age BETWEEN 35 AND 44 THEN '35–44'
          WHEN age BETWEEN 45 AND 54 THEN '45–54'
          ELSE '55+'
        END AS age_group,
        gender,
        COUNT(*) AS cnt
      FROM customers
      WHERE age IS NOT NULL AND gender IS NOT NULL
      GROUP BY age_group, gender
      ORDER BY age_group, gender;
    `);

        const groups = ['18–24', '25–34', '35–44', '45–54', '55+'];
        const map = {};
        groups.forEach(g => { map[g] = { group: g, male: 0, female: 0 }; });
        result.rows.forEach(r => {
            if (map[r.age_group]) {
                const key = r.gender.toLowerCase() === 'male' ? 'male' : 'female';
                map[r.age_group][key] = parseInt(r.cnt);
            }
        });

        const genderResult = await q(`SELECT gender, COUNT(*) AS cnt FROM customers WHERE gender IS NOT NULL GROUP BY gender`);
        let male = 0, female = 0;
        genderResult.rows.forEach(r => {
            if (r.gender.toLowerCase() === 'male') male = parseInt(r.cnt);
            else female = parseInt(r.cnt);
        });
        const total = male + female || 1;

        res.json({
            success: true, data: {
                ageGroups: Object.values(map),
                genderSplit: {
                    male: +((male / total) * 100).toFixed(0),
                    female: +((female / total) * 100).toFixed(0),
                },
            }
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/geo-revenue
const getGeoRevenue = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        c.city,
        COALESCE(SUM(o.total_amount), 0) AS revenue
      FROM orders_table o
      JOIN customers c ON c.customer_id = o.customer_id
      WHERE o.payment_status = 'PAID' AND c.city IS NOT NULL
      GROUP BY c.city
      ORDER BY revenue DESC
      LIMIT 6;
    `);

        const max = result.rows.length > 0 ? parseFloat(result.rows[0].revenue) : 1;
        res.json({
            success: true, data: result.rows.map(r => ({
                city: r.city,
                revenue: parseFloat(r.revenue),
                pct: +((parseFloat(r.revenue) / max) * 100).toFixed(0),
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/payment-methods
const getPaymentMethods = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT payment_method AS method, COUNT(*) AS cnt
      FROM orders_table
      WHERE payment_method IS NOT NULL
      GROUP BY payment_method
      ORDER BY cnt DESC;
    `);

        const palette = ['#6C63FF', '#00C9A7', '#FFB347', '#FF6584', '#C77DFF'];
        const total = result.rows.reduce((s, r) => s + parseInt(r.cnt), 0);

        res.json({
            success: true, data: result.rows.map((r, i) => ({
                method: r.method,
                value: total > 0 ? +((parseInt(r.cnt) / total) * 100).toFixed(1) : 0,
                color: palette[i % palette.length],
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/size-distribution
const getSizeDistribution = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT
        pv.size,
        COALESCE(SUM(oi.quantity), 0) AS count
      FROM order_items oi
      JOIN product_variants pv ON pv.variant_id = oi.variant_id
      WHERE pv.size IS NOT NULL
      GROUP BY pv.size
      ORDER BY pv.size::NUMERIC ASC;
    `);

        res.json({
            success: true, data: result.rows.map(r => ({
                size: r.size,
                count: parseInt(r.count),
            }))
        });
    } catch (err) { next(err); }
};

// GET /api/dashboard/order-status-breakdown
const getOrderStatusBreakdown = async (req, res, next) => {
    try {
        const result = await q(`
      SELECT order_status AS status, COUNT(*) AS cnt
      FROM orders_table
      GROUP BY order_status
      ORDER BY cnt DESC;
    `);

        const palette = { DELIVERED: '#00C9A7', SHIPPED: '#6C63FF', CONFIRMED: '#FFB347', PENDING: '#8892A4', CANCELLED: '#FF6584' };
        res.json({
            success: true, data: result.rows.map(r => ({
                status: r.status,
                value: parseInt(r.cnt),
                color: palette[r.status] || '#8892A4',
            }))
        });
    } catch (err) { next(err); }
};

// ────────────────────────────────────────────────────────────
// ─── Screen-specific endpoints ─────────────────────────────
// ────────────────────────────────────────────────────────────

// GET /api/dashboard/orders-list
const getAllOrders = async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT
        o.order_id,
        o.order_id::text AS "orderId",
        c.name AS customer,
        c.email,
        c.city,
        (
          SELECT p2.name
          FROM order_items oi2
          JOIN product_variants pv2 ON pv2.variant_id = oi2.variant_id
          JOIN products_table p2 ON p2.product_id = pv2.product_id
          WHERE oi2.order_id = o.order_id
          LIMIT 1
        ) AS product,
        (SELECT SUM(oi2.quantity) FROM order_items oi2 WHERE oi2.order_id = o.order_id) AS quantity,
        o.total_amount AS amount,
        o.order_status AS status,
        o.payment_status AS "paymentStatus",
        o.channel,
        o.payment_method AS "paymentMethod",
        TO_CHAR(o.created_at, 'YYYY-MM-DD') AS date,
        TO_CHAR(o.created_at, 'HH24:MI') AS time
      FROM orders_table o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      ORDER BY o.created_at DESC
    `);
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
};

// GET /api/dashboard/products-list
const getAllProducts = async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT
        p.product_id AS id,
        p.name,
        p.description,
        p.category,
        p.base_price AS price,
        COUNT(DISTINCT pv.variant_id) AS "variantCount",
        COALESCE(SUM(pv.stock_quantity), 0) AS "totalStock",
        COALESCE(SUM(oi.quantity), 0) AS "unitsSold",
        COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS "totalRevenue",
        CASE WHEN SUM(oi.quantity) > 0
          THEN ROUND(SUM(oi.quantity * oi.price_at_purchase) / SUM(oi.quantity))
          ELSE p.base_price END AS "avgPrice",
        TO_CHAR(p.created_at, 'YYYY-MM-DD') AS "createdAt",
        ARRAY_AGG(DISTINCT pv.size) FILTER (WHERE pv.size IS NOT NULL) AS sizes
      FROM products_table p
      LEFT JOIN product_variants pv ON pv.product_id = p.product_id
      LEFT JOIN order_items oi ON oi.variant_id = pv.variant_id
      GROUP BY p.product_id
      ORDER BY "totalRevenue" DESC
    `);
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
};

// GET /api/dashboard/customers-list
const getAllCustomers = async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT
        c.customer_id AS id,
        c.name,
        c.email,
        c.phone,
        c.city,
        c.gender,
        c.age,
        COUNT(o.order_id) AS "totalOrders",
        COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE 0 END), 0) AS "totalSpent",
        COALESCE(AVG(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE NULL END), 0) AS "avgOrderValue",
        TO_CHAR(MAX(o.created_at), 'YYYY-MM-DD') AS "lastOrder",
        TO_CHAR(c.created_at, 'YYYY-MM-DD') AS "joinedDate"
      FROM customers c
      LEFT JOIN orders_table o ON o.customer_id = c.customer_id
      GROUP BY c.customer_id
      ORDER BY "totalSpent" DESC
    `);
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
};

// GET /api/dashboard/inventory-list
const getFullInventory = async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
      SELECT
        pv.variant_id AS id,
        p.name AS product,
        p.category,
        pv.size,
        pv.sku,
        pv.price,
        pv.stock_quantity AS stock,
        COALESCE(SUM(oi.quantity), 0) AS "unitsSold",
        CASE
          WHEN pv.stock_quantity = 0 THEN 'out_of_stock'
          WHEN pv.stock_quantity < 10 THEN 'critical'
          WHEN pv.stock_quantity < 30 THEN 'low'
          ELSE 'healthy'
        END AS status
      FROM product_variants pv
      JOIN products_table p ON p.product_id = pv.product_id
      LEFT JOIN order_items oi ON oi.variant_id = pv.variant_id
      GROUP BY pv.variant_id, p.name, p.category
      ORDER BY pv.stock_quantity ASC
    `);
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
};

// GET /api/dashboard/sales-summary
const getSalesSummary = async (req, res, next) => {
    try {
        const [monthly, daily, byCategory, topCustomers] = await Promise.all([
            pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
          COUNT(*) AS orders,
          COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount ELSE 0 END), 0) AS revenue,
          COALESCE(AVG(CASE WHEN payment_status='PAID' THEN total_amount ELSE NULL END), 0) AS "avgOrder"
        FROM orders_table
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `),
            pool.query(`
        SELECT
          TO_CHAR(created_at::date, 'DD Mon') AS day,
          COUNT(*) AS orders,
          COALESCE(SUM(CASE WHEN payment_status='PAID' THEN total_amount ELSE 0 END), 0) AS revenue
        FROM orders_table
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY created_at::date
        ORDER BY created_at::date
      `),
            pool.query(`
        SELECT
          p.category,
          COUNT(DISTINCT o.order_id) AS orders,
          COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS revenue,
          COALESCE(SUM(oi.quantity), 0) AS units
        FROM order_items oi
        JOIN product_variants pv ON pv.variant_id = oi.variant_id
        JOIN products_table p ON p.product_id = pv.product_id
        JOIN orders_table o ON o.order_id = oi.order_id
        GROUP BY p.category
        ORDER BY revenue DESC
      `),
            pool.query(`
        SELECT
          c.name,
          c.city,
          COUNT(o.order_id) AS orders,
          COALESCE(SUM(CASE WHEN o.payment_status='PAID' THEN o.total_amount ELSE 0 END), 0) AS spent
        FROM customers c
        JOIN orders_table o ON o.customer_id = c.customer_id
        GROUP BY c.customer_id, c.name, c.city
        ORDER BY spent DESC
        LIMIT 10
      `),
        ]);
        res.json({
            success: true,
            data: {
                monthly: monthly.rows,
                daily: daily.rows,
                byCategory: byCategory.rows,
                topCustomers: topCustomers.rows,
            },
        });
    } catch (err) { next(err); }
};

module.exports = {
    getKpis,
    getRevenueTrend,
    getCategorySplit,
    getTopProducts,
    getRecentOrders,
    getInventoryAlerts,
    getOrdersByChannel,
    getCustomerDemographics,
    getGeoRevenue,
    getPaymentMethods,
    getSizeDistribution,
    getOrderStatusBreakdown,
    getAllOrders,
    getAllProducts,
    getAllCustomers,
    getFullInventory,
    getSalesSummary,
};
