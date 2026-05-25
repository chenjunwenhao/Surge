const mysql = require('mysql2/promise');

const pools = new Map();
const txConnections = new Map();
const poolConfigs = new Map();

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
  try { await pools.get(instanceId).end(); } catch (_) {}
  pools.delete(instanceId);
  poolConfigs.delete(instanceId);
  if (txConnections.has(instanceId)) {
    try {
      await txConnections.get(instanceId).rollback();
      await txConnections.get(instanceId).release();
    } catch (_) {}
    txConnections.delete(instanceId);
  }
}

function getPool(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const pool = pools.get(instanceId);
  if (!pool) throw new Error(`No connection for instance ${instanceId}`);
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

async function beginTransaction(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const pool = getPool(instanceId);
  if (txConnections.has(instanceId)) throw new Error('Transaction already in progress');
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  txConnections.set(instanceId, connection);
  return true;
}

async function commit(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const connection = txConnections.get(instanceId);
  if (!connection) throw new Error('No active transaction');
  await connection.commit();
  await connection.release();
  txConnections.delete(instanceId);
  return true;
}

async function rollback(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const connection = txConnections.get(instanceId);
  if (!connection) throw new Error('No active transaction');
  await connection.rollback();
  await connection.release();
  txConnections.delete(instanceId);
  return true;
}

const QUERY_TIMEOUT_MS = 60000; // 60-second query timeout

async function execute(instanceId, sql, params) {
  instanceId = resolveInstanceId(instanceId);
  if (!sql) throw new Error('SQL is required');

  const doExec = async (conn) => {
    try {
      const [rows, fields] = await conn.execute({ sql, values: params, timeout: QUERY_TIMEOUT_MS });
      return { rows, fields };
    } catch (e) {
      // Fallback to query() for commands not supported by prepared statement protocol
      // (e.g., USE, SET, FLUSH, CREATE USER, etc.)
      if (e.message && e.message.includes('prepared statement protocol')) {
        const [rows, fields] = await conn.query({ sql, values: params, timeout: QUERY_TIMEOUT_MS });
        return { rows, fields };
      }
      throw e;
    }
  };

  if (txConnections.has(instanceId)) {
    return await doExec(txConnections.get(instanceId));
  }
  const pool = getPool(instanceId);
  return await doExec(pool);
}

module.exports = {
  connect,
  disconnect,
  beginTransaction,
  commit,
  rollback,
  execute,
  getConfig,
  getPoolStatus,
};
