import { useCallback, useEffect, useState } from 'react';
import api from '../utils/api';

export default function useConnections({
  setInstances, setSavedConns, setOpenTabs,
  instancesRef, setStatus, toast, err, setTreeErrors,
  loadDbs, loadTabs,
}) {
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
  const [mEditId, setMEditId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const editOldNameRef = { current: '' };

  /* ----- Load saved connections ----- */
  const loadSaved = useCallback(async () => {
    const r = await api('/api/connections');
    if (r.ok) setSavedConns(r.connections || []);
    else err(r.error);
  }, [err]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

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

  /* ----- Confirm dialog helper ----- */
  const askConfirm = useCallback((title, message, confirmLabel) => {
    return new Promise((resolve) => {
      setConfirmDialog({ title, message, confirmLabel, resolve });
    });
  }, []);

  /* ----- Disconnect instance ----- */
  const disconnectInst = useCallback(async (instId) => {
    const instName = instancesRef.current.find(i => i.id === instId)?.name || instId;
    const ok = await askConfirm('Disconnect', `Disconnect from "${instName}"?`, 'Disconnect');
    if (!ok) return;
    setStatus('Disconnecting...');
    try {
      const r = await api('/api/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instanceId: instId }) });
      if (r.ok) {
        setInstances(p => p.map(i => i.id === instId ? { ...i, connected: false, expanded: false, databases: [], expandedDbs: {}, expandedTables: {}, dbTables: {}, tableColumns: {}, tableIndexes: {} } : i));
        toast('Disconnected: ' + instName, 'info');
        setStatus('Disconnected');
      } else {
        setStatus('Disconnect failed');
        toast('Disconnect failed', 'error');
      }
    } catch (e) {
      setStatus('Disconnect failed: ' + (e.message || String(e)));
      toast('Disconnect failed: ' + (e.message || String(e)), 'error');
    }
  }, [toast, askConfirm]);

  return {
    loadSaved, testConn, modalConnect, connSaved, delSaved, editSaved, disconnectInst, askConfirm,
    showModal, setShowModal, mName, setMName, mHost, setMHost, mPort, setMPort,
    mUser, setMUser, mPass, setMPass, mDb, setMDb, mSave, setMSave,
    mTesting, mResult, setMResult, mEditId, setMEditId, confirmDialog, setConfirmDialog,
  };
}
