const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');

// Track running queries for cancellation
const runningQueries = new Map();

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
    const { id, name, host, port, user, password, database } = req.body;
    if (!name || !host || !user || !database) {
      return res.status(400).json({ ok: false, error: 'name, host, user, database required' });
    }
    const connections = loadSavedConnections();
    const connection = {
      id: id || `${name}-${Date.now()}`,
      name,
      host,
      port: port || 3306,
      user,
      password,
      database,
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
    const { name, host, port, user, password, database } = req.body;
    if (!name || !host || !user) {
      return res.status(400).json({ ok: false, error: 'name, host, user required' });
    }
    let connections = loadSavedConnections();
    const index = connections.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ ok: false, error: 'Connection not found' });
    }
    connections[index] = {
      ...connections[index],
      name,
      host,
      port: port || 3306,
      user,
      password: password || '',
      database: database || '',
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
    await db.connect(instanceId, cfg);
    if (save) {
      const connection = {
        id: instanceId,
        name: name || cfg.database || instanceId,
        host: cfg.host,
        port: cfg.port || 3306,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
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
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port || 3306,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database || undefined,
      connectTimeout: 5000,
    });
    await conn.ping();
    await conn.end();
    res.json({ ok: true, message: 'Connection successful' });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/databases', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const sql = `SELECT SCHEMA_NAME AS name FROM information_schema.schemata WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys') ORDER BY SCHEMA_NAME`;
    const result = await db.execute(instanceId, sql);
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
    const sql = `SELECT TABLE_NAME, TABLE_SCHEMA, TABLE_TYPE, TABLE_COMMENT, TABLE_ROWS, AVG_ROW_LENGTH, DATA_LENGTH, CREATE_TIME, UPDATE_TIME FROM information_schema.tables WHERE table_schema = ? ORDER BY TABLE_NAME`;
    const result = await db.execute(instanceId, sql, [schema]);
    res.json({ ok: true, tables: result.rows });
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
    const sql = `SHOW CREATE TABLE ${escapeId(schema)}.${escapeId(table)}`;
    const result = await db.execute(instanceId, sql);
    const ddl = result.rows?.[0]?.['Create Table'] || '';
    res.json({ ok: true, ddl });
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
    const sql = `SHOW INDEX FROM ${escapeId(schema)}.${escapeId(table)}`;
    const result = await db.execute(instanceId, sql);
    res.json({ ok: true, indexes: result.rows });
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
    const sql = `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, ORDINAL_POSITION FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ORDINAL_POSITION`;
    const result = await db.execute(instanceId, sql, [schema, table]);
    res.json({ ok: true, columns: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/query', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const sql = req.body.sql;
    if (!sql) return res.status(400).json({ error: 'sql required' });
    const result = await db.execute(instanceId, sql);
    res.json({ ok: true, rows: result.rows, fields: result.fields });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Smart SQL split (respects strings, comments, backticks)
function splitSQL(sql) {
  const stmts = [];
  let cur = '', i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') { const q = ch; cur += q; i++; while (i < sql.length && sql[i] !== q) { if (sql[i] === '\\') { cur += sql[i]; i++; } cur += sql[i] || ''; i++; } if (i < sql.length) { cur += q; i++; } continue; }
    if (ch === '`') { cur += '`'; i++; while (i < sql.length && sql[i] !== '`') { cur += sql[i]; i++; } if (i < sql.length) { cur += '`'; i++; } continue; }
    if (ch === '-' && sql[i+1] === '-') { while (i < sql.length && sql[i] !== '\n') { cur += sql[i]; i++; } continue; }
    if (ch === '/' && sql[i+1] === '*') { cur += '/*'; i += 2; while (i < sql.length && !(sql[i] === '*' && sql[i+1] === '/')) { cur += sql[i]; i++; } if (i < sql.length) { cur += '*/'; i += 2; } continue; }
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

app.post('/api/query-batch', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const database = req.body.database || '';
    const statements = splitSQL(req.body.sql || '');
    if (!statements.length) return res.status(400).json({ error: 'no SQL found' });
    // Auto-select database context if specified by frontend
    if (database) statements.unshift(`USE ${escapeId(database)}`);
    const results = [];
    for (const sql of statements) {
      try {
        const start = Date.now();
        const result = await db.execute(instanceId, sql);
        const elapsed = Date.now() - start;
        // mysql2 returns ResultSetHeader for DML/DDL (affectedRows etc.), RowDataPacket[] for SELECT
        const isSelect = Array.isArray(result.rows);
        results.push({
          ok: true,
          sql,
          rows: isSelect ? result.rows : [],
          fields: result.fields || [],
          affectedRows: isSelect ? undefined : (result.rows?.affectedRows ?? 0),
          changedRows: isSelect ? undefined : (result.rows?.changedRows ?? 0),
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
    const action = req.body.action;
    if (!action) return res.status(400).json({ error: 'action required' });
    if (action === 'begin') {
      await db.beginTransaction(instanceId);
      return res.json({ ok: true });
    } else if (action === 'commit') {
      await db.commit(instanceId);
      return res.json({ ok: true });
    } else if (action === 'rollback') {
      await db.rollback(instanceId);
      return res.json({ ok: true });
    }
    res.status(400).json({ error: 'unknown action' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Safe identifier escaping for MySQL backtick identifiers
function escapeId(id) {
  return '`' + String(id).replace(/`/g, '``') + '`';
}

app.post('/api/edit', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const { table, pk, updates } = req.body;
    if (!table || !pk || !updates) return res.status(400).json({ error: 'table, pk, updates required' });
    const whereKeys = Object.keys(pk);
    const whereClauses = whereKeys.map((k) => `${escapeId(k)} = ?`).join(' AND ');
    const whereValues = whereKeys.map((k) => pk[k]);
    const setKeys = Object.keys(updates);
    const setClauses = setKeys.map((k) => `${escapeId(k)} = ?`).join(', ');
    const setValues = setKeys.map((k) => updates[k]);
    const sql = `UPDATE ${escapeId(table)} SET ${setClauses} WHERE ${whereClauses}`;
    const params = [...setValues, ...whereValues];
    const result = await db.execute(instanceId, sql, params);
    res.json({ ok: true, affectedRows: result.rows.affectedRows || 0 });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/autocomplete', async (req, res) => {
  try {
    const instanceId = resolveInstanceId(req);
    const schema = req.query.database || resolveDatabase(req, instanceId);
    const keywords = [
      'SELECT','INSERT','UPDATE','DELETE','FROM','WHERE','JOIN','LEFT','RIGHT','INNER','OUTER','CROSS','ON','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE','IS','NULL','AS','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','UNION','ALL','DISTINCT','CASE','WHEN','THEN','ELSE','END','CREATE','ALTER','DROP','TRUNCATE','TABLE','INDEX','VIEW','PROCEDURE','FUNCTION','TRIGGER','EXPLAIN','DESC','SHOW','USE','SET','BEGIN','COMMIT','ROLLBACK','PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','AUTO_INCREMENT','UNIQUE','CHECK','CASCADE'
    ];
    const functions = [
      'COUNT','SUM','AVG','MAX','MIN','GROUP_CONCAT','COALESCE','IFNULL','NULLIF','IF','CAST','CONVERT','DATE_FORMAT','NOW','CURDATE','CURTIME','UNIX_TIMESTAMP','FROM_UNIXTIME','DATEDIFF','TIMESTAMPDIFF','CONCAT','SUBSTRING','REPLACE','TRIM','UPPER','LOWER','LENGTH','ROUND','FLOOR','CEIL','ABS','MOD','RAND','UUID','MD5','SHA1','JSON_EXTRACT','JSON_UNQUOTE'
    ];
    const tables = [];
    const databases = [];
    if (schema) {
      const t = await db.execute(instanceId, 'SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.tables WHERE table_schema = ?', [schema]);
      for (const r of t.rows) tables.push({ name: r.TABLE_NAME, type: r.TABLE_TYPE });
    }
    const dbs = await db.execute(instanceId, "SELECT SCHEMA_NAME FROM information_schema.schemata WHERE SCHEMA_NAME NOT IN ('information_schema','mysql','performance_schema','sys')");
    for (const r of dbs.rows) databases.push(r.SCHEMA_NAME);
    res.json({ ok: true, keywords, functions, tables, databases });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/cancel-query', async (req, res) => {
  try {
    const instanceId = req.body.instanceId || 'default';
    const entry = runningQueries.get(instanceId);
    if (entry && entry.connection) {
      try {
        // Kill the connection to cancel the query
        await entry.connection.query('KILL QUERY ?', [entry.connection.threadId]);
      } catch (e) {
        // Connection might already be dead
      }
      try { entry.connection.destroy(); } catch (_) {}
      runningQueries.delete(instanceId);
      res.json({ ok: true });
    } else {
      res.json({ ok: true, message: 'No running query' });
    }
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
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="export.json"');
      res.json(result.rows);
    } else {
      const fields = result.fields || [];
      const headers = fields.map(f => f.name).join(',');
      const lines = (result.rows || []).map(row =>
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

app.get('*', (req, res) => {
  const target = fs.existsSync(distPath)
    ? path.join(distPath, 'index.html')
    : path.join(publicPath, 'index.html');
  res.sendFile(target);
});

const PORT = process.env.PORT || 3000;

function startServer(port) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port || PORT, () => {
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

module.exports = { app, startServer, runningQueries };
