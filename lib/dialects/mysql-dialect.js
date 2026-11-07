/**
 * MySQL dialect — all MySQL-specific SQL generation, identifier quoting,
 * value escaping, keyword lists, and metadata queries live here.
 *
 * Future dialects (postgres, sqlite, …) implement the same method set so
 * server.js can stay database-agnostic.
 */

// ── Identifier & Value Quoting ──────────────────────────────────────────────

function escapeId(id) {
  return '`' + String(id).replace(/`/g, '``') + '`';
}

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  const s = String(val);
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// ── SQL Statement Splitting ─────────────────────────────────────────────────

function splitSQL(sql) {
  const stmts = [];
  let cur = '', i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      const q = ch; cur += q; i++;
      while (i < sql.length && sql[i] !== q) {
        if (sql[i] === '\\') { cur += sql[i]; i++; }
        cur += sql[i] || ''; i++;
      }
      if (i < sql.length) { cur += q; i++; }
      continue;
    }
    if (ch === '`') {
      cur += '`'; i++;
      while (i < sql.length && sql[i] !== '`') { cur += sql[i]; i++; }
      if (i < sql.length) { cur += '`'; i++; }
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') { cur += sql[i]; i++; }
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      cur += '/*'; i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) { cur += sql[i]; i++; }
      if (i < sql.length) { cur += '*/'; i += 2; }
      continue;
    }
    if (ch === ';') {
      const s = cur.trim();
      if (s) stmts.push(s);
      cur = ''; i++;
      continue;
    }
    cur += ch; i++;
  }
  const s = cur.trim();
  if (s) stmts.push(s);
  return stmts;
}

// ── Database Context ────────────────────────────────────────────────────────

function buildUseStatement(database) {
  return `USE ${escapeId(database)}`;
}

// ── Metadata Queries ────────────────────────────────────────────────────────

function listDatabases() {
  return {
    sql: `SELECT SCHEMA_NAME AS name FROM information_schema.schemata WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys') ORDER BY SCHEMA_NAME`,
    params: [],
  };
}

function listTables() {
  return {
    sql: `SELECT TABLE_NAME, TABLE_SCHEMA, TABLE_TYPE, TABLE_COMMENT, TABLE_ROWS, AVG_ROW_LENGTH, DATA_LENGTH, CREATE_TIME, UPDATE_TIME FROM information_schema.tables WHERE table_schema = ? ORDER BY TABLE_NAME`,
    params: ['__schema__'],
  };
}

function listRoutines() {
  return {
    sql: `SELECT ROUTINE_NAME, ROUTINE_TYPE, DTD_IDENTIFIER, CREATED, LAST_ALTERED FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? ORDER BY ROUTINE_TYPE, ROUTINE_NAME`,
    params: ['__schema__'],
  };
}

function listTriggers() {
  return {
    sql: `SELECT TRIGGER_NAME, EVENT_MANIPULATION, EVENT_OBJECT_TABLE, ACTION_TIMING, CREATED FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? ORDER BY TRIGGER_NAME`,
    params: ['__schema__'],
  };
}

function listColumns() {
  return {
    sql: `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, ORDINAL_POSITION FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION`,
    params: ['__schema__', '__table__'],
  };
}

function listTableIndexes(schema, table) {
  return {
    sql: `SHOW INDEX FROM ${escapeId(schema)}.${escapeId(table)}`,
    params: [],
  };
}

function listForeignKeys() {
  return {
    sql: `SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION`,
    params: ['__schema__', '__table__'],
  };
}

function estimateTableRowCount() {
  return {
    sql: `SELECT TABLE_ROWS, AVG_ROW_LENGTH, DATA_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    params: ['__schema__', '__table__'],
  };
}

function listDumpTables() {
  return {
    sql: `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    params: ['__schema__'],
  };
}

// ── DDL Queries ─────────────────────────────────────────────────────────────

function getTableDDL(schema, table) {
  return {
    sql: `SHOW CREATE TABLE ${escapeId(schema)}.${escapeId(table)}`,
    params: [],
    extract(rows) {
      return rows?.[0]?.['Create Table'] || rows?.[0]?.['Create View'] || '';
    },
  };
}

function getRoutineDDL(schema, name, type) {
  const isFunction = type === 'FUNCTION';
  return {
    sql: isFunction
      ? `SHOW CREATE FUNCTION ${escapeId(schema)}.${escapeId(name)}`
      : `SHOW CREATE PROCEDURE ${escapeId(schema)}.${escapeId(name)}`,
    params: [],
    extract(rows) {
      const key = isFunction ? 'Create Function' : 'Create Procedure';
      return rows?.[0]?.[key] || '';
    },
  };
}

