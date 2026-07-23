import { useCallback, useState, useRef } from 'react';
import api from '../utils/api';
import formatSQL from '../utils/sqlFormatter';

// Find the SQL statement at a given cursor offset
function getStatementAtCursor(text, offset) {
  const stmts = [];
  let cur = '', start = 0, i = 0;
  while (i < text.length) {
    const ch = text[i];
    // string
    if (ch === "'" || ch === '"') { const q = ch; cur += q; i++; while (i < text.length && text[i] !== q) { if (text[i] === '\\') { cur += text[i]; i++; } cur += text[i] || ''; i++; } if (i < text.length) { cur += q; i++; } continue; }
    // backtick
    if (ch === '`') { cur += '`'; i++; while (i < text.length && text[i] !== '`') { cur += text[i]; i++; } if (i < text.length) { cur += '`'; i++; } continue; }
    // line comment
    if (ch === '-' && text[i+1] === '-') { while (i < text.length && text[i] !== '\n') { cur += text[i]; i++; } continue; }
    // block comment
    if (ch === '/' && text[i+1] === '*') { cur += '/*'; i += 2; while (i < text.length && !(text[i] === '*' && text[i+1] === '/')) { cur += text[i]; i++; } if (i < text.length) { cur += '*/'; i += 2; } continue; }
    // semicolon = statement boundary
    if (ch === ';') {
      const s = cur.trim();
      if (s) {
        const stmtStart = start;
        const stmtEnd = i; // includes the semicolon
        stmts.push({ sql: s, start: stmtStart, end: stmtEnd });
      }
      start = i + 1;
      cur = ''; i++;
      continue;
    }
    cur += ch; i++;
  }
  const s = cur.trim();
  if (s) {
    stmts.push({ sql: s, start, end: text.length });
  }
  // Find the statement that contains the cursor
  const found = stmts.find(st => offset >= st.start && offset <= st.end);
  return found ? found.sql : text.trim();
}

