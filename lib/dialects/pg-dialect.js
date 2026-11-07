/**
 * PostgreSQL dialect — all PG-specific SQL generation, identifier quoting,
 * value escaping, keyword lists, and metadata queries live here.
 */

// ── Identifier & Value Quoting ──────────────────────────────────────────────

function escapeId(id) {
  return '"' + String(id).replace(/"/g, '""') + '"';
}

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  const s = String(val);
  return `'${s.replace(/'/g, "''")}'`;
}

// ── SQL Statement Splitting ─────────────────────────────────────────────────

function splitSQL(sql) {
  const stmts = [];
  let cur = '', i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    // Single-quoted strings
    if (ch === "'") {
      cur += ch; i++;
      while (i < sql.length && sql[i] !== "'") { cur += sql[i]; i++; }
      if (i < sql.length) { cur += "'"; i++; }
      continue;
    }
    // Double-quoted identifiers
    if (ch === '"') {
      cur += ch; i++;
      while (i < sql.length && sql[i] !== '"') { cur += sql[i]; i++; }
      if (i < sql.length) { cur += '"'; i++; }
      continue;
    }
    // Dollar-quoted strings ($tag$...$tag$ or $$...$$)
    if (ch === '$') {
      const rest = sql.substring(i);
      const tagMatch = rest.match(/^(\$[a-zA-Z0-9_]*\$)/);
      if (tagMatch) {
        const tag = tagMatch[1];
        cur += tag; i += tag.length;
        const endIdx = sql.indexOf(tag, i);
        if (endIdx !== -1) {
          cur += sql.substring(i, endIdx + tag.length);
          i = endIdx + tag.length;
        } else {
          cur += sql.substring(i);
          i = sql.length;
        }
        continue;
      }
    }
    // Line comments
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') { cur += sql[i]; i++; }
      continue;
    }
    // Block comments
    if (ch === '/' && sql[i + 1] === '*') {
      cur += '/*'; i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) { cur += sql[i]; i++; }
      if (i < sql.length) { cur += '*/'; i += 2; }
      continue;
    }
    // Statement separator
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
  return `SET search_path TO ${escapeId(database)}`;
}

// ── Metadata Queries ────────────────────────────────────────────────────────

function listDatabases() {
  return {
    sql: `SELECT datname AS name FROM pg_database WHERE datistemplate = false ORDER BY datname`,
    params: [],
  };
}

// For PG sidebar: list schemas in the connected database (analogous to MySQL databases in sidebar)
function listSchemas() {
  return {
    sql: `SELECT schema_name AS name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name`,
    params: [],
  };
}

function listTables() {
  return {
    sql: `SELECT
      t.table_name AS "TABLE_NAME",
      t.table_schema AS "TABLE_SCHEMA",
      t.table_type AS "TABLE_TYPE",
      COALESCE(obj_description((t.table_schema || '.' || t.table_name)::regclass), '') AS "TABLE_COMMENT",
      COALESCE(s.n_live_tup, 0) AS "TABLE_ROWS",
      0 AS "AVG_ROW_LENGTH",
      COALESCE(pg_total_relation_size((t.table_schema || '.' || t.table_name)::regclass), 0) AS "DATA_LENGTH",
      NULL AS "CREATE_TIME",
      NULL AS "UPDATE_TIME"
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.schemaname = t.table_schema AND s.relname = t.table_name
    WHERE t.table_schema = $1
    ORDER BY t.table_name`,
    params: ['__schema__'],
  };
}

function listRoutines() {
  return {
    sql: `SELECT
      p.proname AS "ROUTINE_NAME",
      CASE WHEN p.prokind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS "ROUTINE_TYPE",
      pg_get_function_result(p.oid) AS "DTD_IDENTIFIER",
      NULL AS "CREATED",
      NULL AS "LAST_ALTERED"
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY "ROUTINE_TYPE", "ROUTINE_NAME"`,
    params: ['__schema__'],
  };
}

