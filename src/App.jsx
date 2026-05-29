import { useEffect, useRef, useState, useCallback } from 'react';
import { FaGithub } from 'react-icons/fa';
import api from './utils/api';
import I from './utils/icons';
import formatSQL from './utils/sqlFormatter';
import { scheduleLint } from './utils/sqlLinter';
import { useToast } from './components/Toast';
import ConnectionModal from './components/ConnectionModal';
import SidebarTree from './components/SidebarTree';
import QueryPicker from './components/QueryPicker';
import ContextMenu from './components/ContextMenu';
import TabContent from './components/TabContent';

/* ==================== MAIN APP ==================== */
export default function App() {
  /* ----- State ----- */
  const [instances, setInstances] = useState([]);
  const [savedConns, setSavedConns] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [status, setStatus] = useState('Ready');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [sidebarW, setSidebarW] = useState(320);
  const [editorSplitPct, setEditorSplitPct] = useState(50);
  const [sc, setSc] = useState({ conn: false, saved: false });
  const [queryHistory, setQueryHistory] = useState(() => { try { return JSON.parse(localStorage.getItem('sql-history') || '[]'); } catch { return []; } });
  const [closedTabs, setClosedTabs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [treeErrors, setTreeErrors] = useState({});
  const [refreshing, setRefreshing] = useState({});
  const [treeSearch, setTreeSearch] = useState('');
  const treeSearchRef = useRef(null);
  const [showQueryPicker, setShowQueryPicker] = useState(false);
  const [pickerExpand, setPickerExpand] = useState(null);
  const [pickerConnecting, setPickerConnecting] = useState(null);
  const [pickerDbSearch, setPickerDbSearch] = useState('');
  const [dbPickerTabId, setDbPickerTabId] = useState(null);
  const [dbPickerSearch, setDbPickerSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [batchExpanded, setBatchExpanded] = useState({});
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [mEditId, setMEditId] = useState(null);

  /* ----- Theme effect ----- */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  /* ----- Modal state ----- */
  const [showModal, setShowModal] = useState(false);
  const [mName, setMName] = useState('');
  const [mHost, setMHost] = useState('127.0.0.1');
  const [mPort, setMPort] = useState(3306);
  const [mUser, setMUser] = useState('root');
  const [mPass, setMPass] = useState('');
  const [mDb, setMDb] = useState('');
  const [mSave, setMSave] = useState(true);
  const [mTesting, setMTesting] = useState(false);
  const [mResult, setMResult] = useState(null);

  /* ----- Monaco ----- */
  const [edMonaco, setEdMonaco] = useState(null);
  const cpRef = useRef(null);
  const edRef = useRef(null);
  const monacoRef = useRef(null);
  const rezRef = useRef(null);
  const rezFlag = useRef(false);
  const rezVRef = useRef(null);
  const rezVFlag = useRef(false);
  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  const suggestCacheRef = useRef({ allTabs: [], allCols: [], allDbs: new Set(), version: 0 });
  const editOldNameRef = useRef('');

  /* ----- Derived ----- */
  const activeTab = openTabs.find(t => t.id === activeTabId) || null;
  const selInst = instances[0] || null;

  /* ----- Utils ----- */
  const toast = useToast();
  const err = useCallback(m => { setStatus(`Error: ${m}`); toast(m, 'error'); }, [toast]);

  /* ----- Auto-reconnect ----- */
  const lastPingRef = useRef({});
  const ensureConnected = useCallback(async (instId) => {
    const inst = instancesRef.current.find(i => i.id === instId);
    if (!inst || !inst.config) return instId;
    const now = Date.now();
    if (lastPingRef.current[instId] && (now - lastPingRef.current[instId]) < 30000) return instId;
    try {
      const r = await api(`/api/pool-status?instanceId=${encodeURIComponent(instId)}`);
      if (r.ok && r.status) { lastPingRef.current[instId] = now; return instId; }
    } catch (_) { }
    lastPingRef.current[instId] = now;
    const newId = `${inst.name}-${Date.now()}`;
    const cr = await api('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: newId, name: inst.name, save: false, ...inst.config }) });
    if (!cr.ok) throw new Error(cr.error || 'Reconnect failed');
    setInstances(p => p.map(i => i.id === instId ? { ...i, id: newId, connected: true, databases: [], expanded: true, expandedDbs: {}, expandedTables: {}, dbTables: {}, tableColumns: {}, tableIndexes: {} } : i));
    setOpenTabs(p => p.map(t => t.instId === instId ? { ...t, instId: newId } : t));
    return newId;
  }, []);

  /* ----- API helpers ----- */
  const doQuery = useCallback(async (instId, sql) => {
    const r = await api('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId, sql }) });
    return r;
  }, []);

  const doTx = useCallback(async (instId, action) => {
    const r = await api('/api/transaction', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId, action }) });
    return r;
  }, []);

  /* ----- Load saved connections ----- */
  const loadSaved = useCallback(async () => {
    const r = await api('/api/connections');
    if (r.ok) setSavedConns(r.connections || []);
    else err(r.error);
  }, [err]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  /* ----- Load databases for an instance ----- */
  const loadDbs = useCallback(async (instId) => {
    const r = await api(`/api/databases?instanceId=${encodeURIComponent(instId)}`);
    if (r.ok) {
      setInstances(p => p.map(i => i.id === instId ? { ...i, databases: r.databases || [] } : i));
    } else {
      throw new Error(r.error || 'Failed to load databases');
    }
  }, []);

  /* ----- Load tables for a database ----- */
  const loadTabs = useCallback(async (instId, dbName) => {
    const r = await api(`/api/tables?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}`);
    if (r.ok) {
      setInstances(p => p.map(i => {
        if (i.id !== instId) return i;
        return { ...i, dbTables: { ...(i.dbTables || {}), [dbName]: r.tables } };
      }));
      const tblNames = (r.tables || []).map(t => t.TABLE_NAME);
      if (tblNames.length === 0) return;
      (async () => {
        const BATCH = 5;
        for (let i = 0; i < tblNames.length; i += BATCH) {
          const batch = tblNames.slice(i, i + BATCH);
          try {
            const results = await Promise.allSettled(
              batch.map(tn => api(`/api/columns?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}&table=${encodeURIComponent(tn)}`))
            );
            const columnsMap = {};
            results.forEach((r, idx) => {
              if (r.status === 'fulfilled' && r.value?.ok && r.value?.columns) {
                columnsMap[batch[idx]] = r.value.columns;
              }
            });
            if (Object.keys(columnsMap).length > 0) {
              setInstances(p => p.map(i => i.id === instId
                ? { ...i, tableColumns: { ...(i.tableColumns || {}), ...columnsMap } }
                : i));
            }
          } catch (_) { }
        }
      })().catch(() => { });
    } else {
      throw new Error(r.error || 'Failed to load tables');
    }
  }, []);

  /* ----- Load columns ----- */
  const loadCols = useCallback(async (instId, dbName, table) => {
    const r = await api(`/api/columns?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}&table=${encodeURIComponent(table)}`);
    if (r.ok) return r.columns;
    err(r.error); return [];
  }, [err]);

  /* ----- Load DDL ----- */
  const loadDDL = useCallback(async (instId, dbName, table) => {
    const r = await api(`/api/table-ddl?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}&table=${encodeURIComponent(table)}`);
    if (r.ok) return r.ddl;
    err(r.error); return '';
  }, [err]);

  /* ----- Load Indexes ----- */
  const loadIdx = useCallback(async (instId, dbName, table) => {
    const r = await api(`/api/table-indexes?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}&table=${encodeURIComponent(table)}`);
    if (r.ok) return r.indexes;
    err(r.error); return [];
  }, [err]);

  /* ----- Modal: test connection ----- */
  const testConn = useCallback(async () => {
    setMTesting(true); setMResult(null);
    const r = await api('/api/test-connection', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: mHost, port: mPort, user: mUser, password: mPass, database: mDb || undefined }) });
    setMTesting(false); setMResult(r);
  }, [mHost, mPort, mUser, mPass, mDb]);

  /* ----- Modal: connect / update ----- */
  const modalConnect = useCallback(async () => {
    const name = mName || `${mUser}@${mHost}/${mDb || 'mysql'}`;
    const payload = { host: mHost, port: mPort, user: mUser, password: mPass, database: mDb || undefined };

    // Edit mode: update existing saved connection
    if (mEditId) {
      setShowModal(false);
      setStatus('Updating...');
      const ur = await api(`/api/connections/${encodeURIComponent(mEditId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: mName, host: mHost, port: mPort, user: mUser, password: mPass, database: mDb || '' }),
      });
      if (ur.ok) {
        setSavedConns(p => p.map(c => c.id === mEditId ? { ...c, name: mName, host: mHost, port: mPort, user: mUser, password: mPass, database: mDb || '' } : c));
        // Update matching connected instance
        setInstances(p => p.map(i => {
          if (i.name === editOldNameRef.current) {
            return { ...i, name: mName, config: payload };
          }
          return i;
        }));
        setMEditId(null);
        toast('Connection updated: ' + name, 'success');
        setStatus('Updated: ' + name);
      } else {
        err(ur.error);
      }
      return;
    }

    const existing = instancesRef.current.find(i => i.name === name && i.connected);
    if (existing) { setStatus('Already connected: ' + name); toast('Already connected: ' + name, 'warning'); setShowModal(false); return; }
    setShowModal(false);
    setStatus('Connecting...');
    const instId = `${name}-${Date.now()}`;
    const r = await api('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId: instId, name, save: mSave, ...payload }) });
    if (r.ok) {
      const inst = { id: instId, name, config: payload, connected: true, databases: [], expanded: true, expandedDbs: {}, expandedTables: {} };
      setInstances(p => [...p, inst]);
      toast('Connected: ' + name, 'success');
      setStatus('Connected: ' + name);
      if (mSave) loadSaved();
      try {
        await loadDbs(instId);
        if (payload.database) {
          setInstances(p => p.map(i => i.id === instId ? { ...i, expandedDbs: { [payload.database]: true } } : i));
          await loadTabs(instId, payload.database);
        }
      } catch (e) {
        setTreeErrors(p => ({ ...p, [instId]: e.message || String(e) }));
        setStatus(e.message || 'Failed');
      }
    } else err(r.error);
  }, [mName, mHost, mPort, mUser, mPass, mDb, mSave, mEditId, err, toast, loadSaved, loadDbs, loadTabs]);

  /* ----- Saved connection: connect ----- */
  const connSaved = useCallback(async (conn) => {
    const existing = instancesRef.current.find(i => i.name === conn.name && i.connected);
    if (existing) { setStatus('Already connected: ' + conn.name); return; }
    const payload = { host: conn.host, port: conn.port || 3306, user: conn.user, password: conn.password || '', database: conn.database };
    const instId = `${conn.name}-${Date.now()}`;
    const r = await api('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId: instId, name: conn.name, save: false, ...payload }) });
    if (r.ok) {
      const inst = { id: instId, name: conn.name, config: payload, connected: true, databases: [], expanded: true, expandedDbs: {}, expandedTables: {} };
      setInstances(p => [...p, inst]);
      toast('Connected: ' + conn.name, 'success');
      setStatus('Connected: ' + conn.name);
      try {
        await loadDbs(instId);
        if (payload.database) {
          setInstances(p => p.map(i => i.id === instId ? { ...i, expandedDbs: { [payload.database]: true } } : i));
          await loadTabs(instId, payload.database);
        }
      } catch (e) {
        setTreeErrors(p => ({ ...p, [instId]: e.message || String(e) }));
        setStatus(e.message || 'Failed');
      }
    } else err(r.error);
  }, [err, toast, loadDbs, loadTabs]);

  const delSaved = useCallback(async (id) => {
    await api(`/api/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setSavedConns(p => p.filter(c => c.id !== id));
    toast('Connection removed', 'info');
  }, [toast]);

  const editSaved = useCallback((conn) => {
    editOldNameRef.current = conn.name;
    setMName(conn.name);
    setMHost(conn.host);
    setMPort(conn.port || 3306);
    setMUser(conn.user);
    setMPass(conn.password || '');
    setMDb(conn.database || '');
    setMSave(true);
    setMResult(null);
    setMEditId(conn.id);
    setShowModal(true);
  }, []);

  /* ----- Refresh instance ----- */
  const refreshInst = useCallback(async (instId) => {
    setStatus('Refreshing...');
    setTreeErrors(p => { const n = { ...p }; delete n[instId]; return n; });
    try {
      const effId = await ensureConnected(instId);
      await loadDbs(effId);
      setStatus('Refreshed');
    } catch (e) {
      setTreeErrors(p => ({ ...p, [instId]: e.message || String(e) }));
      setStatus('Refresh failed');
    }
  }, [ensureConnected, loadDbs]);

  /* ----- Disconnect instance ----- */
  const disconnectInst = useCallback(async (instId) => {
    setStatus('Disconnecting...');
    const instNameFromMap = instancesRef.current.find(i => i.id === instId)?.name || instId;
    try {
      const r = await api('/api/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId }) });
      if (r.ok) {
        setInstances(p => p.map(i => i.id === instId ? { ...i, connected: false, expanded: false, databases: [], expandedDbs: {}, expandedTables: {}, dbTables: {}, tableColumns: {}, tableIndexes: {} } : i));
        toast('Disconnected: ' + instNameFromMap, 'info');
        setStatus('Disconnected');
      } else {
        setStatus('Disconnect failed');
      }
    } catch (e) {
      setStatus('Disconnect failed: ' + (e.message || String(e)));
    }
  }, [toast]);

  /* ----- Refresh database ----- */
  const refreshDb = useCallback(async (instId, dbName) => {
    setStatus('Refreshing...');
    const ek = `${instId}/${dbName}`;
    setTreeErrors(p => { const n = { ...p }; delete n[ek]; return n; });
    try {
      const effId = await ensureConnected(instId);
      await loadTabs(effId, dbName);
      setStatus('Refreshed');
    } catch (e) {
      setTreeErrors(p => ({ ...p, [ek]: e.message || String(e) }));
      setStatus('Refresh failed');
    }
  }, [ensureConnected, loadTabs]);

  /* ----- Tree: toggle instance ----- */
  const toggleInst = useCallback(async (instId) => {
    let needLoad = false;
    setInstances(p => {
      const inst = p.find(i => i.id === instId);
      if (inst && !inst.expanded && !inst.databases.length) needLoad = true;
      return p.map(i => i.id === instId ? { ...i, expanded: !i.expanded } : i);
    });
    if (needLoad) {
      setTreeErrors(p => { const n = { ...p }; delete n[instId]; return n; });
      const wasConnected = instancesRef.current.find(i => i.id === instId)?.connected;
      try {
        const effId = await ensureConnected(instId);
        if (!wasConnected) toast('Reconnected to ' + (instancesRef.current.find(i => i.id === effId)?.name || 'instance'), 'info');
        await loadDbs(effId);
      } catch (e) {
        setInstances(p => p.map(i => i.id === instId ? { ...i, expanded: false } : i));
        setTreeErrors(p => ({ ...p, [instId]: e.message || String(e) }));
      }
    }
  }, [ensureConnected, loadDbs, toast]);

  /* ----- Tree: toggle database ----- */
  const toggleDb = useCallback(async (instId, dbName) => {
    let needLoad = false;
    setInstances(p => {
      const inst = p.find(i => i.id === instId);
      const isOpen = inst?.expandedDbs?.[dbName];
      if (!isOpen) needLoad = true;
      return p.map(i => i.id === instId ? { ...i, expandedDbs: { ...(i.expandedDbs || {}), [dbName]: !isOpen } } : i);
    });
    if (needLoad) {
      const ek = `${instId}/${dbName}`;
      setTreeErrors(p => { const n = { ...p }; delete n[ek]; return n; });
      try {
        const effId = await ensureConnected(instId);
        await loadTabs(effId, dbName);
      } catch (e) {
        setInstances(p => p.map(i => i.id === instId ? { ...i, expandedDbs: { ...(i.expandedDbs || {}), [dbName]: false } } : i));
        setTreeErrors(p => ({ ...p, [ek]: e.message || String(e) }));
      }
    }
  }, [ensureConnected, loadTabs]);

  /* ----- Tree: toggle table ----- */
  const toggleTbl = useCallback(async (instId, dbName, tName) => {
    let needCols = false, needIdx = false;
    setInstances(p => {
      const inst = p.find(i => i.id === instId);
      const isOpen = inst?.expandedTables?.[tName];
      if (!isOpen) {
        if (!inst?.tableColumns?.[tName]) needCols = true;
        if (!inst?.tableIndexes?.[tName]) needIdx = true;
      }
      return p.map(i => i.id === instId ? { ...i, expandedTables: { ...(i.expandedTables || {}), [tName]: !isOpen } } : i);
    });
    if (needCols || needIdx) {
      const [cols, idxs] = await Promise.all([
        needCols ? loadCols(instId, dbName, tName) : Promise.resolve(null),
        needIdx ? loadIdx(instId, dbName, tName) : Promise.resolve(null),
      ]);
      setInstances(p => p.map(i => {
        if (i.id !== instId) return i;
        const upd = {};
        if (cols) upd.tableColumns = { ...(i.tableColumns || {}), [tName]: cols };
        if (idxs) upd.tableIndexes = { ...(i.tableIndexes || {}), [tName]: idxs };
        return { ...i, ...upd };
      }));
    }
  }, [loadCols, loadIdx]);

  /* ----- Open table data tab ----- */
  const openTable = useCallback(async (instId, dbName, tName) => {
    let effInstId = instId;
    try { effInstId = await ensureConnected(instId); } catch (e) {
      setStatus('Reconnect failed: ' + (e.message || String(e)));
      return;
    }
    const tid = `table:${effInstId}:${dbName}:${tName}`;
    if (openTabs.find(t => t.id === tid)) { setActiveTabId(tid); return; }
    const nt = { id: tid, type: 'table', title: tName, instId: effInstId, dbName, tName, subTab: 'data', loading: true };
    setOpenTabs(p => [...p, nt]); setActiveTabId(tid);
    const [cols, qr, ddl, idx] = await Promise.all([
      loadCols(effInstId, dbName, tName),
      doQuery(effInstId, `SELECT * FROM \`${dbName}\`.\`${tName}\` LIMIT 10000`),
      loadDDL(effInstId, dbName, tName),
      loadIdx(effInstId, dbName, tName),
    ]);
    const pks = cols.filter(c => c.COLUMN_KEY === 'PRI').map(c => c.COLUMN_NAME);
    setOpenTabs(p => p.map(t => t.id === tid ? { ...t, loading: false, columns: cols, rows: qr.ok ? qr.rows : [], fields: qr.ok ? qr.fields : [], pkColumns: pks, dirtyRows: {}, ddl, indexes: idx } : t));
    setStatus(`${tName} — ${qr.rows?.length || 0} rows`);
  }, [openTabs, loadCols, doQuery, loadDDL, loadIdx, ensureConnected]);

  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const selInstRef = useRef(selInst);
  selInstRef.current = selInst;

  /* ----- New query tab ----- */
  const newQuery = useCallback((instId, db, sql) => {
    const currentSelInst = selInstRef.current;
    const currentOpenTabs = openTabsRef.current;
    const effInstId = instId || currentSelInst?.id || '';
    const effDb = db || currentSelInst?.config?.database || '';
    const tid = `q:${Date.now()}`;
    const title = effDb ? `Query ${currentOpenTabs.filter(t => t.type === 'query').length + 1} \u00B7 ${effDb}` : `Query ${currentOpenTabs.filter(t => t.type === 'query').length + 1}`;
    const effSql = sql || (effDb ? `-- ${effDb}\nSELECT 1;` : 'SELECT 1;');
    setOpenTabs(p => [...p, { id: tid, type: 'query', title, instId: effInstId, db: effDb, sql: effSql, results: null, fields: [], error: null }]);
    setActiveTabId(tid);
    setShowQueryPicker(false);
    setPickerDbSearch('');
    if (effDb) loadTabs(effInstId, effDb);
  }, [loadTabs]);

  /* ----- Open console for DB ----- */
  const openConsole = useCallback((instId, dbName) => {
    const tid = `console:${instId}:${dbName || ''}`;
    if (openTabs.find(t => t.id === tid)) { setActiveTabId(tid); return; }
    const label = dbName || 'instance';
    const nt = { id: tid, type: 'query', title: `Console - ${label}`, instId, db: dbName || '', sql: dbName ? `-- ${dbName}\nSELECT 1;` : 'SELECT 1;', results: null, fields: [], error: null };
    setOpenTabs(p => [...p, nt]); setActiveTabId(tid);
  }, [openTabs]);

  /* ----- Close / Reopen tab ----- */
  const closeTab = useCallback((tid) => {
    setOpenTabs(p => {
      const tab = p.find(t => t.id === tid);
      if (tab) setClosedTabs(prev => [tab, ...prev].slice(0, 20));
      const r = p.filter(t => t.id !== tid);
      if (activeTabId === tid) setActiveTabId(r.length ? r[r.length - 1].id : null);
      return r;
    });
  }, [activeTabId]);

  const reopenTab = useCallback(() => {
    setClosedTabs(prev => {
      if (!prev.length) return prev;
      const [tab, ...rest] = prev;
      setOpenTabs(p => { if (p.find(t => t.id === tab.id)) return p; return [...p, tab]; });
      setActiveTabId(tab.id);
      return rest;
    });
  }, []);

  /* ----- Execute query ----- */
  const execQuery = useCallback(async () => {
    if (!activeTab || activeTab.type !== 'query') return;
    let sql = edRef.current?.getValue() || activeTab.sql;
    let isSelection = false;
    if (edRef.current) {
      const sel = edRef.current.getSelection();
      if (sel && !sel.isEmpty()) { sql = edRef.current.getModel().getValueInRange(sel); isSelection = true; }
    }
    if (!sql.trim()) return;

    setQueryHistory(prev => {
      const next = [{ sql: sql.trim(), ts: Date.now(), instId: activeTab.instId, db: activeTab.db }, ...prev.filter(h => h.sql !== sql.trim())].slice(0, 50);
      localStorage.setItem('sql-history', JSON.stringify(next));
      return next;
    });

    setStatus('Running...');
    setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, error: null, batchResults: null, results: null } : t));

    let effInstId = activeTab.instId;
    try {
      effInstId = await ensureConnected(activeTab.instId);
      if (effInstId !== activeTab.instId) {
        setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, instId: effInstId } : t));
      }
    } catch (e) {
      setStatus('Reconnect failed');
      setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, error: e.message || String(e), results: null } : t));
      return;
    }

    const r = await api('/api/query-batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: effInstId, sql, database: activeTab.db || '' }) });

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
      // Refresh sidebar tree after DDL/DML that may have changed schema
      const hasSchemaChange = batch.some(b => b.affectedRows !== undefined && b.affectedRows !== null);
      if (hasSchemaChange && activeTab.db) {
        loadTabs(effInstId, activeTab.db).catch(() => {});
      }
    } else {
      setStatus('Query failed');
      setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, error: r.error || 'Unknown error', results: null, batchResults: null } : t));
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

  /* ----- Explain query ----- */
  const explainQuery = useCallback(async () => {
    if (!activeTab || activeTab.type !== 'query') return;
    setStatus('Explaining...');
    const sql = (edRef.current?.getValue() || activeTab.sql || '').trim();
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
  const txAction = useCallback(async (action) => {
    if (!selInst) { err('No instance selected'); return; }
    const r = await doTx(selInst.id, action);
    if (r.ok) setStatus(`TX ${action} OK`);
    else err(r.error);
  }, [selInst, doTx, err]);

  /* ----- Cell editing ----- */
  const cellEdit = useCallback((tid, ri, cn, val) => {
    setOpenTabs(p => p.map(t => {
      if (t.id !== tid) return t;
      const rows = [...(t.rows || [])]; rows[ri] = { ...rows[ri], [cn]: val };
      return { ...t, rows, dirtyRows: { ...(t.dirtyRows || {}), [ri]: true } };
    }));
  }, []);

  const saveRow = useCallback(async (tab) => {
    if (!tab.pkColumns?.length) { err('No primary key'); return; }
    const keys = Object.keys(tab.dirtyRows || {});
    if (!keys.length) return;
    setStatus('Saving...');
    let saved = 0, failed = 0;
    for (const key of keys) {
      const ri = Number(key);
      const row = tab.rows[ri];
      if (!row) continue;
      const pk = {};
      tab.pkColumns.forEach(c => { pk[c] = row[c]; });
      const ups = {};
      tab.columns.forEach(c => { if (!tab.pkColumns.includes(c.COLUMN_NAME)) ups[c.COLUMN_NAME] = row[c.COLUMN_NAME]; });
      try {
        const r = await api('/api/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId: tab.instId, table: tab.tName, pk, updates: ups }) });
        if (r.ok) saved++;
        else failed++;
      } catch (_) { failed++; }
    }
    if (failed === 0) {
      setStatus('Rows saved: ' + saved);
      toast(saved + ' row(s) saved', 'success');
      setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, dirtyRows: {} } : t));
    } else {
      setStatus(`Saved ${saved}, ${failed} failed`);
      toast(`Saved ${saved}, ${failed} failed`, failed === keys.length ? 'error' : 'warning');
      if (saved > 0) setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, dirtyRows: {} } : t));
    }
  }, [err, toast]);

  const refreshTab = useCallback(async (tab) => {
    setStatus('Refreshing...');
    setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, loading: true } : t));
    try {
      const [cols, qr] = await Promise.all([
        loadCols(tab.instId, tab.dbName, tab.tName),
        doQuery(tab.instId, `SELECT * FROM \`${tab.dbName}\`.\`${tab.tName}\` LIMIT 10000`),
      ]);
      const pks = cols.filter(c => c.COLUMN_KEY === 'PRI').map(c => c.COLUMN_NAME);
      if (qr.ok) {
        setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, loading: false, columns: cols, rows: qr.rows, fields: qr.fields, pkColumns: pks, dirtyRows: {} } : t));
        setStatus(`${tab.tName} — ${qr.rows?.length || 0} rows`);
      } else {
        setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, loading: false } : t));
        setStatus(`Refresh failed: ${qr.error || 'Unknown error'}`);
      }
    } catch (e) {
      setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, loading: false } : t));
      setStatus(`Refresh failed: ${e.message || String(e)}`);
    }
  }, [doQuery, loadCols]);

  /* ----- Sub-tab switch ----- */
  const setSub = useCallback((tid, st) => setOpenTabs(p => p.map(t => t.id === tid ? { ...t, subTab: st } : t)), []);

  /* ----- Context menu ----- */
  const onCtx = useCallback((e, instId, dbName, tName, type) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, instId, dbName, tName, type }); }, []);
  useEffect(() => { const h = () => setCtxMenu(null); document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);
  useEffect(() => {
    if (!dbPickerTabId) return;
    const h = (e) => {
      if (!e.target.closest('.db-picker-dropdown') && !e.target.closest('.db-selector-btn')) setDbPickerTabId(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dbPickerTabId]);

  /* ----- Resizer ----- */
  useEffect(() => {
    const mm = e => { if (!rezFlag.current) return; setSidebarW(Math.max(240, Math.min(500, e.clientX))); };
    const mu = () => { rezFlag.current = false; };
    document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
  }, []);

  useEffect(() => {
    const mm = e => {
      if (!rezVFlag.current) return;
      const panel = document.querySelector('.editor-panel');
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const y = e.clientY - rect.top - 70;
      const total = rect.height - 70;
      const pct = Math.max(20, Math.min(80, (y / total) * 100));
      setEditorSplitPct(Math.round(pct));
    };
    const mu = () => { rezVFlag.current = false; };
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
  }, []);

  /* ----- Monaco Autocomplete ----- */
  useEffect(() => {
    if (!edMonaco) return;
    if (cpRef.current) cpRef.current.dispose();

    const KW = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EXPLAIN', 'DESC', 'SHOW', 'USE', 'SET', 'BEGIN', 'COMMIT', 'ROLLBACK', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'AUTO_INCREMENT', 'UNIQUE', 'CHECK', 'CASCADE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'INTO', 'VALUES', 'IF'];
    const FN = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP_CONCAT', 'COALESCE', 'IFNULL', 'NULLIF', 'IF', 'CAST', 'CONVERT', 'DATE_FORMAT', 'NOW', 'CURDATE', 'CURTIME', 'UNIX_TIMESTAMP', 'FROM_UNIXTIME', 'DATEDIFF', 'TIMESTAMPDIFF', 'CONCAT', 'SUBSTRING', 'SUBSTR', 'REPLACE', 'TRIM', 'UPPER', 'LOWER', 'LENGTH', 'CHAR_LENGTH', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD', 'RAND', 'UUID', 'MD5', 'SHA1', 'JSON_EXTRACT', 'JSON_UNQUOTE', 'DATE', 'YEAR', 'MONTH', 'DAY'];

    cpRef.current = edMonaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '.', ',', '(', ')'],
      provideCompletionItems: (model, pos) => {
        try {
          const word = model.getWordUntilPosition(pos);
          const wordText = word.word.toLowerCase();
          const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
          const instances = instancesRef.current;
          const cache = suggestCacheRef.current;
          const fingerprint = instances.reduce((s, i) => s + '|' + (i.databases?.length || 0) + ':' + Object.keys(i.dbTables || {}).reduce((a, k) => a + (i.dbTables[k]?.length || 0), 0), '');
          if (cache._fp !== fingerprint) {
            cache.allTabs = []; cache.allCols = []; cache.allDbs = new Set();
            instances.forEach(inst => {
              inst.databases?.forEach(d => cache.allDbs.add(d.name));
              if (inst.dbTables) Object.entries(inst.dbTables).forEach(([db, tabs]) => tabs.forEach(t => cache.allTabs.push({ name: t.TABLE_NAME, db, type: t.TABLE_TYPE })));
              if (inst.tableColumns) Object.entries(inst.tableColumns).forEach(([tbl, cols]) => cols.forEach(c => cache.allCols.push({ table: tbl, col: c.COLUMN_NAME, type: c.DATA_TYPE })));
            });
            cache._fp = fingerprint;
          }
          const { allTabs, allCols, allDbs } = cache;

          const line = model.getLineContent(pos.lineNumber);
          const before = line.substring(0, pos.column - 1).trim();
          const beforeUpper = before.toUpperCase();
          const tokens = beforeUpper.split(/\s+/);
          const lastToken = tokens[tokens.length - 1] || '';

          const dotIdx = line.lastIndexOf('.', pos.column - 2);
          let dotTable = '';
          if (dotIdx >= 0) {
            const bd = line.substring(0, dotIdx).trim().split(/\s+/);
            dotTable = (bd[bd.length - 1] || '').replace(/[\`"'[\]]/g, '');
          }

          const MAX_SUGGESTIONS = 2000;
          const afterFrom = /\bFROM\s*$/i.test(beforeUpper) || /\bJOIN\s*$/i.test(beforeUpper) || /\bINTO\s*$/i.test(beforeUpper) || /\bUPDATE\s*$/i.test(beforeUpper) || /\bTABLE\s*$/i.test(beforeUpper);
          const afterSel = /\bSELECT\s*$/i.test(beforeUpper) || /,\s*$/i.test(beforeUpper) || /\bSELECT\s+[^\n]*,\s*$/i.test(beforeUpper);
          const afterWhere = /\bWHERE\s*$/i.test(beforeUpper) || /\bAND\s*$/i.test(beforeUpper) || /\bOR\s*$/i.test(beforeUpper) || /\bON\s*$/i.test(beforeUpper) || /\bSET\s*$/i.test(beforeUpper) || /\bHAVING\s*$/i.test(beforeUpper) || /\bBY\s*$/i.test(beforeUpper);
          const typingWord = wordText.length > 0;

          const sug = [];

          if (dotTable) {
            allCols.filter(c => c.table.toLowerCase() === dotTable.toLowerCase()).forEach(c => sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: c.type, range }));
            if (sug.length) return { suggestions: sug };
          }

          if (afterFrom) {
            allTabs.forEach(t => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: t.name, kind: t.type === 'VIEW' ? edMonaco.languages.CompletionItemKind.Struct : edMonaco.languages.CompletionItemKind.Class, insertText: t.name, detail: `${t.db} \u00B7 ${t.type || 'TABLE'}`, range, sortText: '0' + t.name }); });
            allDbs.forEach(db => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: db, kind: edMonaco.languages.CompletionItemKind.Module, insertText: db, detail: 'database', range, sortText: '1' + db }); });
            if (typingWord) sug.forEach(s => { s.filterText = s.label; });
            if (sug.length) return { suggestions: sug };
          }

          if (afterSel) {
            allCols.forEach(c => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: `${c.table} \u00B7 ${c.type}`, range, sortText: '0' + c.col }); });
            allTabs.forEach(t => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: t.name + '.*', kind: edMonaco.languages.CompletionItemKind.Field, insertText: t.name + '.*', detail: `all columns of ${t.name}`, range, sortText: '2' + t.name }); });
            if (typingWord) sug.forEach(s => { s.filterText = s.label; });
            if (sug.length) return { suggestions: sug };
          }

          if (afterWhere) {
            allCols.forEach(c => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: `${c.table} \u00B7 ${c.type}`, range, sortText: '0' + c.col }); });
            if (typingWord) sug.forEach(s => { s.filterText = s.label; });
            if (sug.length) return { suggestions: sug };
          }

          let cnt = 0;
          allTabs.forEach(t => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: t.name, kind: t.type === 'VIEW' ? edMonaco.languages.CompletionItemKind.Struct : edMonaco.languages.CompletionItemKind.Class, insertText: t.name, detail: `${t.db} \u00B7 ${t.type || 'TABLE'}`, range, sortText: '0' + t.name }); });
          allCols.forEach(c => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: `${c.table} \u00B7 ${c.type}`, range, sortText: '1' + c.col }); });
          allDbs.forEach(db => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: db, kind: edMonaco.languages.CompletionItemKind.Module, insertText: db, detail: 'database', range, sortText: '2' + db }); });
          FN.forEach(fn => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: fn, kind: edMonaco.languages.CompletionItemKind.Function, insertText: fn + '()', detail: 'function', range, sortText: 'y' + fn }); });
          KW.forEach(kw => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: kw, kind: edMonaco.languages.CompletionItemKind.Keyword, insertText: kw + ' ', detail: 'keyword', range, sortText: 'z' + kw }); });

          if (typingWord) sug.forEach(s => { if (!s.filterText) s.filterText = s.label; });
          return { suggestions: sug };
        } catch (e) {
          console.error('Completion error:', e);
          return { suggestions: [] };
        }
      },
    });
    return () => cpRef.current?.dispose();
  }, [edMonaco]);
  /* ----- Dismiss tab list menu on outside click ----- */
  useEffect(() => {
    const h = (e) => {
      const menu = document.getElementById('tab-list-menu');
      if (menu && menu.style.display === 'block' && !e.target.closest('#tab-list-menu') && !e.target.closest('.tab-list-btn')) {
        menu.style.display = 'none';
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ----- Ctrl+F / Cmd+F tree search shortcut ----- */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const active = document.activeElement;
        if (active && (active.closest('.monaco-editor') || active.closest('input[type="text"]') || active.closest('textarea'))) return;
        e.preventDefault();
        treeSearchRef.current?.focus();
        treeSearchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  /* ----- Export result ----- */
  const exportResult = useCallback(async (format) => {
    if (!activeTab) return;
    const tab = openTabs.find(t => t.id === activeTab?.id);
    if (!tab) return;
    let sql = '';
    if (tab.type === 'query' && (tab.results || tab.batchResults)) {
      sql = tab.singleResult?.sql || tab.sql || '';
    } else if (tab.type === 'table') {
      sql = `SELECT * FROM \`${tab.dbName}\`.\`${tab.tName}\` LIMIT 10000`;
    } else return;
    if (!sql) { toast('No query to export', 'warning'); return; }
    try {
      const instId = tab.instId;
      const resp = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId, sql, format }) });
      if (!resp.ok) { const err = await resp.json(); throw new Error(err.error || 'Export failed'); }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Exported as ${format.toUpperCase()}`, 'success');
    } catch (e) {
      toast('Export failed: ' + (e.message || String(e)), 'error');
    }
  }, [activeTab, openTabs, toast]);

  /* ----- Cancel query ----- */
  const cancelQuery = useCallback(async () => {
    if (!activeTab) return;
    const instId = activeTab.instId;
    if (!instId) return;
    try {
      const r = await api('/api/cancel-query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId }) });
      if (r.ok) toast('Query cancelled', 'warning');
      else toast('Cancel failed', 'error');
    } catch (e) {
      toast('Cancel failed', 'error');
    }
  }, [activeTab, toast]);


  /* ==================== RENDER ==================== */
  return (
    <div className="app-shell">
      <div className="toolbar">
        <div className="toolbar-left">
          <span className="toolbar-title">Surge</span>
          <span className="toolbar-spacer" />
          <button className="toolbar-btn accent" onClick={() => {
            setMName(''); setMHost('127.0.0.1'); setMPort(3306); setMUser('root'); setMPass(''); setMDb(''); setMSave(true); setMResult(null); setShowModal(true);
          }}>+ New Connection</button>
          <div style={{ position: 'relative' }}>
            <button className="toolbar-btn" onClick={() => setShowQueryPicker(v => !v)}>+ New Query</button>
            <QueryPicker
              instances={instances}
              savedConns={savedConns}
              showPicker={showQueryPicker}
              onClose={() => { setShowQueryPicker(false); setPickerDbSearch(''); }}
              pickerExpand={pickerExpand}
              setPickerExpand={setPickerExpand}
              pickerConnecting={pickerConnecting}
              setPickerConnecting={setPickerConnecting}
              pickerDbSearch={pickerDbSearch}
              setPickerDbSearch={setPickerDbSearch}
              connSaved={connSaved}
              newQuery={newQuery}
              loadTabs={loadTabs}
              setInstances={setInstances}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <a className="github-link" href="https://github.com/chenjunwenhao/MySQL-Explorer" target="_blank" rel="noopener noreferrer" title="GitHub">
            <FaGithub size={16} />
            <span className="github-tip">
              <div className="github-tip-title">Surge — 开源项目</div>
              欢迎 Star / PR / Issue<br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>github.com/chenjunwenhao/MySQL-Explorer</span>
            </span>
          </a>
          <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} title="Toggle theme">
            {theme === 'dark' ? '\u2600' : '\u263D'}
          </button>
          <span className="status-text">{status}</span>
        </div>
      </div>

      <div className="main-layout">
        <div className="sidebar" style={{ width: sidebarW }}>
          <div className="sidebar-section">
            <div className={`sidebar-section-header${sc.saved ? ' collapsed' : ''}`} onClick={() => setSc(p => ({ ...p, saved: !p.saved }))}>
              <span>Saved Connections</span>
              <span className="toggle-icon">{'\u25B2'}</span>
            </div>
            {!sc.saved && (
              <div className="sidebar-section-body">
                {savedConns.length === 0 ? <div className="tree-empty">None saved</div>
                  : savedConns.map(c => (
                    <div key={c.id} className="saved-item" onDoubleClick={() => connSaved(c)}>
                      <div className="saved-item-main">
                        <div className="saved-item-name">{c.name}</div>
                        <div className="saved-item-detail">{c.user}@{c.host}:{c.port}/{c.database}</div>
                      </div>
                      <div className="saved-item-actions">
                        <button className="btn-icon" onClick={() => connSaved(c)} title="Connect">{I.run}</button>
                        <button className="btn-icon" onClick={() => editSaved(c)} title="Edit">{I.edit}</button>
                        <button className="btn-icon danger" onClick={() => delSaved(c.id)} title="Delete">{I.close}</button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="tree-scroll">
            <div className="sidebar-section-header" style={{ padding: '8px 12px', cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Database Explorer</span>
              {instances.length > 0 && <button className="btn-icon" onClick={() => instances.forEach(inst => refreshInst(inst.id))} title="Refresh all (Ctrl+R)">{I.refresh}</button>}
            </div>
            {instances.length > 0 && (
              <div className={`tree-search-wrap${treeSearch ? ' active' : ''}`}>
                <input className="conn-input tree-search-input" ref={treeSearchRef}
                  placeholder={`${I.search} Search databases / tables...`}
                  value={treeSearch}
                  onChange={e => setTreeSearch(e.target.value)}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Escape') { setTreeSearch(''); e.target.blur(); } }}
                />
                {treeSearch && (
                  <button className="tree-search-clear" onClick={() => { setTreeSearch(''); treeSearchRef.current?.focus(); }}
                    title="Clear search (Esc)">{I.close}</button>
                )}
              </div>
            )}
            <SidebarTree
              instances={instances}
              treeSearch={treeSearch}
              collapsedGroups={collapsedGroups}
              setCollapsedGroups={setCollapsedGroups}
              treeErrors={treeErrors}
              refreshing={refreshing}
              toggleInst={toggleInst}
              openConsole={openConsole}
              toggleDb={toggleDb}
              openTable={openTable}
              toggleTbl={toggleTbl}
              refreshInst={refreshInst}
              disconnectInst={disconnectInst}
              onCtx={onCtx}
            />
          </div>
        </div>

        <div className="resizer" ref={rezRef} onMouseDown={() => { rezFlag.current = true; }} />

        <div className="content-area">
          <div className="tab-bar">
            {openTabs.map(t => (
              <div key={t.id} className={`tab-item${t.id === activeTabId ? ' active' : ''}`} onClick={() => setActiveTabId(t.id)}>
                <span>{t.type === 'table' ? I.table : I.sql}</span>
                <span>{t.title}</span>
                {t.db && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>· {t.db}</span>}
                <span className="tab-close" onClick={e => { e.stopPropagation(); closeTab(t.id); }}>{I.close}</span>
              </div>
            ))}
            <button className="tab-add" onClick={() => setShowQueryPicker(v => !v)} title="New Query">+</button>
            {openTabs.length > 5 && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button className="tab-list-btn" title="All tabs" onClick={(e) => {
                  const menu = document.getElementById('tab-list-menu');
                  if (menu) {
                    const rect = e.target.getBoundingClientRect();
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                    menu.style.top = (rect.bottom + 4) + 'px';
                    menu.style.left = (rect.left - 120) + 'px';
                  }
                }}>{'≡'}</button>
                <div id="tab-list-menu" className="tab-list-menu" style={{ display: 'none' }}>
                  {openTabs.map(t => (
                    <div key={t.id} className={`tab-list-item${t.id === activeTabId ? ' active' : ''}`}
                      onClick={() => { setActiveTabId(t.id); const m = document.getElementById('tab-list-menu'); if (m) m.style.display = 'none'; }}>
                      <span>{t.type === 'table' ? I.table : I.sql}</span>
                      <span className="tab-list-title">{t.title}</span>
                      <span className="tab-list-close" onClick={e => { e.stopPropagation(); closeTab(t.id); }}>{'×'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <TabContent
            activeTab={activeTab}
            instances={instances}
            selInst={selInst}
            openTabs={openTabs}
            setOpenTabs={setOpenTabs}
            setActiveTabId={setActiveTabId}
            setStatus={setStatus}
            setShowModal={setShowModal}
            setMName={setMName}
            setMHost={setMHost}
            setMPort={setMPort}
            setMUser={setMUser}
            setMPass={setMPass}
            setMDb={setMDb}
            setMSave={setMSave}
            setMResult={setMResult}
            execQuery={execQuery}
            explainQuery={explainQuery}
            fmtSQL={fmtSQL}
            txAction={txAction}
            reopenTab={reopenTab}
            closeTab={closeTab}
            setSub={setSub}
            cellEdit={cellEdit}
            saveRow={saveRow}
            refreshTab={refreshTab}
            loadTabs={loadTabs}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            queryHistory={queryHistory}
            setQueryHistory={setQueryHistory}
            newQuery={newQuery}
            closedTabs={closedTabs}
            batchExpanded={batchExpanded}
            setBatchExpanded={setBatchExpanded}
            edMonaco={edMonaco}
            setEdMonaco={setEdMonaco}
            monacoRef={monacoRef}
            edRef={edRef}
            instancesRef={instancesRef}
            editorSplitPct={editorSplitPct}
            setEditorSplitPct={setEditorSplitPct}
            rezVRef={rezVRef}
            rezVFlag={rezVFlag}
            dbPickerTabId={dbPickerTabId}
            setDbPickerTabId={setDbPickerTabId}
            dbPickerSearch={dbPickerSearch}
            setDbPickerSearch={setDbPickerSearch}
            exportResult={exportResult}
            cancelQuery={cancelQuery}
            theme={theme}
          />
        </div>
      </div>

      <ContextMenu
        ctxMenu={ctxMenu}
        setCtxMenu={setCtxMenu}
        openTable={openTable}
        loadDDL={loadDDL}
        loadIdx={loadIdx}
        refreshDb={refreshDb}
        openConsole={openConsole}
        disconnectInst={disconnectInst}
        setOpenTabs={setOpenTabs}
        setActiveTabId={setActiveTabId}
      />

      <ConnectionModal
        show={showModal}
        onClose={() => setShowModal(false)}
        mEditId={mEditId}
        mName={mName} setMName={setMName}
        mHost={mHost} setMHost={setMHost}
        mPort={mPort} setMPort={setMPort}
        mUser={mUser} setMUser={setMUser}
        mPass={mPass} setMPass={setMPass}
        mDb={mDb} setMDb={setMDb}
        mSave={mSave} setMSave={setMSave}
        mTesting={mTesting}
        mResult={mResult}
        onTest={testConn}
        onConnect={modalConnect}
      />
    </div>
  );
}
