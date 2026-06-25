import { useMemo, useState, useEffect, useCallback } from 'react';
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
  openRoutine,
  openTrigger,
  setOpenTabs,
  setActiveTabId,
  loadCols,
}) {
  const [sqlMenu, setSqlMenu] = useState(null); // { instId, dbName, tName, x, y }

  // Close SQL menu on outside click
  useEffect(() => {
    if (!sqlMenu) return;
    const h = (e) => {
      if (!e.target.closest('.tree-node-action-popup')) setSqlMenu(null);
    };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [sqlMenu]);

  const openSqlMenu = useCallback((e, instId, dbName, tName) => {
    e.stopPropagation();
    const rect = e.target.getBoundingClientRect();
    setSqlMenu({ instId, dbName, tName, x: rect.left, y: rect.bottom + 2 });
  }, []);

  const genSqlAndClose = useCallback(async (instId, dbName, tName, type) => {
    let cols = [];
    // Load column info for INSERT/UPDATE
    if (type !== 'select') {
      try { cols = await loadCols(instId, dbName, tName) || []; } catch (_) {}
    }
    const colNames = cols.map(c => c.COLUMN_NAME);
    const pkNames = cols.filter(c => c.COLUMN_KEY === 'PRI').map(c => c.COLUMN_NAME);
    let sql = '';
    let title = '';
    if (type === 'select') {
      sql = `SELECT * FROM \`${dbName}\`.\`${tName}\` LIMIT 100;`;
      title = `SEL-${tName}`;
    } else if (type === 'insert') {
      if (colNames.length) {
        const names = colNames.map(c => `\`${c}\``).join(', ');
        const phs = colNames.map(() => '').join(', ');
        sql = `INSERT INTO \`${dbName}\`.\`${tName}\` (\n  ${names}\n) VALUES (\n  ${phs}\n);`;
      } else {
        sql = `INSERT INTO \`${dbName}\`.\`${tName}\` (\n  \n) VALUES (\n  \n);`;
      }
      title = `INS-${tName}`;
    } else if (type === 'update') {
      if (colNames.length) {
        const sets = colNames.map(c => `\`${c}\` = ''`).join(',\n  ');
        const where = pkNames.length ? pkNames.map(c => `\`${c}\` = ''`).join(' AND ') : '-- where';
        sql = `UPDATE \`${dbName}\`.\`${tName}\`\nSET\n  ${sets}\nWHERE ${where};`;
      } else {
        sql = `UPDATE \`${dbName}\`.\`${tName}\`\nSET \nWHERE ;`;
      }
      title = `UPD-${tName}`;
    }
    const tid = `q:${Date.now()}`;
    setOpenTabs(p => [...p, { id: tid, type: 'query', title, instId, db: dbName, sql, results: null, fields: [], error: null }]);
    setActiveTabId(tid);
    setSqlMenu(null);
  }, [setOpenTabs, setActiveTabId, loadCols]);
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
      const tblFKs = inst.tableFKs || {};
      const dbRoutines = inst.dbRoutines || {};
      const dbTriggers = inst.dbTriggers || {};

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
            const routines = dbRoutines[db.name] || [];
            const triggers = dbTriggers[db.name] || [];

            const rtabs = tabs.filter(t => t.TABLE_TYPE !== 'VIEW');
            const views = tabs.filter(t => t.TABLE_TYPE === 'VIEW');
            const procs = routines.filter(r => r.ROUTINE_TYPE === 'PROCEDURE');
            const funcs = routines.filter(r => r.ROUTINE_TYPE === 'FUNCTION');

            if (search) {
              const dotIdx = search.indexOf('.');
              const hasDot = dotIdx >= 0;
              const dbFilter = hasDot ? search.substring(0, dotIdx).toLowerCase() : '';
              const objFilter = hasDot ? search.substring(dotIdx + 1).toLowerCase() : '';
              const browseDb = hasDot && objFilter === ''; // "mydb." → show all

              if (hasDot) {
                const dbMatch = dbFilter === '' || db.name.toLowerCase().includes(dbFilter);
                if (!dbMatch) return null;
                const openAll = true;

                if (browseDb) {
                  // "mydb." → browse: show all objects in matching databases
                  return renderDbRow(inst, db, openAll, rtabs, views, procs, funcs, triggers,
                    search, true, expTbls, tblCols, tblIdxs, tblFKs, collapsedGroups, setCollapsedGroups,
                    openConsole, openTable, toggleTbl, onCtx, openRoutine, openTrigger,
                    toggleDb, refreshDb, treeErrors, refreshing, openSqlMenu, genSqlAndClose, sqlMenu);
                }

                // ".obj" or "db.obj" → show only matching objects in matching databases
                const mRtabs = rtabs.filter(t => t.TABLE_NAME.toLowerCase().includes(objFilter));
                const mViews = views.filter(v => v.TABLE_NAME.toLowerCase().includes(objFilter));
                const mProcs = procs.filter(p => p.ROUTINE_NAME.toLowerCase().includes(objFilter));
                const mFuncs = funcs.filter(f => f.ROUTINE_NAME.toLowerCase().includes(objFilter));
                const mTriggers = triggers.filter(t => t.TRIGGER_NAME.toLowerCase().includes(objFilter));
                return renderDbRow(inst, db, openAll, mRtabs, mViews, mProcs, mFuncs, mTriggers,
                  search, true, expTbls, tblCols, tblIdxs, tblFKs, collapsedGroups, setCollapsedGroups,
                  openConsole, openTable, toggleTbl, onCtx, openRoutine, openTrigger,
                  toggleDb, refreshDb, treeErrors, refreshing, openSqlMenu, genSqlAndClose, sqlMenu);
              }

              // No dot: pure filter — match both db names and object names, always show matching objects
              const dbMatch = db.name.toLowerCase().includes(search);
              const mRtabs = rtabs.filter(t => t.TABLE_NAME.toLowerCase().includes(search));
              const mViews = views.filter(v => v.TABLE_NAME.toLowerCase().includes(search));
              const mProcs = procs.filter(p => p.ROUTINE_NAME.toLowerCase().includes(search));
              const mFuncs = funcs.filter(f => f.ROUTINE_NAME.toLowerCase().includes(search));
              const mTriggers = triggers.filter(t => t.TRIGGER_NAME.toLowerCase().includes(search));
              if (!dbMatch && mRtabs.length === 0 && mViews.length === 0 && mProcs.length === 0 && mFuncs.length === 0 && mTriggers.length === 0) return null;
              return renderDbRow(inst, db, true, mRtabs, mViews, mProcs, mFuncs, mTriggers,
                search, dbMatch, expTbls, tblCols, tblIdxs, tblFKs, collapsedGroups, setCollapsedGroups,
                openConsole, openTable, toggleTbl, onCtx, openRoutine, openTrigger,
                toggleDb, refreshDb, treeErrors, refreshing, openSqlMenu, genSqlAndClose, sqlMenu);
            }

            return renderDbRow(inst, db, isOpen, rtabs, views, procs, funcs, triggers,
              '', false, expTbls, tblCols, tblIdxs, tblFKs, collapsedGroups, setCollapsedGroups,
              openConsole, openTable, toggleTbl, onCtx, openRoutine, openTrigger,
              toggleDb, refreshDb, treeErrors, refreshing, openSqlMenu, genSqlAndClose, sqlMenu);
          })}
        </div>
      );
    });
  }, [instances, treeSearch, collapsedGroups, treeErrors, refreshing, toggleInst, openConsole, toggleDb, openTable, toggleTbl, refreshInst, refreshDb, disconnectInst, onCtx, setCollapsedGroups, openRoutine, openTrigger, setOpenTabs, setActiveTabId, sqlMenu, openSqlMenu, genSqlAndClose, loadCols]);
}

