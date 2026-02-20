const pool = require('../config/db');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { QueryBuilder } = require('../utils/queryBuilder');

const getFullInventory = async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { search, status, category } = req.query;

    const qb = new QueryBuilder();
    qb.addSearch(['p.name', 'pv.sku'], search);
    qb.addCondition('p.category = $?', category);

    const statusFilter = getStatusFilter(status);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM (
        SELECT pv.variant_id
        FROM product_variants pv
        JOIN products_table p ON p.product_id = pv.product_id
        LEFT JOIN order_items oi ON oi.variant_id = pv.variant_id
        ${qb.whereClause}
        GROUP BY pv.variant_id, p.name, p.category
        ${statusFilter}
      ) sub
    `, [...qb.params]);
    const total = parseInt(countResult.rows[0].count);

    const paginationClause = qb.addPagination(limit, offset);
    const { rows } = await pool.query(`
      SELECT
        pv.variant_id AS id, p.name AS product, p.category, pv.size, pv.sku, pv.price,
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
      ${qb.whereClause}
      GROUP BY pv.variant_id, p.name, p.category
      ${statusFilter}
      ORDER BY pv.stock_quantity ASC
      ${paginationClause}
    `, qb.params);

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) { next(err); }
};

function getStatusFilter(status) {
  if (!status || status === 'All') return '';
  const filters = {
    healthy: 'HAVING pv.stock_quantity >= 30',
    low: 'HAVING pv.stock_quantity >= 10 AND pv.stock_quantity < 30',
    critical: 'HAVING pv.stock_quantity > 0 AND pv.stock_quantity < 10',
    out_of_stock: 'HAVING pv.stock_quantity = 0',
  };
  return filters[status] || '';
}

module.exports = { getFullInventory };
