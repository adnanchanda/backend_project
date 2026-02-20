const pool = require('../config/db');

const getKpis = async (req, res, next) => {
  try {
    const [revenue, orders, customers, aov, stock, cancelled] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total_amount),0) AS val FROM orders_table WHERE payment_status='PAID'`),
      pool.query(`SELECT COUNT(*) AS val FROM orders_table`),
      pool.query(`SELECT COUNT(*) AS val FROM customers`),
      pool.query(`SELECT COALESCE(AVG(total_amount),0) AS val FROM orders_table WHERE payment_status='PAID'`),
      pool.query(`SELECT COALESCE(SUM(stock_quantity),0) AS val FROM product_variants`),
      pool.query(`SELECT COUNT(*) AS val FROM orders_table WHERE order_status='CANCELLED'`),
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

module.exports = { getKpis };