function renderDbRow(inst, db, isOpen, rtabs, views, procs, funcs, triggers,
  search, dbMatch, expTbls, tblCols, tblIdxs, tblFKs, collapsedGroups, setCollapsedGroups,
  openConsole, openTable, toggleTbl, onCtx, openRoutine, openTrigger,
  toggleDb, refreshDb, treeErrors, refreshing, openSqlMenu, genSqlAndClose, sqlMenu) {
  return (
    <div key={db.name}>
      <div className="tree-node database tree-node-level-1"
        onClick={() => { toggleDb(inst.id, db.name); clearTreeSearch?.(); }}
        onContextMenu={e => onCtx(e, inst.id, db.name, null)}>
        <span className="tree-node-arrow">{isOpen ? '\u25BE' : '\u25B8'}</span>
        <span className="tree-node-icon">{I.db}</span>
        <span className="tree-node-label" style={search && dbMatch ? { fontWeight: 'bold', color: 'var(--accent)' } : {}}>{db.name}</span>
        <span className="tree-node-badge">{rtabs.length + views.length}</span>
        <span className="tree-node-action" onClick={e => { e.stopPropagation(); refreshDb(inst.id, db.name); }} title="Refresh database">{I.refresh}</span>
      </div>
      {(treeErrors[`${inst.id}/${db.name}`] || refreshing[`${inst.id}/${db.name}`]) && (
        <div className="tree-error" style={{ padding: '3px 8px 3px 36px', fontSize: 11, color: 'var(--red)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {refreshing[`${inst.id}/${db.name}`] ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> : treeErrors[`${inst.id}/${db.name}`]}
        </div>
      )}
      {isOpen && renderDbContent(inst, db, rtabs, views, procs, funcs, triggers, search, dbMatch, expTbls, tblCols, tblIdxs, tblFKs, collapsedGroups, setCollapsedGroups, openConsole, openTable, toggleTbl, onCtx, openRoutine, openTrigger, refreshing, treeErrors, openSqlMenu, genSqlAndClose, sqlMenu)}
    </div>
  );
}

function renderDbContent(inst, db, rtabs, views, procs, funcs, triggers, search, dbMatch, expTbls, tblCols, tblIdxs, tblFKs, collapsedGroups, setCollapsedGroups, openConsole, openTable, toggleTbl, onCtx, openRoutine, openTrigger, refreshing, treeErrors, openSqlMenu, genSqlAndClose, sqlMenu) {
  const ek = `${inst.id}/${db.name}`;
  const loading = refreshing[ek];
  const hasContent = rtabs.length > 0 || views.length > 0 || procs.length > 0 || funcs.length > 0 || triggers.length > 0;

  return (
    <>
      <div className="tree-node table tree-node-level-2" style={{ color: 'var(--accent)' }} onClick={() => openConsole(inst.id, db.name)}>
        <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
        <span className="tree-node-icon">{I.console}</span>
        <span className="tree-node-label">Console</span>
      </div>

      {/* Tables */}
      {(rtabs.length > 0 || loading) && <>
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
          const fks = tblFKs[t.TABLE_NAME] || [];
          return (
            <div key={t.TABLE_NAME}>
              <div className="tree-node table tree-node-level-3"
                onClick={() => openTable(inst.id, db.name, t.TABLE_NAME)}
                onContextMenu={e => onCtx(e, inst.id, db.name, t.TABLE_NAME)}>
                <span className="tree-node-arrow" onClick={e => { e.stopPropagation(); toggleTbl(inst.id, db.name, t.TABLE_NAME); }}>{exT ? '\u25BE' : '\u25B8'}</span>
                <span className="tree-node-icon">{I.table}</span>
                <span className="tree-node-label" style={search ? { fontWeight: 'bold', color: 'var(--yellow)' } : {}}>{t.TABLE_NAME}</span>
                {t.TABLE_COMMENT && <span className="tree-node-badge" title={t.TABLE_COMMENT}>{t.TABLE_COMMENT}</span>}
                <span className="tree-node-action" onClick={e => openSqlMenu(e, inst.id, db.name, t.TABLE_NAME)} title="Quick SQL">{I.sql}</span>
              </div>
              {exT && renderTableDetail(cols, idxs, fks)}
            </div>
          );
        })}
      </>}

      {/* Views */}
      {(views.length > 0 || loading) && <>
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
            onClick={() => openTable(inst.id, db.name, v.TABLE_NAME, 'view')}
            onContextMenu={e => onCtx(e, inst.id, db.name, v.TABLE_NAME, 'view')}>
            <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
            <span className="tree-node-icon">{I.view}</span>
            <span className="tree-node-label">{v.TABLE_NAME}</span>
          </div>
        ))}
      </>}

      {/* Procedures */}
      {(procs.length > 0 || loading) && <>
        <div
          className="tree-node schema-group tree-node-level-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setCollapsedGroups(p => ({ ...p, [`procs:${inst.id}:${db.name}`]: !p[`procs:${inst.id}:${db.name}`] }))}
        >
          <span className="tree-node-arrow">{collapsedGroups[`procs:${inst.id}:${db.name}`] ? '\u25B8' : '\u25BE'}</span>
          <span className="tree-node-label">Procedures ({procs.length}{search && !dbMatch ? ` / ${(inst.dbRoutines?.[db.name] || []).filter(r => r.ROUTINE_TYPE === 'PROCEDURE').length}` : ''})</span>
        </div>
        {!collapsedGroups[`procs:${inst.id}:${db.name}`] && procs.map(p => (
          <div key={p.ROUTINE_NAME} className="tree-node table tree-node-level-3"
            onClick={() => openRoutine?.(inst.id, db.name, p.ROUTINE_NAME, 'PROCEDURE')}
            onContextMenu={e => onCtx(e, inst.id, db.name, p.ROUTINE_NAME, 'procedure')}>
            <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
            <span className="tree-node-icon">{I.proc}</span>
            <span className="tree-node-label">{p.ROUTINE_NAME}</span>
            {p.DTD_IDENTIFIER && <span className="column-type-badge">{p.DTD_IDENTIFIER}</span>}
          </div>
        ))}
      </>}

      {/* Functions */}
      {(funcs.length > 0 || loading) && <>
        <div
          className="tree-node schema-group tree-node-level-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setCollapsedGroups(p => ({ ...p, [`funcs:${inst.id}:${db.name}`]: !p[`funcs:${inst.id}:${db.name}`] }))}
        >
          <span className="tree-node-arrow">{collapsedGroups[`funcs:${inst.id}:${db.name}`] ? '\u25B8' : '\u25BE'}</span>
          <span className="tree-node-label">Functions ({funcs.length}{search && !dbMatch ? ` / ${(inst.dbRoutines?.[db.name] || []).filter(r => r.ROUTINE_TYPE === 'FUNCTION').length}` : ''})</span>
        </div>
        {!collapsedGroups[`funcs:${inst.id}:${db.name}`] && funcs.map(f => (
          <div key={f.ROUTINE_NAME} className="tree-node table tree-node-level-3"
            onClick={() => openRoutine?.(inst.id, db.name, f.ROUTINE_NAME, 'FUNCTION')}
            onContextMenu={e => onCtx(e, inst.id, db.name, f.ROUTINE_NAME, 'function')}>
            <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
            <span className="tree-node-icon">{I.func}</span>
            <span className="tree-node-label">{f.ROUTINE_NAME}</span>
            {f.DTD_IDENTIFIER && <span className="column-type-badge">{f.DTD_IDENTIFIER}</span>}
          </div>
        ))}
      </>}

      {/* Triggers */}
      {(triggers.length > 0 || loading) && <>
        <div
          className="tree-node schema-group tree-node-level-2"
          style={{ cursor: 'pointer' }}
          onClick={() => setCollapsedGroups(p => ({ ...p, [`triggers:${inst.id}:${db.name}`]: !p[`triggers:${inst.id}:${db.name}`] }))}
        >
          <span className="tree-node-arrow">{collapsedGroups[`triggers:${inst.id}:${db.name}`] ? '\u25B8' : '\u25BE'}</span>
          <span className="tree-node-label">Triggers ({triggers.length}{search && !dbMatch ? ` / ${(inst.dbTriggers?.[db.name] || []).length}` : ''})</span>
        </div>
        {!collapsedGroups[`triggers:${inst.id}:${db.name}`] && triggers.map(t => (
          <div key={t.TRIGGER_NAME} className="tree-node table tree-node-level-3"
            onClick={() => openTrigger?.(inst.id, db.name, t.TRIGGER_NAME)}
            onContextMenu={e => onCtx(e, inst.id, db.name, t.TRIGGER_NAME, 'trigger')}>
            <span className="tree-node-arrow" style={{ visibility: 'hidden' }}>{'\u25B8'}</span>
            <span className="tree-node-icon">{I.trigger}</span>
            <span className="tree-node-label">{t.TRIGGER_NAME}</span>
            <span className="column-type-badge">{t.EVENT_MANIPULATION} {t.ACTION_TIMING}</span>
          </div>
        ))}
      </>}

      {!hasContent && <div className="tree-empty tree-node-level-2">No tables</div>}

      {/* Quick SQL popup */}
      {sqlMenu && sqlMenu.instId === inst.id && sqlMenu.dbName === db.name && (
        <div className="tree-node-action-popup" style={{ left: sqlMenu.x, top: sqlMenu.y }}>
          <div className="context-menu-item" onClick={() => genSqlAndClose(inst.id, db.name, sqlMenu.tName, 'select')}>{I.sql} SELECT * FROM</div>
          <div className="context-menu-item" onClick={() => genSqlAndClose(inst.id, db.name, sqlMenu.tName, 'insert')}>{I.sql} INSERT INTO</div>
          <div className="context-menu-item" onClick={() => genSqlAndClose(inst.id, db.name, sqlMenu.tName, 'update')}>{I.sql} UPDATE</div>
        </div>
      )}
    </>
  );
}

