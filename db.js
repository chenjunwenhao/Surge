const mysql = require('mysql2/promise');

const pools = new Map();
const txConnections = new Map(); // sessionId → connection (each tab gets its own MySQL session)
const sessionInstances = new Map(); // sessionId → instanceId (for disconnect cleanup + cancelQuery)
const poolConfigs = new Map();
const runningQueries = new Map(); // sessionId → { connection, threadId }

// Transaction timeout tracking — per session
const TX_WARN_5_MIN = 5 * 60 * 1000;
const TX_WARN_15_MIN = 15 * 60 * 1000;
const TX_AUTO_ROLLBACK = 30 * 60 * 1000;
const txTimers = new Map(); // sessionId → { startedAt, timer, warned5, warned15 }

// Callback for frontend to subscribe to transaction warnings
let txWarningCallback = null;
function onTxWarning(cb) { txWarningCallback = cb; }

function clearTxTimer(sessionId) {
  const t = txTimers.get(sessionId);
  if (t && t.timer) clearTimeout(t.timer);
  txTimers.delete(sessionId);
}

const DEFAULT_INSTANCE = 'default';

function resolveInstanceId(instanceId) {
  return instanceId || DEFAULT_INSTANCE;
}

async function connect(instanceId, config) {
  instanceId = resolveInstanceId(instanceId);
  if (pools.has(instanceId)) {
    try { await pools.get(instanceId).end(); } catch (_) {}
  }
  const pool = mysql.createPool({
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

  // 立即验证连接是否可达（懒连接会导致 connect 成功但后续全部超时）
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
  } catch (e) {
    try { await pool.end(); } catch (_) {}
    throw new Error(`Connection failed: ${e.message}`);
  }

  pools.set(instanceId, pool);
  poolConfigs.set(instanceId, config);
  return pool;
}

async function disconnect(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  if (!pools.has(instanceId)) return;
  // Rollback and release only transaction connections for THIS instance
  for (const [sessionId, conn] of txConnections.entries()) {
    if (sessionInstances.get(sessionId) !== instanceId) continue;
    try {
      await conn.rollback();
      await conn.release();
    } catch (_) {}
    txConnections.delete(sessionId);
    sessionInstances.delete(sessionId);
    clearTxTimer(sessionId);
  }
  try { await pools.get(instanceId).end(); } catch (_) {}
  pools.delete(instanceId);
  poolConfigs.delete(instanceId);
}

function getPool(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const pool = pools.get(instanceId);
  if (!pool) {
    const err = new Error(`No connection for instance ${instanceId}`);
    err.code = 'NO_POOL';
    throw err;
  }
  return pool;
}

function getConfig(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  return poolConfigs.get(instanceId) || {};
}

function getPoolStatus(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const pool = pools.get(instanceId);
  if (!pool) return null;
  const internal = pool.pool || {};
  return {
    instanceId,
    total: internal._allConnections?.length || 0,
    free: internal._freeConnections?.length || 0,
    pending: internal._connectionQueue?.length || 0,
    max: internal.config?.connectionLimit || 10,
    config: poolConfigs.get(instanceId) || {},
  };
}

async function beginTransaction(sessionId, instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const pool = getPool(instanceId);
  if (txConnections.has(sessionId)) throw new Error('Transaction already in progress for this tab');
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  txConnections.set(sessionId, connection);
  sessionInstances.set(sessionId, instanceId);

  // Start timeout tracking
  const startedAt = Date.now();
  const timeoutId = setTimeout(() => {
    autoRollbackTransaction(sessionId, 'Transaction auto-rolled back after 30 minutes idle');
  }, TX_AUTO_ROLLBACK);
  txTimers.set(sessionId, { startedAt, timer: timeoutId, warned5: false, warned15: false });

  return true;
}

async function commit(sessionId) {
  const connection = txConnections.get(sessionId);
  if (!connection) throw new Error('No active transaction');
  clearTxTimer(sessionId);
  await connection.commit();
  await connection.release();
  txConnections.delete(sessionId);
  sessionInstances.delete(sessionId);
  return true;
}

async function rollback(sessionId) {
  const connection = txConnections.get(sessionId);
  if (!connection) throw new Error('No active transaction');
  clearTxTimer(sessionId);
  await connection.rollback();
  await connection.release();
  txConnections.delete(sessionId);
  sessionInstances.delete(sessionId);
  return true;
}

const QUERY_TIMEOUT_MS = 60000; // 60-second query timeout

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

async function autoRollbackTransaction(sessionId, reason) {
  const connection = txConnections.get(sessionId);
  if (!connection) return;
  try {
    await connection.rollback();
    await connection.release();
  } catch (_) {}
  txConnections.delete(sessionId);
  sessionInstances.delete(sessionId);
  clearTxTimer(sessionId);
  if (txWarningCallback) txWarningCallback(sessionId, 'rollback', reason);
}

function getTransactionStatus(sessionId) {
  const conn = txConnections.get(sessionId);
  const timer = txTimers.get(sessionId);
  if (!conn) return { active: false, elapsed: 0 };
  const elapsed = timer ? Date.now() - timer.startedAt : 0;

  // Fire warnings at thresholds (once each)
  if (timer && !timer.warned5 && elapsed >= TX_WARN_5_MIN) {
    timer.warned5 = true;
    if (txWarningCallback) txWarningCallback(sessionId, 'warn', `Transaction running for 5 minutes`);
  }
  if (timer && !timer.warned15 && elapsed >= TX_WARN_15_MIN) {
    timer.warned15 = true;
    if (txWarningCallback) txWarningCallback(sessionId, 'warn', `Transaction running for 15 minutes (auto-rollback at 30 min)`);
  }

  return { active: true, elapsed, autoRollbackAt: TX_AUTO_ROLLBACK };
}

async function execute(instanceId, sql, params, sessionId) {
  instanceId = resolveInstanceId(instanceId);
  if (!sql) throw new Error('SQL is required');

  const doExec = async (conn) => {
    try {
      const [rows, fields] = await conn.execute({ sql, values: params, timeout: QUERY_TIMEOUT_MS });
      return { rows: normalizeRows(rows), fields };
    } catch (e) {
      // Fallback to query() for commands not supported by prepared statement protocol
      // (e.g., USE, SET, FLUSH, CREATE USER, etc.)
      if (e.message && e.message.includes('prepared statement protocol')) {
        const [rows, fields] = await conn.query({ sql, values: params, timeout: QUERY_TIMEOUT_MS });
        return { rows: normalizeRows(rows), fields };
      }
      throw e;
    }
  };

  // If this tab has an active transaction, use its dedicated connection
  if (sessionId && txConnections.has(sessionId)) {
    return await doExec(txConnections.get(sessionId));
  }

  // Get a dedicated connection from pool so we can cancel it by threadId
  const pool = getPool(instanceId);
  const conn = await pool.getConnection();
  if (sessionId) {
    runningQueries.set(sessionId, { connection: conn, threadId: conn.threadId });
  }
  try {
    return await doExec(conn);
  } finally {
    if (sessionId) runningQueries.delete(sessionId);
    conn.release();
  }
}

async function cancelQuery(sessionId) {
  const entry = runningQueries.get(sessionId);
  if (!entry) return false;
  // Use the same instance's pool to kill the query
  const instId = sessionInstances.get(sessionId);
  const pool = instId ? pools.get(instId) : pools.values().next().value;
  if (!pool) return false;
  try {
    const killer = await pool.getConnection();
    try {
      await killer.query(`KILL QUERY ${entry.threadId}`);
    } finally {
      killer.release();
    }
    return true;
  } catch (_) {
    return false;
  }
}

async function shutdownAll() {
  // Rollback all active transactions first
  for (const [sessionId, conn] of txConnections.entries()) {
    try {
      await conn.rollback();
      await conn.release();
    } catch (_) {}
    txConnections.delete(sessionId);
    sessionInstances.delete(sessionId);
    clearTxTimer(sessionId);
  }
  // Close all connection pools
  for (const [id, pool] of pools.entries()) {
    try { await pool.end(); } catch (_) {}
    pools.delete(id);
    poolConfigs.delete(id);
  }
}

module.exports = {
  connect,
  disconnect,
  beginTransaction,
  commit,
  rollback,
  execute,
  cancelQuery,
  getConfig,
  getPoolStatus,
  getTransactionStatus,
  onTxWarning,
  shutdownAll,
};
