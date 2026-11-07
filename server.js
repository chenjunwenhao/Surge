const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');
const db = require('./db');
const { getDialect } = require('./lib/dialects');

function dialectFor(instanceId) {
  return db.getDialectForInstance(instanceId);
}

// Determine data directory: Electron uses userData, standalone uses __dirname
function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  try {
    if (process.type === 'browser') {
      const { app } = require('electron');
      const dir = path.join(app.getPath('userData'), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    }
  } catch (_) {}
  return __dirname;
}
const DATA_DIR = getDataDir();
console.log('[server] data dir:', DATA_DIR);

const app = express();
// Restrict CORS to localhost origins (desktop tool)
app.use(cors({ origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
app.use(bodyParser.json({ limit: '50mb' }));

const connectionsFile = path.join(DATA_DIR, 'connections.json');
const KEY_FILE = path.join(DATA_DIR, '.encryption-key');
const ALGORITHM = 'aes-256-gcm';
const ENC_MARKER = 'ENC:';

function getEncryptionKey() {
  try {
    if (fs.existsSync(KEY_FILE)) {
      return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
    return key;
  } catch (e) {
    console.error('Encryption key error:', e.message);
    // Fallback: derive key from machine-specific path (less secure but works)
    return crypto.createHash('sha256').update(__dirname + '-mysql-cli-salt').digest();
  }
}

function encrypt(text) {
  if (!text) return text;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return ENC_MARKER + iv.toString('hex') + ':' + authTag + ':' + encrypted;
  } catch (e) {
    console.error('Encryption error:', e.message);
    return text; // fallback: keep plaintext
  }
}

function decrypt(text) {
  if (!text || !text.startsWith(ENC_MARKER)) return text;
  try {
    const key = getEncryptionKey();
    const payload = text.slice(ENC_MARKER.length);
    const parts = payload.split(':');
    if (parts.length < 3) return text;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts.slice(2).join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    console.error('Decryption error:', e.message);
    return text; // fallback: return as-is
  }
}

function loadSavedConnections() {
  try {
    if (!fs.existsSync(connectionsFile)) {
      fs.writeFileSync(connectionsFile, JSON.stringify([], null, 2));
      return [];
    }
    const raw = fs.readFileSync(connectionsFile, 'utf8');
    const connections = JSON.parse(raw || '[]');
    // Decrypt passwords on load
    return connections.map(c => ({
      ...c,
      password: decrypt(c.password || ''),
    }));
  } catch (err) {
    console.error('Load connections failed', err);
    return [];
  }
}

function saveConnections(connections) {
  // Encrypt passwords before persisting
  const safe = connections.map(c => ({
    ...c,
    password: encrypt(c.password || ''),
  }));
  // Atomic write: write to temp file then rename
  const tmpFile = connectionsFile + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(safe, null, 2));
  fs.renameSync(tmpFile, connectionsFile);
}

function findConnection(id) {
  return loadSavedConnections().find((item) => item.id === id);
}

const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  app.use(express.static(publicPath));
}

function resolveInstanceId(req) {
  return req.body.instanceId || req.query.instanceId || 'default';
}

function resolveDatabase(req, instanceId) {
  const configured = db.getConfig(instanceId);
  return req.query.database || configured.database;
}

app.get('/api/connections', (req, res) => {
  try {
    const connections = loadSavedConnections();
    res.json({ ok: true, connections });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/connections', (req, res) => {
  try {
    const { id, name, host, port, user, password, database, type } = req.body;
    if (!name || !host || !user || !database) {
      return res.status(400).json({ ok: false, error: 'name, host, user, database required' });
    }
    const dbType = type || 'mysql';
    const dbDialect = getDialect(dbType);
    const connections = loadSavedConnections();
    const connection = {
      id: id || `${name}-${Date.now()}`,
      name,
      host,
      port: port || dbDialect.getCapabilities().defaultPort,
      user,
      password,
      database,
      type: dbType,
    };
    const index = connections.findIndex((item) => item.id === connection.id || item.name === name);
    if (index >= 0) {
      connections[index] = connection;
    } else {
      connections.push(connection);
    }
    saveConnections(connections);
    res.json({ ok: true, connection });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/connections/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { name, host, port, user, password, database, type } = req.body;
    if (!name || !host || !user) {
      return res.status(400).json({ ok: false, error: 'name, host, user required' });
    }
    let connections = loadSavedConnections();
    const index = connections.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ ok: false, error: 'Connection not found' });
    }
    const dbType = type || connections[index].type || 'mysql';
    const dbDialect = getDialect(dbType);
    connections[index] = {
      ...connections[index],
      name,
      host,
      port: port || dbDialect.getCapabilities().defaultPort,
      user,
      password: password || '',
      database: database || '',
      type: dbType,
    };
    saveConnections(connections);
    res.json({ ok: true, connection: connections[index] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/connections/:id', (req, res) => {
  try {
    const id = req.params.id;
    let connections = loadSavedConnections();
    connections = connections.filter((item) => item.id !== id);
    saveConnections(connections);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/connect', async (req, res) => {
  try {
    const { instanceId = `default`, save = false, name, ...cfg } = req.body;
    const dbType = cfg.type || 'mysql';
    const dbDialect = getDialect(dbType);
    await db.connect(instanceId, cfg);
    if (save) {
      const connection = {
        id: instanceId,
        name: name || cfg.database || instanceId,
        host: cfg.host,
        port: cfg.port || dbDialect.getCapabilities().defaultPort,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        type: dbType,
      };
      const connections = loadSavedConnections();
      const index = connections.findIndex((item) => item.id === connection.id || item.name === connection.name);
      if (index >= 0) {
        connections[index] = connection;
      } else {
        connections.push(connection);
      }
      saveConnections(connections);
    }
    res.json({ ok: true, instanceId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/test-connection', async (req, res) => {
  try {
    const cfg = req.body;
    const dbType = cfg.type || 'mysql';
    const { getDriver } = require('./lib/drivers');
    const drv = getDriver(dbType);
    const pool = drv.createPool({
      host: cfg.host,
      port: cfg.port || drv.getCapabilities().defaultPort,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database || undefined,
    });
    const conn = await drv.getConnection(pool);
    await drv.ping(conn);
    drv.releaseConnection(conn);
    await drv.endPool(pool);
    res.json({ ok: true, message: 'Connection successful' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/databases', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const d = dialectFor(instanceId);
    // For PG, show schemas instead of databases in the sidebar
    const query = d.listSchemas ? d.listSchemas() : d.listDatabases();
    const result = await db.execute(instanceId, query.sql, query.params);
    res.json({ ok: true, databases: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/tables', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    if (!schema) return res.status(400).json({ error: 'database required' });
    const d = dialectFor(instanceId);
    const { sql } = d.listTables();
    const result = await db.execute(instanceId, sql, [schema]);
    res.json({ ok: true, tables: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Stored procedures & functions
app.get('/api/routines', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    if (!schema) return res.status(400).json({ error: 'database required' });
    const d = dialectFor(instanceId);
    const { sql } = d.listRoutines();
    const result = await db.execute(instanceId, sql, [schema]);
    res.json({ ok: true, routines: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Triggers
app.get('/api/triggers', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    if (!schema) return res.status(400).json({ error: 'database required' });
    const d = dialectFor(instanceId);
    const { sql } = d.listTriggers();
    const result = await db.execute(instanceId, sql, [schema]);
    res.json({ ok: true, triggers: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Routine / Trigger DDL
app.get('/api/routine-ddl', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    const { name, type } = req.query;
    if (!name || !schema) return res.status(400).json({ error: 'name and database required' });
    const d = dialectFor(instanceId);
    const { sql, params, extract } = d.getRoutineDDL(schema, name, type);
    const result = await db.execute(instanceId, sql, params || []);
    const ddl = extract(result.rows);
    res.json({ ok: true, ddl, type: type || 'PROCEDURE' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/trigger-ddl', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    const { name } = req.query;
    if (!name || !schema) return res.status(400).json({ error: 'name and database required' });
    const d = dialectFor(instanceId);
    const { sql, params, extract } = d.getTriggerDDL(schema, name);
    const result = await db.execute(instanceId, sql, params || []);
    const ddl = extract(result.rows);
    res.json({ ok: true, ddl });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/table-ddl', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    const table = req.query.table;
    if (!table || !schema) return res.status(400).json({ error: 'table and database required' });
    const d = dialectFor(instanceId);
    const { sql, params, extract } = d.getTableDDL(schema, table);
    const result = await db.execute(instanceId, sql, params || []);
    const ddl = extract(result.rows);
    res.json({ ok: true, ddl });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/table-estimate', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    const table = req.query.table;
    if (!table || !schema) return res.status(400).json({ error: 'table and database required' });
    const d = dialectFor(instanceId);
    const { sql } = d.estimateTableRowCount();
    const result = await db.execute(instanceId, sql, [schema, table]);
    const row = result.rows?.[0] || {};
    const rowCount = row.TABLE_ROWS ?? 0;
    const avgRowLen = row.AVG_ROW_LENGTH ?? 100;
    const dataLen = row.DATA_LENGTH ?? 0;
    const estimatedDumpSize = dataLen > 0 ? Math.round(dataLen * 1.5) : rowCount * avgRowLen * 1.5;
    res.json({ ok: true, rowCount, dataLength: dataLen, estimatedDumpSize });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/table-indexes', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    const table = req.query.table;
    if (!table || !schema) return res.status(400).json({ error: 'table and database required' });
    const d = dialectFor(instanceId);
    const { sql, params } = d.listTableIndexes(schema, table);
    const result = await db.execute(instanceId, sql, params);
    res.json({ ok: true, indexes: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/table-fks', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = resolveDatabase(req, instanceId);
    const table = req.query.table;
    if (!table || !schema) return res.status(400).json({ error: 'table and database required' });
    const d = dialectFor(instanceId);
    const { sql } = d.listForeignKeys();
    const result = await db.execute(instanceId, sql, [schema, table]);
    res.json({ ok: true, foreignKeys: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/columns', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const table = req.query.table;
    const schema = resolveDatabase(req, instanceId);
    if (!table || !schema) return res.status(400).json({ error: 'table and database required' });
    const d = dialectFor(instanceId);
    const { sql } = d.listColumns();
    const result = await db.execute(instanceId, sql, [schema, table]);
    res.json({ ok: true, columns: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/query', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const sessionId = req.body.sessionId || '';
    const sql = req.body.sql;
    if (!sql) return res.status(400).json({ error: 'sql required' });
    const result = await db.execute(instanceId, sql, undefined, sessionId);
    res.json({ ok: true, rows: result.rows, fields: result.fields });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/query-batch', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const sessionId = req.body.sessionId || '';
    const database = req.body.database || '';
    const d = dialectFor(instanceId);
    const statements = d.splitSQL(req.body.sql || '');
    if (!statements.length) return res.status(400).json({ error: 'no SQL found' });
    if (database) statements.unshift(d.buildUseStatement(database));
    const results = [];
    for (const sql of statements) {
      try {
        const start = Date.now();
        const result = await db.execute(instanceId, sql, undefined, sessionId);
        const elapsed = Date.now() - start;
        // mysql2 returns ResultSetHeader for DML/DDL (affectedRows etc.), RowDataPacket[] for SELECT
        const isSelect = Array.isArray(result.rows);
        results.push({
          ok: true,
          sql,
          rows: isSelect ? result.rows : [],
          fields: result.fields || [],
          affectedRows: isSelect ? undefined : (result.affectedRows ?? 0),
          changedRows: isSelect ? undefined : (result.changedRows ?? 0),
          elapsed,
          isSelect,
        });
      } catch (err) {
        results.push({ ok: false, sql, error: err.message });
        break;
      }
    }
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/pool-status', (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const status = db.getPoolStatus(instanceId);
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/disconnect', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    await db.disconnect(instanceId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/explain', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const sql = req.query.sql;
    if (!sql) return res.status(400).json({ error: 'sql required' });
    const result = await db.execute(instanceId, 'EXPLAIN ' + sql);
    res.json({ ok: true, explain: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/transaction', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const sessionId = req.body.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const action = req.body.action;
    if (!action) return res.status(400).json({ error: 'action required' });
    if (action === 'begin') {
      await db.beginTransaction(sessionId, instanceId);
      return res.json({ ok: true });
    } else if (action === 'commit') {
      await db.commit(sessionId);
      return res.json({ ok: true });
    } else if (action === 'rollback') {
      await db.rollback(sessionId);
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Transaction status — polled by frontend for timeout warnings
app.get('/api/transaction-status', (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const status = db.getTransactionStatus(sessionId);
    res.json({ ok: true, ...status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/edit', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const d = dialectFor(instanceId);
    const { database, table, pk, updates } = req.body;
    if (!table || !pk || !updates) return res.status(400).json({ error: 'table, pk, updates required' });
    const whereKeys = Object.keys(pk);
    if (!whereKeys.length) return res.status(400).json({ error: 'primary key required' });
    const whereClauses = whereKeys.map((k) => `${d.escapeId(k)} = ?`).join(' AND ');
    const whereValues = whereKeys.map((k) => pk[k]);
    const setKeys = Object.keys(updates);
    if (!setKeys.length) return res.status(400).json({ error: 'no columns to update' });
    const setClauses = setKeys.map((k) => `${d.escapeId(k)} = ?`).join(', ');
    const setValues = setKeys.map((k) => updates[k]);
    const fullTable = database ? `${d.escapeId(database)}.${d.escapeId(table)}` : d.escapeId(table);
    const sql = `UPDATE ${fullTable} SET ${setClauses} WHERE ${whereClauses}`;
    const params = [...setValues, ...whereValues];
    const result = await db.execute(instanceId, sql, params);
    res.json({ ok: true, affectedRows: result.affectedRows || 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// INSERT a single row into a table
app.post('/api/insert', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const d = dialectFor(instanceId);
    const { database, table, row } = req.body;
    if (!table || !row) return res.status(400).json({ error: 'table, row required' });
    const keys = Object.keys(row);
    if (!keys.length) return res.status(400).json({ error: 'row has no columns' });
    const cols = keys.map(k => d.escapeId(k)).join(', ');
    const pholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => row[k]);
    const fullTable = database ? `${d.escapeId(database)}.${d.escapeId(table)}` : d.escapeId(table);
    const sql = `INSERT INTO ${fullTable} (${cols}) VALUES (${pholders})`;
    const result = await db.execute(instanceId, sql, values);
    res.json({ ok: true, affectedRows: result.affectedRows || 0, insertId: result.insertId || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// DELETE a single row by primary key
app.post('/api/delete', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const d = dialectFor(instanceId);
    const { database, table, pk } = req.body;
    if (!table || !pk || !Object.keys(pk).length) return res.status(400).json({ error: 'table, pk required' });
    const whereKeys = Object.keys(pk);
    const whereClauses = whereKeys.map((k) => `${d.escapeId(k)} = ?`).join(' AND ');
    const whereValues = whereKeys.map((k) => pk[k]);
    const fullTable = database ? `${d.escapeId(database)}.${d.escapeId(table)}` : d.escapeId(table);
    const sql = `DELETE FROM ${fullTable} WHERE ${whereClauses}`;
    const result = await db.execute(instanceId, sql, whereValues);
    res.json({ ok: true, affectedRows: result.affectedRows || 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/autocomplete', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = req.query.database || resolveDatabase(req, instanceId);
    const d = dialectFor(instanceId);
    const keywords = d.getKeywords();
    const functions = d.getFunctions();
    const tables = [];
    const databases = [];
    if (schema) {
      const { sql: tSql } = d.listAutocompleteTables();
      const t = await db.execute(instanceId, tSql, [schema]);
      for (const r of t.rows) tables.push({ name: r.TABLE_NAME, type: r.TABLE_TYPE });
    }
    const { sql: dSql } = d.listAutocompleteDatabases();
    const dbs = await db.execute(instanceId, dSql);
    for (const r of dbs.rows) databases.push(r.SCHEMA_NAME);
    res.json({ ok: true, keywords, functions, tables, databases });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/cancel-query', async (req, res) => {
  try {
    const sessionId = req.body.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const killed = await db.cancelQuery(sessionId);
    res.json({ ok: true, killed });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Batch data import from CSV/JSON
app.post('/api/import', async (req, res) => {
  try {
    const instanceId = req.body.instanceId || 'default';
    const { database, table, columns, rows } = req.body;

    if (!database || !table || !columns || !columns.length || !rows || !rows.length) {
      return res.status(400).json({ ok: false, error: 'database, table, columns, rows required' });
    }

    const d = dialectFor(instanceId);

    // Validate and sanitize identifiers
    const escapedCols = columns.filter(c => c && c.trim()).map(c => d.escapeId(c.trim())).join(', ');
    if (!escapedCols) return res.status(400).json({ ok: false, error: 'no valid columns' });

    const cleanCols = columns.filter(c => c && c.trim());
    const colCount = cleanCols.length;

    // Normalize rows to match column count (fill missing with NULL)
    const normalizedRows = rows.map(row => {
      const r = new Array(colCount).fill(null);
      for (let i = 0; i < Math.min(colCount, row.length); i++) {
        const v = row[i];
        // Treat empty string as NULL
        r[i] = (v === '' || v === undefined || v === null) ? null : v;
      }
      return r;
    });

    // Build batch INSERT with parameterized values
    const placeholders = normalizedRows.map(() => `(${cleanCols.map(() => '?').join(', ')})`).join(', ');
    const flatValues = normalizedRows.flat();
    const sql = `INSERT INTO ${d.escapeId(database)}.${d.escapeId(table)} (${escapedCols}) VALUES ${placeholders}`;

    const result = await db.execute(instanceId, sql, flatValues);
    const inserted = result.affectedRows || normalizedRows.length;
    res.json({ ok: true, inserted });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/export', async (req, res) => {
  try {
    const instanceId = req.body.instanceId || 'default';
    const { sql, format = 'csv' } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql required' });
    const result = await db.execute(instanceId, sql);
    const fields = result.fields || [];
    const rows = result.rows || [];
    // Signal row count via header so frontend can display it
    res.setHeader('X-Results-Count', String(rows.length));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="export.json"');
      res.json(rows);
    } else if (format === 'xlsx') {
      const headers = fields.map(f => f.name);
      const data = [headers, ...rows.map(row => headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
        return v;
      }))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Results');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="export.xlsx"');
      res.send(buf);
    } else {
      const headers = fields.map(f => f.name).join(',');
      const lines = rows.map(row =>
        fields.map(f => {
          const v = row[f.name];
          if (v === null || v === undefined) return '';
          const s = String(v);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
          return s;
        }).join(',')
      );
      const csv = [headers, ...lines].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
      res.send(csv);
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Export SQL Dump — generates CREATE TABLE + INSERT INTO for table or database
app.post('/api/dump', async (req, res) => {
  try {
    const instanceId = req.body.instanceId || 'default';
    const { database, table, mode = 'all', maxDataRows = 100000 } = req.body;
    if (!database) return res.status(400).json({ error: 'database required' });

    const modeLabel = { all: 'Structure + Data', structure: 'Structure Only', data: 'Data Only' }[mode] || 'all';
    let output = [
      `-- Surge SQL Dump`,
      `-- Database: ${database}`,
      `-- Mode: ${modeLabel}`,
      `-- Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      ``,
    ];

    if (table) {
      // Single table dump
      await dumpTable(db, instanceId, database, table, output, mode, maxDataRows);
    } else {
      // Full database dump
      const d = dialectFor(instanceId);
      const { sql: listSql } = d.listDumpTables();
      const colsResult = await db.execute(instanceId, listSql, [database]);
      const tables = (colsResult.rows || []).map(r => r.TABLE_NAME);
      for (const tbl of tables) {
        await dumpTable(db, instanceId, database, tbl, output, mode, maxDataRows);
        output.push('');
      }
    }

    let suffix = '';
    if (mode === 'structure') suffix = '_structure';
    else if (mode === 'data') suffix = '_data';
    const filename = table ? `${database}_${table}${suffix}.sql` : `${database}${suffix}_dump.sql`;
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(output.join('\n'));
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function dumpTable(db, instanceId, database, tableName, output, mode = 'all', maxDataRows = 100000) {
  const d = dialectFor(instanceId);
  output.push(`-- --------------------------------------------------------`);
  output.push(`-- Table: ${database}.${tableName}`);
  output.push(`-- --------------------------------------------------------`);

  const includeStructure = mode === 'all' || mode === 'structure';
  const includeData = mode === 'all' || mode === 'data';

  // CREATE TABLE
  if (includeStructure) {
    try {
      const ddlQuery = d.getTableDDLForDump(database, tableName);
      const ddlResult = await db.execute(instanceId, ddlQuery.sql, ddlQuery.params);
      const ddl = ddlQuery.extract(ddlResult.rows);
      output.push('');
      output.push(d.buildDropTable(database, tableName));
      output.push(ddl + ';');
    } catch (e) {
      output.push(`-- Error getting DDL: ${e.message}`);
    }
  }

  if (includeData) {
    try {
      const selectSql = d.buildDumpSelect(database, tableName, maxDataRows);
      const dataResult = await db.execute(instanceId, selectSql);
      const rows = dataResult.rows || [];
      const fields = dataResult.fields || [];

      output.push('');
      if (rows.length === 0) {
        output.push(`-- ${tableName} has no rows`);
        return;
      }

      // Check if data was truncated
      output.push(`-- Data for ${tableName} (${rows.length} rows)`);
      if (maxDataRows > 0 && rows.length >= maxDataRows) {
        output.push(`-- WARNING: Data truncated at ${maxDataRows} rows. Total may exceed this limit.`);
      }
      output.push('');

      const fieldNames = fields.map(f => f.name);

      // Generate INSERT statements in batches of 500 rows
      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        output.push(d.buildDumpInsert(database, tableName, fieldNames, batch));
        if (i + BATCH < rows.length) output.push('');
      }
    } catch (e) {
      output.push(`-- Error getting data: ${e.message}`);
    }
  }
}


/* ==================== Version Update ==================== */
const https = require('https');
const os = require('os');
const { execFile } = require('child_process');
const APP_VERSION = require('./package.json').version;
const GITHUB_REPO = 'chenjunwenhao/Surge';
const ALLOWED_DOWNLOAD_HOSTS = /^https:\/\/(github\.com|[a-z0-9-]+\.githubusercontent\.com)\//;
const MAX_CONCURRENT_DOWNLOADS = 3;

function httpsGetJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const req = https.get(url, {
      headers: { 'User-Agent': 'Surge-Update-Checker', 'Accept': 'application/vnd.github+json' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(httpsGetJson(res.headers.location, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`GitHub API returned ${res.statusCode}`));
      }
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON from GitHub API')); }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('GitHub API timeout')); });
    req.on('error', reject);
  });
}

// Compare semver a vs b: 1 if a>b, -1 if a<b, 0 if equal.
// Pre-release versions (beta/rc) are considered LOWER than the same core version.
function compareVersions(a, b) {
  const parse = (v) => {
    const cleaned = String(v).replace(/^v/, '');
    const dash = cleaned.indexOf('-');
    const core = dash >= 0 ? cleaned.slice(0, dash) : cleaned;
    const pre = dash >= 0 ? cleaned.slice(dash + 1) : '';
    return {
      parts: core.split('.').map(n => parseInt(n, 10) || 0),
      isPreRelease: pre.length > 0,
    };
  };
  const pa = parse(a), pb = parse(b);
  // Core version comparison
  for (let i = 0; i < 3; i++) {
    if ((pa.parts[i] || 0) > (pb.parts[i] || 0)) return 1;
    if ((pa.parts[i] || 0) < (pb.parts[i] || 0)) return -1;
  }
  // Same core: non-pre-release > pre-release
  if (!pa.isPreRelease && pb.isPreRelease) return 1;
  if (pa.isPreRelease && !pb.isPreRelease) return -1;
  return 0;
}

// Pick the platform-appropriate zip asset from a GitHub release
function pickZipAsset(assets) {
  const list = assets || [];
  const zips = list.filter(a => /\.zip$/i.test(a.name) && !/portable/i.test(a.name));
  if (process.platform === 'darwin') {
    // Prefer arch-matching zip, e.g. Surge-2.4.0-arm64-mac.zip
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    return zips.find(a => /mac/i.test(a.name) && a.name.includes(arch))
        || zips.find(a => /mac/i.test(a.name))
        || null;
  }
  // Windows: e.g. Surge-2.4.0-win.zip
  return zips.find(a => /win/i.test(a.name)) || null;
}

app.get('/api/check-update', async (req, res) => {
  try {
    const release = await httpsGetJson(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    const latest = String(release.tag_name || '').replace(/^v/, '');
    if (!latest) return res.json({ ok: false, error: 'No release found' });
    const hasUpdate = compareVersions(latest, APP_VERSION) > 0;
    const zipAsset = pickZipAsset(release.assets);
    res.json({
      ok: true,
      current: APP_VERSION,
      latest,
      hasUpdate,
      zipUrl: zipAsset ? zipAsset.browser_download_url : null,
      zipSize: zipAsset ? zipAsset.size : 0,
      pageUrl: release.html_url || `https://github.com/${GITHUB_REPO}/releases/latest`,
      notes: release.body || '',
      publishedAt: release.published_at || '',
    });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// Per-session state for in-flight downloads (keyed by downloadId)
const downloadSessions = new Map();
let activeDownloads = 0;

function downloadFile(url, session, onProgress, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    // Re-validate redirect targets against the allow-list
    if (!ALLOWED_DOWNLOAD_HOSTS.test(url)) {
      return reject(new Error('Blocked redirect to untrusted host'));
    }
    const req = https.get(url, {
      headers: { 'User-Agent': 'Surge-Update-Checker', 'Accept': 'application/octet-stream' },
      timeout: 120000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(downloadFile(res.headers.location, session, onProgress, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const dest = session.zipPath;
      const file = fs.createWriteStream(dest);
      session.req = req;

      // Prevent duplicate settle (res error + file error may both fire)
      let settled = false;
      const settle = (fn) => (...args) => {
        if (settled) return;
        settled = true;
        try { file.destroy(); } catch (_) {}
        try { fs.unlink(dest, () => {}); } catch (_) {}
        fn(...args);
      };

      res.on('data', chunk => {
        downloaded += chunk.length;
        onProgress(downloaded, total);
      });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', settle(reject));
      res.on('error', settle(reject));
    });
    req.on('timeout', () => { req.destroy(new Error('Download timeout')); });
    req.on('error', reject);
  });
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    const validate = () => {
      // Defend against zip-slip / path-traversal
      try {
        const root = path.resolve(destDir) + path.sep;
        const walk = (dir) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.resolve(dir, e.name);
            if (!full.startsWith(root)) {
              throw new Error('Path traversal detected in zip: ' + full);
            }
            if (e.isDirectory()) walk(full);
          }
        };
        walk(destDir);
        resolve();
      } catch (err) {
        reject(err);
      }
    };

    if (process.platform === 'darwin') {
      // ditto preserves symlinks, permissions & code signature (critical for .app)
      execFile('ditto', ['-x', '-k', zipPath, destDir], (err) => err ? reject(err) : validate());
    } else {
      execFile('powershell.exe', ['-NoProfile', '-Command',
        `Expand-Archive -LiteralPath "${zipPath}" -DestinationPath "${destDir}" -Force`],
        (err) => err ? reject(err) : validate());
    }
  });
}

// SSE endpoint: downloads zip, extracts, streams progress
app.get('/api/download-update', async (req, res) => {
  const { url, version } = req.query;
  if (!url || !version) {
    return res.status(400).json({ ok: false, error: 'url and version required' });
  }
  // Only allow downloads from GitHub release assets of this repo
  if (!ALLOWED_DOWNLOAD_HOSTS.test(url)) {
    return res.status(400).json({ ok: false, error: 'Invalid download URL' });
  }

  // Rate-limit concurrent downloads
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    return res.status(429).json({ ok: false, error: 'Too many concurrent downloads — try again later' });
  }
  activeDownloads++;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    try {
      const ok = res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (!ok) {
        console.warn('[sse] backpressure on download session');
      }
    } catch (_) {
      // Client disconnected, mark cancelled
      const s = downloadSessions.get(downloadId);
      if (s) s.cancelled = true;
    }
  };

  const workDir = path.join(os.tmpdir(), `surge-update-v${version}`);
  const zipPath = path.join(workDir, 'update.zip');
  const downloadId = crypto.randomUUID();
  const session = { cancelled: false, req: null, zipPath, done: false };
  downloadSessions.set(downloadId, session);

  // 10-minute overall timeout
  const timeout = setTimeout(() => {
    if (!session.done) {
      session.cancelled = true;
      try { session.req?.destroy(); } catch (_) {}
      try { res.end(); } catch (_) {}
    }
  }, 10 * 60 * 1000);

  req.on('close', () => {
    // Client disconnected (cancel): abort in-flight request
    if (!session.done) {
      session.cancelled = true;
      try { session.req?.destroy(); } catch (_) {}
    }
  });

  try {
    // Clean previous attempts
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(workDir, { recursive: true });

    let lastPct = -1;
    await downloadFile(url, session, (downloaded, total) => {
      const pct = total ? Math.floor((downloaded / total) * 100) : 0;
      if (pct !== lastPct) {
        lastPct = pct;
        send('progress', {
          percent: pct,
          downloaded: (downloaded / 1048576).toFixed(1) + ' MB',
          total: total ? (total / 1048576).toFixed(1) + ' MB' : '?',
        });
      }
    });
    if (session.cancelled) throw new Error('Cancelled');

    send('progress', { percent: 100, extracting: true });
    const extractDir = path.join(workDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });
    await extractZip(zipPath, extractDir);
    if (session.cancelled) throw new Error('Cancelled');

    // Locate payload: mac zip contains Surge.app; win zip contains exe + resources
    let extractedPath = extractDir;
    if (process.platform === 'darwin') {
      const appEntry = fs.readdirSync(extractDir).find(n => n.endsWith('.app'));
      if (!appEntry) throw new Error('No .app found in update package');
      extractedPath = path.join(extractDir, appEntry);
    }
    fs.rmSync(zipPath, { force: true });

    session.done = true;
    send('complete', { ok: true, extractedPath });
  } catch (err) {
    session.done = true;
    fs.rmSync(workDir, { recursive: true, force: true });
    send('error', { ok: false, error: err.message });
  } finally {
    clearTimeout(timeout);
    downloadSessions.delete(downloadId);
    activeDownloads--;
    res.end();
  }
});

app.get('*', (req, res) => {
  const target = fs.existsSync(distPath)
    ? path.join(distPath, 'index.html')
    : path.join(publicPath, 'index.html');
  res.sendFile(target);
});

const PORT = process.env.PORT || 4000;

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port ?? PORT, () => {
      const addr = srv.address();
      console.log('Server running on port', addr.port);
      resolve(addr.port);
    });
    srv.on('error', reject);
  });
}

// Standalone mode: node server.js
if (require.main === module) {
  startServer(PORT).catch(err => { console.error('Failed to start:', err); process.exit(1); });
}

module.exports = { app, startServer };
