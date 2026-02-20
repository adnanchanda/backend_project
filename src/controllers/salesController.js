const pool = require('../config/db');

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
        SELECT c.name, c.city, COUNT(o.order_id) AS orders,
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

module.exports = { getSalesSummary };
