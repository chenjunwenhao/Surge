import I from '../utils/icons';

/* ==================== Context Menu ==================== */
export default function ContextMenu({
  ctxMenu,
  setCtxMenu,
  openTable,
  loadDDL,
  loadIdx,
  refreshDb,
  openConsole,
  disconnectInst,
  setOpenTabs,
  setActiveTabId,
}) {
  if (!ctxMenu) return null;

  return (
    <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
      {ctxMenu.tName ? <>
        <div className="context-menu-item" onClick={() => { openTable(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName); setCtxMenu(null); }}>{I.table} Edit Data</div>
        <div className="context-menu-item" onClick={async () => {
          const ddl = await loadDDL(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName);
          const tid = `ddl:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'table', title: `DDL-${ctxMenu.tName}`, instId: ctxMenu.instId, dbName: ctxMenu.dbName, tName: ctxMenu.tName, subTab: 'ddl', ddl, columns: [], rows: [], pkColumns: [], dirtyRows: {}, indexes: [], loading: false }]);
          setActiveTabId(tid); setCtxMenu(null);
        }}>{I.index} View DDL</div>
        <div className="context-menu-item" onClick={async () => {
          const idx = await loadIdx(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName);
          const tid = `idx:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'table', title: `Idx-${ctxMenu.tName}`, instId: ctxMenu.instId, dbName: ctxMenu.dbName, tName: ctxMenu.tName, subTab: 'indexes', indexes: idx, ddl: '', columns: [], rows: [], pkColumns: [], dirtyRows: {}, loading: false }]);
          setActiveTabId(tid); setCtxMenu(null);
        }}>{I.index} Show Indexes</div>
        <div className="context-menu-item" onClick={() => { refreshDb(ctxMenu.instId, ctxMenu.dbName); setCtxMenu(null); }}>{I.refresh} Refresh</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => { navigator.clipboard.writeText(ctxMenu.tName); setCtxMenu(null); }}>Copy Name</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'default', pointerEvents: 'none' }}>Run: Ctrl+Enter · Explain: Ctrl+Shift+Enter</div>
        <div className="context-menu-item" onClick={() => {
          const tid = `q:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'query', title: ctxMenu.tName, instId: ctxMenu.instId, db: ctxMenu.dbName, sql: `SELECT * FROM \`${ctxMenu.dbName}\`.\`${ctxMenu.tName}\` LIMIT 100;`, results: null, fields: [], error: null }]);
          setActiveTabId(tid); setCtxMenu(null);
        }}>{I.sql} SELECT * FROM</div>
      </> : ctxMenu.instId ? <>
        {ctxMenu.type === 'instance' && <>
          <div className="context-menu-item" onClick={() => { disconnectInst(ctxMenu.instId); setCtxMenu(null); }}>{I.close} Disconnect</div>
          <div className="context-menu-divider" />
        </>}
        <div className="context-menu-item" onClick={() => { openConsole(ctxMenu.instId, ctxMenu.dbName); setCtxMenu(null); }}>{I.console} Open Console</div>
        <div className="context-menu-item" onClick={() => { refreshDb(ctxMenu.instId, ctxMenu.dbName); setCtxMenu(null); }}>{I.refresh} Refresh</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => { navigator.clipboard.writeText(ctxMenu.dbName); setCtxMenu(null); }}>Copy Name</div>
      </> : null}
    </div>
  );
}
