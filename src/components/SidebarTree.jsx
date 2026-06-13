import { useMemo } from 'react';
import I from '../utils/icons';

/* ==================== Sidebar Tree ==================== */
export default function SidebarTree({
  instances,
  treeSearch,
  collapsedGroups,
  setCollapsedGroups,
  treeErrors,
  refreshing,
  toggleInst,
  openConsole,
  toggleDb,
  openTable,
  toggleTbl,
  refreshInst,
  refreshDb,
  disconnectInst,
  onCtx,
}) {
  return useMemo(() => {
    const search = treeSearch.trim().toLowerCase();

    if (!instances.length) return (
      <div className="tree-empty">
        No connections yet.<br />
        <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => {
          // This button needs the modal open callback — handled via the caller
          document.querySelector('.toolbar-btn.accent')?.click();
        }}>+ New Connection</button>
      </div>
    );

    return instances.map(inst => {
      const dbTabs = inst.dbTables || {};
      const expDbs = inst.expandedDbs || {};
      const expTbls = inst.expandedTables || {};
      const tblCols = inst.tableColumns || {};
      const tblIdxs = inst.tableIndexes || {};

      return (
        <div key={inst.id}>
          <div className={`tree-node instance tree-node-level-0${inst.expanded ? ' selected' : ''}`}
            onClick={() => toggleInst(inst.id)}
            onContextMenu={e => onCtx(e, inst.id, inst.config?.database || '', null, 'instance')}>
            <span className="tree-node-arrow">{inst.expanded ? '\u25BE' : '\u25B8'}</span>
            <span className="tree-node-icon">{I.server}</span>
            <span className="tree-node-label">{inst.name}</span>
            <span className="tree-node-badge" style={{ color: inst.connected ? 'var(--green)' : 'var(--text-muted)' }}>{inst.connected ? '\u25CF' : '\u25CB'}</span>
            {inst.connected && <span className="tree-node-action danger" onClick={e => { e.stopPropagation(); disconnectInst(inst.id); }} title="Disconnect">{I.close}</span>}
            <span className="tree-node-action" onClick={e => { e.stopPropagation(); refreshInst(inst.id); }} title="Refresh instance">{I.refresh}</span>
          </div>
          {treeErrors[inst.id] && (
            <div className="tree-error" style={{ padding: '3px 8px 3px 22px', fontSize: 11, color: 'var(--red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {treeErrors[inst.id]}
            </div>
          )}

          {inst.expanded && (
            <div className="tree-node table tree-node-level-1" style={{ color: 'var(--accent)' }} onClick={() => openConsole(inst.id, inst.databases?.[0]?.name || '')}>
              <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
              <span className="tree-node-icon">{I.console}</span>
              <span className="tree-node-label">Console</span>
            </div>
          )}

          {inst.expanded && inst.databases.map(db => {
            const isOpen = expDbs[db.name];
            const tabs = dbTabs[db.name] || [];
            const rtabs = tabs.filter(t => t.TABLE_TYPE !== 'VIEW');
            const views = tabs.filter(t => t.TABLE_TYPE === 'VIEW');

            if (search) {
              const dbMatch = db.name.toLowerCase().includes(search);
              const matchRtabs = rtabs.filter(t => t.TABLE_NAME.toLowerCase().includes(search));
              const matchViews = views.filter(v => v.TABLE_NAME.toLowerCase().includes(search));
              if (!dbMatch && matchRtabs.length === 0 && matchViews.length === 0) return null;
              const displayRtabs = dbMatch ? rtabs : matchRtabs;
              const displayViews = dbMatch ? views : matchViews;
              return (
                <div key={db.name}>
                  <div className="tree-node database tree-node-level-1"
                    onClick={() => toggleDb(inst.id, db.name)}
                    onContextMenu={e => onCtx(e, inst.id, db.name, null)}>
                    <span className="tree-node-arrow">{isOpen ? '\u25BE' : '\u25B8'}</span>
                    <span className="tree-node-icon">{I.db}</span>
                    <span className="tree-node-label" style={dbMatch ? { fontWeight: 'bold', color: 'var(--accent)' } : {}}>{db.name}</span>
                    <span className="tree-node-badge">{tabs.length}</span>
                    <span className="tree-node-action" onClick={e => { e.stopPropagation(); refreshDb(inst.id, db.name); }} title="Refresh database">{I.refresh}</span>
                  </div>
                  {(treeErrors[`${inst.id}/${db.name}`] || refreshing[`${inst.id}/${db.name}`]) && (
                    <div className="tree-error" style={{ padding: '3px 8px 3px 36px', fontSize: 11, color: 'var(--red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {refreshing[`${inst.id}/${db.name}`] ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> : treeErrors[`${inst.id}/${db.name}`]}
                    </div>
                  )}
                  {isOpen && renderDbContent(inst, db, displayRtabs, displayViews, search, dbMatch, expTbls, tblCols, tblIdxs, collapsedGroups, setCollapsedGroups, openConsole, openTable, toggleTbl, onCtx)}
                </div>
              );
            }

            return (
              <div key={db.name}>
                <div className="tree-node database tree-node-level-1"
                  onClick={() => toggleDb(inst.id, db.name)}
                  onContextMenu={e => onCtx(e, inst.id, db.name, null)}>
                  <span className="tree-node-arrow">{isOpen ? '\u25BE' : '\u25B8'}</span>
                  <span className="tree-node-icon">{I.db}</span>
                  <span className="tree-node-label">{db.name}</span>
                  <span className="tree-node-badge">{tabs.length}</span>
                  <span className="tree-node-action" onClick={e => { e.stopPropagation(); refreshDb(inst.id, db.name); }} title="Refresh database">{I.refresh}</span>
                </div>
                {(treeErrors[`${inst.id}/${db.name}`] || refreshing[`${inst.id}/${db.name}`]) && (
                  <div className="tree-error" style={{ padding: '3px 8px 3px 36px', fontSize: 11, color: 'var(--red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {refreshing[`${inst.id}/${db.name}`] ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> : treeErrors[`${inst.id}/${db.name}`]}
                  </div>
                )}
                {isOpen && renderDbContent(inst, db, rtabs, views, '', false, expTbls, tblCols, tblIdxs, collapsedGroups, setCollapsedGroups, openConsole, openTable, toggleTbl, onCtx)}
              </div>
            );
          })}
        </div>
      );
    });
  }, [instances, treeSearch, collapsedGroups, treeErrors, refreshing, toggleInst, openConsole, toggleDb, openTable, toggleTbl, refreshInst, refreshDb, disconnectInst, onCtx, setCollapsedGroups]);
}

function renderDbContent(inst, db, rtabs, views, search, dbMatch, expTbls, tblCols, tblIdxs, collapsedGroups, setCollapsedGroups, openConsole, openTable, toggleTbl, onCtx) {
  return (
    <>
      <div className="tree-node table tree-node-level-2" style={{ color: 'var(--accent)' }} onClick={() => openConsole(inst.id, db.name)}>
        <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
        <span className="tree-node-icon">{I.console}</span>
        <span className="tree-node-label">Console</span>
      </div>
      {rtabs.length > 0 && <>
        <div
          className="tree-node schema-group tree-node-level-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setCollapsedGroups(p => ({ ...p, [`tbls:${inst.id}:${db.name}`]: !p[`tbls:${inst.id}:${db.name}`] }))}
        >
          <span className="tree-node-arrow">{collapsedGroups[`tbls:${inst.id}:${db.name}`] ? '\u25B8' : '\u25BE'}</span>
          <span className="tree-node-label">Tables ({rtabs.length}{search && !dbMatch ? ` / ${(inst.dbTables?.[db.name] || []).filter(t => t.TABLE_TYPE !== 'VIEW').length}` : ''})</span>
        </div>
        {!collapsedGroups[`tbls:${inst.id}:${db.name}`] && rtabs.map(t => {
          const exT = expTbls[t.TABLE_NAME];
          const cols = tblCols[t.TABLE_NAME] || [];
          const idxs = tblIdxs[t.TABLE_NAME] || [];
          return (
            <div key={t.TABLE_NAME}>
              <div className="tree-node table tree-node-level-3"
                onClick={() => openTable(inst.id, db.name, t.TABLE_NAME)}
                onContextMenu={e => onCtx(e, inst.id, db.name, t.TABLE_NAME)}>
                <span className="tree-node-arrow" onClick={e => { e.stopPropagation(); toggleTbl(inst.id, db.name, t.TABLE_NAME); }}>{exT ? '\u25BE' : '\u25B8'}</span>
                <span className="tree-node-icon">{I.table}</span>
                <span className="tree-node-label" style={search ? { fontWeight: 'bold', color: 'var(--yellow)' } : {}}>{t.TABLE_NAME}</span>
                {t.TABLE_COMMENT && <span className="tree-node-badge" title={t.TABLE_COMMENT}>{t.TABLE_COMMENT}</span>}
              </div>
              {exT && renderTableDetail(cols, idxs)}
            </div>
          );
        })}
      </>}
      {views.length > 0 && <>
        <div
          className="tree-node schema-group tree-node-level-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setCollapsedGroups(p => ({ ...p, [`views:${inst.id}:${db.name}`]: !p[`views:${inst.id}:${db.name}`] }))}
        >
          <span className="tree-node-arrow">{collapsedGroups[`views:${inst.id}:${db.name}`] ? '\u25B8' : '\u25BE'}</span>
          <span className="tree-node-label">Views ({views.length}{search && !dbMatch ? ` / ${(inst.dbTables?.[db.name] || []).filter(v => v.TABLE_TYPE === 'VIEW').length}` : ''})</span>
        </div>
        {!collapsedGroups[`views:${inst.id}:${db.name}`] && views.map(v => (
          <div key={v.TABLE_NAME} className="tree-node table tree-node-level-3"
            onDoubleClick={() => openTable(inst.id, db.name, v.TABLE_NAME)}
            onContextMenu={e => onCtx(e, inst.id, db.name, v.TABLE_NAME)}>
            <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
            <span className="tree-node-icon">{I.view}</span>
            <span className="tree-node-label">{v.TABLE_NAME}</span>
          </div>
        ))}
      </>}
      {rtabs.length === 0 && views.length === 0 && <div className="tree-empty tree-node-level-2">No tables</div>}
    </>
  );
}

function renderTableDetail(cols, idxs) {
  return (
    <>
      {cols.length > 0 && <div className="tree-node schema-group tree-node-level-4" style={{ paddingLeft: 68 }}><span className="tree-node-label" style={{ fontSize: 10 }}>Columns ({cols.length})</span></div>}
      {cols.map(c => (
        <div key={c.COLUMN_NAME} className="tree-node column tree-node-level-4">
          <span className="tree-node-icon" style={{ fontSize: 6 }}>{c.COLUMN_KEY === 'PRI' ? '\u25C9' : '\u25CF'}</span>
          <span className="tree-node-label">{c.COLUMN_KEY === 'PRI' && <span className="pk-badge">PK</span>}{c.COLUMN_NAME}</span>
          <span className="column-type-badge">{c.DATA_TYPE}</span>
          {c.COLUMN_COMMENT && <span className="tree-node-badge" style={{ fontSize: 10 }} title={c.COLUMN_COMMENT}>{c.COLUMN_COMMENT}</span>}
        </div>
      ))}
      {idxs.length > 0 && <div className="tree-node schema-group tree-node-level-4" style={{ paddingLeft: 68 }}><span className="tree-node-label" style={{ fontSize: 10 }}>{I.index} Indexes ({idxs.length})</span></div>}
      {idxs.map((idx, i) => (
        <div key={idx.Key_name + '_' + i} className="tree-node column tree-node-level-4">
          <span className="tree-node-icon" style={{ fontSize: 6 }}>{idx.Non_unique === 0 ? '\u25C9' : '\u25CF'}</span>
          <span className="tree-node-label">{idx.Non_unique === 0 && <span className="pk-badge" style={{ color: 'var(--cyan)' }}>UQ</span>}{idx.Key_name}</span>
          <span className="column-type-badge">{idx.Index_type} · {idx.Column_name}</span>
        </div>
      ))}
    </>
  );
}
