import I from '../utils/icons';

/* ==================== Connection Modal ==================== */
export default function ConnectionModal({
  show,
  onClose,
  mEditId,
  mName, setMName,
  mHost, setMHost,
  mPort, setMPort,
  mUser, setMUser,
  mPass, setMPass,
  mDb, setMDb,
  mSave, setMSave,
  mTesting,
  mResult,
  onTest,
  onConnect,
}) {
  if (!show) return null;

  const isEdit = !!mEditId;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Connection' : 'New Database Connection'}</h3>
          <button className="btn-icon" onClick={onClose}>{I.close}</button>
        </div>
        <div className="modal-body">
          <div className="conn-form">
            <label className="form-label">Connection Name</label>
            <input className="conn-input" placeholder="My Connection" value={mName} onChange={e => setMName(e.target.value)} />
            <div className="conn-form-row">
              <div style={{ flex: 1 }}><label className="form-label">Host</label><input className="conn-input" value={mHost} onChange={e => setMHost(e.target.value)} /></div>
              <div style={{ width: 100 }}><label className="form-label">Port</label><input className="conn-input" type="number" value={mPort} onChange={e => setMPort(Number(e.target.value))} /></div>
            </div>
            <div className="conn-form-row">
              <div style={{ flex: 1 }}><label className="form-label">User</label><input className="conn-input" value={mUser} onChange={e => setMUser(e.target.value)} /></div>
              <div style={{ flex: 1 }}><label className="form-label">Password</label><input className="conn-input" type="password" value={mPass} onChange={e => setMPass(e.target.value)} /></div>
            </div>
            <label className="form-label">Database (optional)</label>
            <input className="conn-input" placeholder="Leave empty to list all" value={mDb} onChange={e => setMDb(e.target.value)} />
            <label className="checkbox-row" style={{ marginTop: 8 }}><input type="checkbox" checked={mSave} onChange={e => setMSave(e.target.checked)} /> Save connection</label>
            {mResult && <div className={`test-result ${mResult.ok ? 'success' : 'fail'}`}>{mResult.ok ? 'Connection successful!' : mResult.error}</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onTest} disabled={mTesting}>{mTesting ? <span className="spinner" style={{ width: 12, height: 12, marginRight: 4 }} /> : null}Test Connection</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onConnect}>{isEdit ? 'Update' : 'Save & Connect'}</button>
        </div>
      </div>
    </div>
  );
}