function renderTableDetail(cols, idxs, fks) {
  // Group FKs by constraint name
  const fkGroups = {};
  (fks || []).forEach(fk => {
    const key = fk.CONSTRAINT_NAME;
    if (!fkGroups[key]) fkGroups[key] = [];
    fkGroups[key].push(fk);
  });
  const fkKeys = Object.keys(fkGroups);

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
      {fkKeys.length > 0 && <div className="tree-node schema-group tree-node-level-4" style={{ paddingLeft: 68 }}><span className="tree-node-label" style={{ fontSize: 10 }}>{'\uD83D\uDD17'} Foreign Keys ({fkKeys.length})</span></div>}
      {fkKeys.map(key => {
        const cols = fkGroups[key];
        const ref = cols[0];
        const colNames = cols.map(c => c.COLUMN_NAME).join(', ');
        const refCols = cols.map(c => c.REFERENCED_COLUMN_NAME).join(', ');
        return (
          <div key={key} className="tree-node column tree-node-level-4">
            <span className="tree-node-icon" style={{ fontSize: 6 }}>{'\u2192'}</span>
            <span className="tree-node-label">{colNames}</span>
            <span className="column-type-badge">{ref.REFERENCED_TABLE_NAME}.{refCols}</span>
          </div>
        );
      })}
    </>
  );
}
