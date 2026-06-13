import { useCallback } from 'react';
import api from '../utils/api';

export default function useSidebar({
  setInstances, setOpenTabs, instancesRef, setStatus, toast, err,
  lastPingRef, setTreeErrors, setRefreshing,
}) {
  /* ----- Auto-reconnect ----- */
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
        const kept = new Set((r.tables || []).map(t => t.TABLE_NAME));
        const et = { ...(i.expandedTables || {}) };
        let cleaned = false;
        Object.keys(et).forEach(k => { if (!kept.has(k)) { delete et[k]; cleaned = true; } });
        return { ...i, dbTables: { ...(i.dbTables || {}), [dbName]: r.tables }, ...(cleaned ? { expandedTables: et } : {}) };
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

  /* ----- Load columns / DDL / indexes ----- */
  const loadCols = useCallback(async (instId, dbName, table) => {
    const r = await api(`/api/columns?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}&table=${encodeURIComponent(table)}`);
    if (r.ok) return r.columns;
    err(r.error); return [];
  }, [err]);

  const loadDDL = useCallback(async (instId, dbName, table) => {
    const r = await api(`/api/table-ddl?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}&table=${encodeURIComponent(table)}`);
    if (r.ok) return r.ddl;
    err(r.error); return '';
  }, [err]);

  const loadIdx = useCallback(async (instId, dbName, table) => {
    const r = await api(`/api/table-indexes?instanceId=${encodeURIComponent(instId)}&database=${encodeURIComponent(dbName)}&table=${encodeURIComponent(table)}`);
    if (r.ok) return r.indexes;
    err(r.error); return [];
  }, [err]);

  /* ----- Refresh instance ----- */
  const refreshInst = useCallback(async (instId) => {
    setStatus('Refreshing...');
    setRefreshing(p => ({ ...p, [instId]: true }));
    setTreeErrors(p => { const n = { ...p }; delete n[instId]; return n; });
    try {
      const effId = await ensureConnected(instId);
      await loadDbs(effId);
      const inst = instancesRef.current.find(i => i.id === effId);
      if (inst?.expanded) {
        const expDbs = Object.entries(inst.expandedDbs || {}).filter(([, v]) => v).map(([k]) => k);
        for (const dbName of expDbs) {
          try { await loadTabs(effId, dbName); } catch (_) {}
        }
      }
      setStatus('Refreshed');
      toast('Refreshed', 'success');
    } catch (e) {
      setTreeErrors(p => ({ ...p, [instId]: e.message || String(e) }));
      setStatus('Refresh failed');
    } finally {
      setRefreshing(p => { const n = { ...p }; delete n[instId]; return n; });
    }
  }, [ensureConnected, loadDbs, loadTabs, toast]);

  /* ----- Refresh database ----- */
  const refreshDb = useCallback(async (instId, dbName) => {
    setStatus('Refreshing...');
    const ek = `${instId}/${dbName}`;
    setRefreshing(p => ({ ...p, [ek]: true }));
    setTreeErrors(p => { const n = { ...p }; delete n[ek]; return n; });
    try {
      const effId = await ensureConnected(instId);
      await loadTabs(effId, dbName);
      setStatus('Refreshed');
      toast('Refreshed', 'success');
    } catch (e) {
      setTreeErrors(p => ({ ...p, [ek]: e.message || String(e) }));
      setStatus('Refresh failed');
    } finally {
      setRefreshing(p => { const n = { ...p }; delete n[ek]; return n; });
    }
  }, [ensureConnected, loadTabs, toast]);

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

  return {
    ensureConnected, loadDbs, loadTabs, loadCols, loadDDL, loadIdx,
    refreshInst, refreshDb, toggleInst, toggleDb, toggleTbl,
  };
}
