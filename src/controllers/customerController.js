const pool = require('../config/db');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { QueryBuilder } = require('../utils/queryBuilder');

const getAllCustomers = async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { search, gender, city, sortBy, sortOrder } = req.query;

    const qb = new QueryBuilder();
    qb.addSearch(['c.name', 'c.email', 'c.city'], search);
    qb.addCondition('c.gender = $?', gender);
    qb.addCondition('c.city = $?', city);

    const whereParams = [...qb.params];
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM customers c ${qb.whereClause}`,
      whereParams
    );
    const total = parseInt(countResult.rows[0].count);

    const allowedSorts = { name: 'c.name', totalOrders: '"totalOrders"', totalSpent: '"totalSpent"', age: 'c.age' };
    const orderCol = allowedSorts[sortBy] || '"totalSpent"';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const paginationClause = qb.addPagination(limit, offset);
    const { rows } = await pool.query(`
      SELECT
        c.customer_id AS id, c.name, c.email, c.phone, c.city, c.gender, c.age,
        COUNT(o.order_id) AS "totalOrders",
        COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE 0 END), 0) AS "totalSpent",
        COALESCE(AVG(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE NULL END), 0) AS "avgOrderValue",
        TO_CHAR(MAX(o.created_at), 'YYYY-MM-DD') AS "lastOrder",
        TO_CHAR(c.created_at, 'YYYY-MM-DD') AS "joinedDate"
      FROM customers c
      LEFT JOIN orders_table o ON o.customer_id = c.customer_id
      ${qb.whereClause}
      GROUP BY c.customer_id
      ORDER BY ${orderCol} ${orderDir}
      ${paginationClause}
    `, qb.params);

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) { next(err); }
};

module.exports = { getAllCustomers };
