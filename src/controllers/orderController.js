const pool = require('../config/db');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { QueryBuilder } = require('../utils/queryBuilder');

const getAllOrders = async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { search, status, channel } = req.query;

    const qb = new QueryBuilder();
    qb.addSearch(['c.name', 'o.order_id::text'], search);
    qb.addCondition('o.order_status = $?', status);
    qb.addCondition('o.channel = $?', channel);

    const whereParams = [...qb.params];
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM orders_table o LEFT JOIN customers c ON c.customer_id = o.customer_id ${qb.whereClause}`,
      whereParams
    );
    const total = parseInt(countResult.rows[0].count);

    const paginationClause = qb.addPagination(limit, offset);
    const { rows } = await pool.query(`
      SELECT
        o.order_id,
        o.order_id::text AS "orderId",
        c.name AS customer,
        c.email,
        c.city,
        (SELECT p2.name FROM order_items oi2
         JOIN product_variants pv2 ON pv2.variant_id = oi2.variant_id
         JOIN products_table p2 ON p2.product_id = pv2.product_id
         WHERE oi2.order_id = o.order_id LIMIT 1) AS product,
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
      ${qb.whereClause}
      ORDER BY o.created_at DESC
      ${paginationClause}
    `, qb.params);

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) { next(err); }
};

module.exports = { getAllOrders };
