const pool = require('../config/db');

const getRevenueTrend = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') AS month,
        DATE_TRUNC('month', created_at) AS month_date,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders_table
      WHERE payment_status = 'PAID'
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month_date ASC
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        target: parseFloat(r.revenue) * 0.9,
      })),
    });
  } catch (err) { next(err); }
};

const getCategorySplit = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT p.category, COALESCE(SUM(oi.total_price), 0) AS revenue
      FROM order_items oi
      JOIN product_variants pv ON pv.variant_id = oi.variant_id
      JOIN products_table p ON p.product_id = pv.product_id
      GROUP BY p.category
      ORDER BY revenue DESC
    `);
    const palette = ['#6C63FF', '#00C9A7', '#FFB347', '#FF6584', '#C77DFF', '#43D9AD'];
    const total = result.rows.reduce((s, r) => s + parseFloat(r.revenue), 0);
    res.json({
      success: true,
      data: result.rows.map((r, i) => ({
        category: r.category,
        value: total > 0 ? +((parseFloat(r.revenue) / total) * 100).toFixed(1) : 0,
        color: palette[i % palette.length],
      })),
    });
  } catch (err) { next(err); }
};

const getTopProducts = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT p.name, COALESCE(SUM(oi.quantity), 0) AS units, COALESCE(SUM(oi.total_price), 0) AS revenue
      FROM order_items oi
      JOIN product_variants pv ON pv.variant_id = oi.variant_id
      JOIN products_table p ON p.product_id = pv.product_id
      GROUP BY p.product_id, p.name
      ORDER BY units DESC
      LIMIT 6
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({
        name: r.name,
        units: parseInt(r.units),
        revenue: parseFloat(r.revenue),
      })),
    });
  } catch (err) { next(err); }
};

const getRecentOrders = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        o.order_id, o.total_amount, o.order_status AS status, o.created_at,
        c.name AS customer,
        (SELECT pv2.variant_name FROM order_items oi2
         JOIN product_variants pv2 ON pv2.variant_id = oi2.variant_id
         WHERE oi2.order_id = o.order_id LIMIT 1) AS product
      FROM orders_table o
      LEFT JOIN customers c ON c.customer_id = o.customer_id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({
        orderId: '#SM' + r.order_id.slice(-6).toUpperCase(),
        customer: r.customer || 'Guest',
        product: r.product || '—',
        amount: parseFloat(r.total_amount),
        status: r.status.charAt(0) + r.status.slice(1).toLowerCase(),
        date: new Date(r.created_at).toISOString(),
      })),
    });
  } catch (err) { next(err); }
};

const getInventoryAlerts = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT pv.variant_id, pv.variant_name AS name, pv.sku, pv.stock_quantity AS stock
      FROM product_variants pv
      WHERE pv.stock_quantity < 15
      ORDER BY pv.stock_quantity ASC
      LIMIT 8
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({
        name: r.name,
        sku: r.sku,
        stock: parseInt(r.stock),
        reorderLevel: 15,
        status: parseInt(r.stock) <= 5 ? 'critical' : 'low',
      })),
    });
  } catch (err) { next(err); }
};

const getOrdersByChannel = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT channel, COUNT(*) AS cnt FROM orders_table GROUP BY channel ORDER BY cnt DESC
    `);
    const palette = ['#6C63FF', '#00C9A7', '#FFB347', '#FF6584'];
    const total = result.rows.reduce((s, r) => s + parseInt(r.cnt), 0);
    res.json({
      success: true,
      data: result.rows.map((r, i) => ({
        channel: r.channel,
        value: total > 0 ? +((parseInt(r.cnt) / total) * 100).toFixed(1) : 0,
        color: palette[i % palette.length],
      })),
    });
  } catch (err) { next(err); }
};

