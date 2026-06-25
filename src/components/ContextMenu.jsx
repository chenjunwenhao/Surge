import { useState } from 'react';
import I from '../utils/icons';

/* ==================== Context Menu ==================== */
export default function ContextMenu({
  ctxMenu,
  setCtxMenu,
  openTable,
  loadDDL,
  loadIdx,
  loadCols,
  refreshDb,
  openConsole,
  disconnectInst,
  setOpenTabs,
  setActiveTabId,
  onImport,
  onDump,
  openRoutine,
  openTrigger,
}) {
  const [dumpSubmenu, setDumpSubmenu] = useState(false);

  if (!ctxMenu) return null;

  const closeAll = () => { setCtxMenu(null); setDumpSubmenu(false); };

  const DumpItem = ({ label, mode }) => (
    <div className="context-menu-subitem" onClick={() => { onDump?.(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName || null, mode); closeAll(); }}>
      {label}
    </div>
  );

  // Routine / Trigger context menu
  const isRoutine = ctxMenu.type === 'procedure' || ctxMenu.type === 'function';
  if (isRoutine || ctxMenu.type === 'trigger') {
    const icon = ctxMenu.type === 'procedure' ? I.proc : ctxMenu.type === 'function' ? I.func : I.trigger;
    const label = ctxMenu.type === 'procedure' ? 'Procedure' : ctxMenu.type === 'function' ? 'Function' : 'Trigger';
    return (
      <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
        <div className="context-menu-item" onClick={() => {
          if (ctxMenu.type === 'trigger') {
            openTrigger?.(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName);
          } else {
            openRoutine?.(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName, ctxMenu.type === 'function' ? 'FUNCTION' : 'PROCEDURE');
          }
          closeAll();
        }}>{icon} View {label} DDL</div>
        <div className="context-menu-item" onClick={() => { refreshDb(ctxMenu.instId, ctxMenu.dbName); closeAll(); }}>{I.refresh} Refresh</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => { navigator.clipboard.writeText(ctxMenu.tName); closeAll(); }}>Copy Name</div>
      </div>
    );
  }

  // View context menu
  if (ctxMenu.type === 'view') {
    return (
      <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
        <div className="context-menu-item" onClick={() => { openTable(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName); closeAll(); }}>{I.view} View Data</div>
        <div className="context-menu-item" onClick={async () => {
          const ddl = await loadDDL(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName);
          const tid = `ddl:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'table', title: `DDL-${ctxMenu.tName}`, instId: ctxMenu.instId, dbName: ctxMenu.dbName, tName: ctxMenu.tName, subTab: 'ddl', ddl, columns: [], rows: [], pkColumns: [], dirtyRows: {}, indexes: [], loading: false }]);
          setActiveTabId(tid); closeAll();
        }}>{I.index} View DDL</div>
        <div className="context-menu-item" onClick={() => { refreshDb(ctxMenu.instId, ctxMenu.dbName); closeAll(); }}>{I.refresh} Refresh</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => { navigator.clipboard.writeText(ctxMenu.tName); closeAll(); }}>Copy Name</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => {
          const tid = `q:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'query', title: ctxMenu.tName, instId: ctxMenu.instId, db: ctxMenu.dbName, sql: `SELECT * FROM \`${ctxMenu.dbName}\`.\`${ctxMenu.tName}\` LIMIT 100;`, results: null, fields: [], error: null }]);
          setActiveTabId(tid); closeAll();
        }}>{I.sql} SELECT * FROM</div>
      </div>
    );
  }

  return (
    <div className="context-menu" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
      {ctxMenu.tName ? <>
        <div className="context-menu-item" onClick={() => { openTable(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName); closeAll(); }}>{I.table} Edit Data</div>
        <div className="context-menu-item" onClick={async () => {
          const ddl = await loadDDL(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName);
          const tid = `ddl:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'table', title: `DDL-${ctxMenu.tName}`, instId: ctxMenu.instId, dbName: ctxMenu.dbName, tName: ctxMenu.tName, subTab: 'ddl', ddl, columns: [], rows: [], pkColumns: [], dirtyRows: {}, indexes: [], loading: false }]);
          setActiveTabId(tid); closeAll();
        }}>{I.index} View DDL</div>
        <div className="context-menu-item" onClick={async () => {
          const idx = await loadIdx(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName);
          const tid = `idx:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'table', title: `Idx-${ctxMenu.tName}`, instId: ctxMenu.instId, dbName: ctxMenu.dbName, tName: ctxMenu.tName, subTab: 'indexes', indexes: idx, ddl: '', columns: [], rows: [], pkColumns: [], dirtyRows: {}, loading: false }]);
          setActiveTabId(tid); closeAll();
        }}>{I.index} Show Indexes</div>
        <div className="context-menu-item" onClick={() => { refreshDb(ctxMenu.instId, ctxMenu.dbName); closeAll(); }}>{I.refresh} Refresh</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => { onImport?.(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName); closeAll(); }}>{'\u2B07'} Import Data</div>
        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); setDumpSubmenu(v => !v); }}>
          <span>{'\u2B06'} Export Dump (.sql)</span>
          <span style={{ marginLeft: 'auto', fontSize: 10 }}>{dumpSubmenu ? '\u25BC' : '\u25B6'}</span>
        </div>
        {dumpSubmenu && <>
          <DumpItem label="Structure + Data" mode="all" />
          <DumpItem label="Structure Only" mode="structure" />
          <DumpItem label="Data Only" mode="data" />
        </>}
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => {
          const tid = `q:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'query', title: `SEL-${ctxMenu.tName}`, instId: ctxMenu.instId, db: ctxMenu.dbName, sql: `SELECT * FROM \`${ctxMenu.dbName}\`.\`${ctxMenu.tName}\` LIMIT 100;`, results: null, fields: [], error: null }]);
          setActiveTabId(tid); closeAll();
        }}>{I.sql} SELECT * FROM</div>
        <div className="context-menu-item" onClick={async () => {
          let cols = [];
          try { cols = await loadCols(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName) || []; } catch (_) {}
          const colNames = cols.map(c => c.COLUMN_NAME);
          const names = colNames.length ? colNames.map(c => `\`${c}\``).join(', ') : '';
          const phs = colNames.length ? colNames.map(() => '').join(', ') : '';
          const sql = colNames.length
            ? `INSERT INTO \`${ctxMenu.dbName}\`.\`${ctxMenu.tName}\` (\n  ${names}\n) VALUES (\n  ${phs}\n);`
            : `INSERT INTO \`${ctxMenu.dbName}\`.\`${ctxMenu.tName}\` (\n  \n) VALUES (\n  \n);`;
          const tid = `q:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'query', title: `INS-${ctxMenu.tName}`, instId: ctxMenu.instId, db: ctxMenu.dbName, sql, results: null, fields: [], error: null }]);
          setActiveTabId(tid); closeAll();
        }}>{I.sql} INSERT INTO</div>
        <div className="context-menu-item" onClick={async () => {
          let cols = [];
          try { cols = await loadCols(ctxMenu.instId, ctxMenu.dbName, ctxMenu.tName) || []; } catch (_) {}
          const colNames = cols.map(c => c.COLUMN_NAME);
          const pkNames = cols.filter(c => c.COLUMN_KEY === 'PRI').map(c => c.COLUMN_NAME);
          const sets = colNames.length ? colNames.map(c => `\`${c}\` = ''`).join(',\n  ') : '';
          const where = pkNames.length ? pkNames.map(c => `\`${c}\` = ''`).join(' AND ') : '-- where';
          const sql = colNames.length
            ? `UPDATE \`${ctxMenu.dbName}\`.\`${ctxMenu.tName}\`\nSET\n  ${sets}\nWHERE ${where};`
            : `UPDATE \`${ctxMenu.dbName}\`.\`${ctxMenu.tName}\`\nSET \nWHERE ;`;
          const tid = `q:${Date.now()}`;
          setOpenTabs(p => [...p, { id: tid, type: 'query', title: `UPD-${ctxMenu.tName}`, instId: ctxMenu.instId, db: ctxMenu.dbName, sql, results: null, fields: [], error: null }]);
          setActiveTabId(tid); closeAll();
        }}>{I.sql} UPDATE</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => { navigator.clipboard.writeText(ctxMenu.tName); closeAll(); }}>Copy Name</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" style={{ fontSize: 10, color: 'var(--text-muted)', cursor: 'default', pointerEvents: 'none' }}>Run: Ctrl+Enter · Explain: Ctrl+Shift+Enter</div>
      </> : ctxMenu.instId ? <>
        {ctxMenu.type === 'instance' && <>
          <div className="context-menu-item" onClick={() => { disconnectInst(ctxMenu.instId); closeAll(); }}>{I.close} Disconnect</div>
          <div className="context-menu-divider" />
        </>}
        <div className="context-menu-item" onClick={() => { openConsole(ctxMenu.instId, ctxMenu.dbName); closeAll(); }}>{I.console} Open Console</div>
        <div className="context-menu-item" onClick={() => { refreshDb(ctxMenu.instId, ctxMenu.dbName); closeAll(); }}>{I.refresh} Refresh</div>
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); setDumpSubmenu(v => !v); }}>
          <span>{'\u2B06'} Export Dump (.sql)</span>
          <span style={{ marginLeft: 'auto', fontSize: 10 }}>{dumpSubmenu ? '\u25BC' : '\u25B6'}</span>
        </div>
        {dumpSubmenu && <>
          <DumpItem label="Structure + Data" mode="all" />
          <DumpItem label="Structure Only" mode="structure" />
          <DumpItem label="Data Only" mode="data" />
        </>}
        <div className="context-menu-divider" />
        <div className="context-menu-item" onClick={() => { navigator.clipboard.writeText(ctxMenu.dbName); closeAll(); }}>Copy Name</div>
      </> : null}
    </div>
  );
}