export default function useQueryExecution({
  edRef, abortRef, timerRef, instancesRef, selInst,
  setOpenTabs, setStatus, setRunning, setQueryHistory,
  activeTab, ensureConnected, loadTabs, err,
}) {
  /* ----- API helpers ----- */
  const doQuery = useCallback(async (instId, sql) => {
    const r = await api('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId, sql }) });
    return r;
  }, []);

  const doTx = useCallback(async (instId, action) => {
    const r = await api('/api/transaction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId, action }) });
    return r;
  }, []);

  /* ----- Execute query ----- */
  const execQuery = useCallback(async () => {
    if (!activeTab || activeTab.type !== 'query') return;
    let sql = edRef.current?.getValue() || activeTab.sql;
    let isSelection = false;
    if (edRef.current) {
      const sel = edRef.current.getSelection();
      if (sel && !sel.isEmpty()) {
        sql = edRef.current.getModel().getValueInRange(sel); isSelection = true;
      } else {
        // Cursor-based: execute the statement at cursor position
        const fullText = edRef.current.getValue();
        const pos = edRef.current.getPosition();
        const model = edRef.current.getModel();
        const offset = model.getOffsetAt(pos);
        const stmt = getStatementAtCursor(fullText, offset);
        if (stmt && stmt !== fullText.trim()) sql = stmt;
      }
    }
    if (!sql.trim()) return;

    // Cancel previous running query if any
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setQueryHistory(prev => {
      const next = [{ sql: sql.trim(), ts: Date.now(), instId: activeTab.instId, db: activeTab.db }, ...prev.filter(h => h.sql !== sql.trim())].slice(0, 50);
      localStorage.setItem('sql-history', JSON.stringify(next));
      return next;
    });

    const startTime = Date.now();
    setStatus('Running... 0ms');
    setRunning(true);
    timerRef.current = setInterval(() => {
      setStatus(`Running... ${Date.now() - startTime}ms`);
    }, 100);
    setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, error: null, batchResults: null, results: null } : t));

    let effInstId = activeTab.instId;
    try {
      effInstId = await ensureConnected(activeTab.instId);
      runInstRef.current = effInstId;
      if (effInstId !== activeTab.instId) {
        setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, instId: effInstId } : t));
      }
    } catch (e) {
      clearTimeout(timerRef.current);
      abortRef.current = null;
      setRunning(false);
      setStatus('Reconnect failed');
      setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, error: e.message || String(e), results: null } : t));
      return;
    }

    try {
      const r = await api('/api/query-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: effInstId, sql, database: activeTab.db || '' }), signal: controller.signal });

      if (r.ok && r.results) {
        let batch = r.results.filter(b => !/^USE\s+`/.test(b.sql || ''));
        if (batch.length === 0) { setStatus('OK'); return; }
        const totalRows = batch.reduce((s, x) => s + (x.rows?.length || 0), 0);
        const totalAffected = batch.reduce((s, x) => s + (x.affectedRows || 0), 0);
        const hasError = batch.some(x => !x.ok);
        const statusParts = [];
        if (totalRows) statusParts.push(`${totalRows} rows`);
        if (totalAffected) statusParts.push(`${totalAffected} affected`);
        if (!statusParts.length) statusParts.push('OK');
        if (isSelection) statusParts.push('[selection]');
        setStatus(hasError ? 'Error in batch' : statusParts.join(' '));
        if (batch.length === 1) {
          const b = batch[0];
          setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, results: b.ok ? b.rows : null, fields: b.ok ? b.fields : [], error: b.ok ? null : b.error, singleResult: b, batchResults: null } : t));
        } else {
          setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, batchResults: batch, results: null, fields: [], error: null, singleResult: null } : t));
        }
        const hasSchemaChange = batch.some(b => b.affectedRows !== undefined && b.affectedRows !== null);
        if (hasSchemaChange && activeTab.db) {
          loadTabs(effInstId, activeTab.db).catch(() => {});
        }
      } else {
        setStatus('Query failed');
        setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, error: r.error || 'Unknown error', results: null, batchResults: null } : t));
      }
    } catch (e) {
      if (controller.signal.aborted) {
        setStatus('Cancelled');
        setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, results: null, batchResults: null, error: null } : t));
      } else {
        setStatus('Query failed');
        setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, error: e.message || String(e), results: null, batchResults: null } : t));
      }
    } finally {
      clearInterval(timerRef.current);
      if (abortRef.current === controller) abortRef.current = null;
      runInstRef.current = null;
      setRunning(false);
    }
  }, [activeTab, ensureConnected, loadTabs]);

  /* ----- Format SQL ----- */
  const fmtSQL = useCallback(() => {
    if (!activeTab || activeTab.type !== 'query' || !edRef.current) return;
    const sql = edRef.current.getValue();
    if (!sql.trim()) return;
    const formatted = formatSQL(sql);
    edRef.current.setValue(formatted);
    setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, sql: formatted } : t));
  }, [activeTab]);

  /* ----- Cancel running query ----- */
  const runInstRef = useRef(null);
  const cancelQuery = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    // Also kill the query on the server side
    if (runInstRef.current) {
      api('/api/cancel-query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: runInstRef.current }) }).catch(() => {});
      runInstRef.current = null;
    }
  }, []);

  /* ----- Explain query ----- */
  const explainQuery = useCallback(async () => {
    if (!activeTab || activeTab.type !== 'query') return;
    setStatus('Explaining...');
    const rawSql = (edRef.current?.getValue() || activeTab.sql || '').trim();
    const sql = rawSql.split(';')[0].trim(); // EXPLAIN only supports single statement
    if (!sql) { setStatus('No valid SQL to explain'); return; }
    let effInstId = activeTab.instId;
    try { effInstId = await ensureConnected(activeTab.instId); } catch (e) {
      setStatus('Reconnect failed');
      setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, explainError: e.message || String(e) } : t));
      return;
    }
    const r = await api(`/api/explain?instanceId=${encodeURIComponent(effInstId)}&sql=${encodeURIComponent(sql)}`);
    if (r.ok) {
      setStatus('EXPLAIN ready');
      setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, explainResults: r.explain || [], explainError: null } : t));
    } else {
      setStatus('EXPLAIN failed');
      setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, explainError: r.error, explainResults: null } : t));
    }
  }, [activeTab, ensureConnected]);

  /* ----- Transaction ----- */
  const [txActive, setTxActive] = useState(false);
  const [txStartedAt, setTxStartedAt] = useState(null);
  const txTimerRef = useRef(null);

  const txAction = useCallback(async (action) => {
    if (!selInst) { err('No instance selected'); return; }
    const r = await doTx(selInst.id, action);
    if (r.ok) {
      if (action === 'begin') {
        setTxActive(true);
        setTxStartedAt(Date.now());
      } else {
        setTxActive(false);
        setTxStartedAt(null);
      }
      setStatus(`TX ${action} OK`);
    } else {
      // If commit/rollback fails, tx might still be active — keep state
      if (action === 'begin') { setTxActive(false); setTxStartedAt(null); }
      err(r.error);
    }
  }, [selInst, doTx, err]);

  return {
    doQuery, execQuery, fmtSQL, cancelQuery, explainQuery, txAction,
    txActive, txStartedAt,
  };
}
