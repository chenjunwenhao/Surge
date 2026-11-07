const { Pool } = require('pg');

const QUERY_TIMEOUT_MS = 60000;

function createPool(config) {
  return new Pool({
    host: config.host,
    port: config.port || 5432,
    user: config.user,
    password: config.password,
    database: config.database || 'postgres',
    max: 10,
    idleTimeoutMillis: 120000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
}

async function endPool(pool) {
  try { await pool.end(); } catch (_) {}
}

async function getConnection(pool) {
  return pool.connect();
}

function releaseConnection(client) {
  client.release();
}

async function ping(client) {
  await client.query('SELECT 1');
}

function getThreadId(client) {
  return client.processID;
}

// pg returns JSONB columns as JS objects natively; serialize them for display consistency
function normalizeRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(row => {
    const out = {};
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (typeof v === 'object' && v !== null && !Buffer.isBuffer(v) && !(v instanceof Date)) {
        out[k] = JSON.stringify(v);
      } else if (Buffer.isBuffer(v)) {
        out[k] = v.toString('hex');
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

function convertParams(params) {
  if (!params || !Array.isArray(params)) return params;
  return params.map((v) => {
    if (v === null || v === undefined) return null;
    return v;
  });
}

async function executeWithTimeout(pool, client, queryFn, sql, params) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(async () => {
      try {
        if (pool && client.processID) {
          await killQuery(pool, client.processID);
        }
      } catch (_) {}
      reject(new Error(`Query timeout after ${QUERY_TIMEOUT_MS}ms`));
    }, QUERY_TIMEOUT_MS)
  );
  return Promise.race([queryFn(sql, params), timeoutPromise]);
}

async function execute(client, sql, params, pool) {
  const converted = convertParams(params);
  const result = await executeWithTimeout(pool, client, client.query.bind(client), sql, converted);
  const rows = result.rows || [];
  const fields = (result.fields || []).map(f => ({ name: f.name, type: f.dataTypeID }));
  return {
    rows: normalizeRows(rows),
    fields,
    affectedRows: result.rowCount || 0,
    insertId: null, // PG doesn't have auto-increment IDs in the same way
    changedRows: result.rowCount || 0,
  };
}

async function query(client, sql, params, pool) {
  return execute(client, sql, params, pool);
}

function isPreparedStatementError(err) {
  return false;
}

async function killQuery(pool, processId) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_cancel_backend($1)', [processId]);
  } finally {
    client.release();
  }
}

function getPoolStatus(pool) {
  return {
    total: pool.totalCount || 0,
    free: pool.idleCount || 0,
    pending: pool.waitingCount || 0,
    max: pool.options?.max || 10,
  };
}

function getCapabilities() {
  return {
    identifier: 'pg',
    defaultPort: 5432,
    defaultUser: 'postgres',
    supportsPrepare: false,
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
