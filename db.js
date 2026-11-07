const { getDriver } = require('./lib/drivers');
const { getDialect } = require('./lib/dialects');

const pools = new Map();
const instanceDrivers = new Map(); // instanceId → driver module
const instanceDialects = new Map(); // instanceId → dialect module
const txConnections = new Map(); // sessionId → connection (each tab gets its own session)
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

function getDriverForInstance(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  return instanceDrivers.get(instanceId) || getDriver('mysql');
}

function getDialectForInstance(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  return instanceDialects.get(instanceId) || getDialect('mysql');
}

async function connect(instanceId, config) {
  instanceId = resolveInstanceId(instanceId);
  const type = config.type || 'mysql';
  const drv = getDriver(type);
  const dlt = getDialect(type);

  if (pools.has(instanceId)) {
    await drv.endPool(pools.get(instanceId));
  }
  const pool = drv.createPool(config);

  try {
    const conn = await drv.getConnection(pool);
    await drv.ping(conn);
    drv.releaseConnection(conn);
  } catch (e) {
    await drv.endPool(pool);
    throw new Error(`Connection failed: ${e.message}`);
  }

  pools.set(instanceId, pool);
  instanceDrivers.set(instanceId, drv);
  instanceDialects.set(instanceId, dlt);
  poolConfigs.set(instanceId, config);
  return pool;
}

async function disconnect(instanceId) {
  instanceId = resolveInstanceId(instanceId);
  if (!pools.has(instanceId)) return;
  const drv = getDriverForInstance(instanceId);
  for (const [sessionId, conn] of txConnections.entries()) {
    if (sessionInstances.get(sessionId) !== instanceId) continue;
    try {
      await conn.rollback();
      drv.releaseConnection(conn);
    } catch (_) {}
    txConnections.delete(sessionId);
    sessionInstances.delete(sessionId);
    clearTxTimer(sessionId);
  }
  await drv.endPool(pools.get(instanceId));
  pools.delete(instanceId);
  instanceDrivers.delete(instanceId);
instanceDialects.delete(instanceId);
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
  const drv = getDriverForInstance(instanceId);
  return {
    instanceId,
    ...drv.getPoolStatus(pool),
    config: poolConfigs.get(instanceId) || {},
  };
}

async function beginTransaction(sessionId, instanceId) {
  instanceId = resolveInstanceId(instanceId);
  const pool = getPool(instanceId);
  const drv = getDriverForInstance(instanceId);
  if (txConnections.has(sessionId)) throw new Error('Transaction already in progress for this tab');
  const connection = await drv.getConnection(pool);
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
  const instanceId = sessionInstances.get(sessionId);
  const drv = getDriverForInstance(instanceId);
  clearTxTimer(sessionId);
  await connection.commit();
  drv.releaseConnection(connection);
  txConnections.delete(sessionId);
  sessionInstances.delete(sessionId);
  return true;
}

async function rollback(sessionId) {
  const connection = txConnections.get(sessionId);
  if (!connection) throw new Error('No active transaction');
  const instanceId = sessionInstances.get(sessionId);
  const drv = getDriverForInstance(instanceId);
  clearTxTimer(sessionId);
  await connection.rollback();
  drv.releaseConnection(connection);
  txConnections.delete(sessionId);
  sessionInstances.delete(sessionId);
  return true;
}

async function autoRollbackTransaction(sessionId, reason) {
  const connection = txConnections.get(sessionId);
  if (!connection) return;
  const instanceId = sessionInstances.get(sessionId);
  const drv = getDriverForInstance(instanceId);
  try {
    await connection.rollback();
    drv.releaseConnection(connection);
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
  const drv = getDriverForInstance(instanceId);
  const dlt = getDialectForInstance(instanceId);

  // Convert ? placeholders to dialect-specific format (e.g., $1, $2 for PG)
  const convertedSql = params && params.length ? dlt.convertPlaceholders(sql) : sql;

  const doExec = async (conn, pool) => {
    try {
      return await drv.execute(conn, convertedSql, params, pool);
    } catch (e) {
      if (drv.isPreparedStatementError(e)) {
        return await drv.query(conn, convertedSql, params, pool);
      }
      throw e;
    }
  };

  if (sessionId && txConnections.has(sessionId)) {
    return await doExec(txConnections.get(sessionId), null);
  }

  const pool = getPool(instanceId);
  const conn = await drv.getConnection(pool);
  if (sessionId) {
    runningQueries.set(sessionId, { connection: conn, threadId: drv.getThreadId(conn) });
  }
  try {
    return await doExec(conn, pool);
  } finally {
    if (sessionId) runningQueries.delete(sessionId);
    drv.releaseConnection(conn);
  }
}

async function cancelQuery(sessionId) {
  const entry = runningQueries.get(sessionId);
  if (!entry) return false;
  const instId = sessionInstances.get(sessionId);
  const pool = instId ? pools.get(instId) : pools.values().next().value;
  if (!pool) return false;
  const drv = instId ? getDriverForInstance(instId) : getDriverForInstance(DEFAULT_INSTANCE);
  try {
    await drv.killQuery(pool, entry.threadId);
    return true;
  } catch (_) {
    return false;
  }
}

async function shutdownAll() {
  for (const [sessionId, conn] of txConnections.entries()) {
    const instanceId = sessionInstances.get(sessionId);
    const drv = getDriverForInstance(instanceId);
    try {
      await conn.rollback();
      drv.releaseConnection(conn);
    } catch (_) {}
    txConnections.delete(sessionId);
    sessionInstances.delete(sessionId);
    clearTxTimer(sessionId);
  }
  for (const [id, pool] of pools.entries()) {
    const drv = getDriverForInstance(id);
    await drv.endPool(pool);
    pools.delete(id);
    instanceDrivers.delete(id);
    instanceDialects.delete(id);
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
  getDialectForInstance,
  onTxWarning,
  shutdownAll,
};