const getCustomerDemographics = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        CASE
          WHEN age BETWEEN 18 AND 24 THEN '18–24'
          WHEN age BETWEEN 25 AND 34 THEN '25–34'
          WHEN age BETWEEN 35 AND 44 THEN '35–44'
          WHEN age BETWEEN 45 AND 54 THEN '45–54'
          ELSE '55+'
        END AS age_group, gender, COUNT(*) AS cnt
      FROM customers
      WHERE age IS NOT NULL AND gender IS NOT NULL
      GROUP BY age_group, gender
      ORDER BY age_group, gender
    `);

    const groups = ['18–24', '25–34', '35–44', '45–54', '55+'];
    const map = {};
    groups.forEach(g => { map[g] = { group: g, male: 0, female: 0 }; });
    result.rows.forEach(r => {
      if (map[r.age_group]) {
        map[r.age_group][r.gender.toLowerCase() === 'male' ? 'male' : 'female'] = parseInt(r.cnt);
      }
    });

    const genderResult = await pool.query(`SELECT gender, COUNT(*) AS cnt FROM customers WHERE gender IS NOT NULL GROUP BY gender`);
    let male = 0, female = 0;
    genderResult.rows.forEach(r => {
      if (r.gender.toLowerCase() === 'male') male = parseInt(r.cnt);
      else female = parseInt(r.cnt);
    });
    const total = male + female || 1;

    res.json({
      success: true,
      data: {
        ageGroups: Object.values(map),
        genderSplit: {
          male: +((male / total) * 100).toFixed(0),
          female: +((female / total) * 100).toFixed(0),
        },
      },
    });
  } catch (err) { next(err); }
};

const getGeoRevenue = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT c.city, COALESCE(SUM(o.total_amount), 0) AS revenue
      FROM orders_table o
      JOIN customers c ON c.customer_id = o.customer_id
      WHERE o.payment_status = 'PAID' AND c.city IS NOT NULL
      GROUP BY c.city ORDER BY revenue DESC LIMIT 6
    `);
    const max = result.rows.length > 0 ? parseFloat(result.rows[0].revenue) : 1;
    res.json({
      success: true,
      data: result.rows.map(r => ({
        city: r.city,
        revenue: parseFloat(r.revenue),
        pct: +((parseFloat(r.revenue) / max) * 100).toFixed(0),
      })),
    });
  } catch (err) { next(err); }
};

const getPaymentMethods = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT payment_method AS method, COUNT(*) AS cnt
      FROM orders_table WHERE payment_method IS NOT NULL
      GROUP BY payment_method ORDER BY cnt DESC
    `);
    const palette = ['#6C63FF', '#00C9A7', '#FFB347', '#FF6584', '#C77DFF'];
    const total = result.rows.reduce((s, r) => s + parseInt(r.cnt), 0);
    res.json({
      success: true,
      data: result.rows.map((r, i) => ({
        method: r.method,
        value: total > 0 ? +((parseInt(r.cnt) / total) * 100).toFixed(1) : 0,
        color: palette[i % palette.length],
      })),
    });
  } catch (err) { next(err); }
};

const getSizeDistribution = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT pv.size, COALESCE(SUM(oi.quantity), 0) AS count
      FROM order_items oi
      JOIN product_variants pv ON pv.variant_id = oi.variant_id
      WHERE pv.size IS NOT NULL
      GROUP BY pv.size ORDER BY pv.size::NUMERIC ASC
    `);
    res.json({
      success: true,
      data: result.rows.map(r => ({ size: r.size, count: parseInt(r.count) })),
    });
  } catch (err) { next(err); }
};

const getOrderStatusBreakdown = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT order_status AS status, COUNT(*) AS cnt FROM orders_table GROUP BY order_status ORDER BY cnt DESC
    `);
    const palette = { DELIVERED: '#00C9A7', SHIPPED: '#6C63FF', CONFIRMED: '#FFB347', PENDING: '#8892A4', CANCELLED: '#FF6584' };
    res.json({
      success: true,
      data: result.rows.map(r => ({
        status: r.status,
        value: parseInt(r.cnt),
        color: palette[r.status] || '#8892A4',
      })),
    });
  } catch (err) { next(err); }
};

module.exports = {
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
};