function getTriggerDDL(schema, name) {
  return {
    sql: `SHOW CREATE TRIGGER ${escapeId(schema)}.${escapeId(name)}`,
    params: [],
    extract(rows) {
      return rows?.[0]?.['SQL Original Statement'] || '';
    },
  };
}

// ── Dump Helpers ────────────────────────────────────────────────────────────

function getTableDDLForDump(schema, table) {
  return {
    sql: `SHOW CREATE TABLE ${escapeId(schema)}.${escapeId(table)}`,
    params: [],
    extract(rows) {
      return rows?.[0]?.['Create Table'] || '';
    },
  };
}

function buildDropTable(schema, table) {
  return `DROP TABLE IF EXISTS ${escapeId(schema)}.${escapeId(table)};`;
}

function buildDumpSelect(schema, table, limit) {
  const fullTable = `${escapeId(schema)}.${escapeId(table)}`;
  return limit > 0
    ? `SELECT * FROM ${fullTable} LIMIT ${limit}`
    : `SELECT * FROM ${fullTable}`;
}

function buildDumpInsert(schema, table, fieldNames, rowsBatch) {
  const fullTable = `${escapeId(schema)}.${escapeId(table)}`;
  const colList = fieldNames.map(c => escapeId(c)).join(', ');
  const values = rowsBatch.map(row =>
    '(' + fieldNames.map(c => escapeSqlVal(row[c])).join(', ') + ')'
  ).join(',\n');
  return `INSERT INTO ${fullTable} (${colList})\nVALUES\n${values};`;
}

// ── Autocomplete Keywords & Functions ───────────────────────────────────────

const KEYWORDS = [
  'SELECT','INSERT','UPDATE','DELETE','FROM','WHERE','JOIN','LEFT','RIGHT',
  'INNER','OUTER','CROSS','ON','AND','OR','NOT','IN','EXISTS','BETWEEN',
  'LIKE','IS','NULL','AS','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET',
  'UNION','ALL','DISTINCT','CASE','WHEN','THEN','ELSE','END','CREATE',
  'ALTER','DROP','TRUNCATE','TABLE','INDEX','VIEW','PROCEDURE','FUNCTION',
  'TRIGGER','EXPLAIN','DESC','SHOW','USE','SET','BEGIN','COMMIT','ROLLBACK',
  'PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','AUTO_INCREMENT','UNIQUE',
  'CHECK','CASCADE',
];

const FUNCTIONS = [
  'COUNT','SUM','AVG','MAX','MIN','GROUP_CONCAT','COALESCE','IFNULL',
  'NULLIF','IF','CAST','CONVERT','DATE_FORMAT','NOW','CURDATE','CURTIME',
  'UNIX_TIMESTAMP','FROM_UNIXTIME','DATEDIFF','TIMESTAMPDIFF','CONCAT',
  'SUBSTRING','REPLACE','TRIM','UPPER','LOWER','LENGTH','ROUND','FLOOR',
  'CEIL','ABS','MOD','RAND','UUID','MD5','SHA1','JSON_EXTRACT','JSON_UNQUOTE',
];

function getKeywords() { return KEYWORDS; }
function getFunctions() { return FUNCTIONS; }

// ── Autocomplete Metadata Queries ───────────────────────────────────────────

function listAutocompleteTables() {
  return {
    sql: 'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.tables WHERE table_schema = ?',
    params: ['__schema__'],
  };
}

function listAutocompleteDatabases() {
  return {
    sql: `SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')`,
    params: [],
  };
}

// ── Capabilities ────────────────────────────────────────────────────────────

function getCapabilities() {
  return {
    supportsRoutines: true,
    supportsTriggers: true,
    supportsSchemas: false,
    defaultPort: 3306,
    defaultUser: 'root',
    identifier: 'mysql',
  };
}

// ── Parameter Placeholder Conversion ────────────────────────────────────────

// MySQL uses ? placeholders — no conversion needed
function convertPlaceholders(sql) {
  return sql;
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  escapeId,
  escapeSqlVal,
  splitSQL,
  buildUseStatement,
  listDatabases,
  listTables,
  listRoutines,
  listTriggers,
  listColumns,
  listTableIndexes,
  listForeignKeys,
  estimateTableRowCount,
  listDumpTables,
  getTableDDL,
  getRoutineDDL,
  getTriggerDDL,
  getTableDDLForDump,
  buildDropTable,
  buildDumpSelect,
  buildDumpInsert,
  getKeywords,
  getFunctions,
  listAutocompleteTables,
  listAutocompleteDatabases,
  getCapabilities,
  convertPlaceholders,
};
