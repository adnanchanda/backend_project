class QueryBuilder {
  constructor() {
    this.conditions = [];
    this.params = [];
    this.paramIndex = 1;
  }

  addCondition(sql, value) {
    if (value !== undefined && value !== null && value !== '' && value !== 'All') {
      this.conditions.push(sql.replace(/\$\?/g, `$${this.paramIndex}`));
      this.params.push(value);
      this.paramIndex++;
    }
    return this;
  }

  addSearch(columns, value) {
    if (value && value.trim()) {
      const paramRef = `$${this.paramIndex}`;
      const sql = columns.map((col) => `${col} ILIKE ${paramRef}`).join(' OR ');
      this.conditions.push(`(${sql})`);
      this.params.push(`%${value.trim()}%`);
      this.paramIndex++;
    }
    return this;
  }

  get whereClause() {
    return this.conditions.length > 0 ? `WHERE ${this.conditions.join(' AND ')}` : '';
  }

  addPagination(limit, offset) {
    const limitParam = `$${this.paramIndex}`;
    this.params.push(limit);
    this.paramIndex++;
    const offsetParam = `$${this.paramIndex}`;
    this.params.push(offset);
    this.paramIndex++;
    return `LIMIT ${limitParam} OFFSET ${offsetParam}`;
  }
}

module.exports = { QueryBuilder };
