/**
 * Dialect factory — returns the dialect module for a given database type.
 *
 * Usage:
 *   const dialect = require('./lib/dialects').getDialect('mysql');
 *   dialect.escapeId('table');   // → `table`
 */

function getDialect(type) {
  switch (type) {
    case 'mysql':
      return require('./mysql-dialect');
    case 'pg':
      return require('./pg-dialect');
    default:
      throw new Error(`Unsupported dialect: ${type}`);
  }
}

module.exports = { getDialect };
