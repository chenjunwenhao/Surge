const mysql = require('mysql2/promise');

const QUERY_TIMEOUT_MS = 60000;

function createPool(config) {
  return mysql.createPool({
    host: config.host,
    port: config.port || 3306,
    user: config.user,
    password: config.password,
    database: config.database || undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    acquireTimeout: 15000,
    connectTimeout: 10000,
    idleTimeout: 120000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    dateStrings: true,
  });
}

async function endPool(pool) {
  try { await pool.end(); } catch (_) {}
}

async function getConnection(pool) {
  return pool.getConnection();
}

function releaseConnection(conn) {
  conn.release();
}

async function ping(conn) {
  await conn.ping();
}

function getThreadId(conn) {
  return conn.threadId;
}

// mysql2 parses JSON columns into JS objects; serialize them back to JSON text
// so downstream display/export layers don't render [object Object].
// Buffers (BLOB) and ResultSetHeader (DML, not an Array) are left untouched.
function normalizeRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(row => {
    const out = {};
    for (const k of Object.keys(row)) {
      const v = row[k];
      out[k] = (typeof v === 'object' && v !== null && !Buffer.isBuffer(v)) ? JSON.stringify(v) : v;
    }
    return out;
  });
}

async function execute(conn, sql, params, pool) {
  const [rows, fields] = await conn.execute({ sql, values: params, timeout: QUERY_TIMEOUT_MS });
  const normalizedRows = normalizeRows(rows);
  // For DML, rows is ResultSetHeader with affectedRows/insertId; for SELECT, it's an array
  const isDML = !Array.isArray(rows);
  return {
    rows: normalizedRows,
    fields,
    affectedRows: isDML ? (rows.affectedRows || 0) : 0,
    insertId: isDML ? (rows.insertId || null) : null,
    changedRows: isDML ? (rows.changedRows || 0) : 0,
  };
}

async function query(conn, sql, params, pool) {
  const [rows, fields] = await conn.query({ sql, values: params, timeout: QUERY_TIMEOUT_MS });
  return { rows: normalizeRows(rows), fields };
}

function isPreparedStatementError(err) {
  return err.message && err.message.includes('prepared statement protocol');
}

async function killQuery(pool, threadId) {
  const killer = await pool.getConnection();
  try {
    await killer.query(`KILL QUERY ${threadId}`);
  } finally {
    killer.release();
  }
}

function getPoolStatus(pool) {
  const internal = pool.pool || {};
  return {
    total: internal._allConnections?.length || 0,
    free: internal._freeConnections?.length || 0,
    pending: internal._connectionQueue?.length || 0,
    max: internal.config?.connectionLimit || 10,
  };
}

function getCapabilities() {
  return {
    identifier: 'mysql',
    defaultPort: 3306,
    defaultUser: 'root',
    supportsPrepare: true,
    supportsKillQuery: true,
  };
}

module.exports = {
  createPool,
  endPool,
  getConnection,
  releaseConnection,
  ping,
  getThreadId,
  normalizeRows,
  execute,
  query,
  isPreparedStatementError,
  killQuery,
  getPoolStatus,
  getCapabilities,
};