function listTriggers() {
  return {
    sql: `SELECT
      trigger_name AS "TRIGGER_NAME",
      event_manipulation AS "EVENT_MANIPULATION",
      event_object_table AS "EVENT_OBJECT_TABLE",
      action_timing AS "ACTION_TIMING",
      NULL AS "CREATED"
    FROM information_schema.triggers
    WHERE trigger_schema = $1
    ORDER BY trigger_name`,
    params: ['__schema__'],
  };
}

function listColumns() {
  return {
    sql: `SELECT
      column_name AS "COLUMN_NAME",
      udt_name AS "DATA_TYPE",
      is_nullable AS "IS_NULLABLE",
      CASE WHEN c.column_name IN (
        SELECT kcu.column_name FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = c.table_schema AND tc.table_name = c.table_name AND tc.constraint_type = 'PRIMARY KEY'
      ) THEN 'PRI' ELSE '' END AS "COLUMN_KEY",
      column_default AS "COLUMN_DEFAULT",
      CASE WHEN c.is_identity = 'YES' OR c.column_default LIKE 'nextval%' THEN 'auto_increment' ELSE '' END AS "EXTRA",
      COALESCE(col_description((c.table_schema || '.' || c.table_name)::regclass, c.ordinal_position), '') AS "COLUMN_COMMENT",
      character_maximum_length AS "CHARACTER_MAXIMUM_LENGTH",
      numeric_precision AS "NUMERIC_PRECISION",
      numeric_scale AS "NUMERIC_SCALE",
      ordinal_position AS "ORDINAL_POSITION"
    FROM information_schema.columns c
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position`,
    params: ['__schema__', '__table__'],
  };
}

function listTableIndexes(schema, table) {
  return {
    sql: `SELECT
      i.relname AS "Key_name",
      CASE WHEN ix.indisunique THEN '0' ELSE '1' END AS "Non_unique",
      CASE WHEN ix.indisprimary THEN 'PRIMARY' ELSE i.relname END AS "Key_name_detail",
      a.attname AS "Column_name",
      am.amname AS "Index_type",
      cols.ord AS "Seq_in_index"
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = i.relam
    CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS cols(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
    WHERE n.nspname = $1 AND t.relname = $2
    ORDER BY i.relname, cols.ord`,
    params: [schema, table],
  };
}

function listForeignKeys() {
  return {
    sql: `SELECT
      tc.constraint_name AS "CONSTRAINT_NAME",
      kcu.column_name AS "COLUMN_NAME",
      ccu.table_name AS "REFERENCED_TABLE_NAME",
      ccu.column_name AS "REFERENCED_COLUMN_NAME"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1
      AND tc.table_name = $2
    ORDER BY tc.constraint_name`,
    params: ['__schema__', '__table__'],
  };
}

function estimateTableRowCount() {
  return {
    sql: `SELECT
      COALESCE(n_live_tup, 0) AS "TABLE_ROWS",
      0 AS "AVG_ROW_LENGTH",
      COALESCE(pg_total_relation_size((schemaname || '.' || relname)::regclass), 0) AS "DATA_LENGTH"
    FROM pg_stat_user_tables
    WHERE schemaname = $1 AND relname = $2`,
    params: ['__schema__', '__table__'],
  };
}

