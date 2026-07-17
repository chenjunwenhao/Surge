import { useEffect, useRef, useState, useCallback } from 'react';
import { FaGithub } from 'react-icons/fa';
import api from './utils/api';
import I from './utils/icons';
import { useToast } from './components/Toast';
import ConnectionModal from './components/ConnectionModal';
import SidebarTree from './components/SidebarTree';
import QueryPicker from './components/QueryPicker';
import ContextMenu from './components/ContextMenu';
import TabContent from './components/TabContent';
import ConfirmDialog from './components/ConfirmDialog';
import GenerateSqlModal from './components/GenerateSqlModal';
import ImportModal from './components/ImportModal';
import useMonacoAutocomplete from './hooks/useMonacoAutocomplete';
import useSidebar from './hooks/useSidebar';
import useConnections from './hooks/useConnections';
import useQueryExecution from './hooks/useQueryExecution';

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
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('editor-font-size');
    return saved ? parseInt(saved, 10) : 14;
  });
  const [tabCtxMenu, setTabCtxMenu] = useState(null);
  const [genSqlModal, setGenSqlModal] = useState(null);
  const [importModal, setImportModal] = useState(null);
  const [sidebarFocusIdx, setSidebarFocusIdx] = useState(null);
  const sidebarScrollRef = useRef(null);

  /* ----- Font size persist ----- */
  useEffect(() => {
    localStorage.setItem('editor-font-size', fontSize);
  }, [fontSize]);

  /* ----- Tab session restore ----- */
  useEffect(() => {
    // Restore tabs on mount (light-weight: only structure, no data)
    try {
      const saved = localStorage.getItem('session-tabs');
      if (saved) {
        const tabs = JSON.parse(saved);
        if (Array.isArray(tabs) && tabs.length > 0) {
          const restored = tabs.map(t => ({
            ...t,
            results: null, fields: [], error: null,
            rows: [], columns: [], pkColumns: [], dirtyRows: {},
            loading: false, ddl: '', indexes: [],
          }));
          setOpenTabs(restored);
          // Don't auto-activate - user may want to start fresh
        }
        // Clear after restore to avoid stale data
        localStorage.removeItem('session-tabs');
      }
    } catch (_) {}
  }, []); // runs once on mount

  // Save tab structure on change (for next session)
  useEffect(() => {
    if (openTabs.length === 0) return;
    // Only save structural info, not heavy data
    const slim = openTabs.map(t => ({
      id: t.id,
      type: t.type,
      title: t.title,
      instId: t.instId,
      db: t.db,
      dbName: t.dbName,
      tName: t.tName,
      subTab: t.subTab,
      sql: t.sql,
    }));
    try { localStorage.setItem('session-tabs', JSON.stringify(slim)); } catch (_) {}
  }, [openTabs]);

  /* ----- Theme effect ----- */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  /* ----- Sidebar tree keyboard focus ----- */
  useEffect(() => {
    const container = sidebarScrollRef.current;
    if (!container) return;
    const nodes = container.querySelectorAll('.tree-node');
    nodes.forEach(n => n.classList.remove('tree-focused'));
    if (sidebarFocusIdx !== null && nodes[sidebarFocusIdx]) {
      nodes[sidebarFocusIdx].classList.add('tree-focused');
      nodes[sidebarFocusIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [sidebarFocusIdx, instances, treeSearch, collapsedGroups]);

  /* ----- Monaco ----- */
  const [edMonaco, setEdMonaco] = useState(null);
  const edRef = useRef(null);
  const monacoRef = useRef(null);
  const rezRef = useRef(null);
  const rezFlag = useRef(false);
  const rezVRef = useRef(null);
  const rezVFlag = useRef(false);
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const [running, setRunning] = useState(false);
  const instancesRef = useRef(instances);
  instancesRef.current = instances;

  /* ----- Derived ----- */
  const activeTab = openTabs.find(t => t.id === activeTabId) || null;
  const selInst = instances[0] || null;

  /* ----- Utils ----- */
  const toast = useToast();
  const err = useCallback(m => { setStatus(`Error: ${m}`); toast(m, 'error'); }, [toast]);

  /* ----- Auto-reconnect ----- */
  const lastPingRef = useRef({});

  /* ----- Sidebar / data loading ----- */
  const {
    ensureConnected, loadDbs, loadTabs, loadCols, loadDDL, loadIdx, loadFKs,
    loadRoutines, loadTriggers, loadRoutineDDL, loadTriggerDDL,
    refreshInst, refreshDb, toggleInst, toggleDb, toggleTbl,
  } = useSidebar({ setInstances, setOpenTabs, instancesRef, setStatus, toast, err, lastPingRef, setTreeErrors, setRefreshing });

  /* ----- Query execution ----- */
  const { doQuery, execQuery, fmtSQL, cancelQuery, explainQuery, txAction } = useQueryExecution({
    edRef, abortRef, timerRef, instancesRef, selInst,
    setOpenTabs, setStatus, setRunning, setQueryHistory,
    activeTab, ensureConnected, loadTabs, err,
  });

  /* ----- Connections ----- */
  const {
    loadSaved, testConn, modalConnect, connSaved, delSaved, editSaved, disconnectInst, askConfirm,
    showModal, setShowModal, mName, setMName, mHost, setMHost, mPort, setMPort,
    mUser, setMUser, mPass, setMPass, mDb, setMDb, mSave, setMSave,
    mTesting, mResult, setMResult, mEditId, setMEditId, confirmDialog, setConfirmDialog,
    connecting,
  } = useConnections({ setInstances, setSavedConns, setOpenTabs, instancesRef, setStatus, toast, err, setTreeErrors, loadDbs, loadTabs });

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
    try {
      const [cols, qr, ddl, idx, fks] = await Promise.all([
        loadCols(effInstId, dbName, tName),
        doQuery(effInstId, `SELECT * FROM \`${dbName}\`.\`${tName}\` LIMIT 10000`),
        loadDDL(effInstId, dbName, tName),
        loadIdx(effInstId, dbName, tName),
        loadFKs(effInstId, dbName, tName),
      ]);
      const pks = cols.filter(c => c.COLUMN_KEY === 'PRI').map(c => c.COLUMN_NAME);
      setOpenTabs(p => p.map(t => t.id === tid ? { ...t, loading: false, columns: cols, rows: qr.ok ? qr.rows : [], fields: qr.ok ? qr.fields : [], pkColumns: pks, dirtyRows: {}, ddl, indexes: idx, foreignKeys: fks } : t));
      setStatus(`${tName} — ${qr.rows?.length || 0} rows`);
    } catch (e) {
      setOpenTabs(p => p.map(t => t.id === tid ? { ...t, loading: false, error: e.message || String(e) } : t));
      setStatus(`Failed to open ${tName}: ${e.message || String(e)}`);
    }
  }, [openTabs, loadCols, doQuery, loadDDL, loadIdx, loadFKs, ensureConnected]);

  /* ----- Open routine DDL tab ----- */
  const openRoutine = useCallback(async (instId, dbName, name, type) => {
    const label = type === 'FUNCTION' ? 'Function' : 'Procedure';
    let effInstId = instId;
    try { effInstId = await ensureConnected(instId); } catch (e) {
      setStatus('Reconnect failed: ' + (e.message || String(e)));
      return;
    }
    const tid = `routine:${effInstId}:${dbName}:${name}`;
    if (openTabs.find(t => t.id === tid)) { setActiveTabId(tid); return; }
    const nt = { id: tid, type: 'table', title: `${label}-${name}`, instId: effInstId, dbName, tName: name, subTab: 'ddl', ddl: '', loading: true, columns: [], rows: [], pkColumns: [], dirtyRows: {}, indexes: [], objectType: 'routine' };
    setOpenTabs(p => [...p, nt]); setActiveTabId(tid);
    try {
      const ddl = await loadRoutineDDL(effInstId, dbName, name, type);
      setOpenTabs(p => p.map(t => t.id === tid ? { ...t, loading: false, ddl } : t));
      setStatus(`${label} — ${name}`);
    } catch (e) {
      setOpenTabs(p => p.map(t => t.id === tid ? { ...t, loading: false, error: e.message || String(e) } : t));
      setStatus(`Failed to open ${name}: ${e.message || String(e)}`);
    }
  }, [openTabs, loadRoutineDDL, ensureConnected]);

  /* ----- Open trigger DDL tab ----- */
  const openTrigger = useCallback(async (instId, dbName, name) => {
    let effInstId = instId;
    try { effInstId = await ensureConnected(instId); } catch (e) {
      setStatus('Reconnect failed: ' + (e.message || String(e)));
      return;
    }
    const tid = `trigger:${effInstId}:${dbName}:${name}`;
    if (openTabs.find(t => t.id === tid)) { setActiveTabId(tid); return; }
    const nt = { id: tid, type: 'table', title: `Trigger-${name}`, instId: effInstId, dbName, tName: name, subTab: 'ddl', ddl: '', loading: true, columns: [], rows: [], pkColumns: [], dirtyRows: {}, indexes: [], objectType: 'trigger' };
    setOpenTabs(p => [...p, nt]); setActiveTabId(tid);
    try {
      const ddl = await loadTriggerDDL(effInstId, dbName, name);
      setOpenTabs(p => p.map(t => t.id === tid ? { ...t, loading: false, ddl } : t));
      setStatus(`Trigger — ${name}`);
    } catch (e) {
      setOpenTabs(p => p.map(t => t.id === tid ? { ...t, loading: false, error: e.message || String(e) } : t));
      setStatus(`Failed to open ${name}: ${e.message || String(e)}`);
    }
  }, [openTabs, loadTriggerDDL, ensureConnected]);

  const openTabsRef = useRef(openTabs);
  openTabsRef.current = openTabs;
  const selInstRef = useRef(selInst);
  selInstRef.current = selInst;
  const refs = useRef({ activeTabId: null, closeTab: null, showHistory: false, setShowHistory: null });

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

  const closeOtherTabs = useCallback((tid) => {
    setOpenTabs(p => p.filter(t => t.id === tid));
    setActiveTabId(tid);
  }, []);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabId(null);
  }, []);

  const closeTabsToRight = useCallback((tid) => {
    setOpenTabs(p => {
      const idx = p.findIndex(t => t.id === tid);
      if (idx < 0) return p;
      const r = p.slice(0, idx + 1);
      if (activeTabId && !r.find(t => t.id === activeTabId)) setActiveTabId(tid);
      return r;
    });
  }, [activeTabId]);

  const closeTabsToLeft = useCallback((tid) => {
    setOpenTabs(p => {
      const idx = p.findIndex(t => t.id === tid);
      if (idx < 0) return p;
      const r = p.slice(idx);
      setActiveTabId(tid);
      return r;
    });
  }, []);

  const reopenTab = useCallback(() => {
    setClosedTabs(prev => {
      if (!prev.length) return prev;
      const [tab, ...rest] = prev;
      setOpenTabs(p => { if (p.find(t => t.id === tab.id)) return p; return [...p, tab]; });
      setActiveTabId(tab.id);
      return rest;
    });
  }, []);

  /* ----- Cell editing ----- */
  const cellEdit = useCallback((tid, ri, cn, val) => {
    setOpenTabs(p => p.map(t => {
      if (t.id !== tid) return t;
      const rows = [...(t.rows || [])]; rows[ri] = { ...rows[ri], [cn]: val };
      return { ...t, rows, dirtyRows: { ...(t.dirtyRows || {}), [ri]: { ...((t.dirtyRows || {})[ri] || {}), [cn]: true } } };
    }));
  }, []);

  const saveRow = useCallback(async (tab) => {
    if (!tab.pkColumns?.length) { err('No primary key — cannot save'); return; }
    const dirtyEntries = Object.entries(tab.dirtyRows || {});
    if (!dirtyEntries.length) return;
    setStatus('Saving...');
    let saved = 0, failed = 0;
    const errors = [];
    for (const [key, dirtyCols] of dirtyEntries) {
      const ri = Number(key);
      const row = tab.rows[ri];
      if (!row) continue;
      const pk = {};
      tab.pkColumns.forEach(c => { pk[c] = row[c]; });
      // Only include columns that were actually edited
      const ups = {};
      const changedColNames = Object.keys(dirtyCols || {});
      changedColNames.forEach(cn => {
        if (!tab.pkColumns.includes(cn)) ups[cn] = row[cn];
      });
      if (!Object.keys(ups).length) continue; // no non-PK columns changed
      try {
        const r = await api('/api/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId: tab.instId, database: tab.dbName, table: tab.tName, pk, updates: ups }) });
        if (r.ok) saved++;
        else { failed++; errors.push(r.error || 'Unknown error'); }
      } catch (e) { failed++; errors.push(e.message || String(e)); }
    }
    if (failed === 0) {
      setStatus('Rows saved: ' + saved);
      toast(saved + ' row(s) saved', 'success');
      setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, dirtyRows: {} } : t));
    } else {
      const firstErr = errors[0] || 'Unknown error';
      setStatus(`Saved ${saved}, ${failed} failed — ${firstErr}`);
      if (saved > 0) {
        toast(`Saved ${saved}, ${failed} failed — ${firstErr}`, 'warning');
        setOpenTabs(p => p.map(t => t.id === tab.id ? { ...t, dirtyRows: {} } : t));
      } else {
        toast(`Save failed: ${firstErr}`, 'error');
      }
    }
  }, [err, toast]);

  /* ----- Refresh table data tab ----- */
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

  /* ----- Insert row ----- */
  const insertRow = useCallback(async (tab, row) => {
    if (!tab.tName) { err('No table'); return; }
    setStatus('Inserting...');
    try {
      const r = await api('/api/insert', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: tab.instId, table: `${tab.dbName}.${tab.tName}`, row }) });
      if (r.ok) {
        toast('Row inserted', 'success');
        setStatus('Row inserted');
        // Refresh the table data
        refreshTab(tab);
      } else {
        err(r.error || 'Insert failed');
        setStatus('Insert failed');
      }
    } catch (e) {
      err('Insert failed: ' + (e.message || String(e)));
      setStatus('Insert failed');
    }
  }, [err, toast, refreshTab]);

  /* ----- Delete rows ----- */
  const deleteRows = useCallback(async (tab, rowIndices) => {
    if (!tab.pkColumns?.length) { err('No primary key — cannot delete safely'); return; }
    if (!rowIndices?.length) return;
    const selRows = rowIndices.map(i => tab.rows[i]).filter(Boolean);
    if (!selRows.length) return;
    setStatus('Deleting...');
    let deleted = 0, failed = 0;
    const errors = [];
    for (const row of selRows) {
      const pk = {};
      tab.pkColumns.forEach(c => { pk[c] = row[c]; });
      try {
        const r = await api('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId: tab.instId, table: `${tab.dbName}.${tab.tName}`, pk }) });
        if (r.ok) deleted++;
        else { failed++; errors.push(r.error || 'Unknown error'); }
      } catch (e) { failed++; errors.push(e.message || String(e)); }
    }
    if (failed === 0) {
      setStatus('Rows deleted: ' + deleted);
      toast(deleted + ' row(s) deleted', 'success');
      // Refresh the table data
      refreshTab(tab);
    } else {
      const firstErr = errors[0] || 'Unknown error';
      setStatus(`Deleted ${deleted}, ${failed} failed — ${firstErr}`);
      if (deleted > 0) {
        toast(`Deleted ${deleted}, ${failed} failed — ${firstErr}`, 'warning');
        refreshTab(tab);
      } else {
        toast(`Delete failed: ${firstErr}`, 'error');
      }
    }
  }, [err, toast, refreshTab]);

  /* ----- Sub-tab switch ----- */
  const setSub = useCallback((tid, st) => setOpenTabs(p => p.map(t => t.id === tid ? { ...t, subTab: st } : t)), []);

  /* ----- Context menu ----- */
  const onCtx = useCallback((e, instId, dbName, tName, type) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, instId, dbName, tName, type }); }, []);
  const onCtxTab = useCallback((e, tabId) => { e.preventDefault(); setTabCtxMenu({ x: e.clientX, y: e.clientY, tabId }); }, []);
  useEffect(() => { const h = () => { setCtxMenu(null); setTabCtxMenu(null); }; document.addEventListener('click', h); return () => document.removeEventListener('click', h); }, []);
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
  useMonacoAutocomplete(edMonaco, instancesRef);

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

  /* keep refs in sync for keyboard handler */
  refs.current = { activeTabId, closeTab, showHistory, setShowHistory };

  /* ----- Ctrl+F / Cmd+F tree search, Ctrl+W close tab shortcuts ----- */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const active = document.activeElement;
        if (active && (active.closest('.monaco-editor') || active.closest('input[type="text"]') || active.closest('textarea'))) return;
        e.preventDefault();
        treeSearchRef.current?.focus();
        treeSearchRef.current?.select();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        const active = document.activeElement;
        if (active && active.closest('.monaco-editor')) return;
        e.preventDefault();
        const { activeTabId: aid, closeTab: ct } = refs.current;
        if (aid) ct(aid);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        const active = document.activeElement;
        if (active && active.closest('.monaco-editor')) return;
        e.preventDefault();
        const { showHistory: sh, setShowHistory: ssh } = refs.current;
        if (ssh) ssh(!sh);
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

  /* ----- Export Dump ----- */
  const onDump = useCallback(async (instId, dbName, tName, mode = 'all') => {
    const modeLabel = { all: 'Structure + Data', structure: 'Structure Only', data: 'Data Only' }[mode] || mode;
    const label = tName ? `${tName}` : dbName;
    try {
      setStatus(`Exporting dump (${modeLabel}) for ${label}...`);
      toast(`Exporting dump (${modeLabel}) for ${label}...`);
      const resp = await fetch('/api/dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: instId, database: dbName, table: tName || undefined, mode }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let suffix = '';
      if (mode === 'structure') suffix = '_structure';
      else if (mode === 'data') suffix = '_data';
      a.download = tName ? `${dbName}_${tName}${suffix}.sql` : `${dbName}${suffix}_dump.sql`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Dump exported (${modeLabel}): ${label}`);
      toast(`Dump exported (${modeLabel}): ${label}`, 'success');
    } catch (e) {
      setStatus(`Dump failed: ${e.message}`);
      toast('Dump failed: ' + (e.message || String(e)), 'error');
    }
  }, [toast]);

  /* ----- Generate DML ----- */
  const generateDml = useCallback((rows, fields, tableName, pkColumns) => {
    setGenSqlModal({ rows, fields, tableName, pkColumns });
  }, []);

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
          <a className="github-link" href="https://github.com/chenjunwenhao/Surge" target="_blank" rel="noopener noreferrer" title="GitHub">
            <FaGithub size={16} />
            <span className="github-tip">
              <div className="github-tip-title">Surge — 开源项目</div>
              欢迎 Star / PR / Issue<br />
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>github.com/chenjunwenhao/Surge</span>
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
            {connecting && (
              <div className="connecting-indicator">
                <div className="spinner" />
                <span>Connecting to {connecting}...</span>
              </div>
            )}
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
            <div ref={sidebarScrollRef} onKeyDown={(e) => {
              const container = sidebarScrollRef.current;
              if (!container) return;
              // Only handle keys when tree area has focus (not search input)
              if (e.target.closest('input, textarea')) return;
              const nodes = container.querySelectorAll('.tree-node');
              if (nodes.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = sidebarFocusIdx === null ? 0 : Math.min(sidebarFocusIdx + 1, nodes.length - 1);
                setSidebarFocusIdx(next);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = sidebarFocusIdx === null ? nodes.length - 1 : Math.max(sidebarFocusIdx - 1, 0);
                setSidebarFocusIdx(prev);
              } else if (e.key === 'Enter' && sidebarFocusIdx !== null && nodes[sidebarFocusIdx]) {
                e.preventDefault();
                nodes[sidebarFocusIdx].click();
                setSidebarFocusIdx(null);
              }
            }} tabIndex={0}>
            <SidebarTree
              instances={instances}
              treeSearch={treeSearch}
              clearTreeSearch={() => setTreeSearch('')}
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
              refreshDb={refreshDb}
              disconnectInst={disconnectInst}
              onCtx={onCtx}
              openRoutine={openRoutine}
              openTrigger={openTrigger}
              setOpenTabs={setOpenTabs}
              setActiveTabId={setActiveTabId}
              loadCols={loadCols}
            />
            </div>
          </div>
        </div>

        <div className="resizer" ref={rezRef} onMouseDown={() => { rezFlag.current = true; }} />

        <div className="content-area">
          <div className="tab-bar">
            {openTabs.map(t => (
              <div key={t.id} className={`tab-item${t.id === activeTabId ? ' active' : ''}`}
                onClick={() => setActiveTabId(t.id)}
                onContextMenu={(e) => onCtxTab(e, t.id)}>
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
            cancelQuery={cancelQuery}
            running={running}
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
            generateDml={generateDml}
            insertRow={insertRow}
            deleteRows={deleteRows}
            toast={toast}
            theme={theme}
            fontSize={fontSize}
            setFontSize={setFontSize}
          />
        </div>
      </div>

      <ContextMenu
        ctxMenu={ctxMenu}
        setCtxMenu={setCtxMenu}
        openTable={openTable}
        loadDDL={loadDDL}
        loadIdx={loadIdx}
        loadCols={loadCols}
        refreshDb={refreshDb}
        openConsole={openConsole}
        disconnectInst={disconnectInst}
        setOpenTabs={setOpenTabs}
        setActiveTabId={setActiveTabId}
        onImport={(instId, db, tbl) => setImportModal({ instId, dbName: db, tName: tbl })}
        onDump={onDump}
        openRoutine={openRoutine}
        openTrigger={openTrigger}
      />

      {tabCtxMenu && (
        <div className="context-menu" style={{ left: tabCtxMenu.x, top: tabCtxMenu.y }}>
          <div className="context-menu-item" onClick={() => { closeTab(tabCtxMenu.tabId); setTabCtxMenu(null); }}>{I.close} Close Tab</div>
          <div className="context-menu-item" onClick={() => { closeOtherTabs(tabCtxMenu.tabId); setTabCtxMenu(null); }}>Close Others</div>
          <div className="context-menu-item" onClick={() => { closeTabsToRight(tabCtxMenu.tabId); setTabCtxMenu(null); }}>Close to Right</div>
          <div className="context-menu-item" onClick={() => { closeTabsToLeft(tabCtxMenu.tabId); setTabCtxMenu(null); }}>Close to Left</div>
          <div className="context-menu-item" onClick={() => { closeAllTabs(); setTabCtxMenu(null); }}>Close All</div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={() => { reopenTab(); setTabCtxMenu(null); }}>Reopen Closed Tab</div>
        </div>
      )}

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

      <ConfirmDialog
        show={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message || ''}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirm'}
        onConfirm={() => { confirmDialog?.resolve(true); setConfirmDialog(null); }}
        onCancel={() => { confirmDialog?.resolve(false); setConfirmDialog(null); }}
      />

      <GenerateSqlModal
        show={!!genSqlModal}
        rows={genSqlModal?.rows}
        fields={genSqlModal?.fields}
        tableName={genSqlModal?.tableName}
        pkColumns={genSqlModal?.pkColumns}
        onClose={() => setGenSqlModal(null)}
        toast={toast}
      />

      <ImportModal
        show={!!importModal}
        instId={importModal?.instId}
        dbName={importModal?.dbName}
        tName={importModal?.tName}
        onClose={() => setImportModal(null)}
        toast={toast}
      />
    </div>
  );
}
