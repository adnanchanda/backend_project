const pool = require('../config/db');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { QueryBuilder } = require('../utils/queryBuilder');

const getAllProducts = async (req, res, next) => {
  try {
    const { limit, offset, page } = parsePagination(req.query);
    const { search, category, stockLevel, sortBy, sortOrder } = req.query;

    const qb = new QueryBuilder();
    qb.addSearch(['p.name', 'p.description'], search);
    qb.addCondition('p.category = $?', category);

    const baseQuery = `
      FROM products_table p
      LEFT JOIN product_variants pv ON pv.product_id = p.product_id
      LEFT JOIN order_items oi ON oi.variant_id = pv.variant_id
    `;

    const havingClauses = [];
    if (stockLevel === 'out') havingClauses.push('COALESCE(SUM(pv.stock_quantity), 0) = 0');
    else if (stockLevel === 'low') havingClauses.push('COALESCE(SUM(pv.stock_quantity), 0) > 0 AND COALESCE(SUM(pv.stock_quantity), 0) < 20');
    else if (stockLevel === 'in_stock') havingClauses.push('COALESCE(SUM(pv.stock_quantity), 0) >= 20');

    const havingClause = havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : '';

    // Count query uses only WHERE params
    const whereParams = [...qb.params];
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM (
        SELECT p.product_id
        ${baseQuery}
        ${qb.whereClause}
        GROUP BY p.product_id
        ${havingClause}
      ) sub
    `, whereParams);
    const total = parseInt(countResult.rows[0].count);

    const allowedSorts = { name: 'p.name', price: 'p.base_price', totalStock: '"totalStock"', unitsSold: '"unitsSold"', totalRevenue: '"totalRevenue"' };
    const orderCol = allowedSorts[sortBy] || '"totalRevenue"';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // Data query adds LIMIT/OFFSET params
    const paginationClause = qb.addPagination(limit, offset);
    const { rows } = await pool.query(`
      SELECT
        p.product_id AS id, p.name, p.description, p.category, p.base_price AS price,
        COUNT(DISTINCT pv.variant_id) AS "variantCount",
        COALESCE(SUM(pv.stock_quantity), 0) AS "totalStock",
        COALESCE(SUM(oi.quantity), 0) AS "unitsSold",
        COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) AS "totalRevenue",
        CASE WHEN SUM(oi.quantity) > 0
          THEN ROUND(SUM(oi.quantity * oi.price_at_purchase) / SUM(oi.quantity))
          ELSE p.base_price END AS "avgPrice",
        TO_CHAR(p.created_at, 'YYYY-MM-DD') AS "createdAt",
        ARRAY_AGG(DISTINCT pv.size) FILTER (WHERE pv.size IS NOT NULL) AS sizes
      ${baseQuery}
      ${qb.whereClause}
      GROUP BY p.product_id
      ${havingClause}
      ORDER BY ${orderCol} ${orderDir}
      ${paginationClause}
    `, qb.params);

    res.json(paginatedResponse(rows, total, page, limit));
  } catch (err) { next(err); }
};

module.exports = { getAllProducts };