function listDumpTables() {
  return {
    sql: `SELECT table_name AS "TABLE_NAME" FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
    params: ['__schema__'],
  };
}

// ── DDL Queries ─────────────────────────────────────────────────────────────

function getTableDDL(schema, table) {
  return {
    sql: `SELECT
      'CREATE TABLE ' || quote_ident($1) || '.' || quote_ident($2) || ' (' ||
      string_agg(
        quote_ident(column_name) || ' ' ||
        CASE WHEN character_maximum_length IS NOT NULL
          THEN udt_name || '(' || character_maximum_length || ')'
          ELSE udt_name END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', ' ORDER BY ordinal_position
      ) || ');' AS "Create Table"
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    GROUP BY table_schema, table_name`,
    params: [schema, table],
    extract(rows) {
      return rows?.[0]?.['Create Table'] || '';
    },
  };
}

function getRoutineDDL(schema, name, type) {
  return {
    sql: `SELECT pg_get_functiondef(p.oid) AS "Create Function"
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = $1 AND p.proname = $2`,
    params: [schema, name],
    extract(rows) {
      return rows?.[0]?.['Create Function'] || '';
    },
  };
}

function getTriggerDDL(schema, name) {
  return {
    sql: `SELECT
      'CREATE TRIGGER ' || quote_ident(trigger_name) || ' ' ||
      action_timing || ' ' ||
      event_manipulation || ' ON ' ||
      quote_ident(event_object_schema) || '.' || quote_ident(event_object_table) || ' ' ||
      'FOR EACH ' || action_orientation || ' ' ||
      COALESCE('WHEN (' || action_condition || ') ', '') ||
      'EXECUTE FUNCTION ' || action_statement AS "Trigger Definition"
    FROM information_schema.triggers
    WHERE trigger_schema = $1 AND trigger_name = $2`,
    params: [schema, name],
    extract(rows) {
      return rows?.[0]?.['Trigger Definition'] || '';
    },
  };
}

// ── Dump Helpers ────────────────────────────────────────────────────────────

function getTableDDLForDump(schema, table) {
  return getTableDDL(schema, table);
}

function buildDropTable(schema, table) {
  return `DROP TABLE IF EXISTS ${escapeId(schema)}.${escapeId(table)} CASCADE;`;
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
  'INNER','OUTER','CROSS','FULL','ON','AND','OR','NOT','IN','EXISTS','BETWEEN',
  'LIKE','ILIKE','IS','NULL','AS','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET',
  'UNION','ALL','DISTINCT','CASE','WHEN','THEN','ELSE','END','CREATE',
  'ALTER','DROP','TRUNCATE','TABLE','INDEX','VIEW','FUNCTION','PROCEDURE',
  'TRIGGER','EXPLAIN','ANALYZE','SHOW','SET','BEGIN','COMMIT','ROLLBACK',
  'PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','SERIAL','BIGSERIAL',
  'UNIQUE','CHECK','CASCADE','CONSTRAINT','RETURNING','WITH','RECURSIVE',
  'SCHEMA','DATABASE','SEQUENCE','TYPE','EXTENSION',
];

const FUNCTIONS = [
  'COUNT','SUM','AVG','MAX','MIN','STRING_AGG','ARRAY_AGG','COALESCE','NULLIF',
  'GREATEST','LEAST','CAST','EXTRACT','NOW','CURRENT_DATE','CURRENT_TIME',
  'CURRENT_TIMESTAMP','AGE','DATE_TRUNC','DATE_PART','TO_CHAR','TO_DATE',
  'TO_TIMESTAMP','TO_NUMBER','CONCAT','CONCAT_WS','SUBSTRING','REPLACE',
  'TRIM','UPPER','LOWER','LENGTH','CHAR_LENGTH','ROUND','FLOOR','CEIL',
  'ABS','MOD','RANDOM','GEN_RANDOM_UUID','MD5','SHA256','JSONB_BUILD_OBJECT',
  'JSONB_AGG','JSON_EXTRACT_PATH_TEXT','ROW_NUMBER','RANK','DENSE_RANK',
  'LAG','LEAD','FIRST_VALUE','LAST_VALUE','ST_AsText','ST_Distance',
];

function getKeywords() { return KEYWORDS; }
function getFunctions() { return FUNCTIONS; }

// ── Autocomplete Metadata Queries ───────────────────────────────────────────

function listAutocompleteTables() {
  return {
    sql: `SELECT table_name AS "TABLE_NAME", table_type AS "TABLE_TYPE" FROM information_schema.tables WHERE table_schema = $1`,
    params: ['__schema__'],
  };
}

function listAutocompleteDatabases() {
  return {
    sql: `SELECT datname AS "SCHEMA_NAME" FROM pg_database WHERE datistemplate = false`,
    params: [],
  };
}

// ── Capabilities ────────────────────────────────────────────────────────────

function getCapabilities() {
  return {
    supportsRoutines: true,
    supportsTriggers: true,
    supportsSchemas: true,
    defaultPort: 5432,
    defaultUser: 'postgres',
    identifier: 'pg',
  };
}

// ── Parameter Placeholder Conversion ────────────────────────────────────────

// PostgreSQL uses $1, $2, ... placeholders instead of ?
function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
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
  listSchemas,
};
