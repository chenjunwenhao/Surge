import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import I from '../utils/icons';
import { scheduleLint } from '../utils/sqlLinter';
import TableDataGrid from './TableDataGrid';
import QueryResultTable from './QueryResultTable';
import DDLViewer from './DDLViewer';
import IndexesViewer from './IndexesViewer';

/* ==================== Tab Content ==================== */
export default function TabContent({
  activeTab,
  instances,
  selInst,
  openTabs,
  setOpenTabs,
  setActiveTabId,
  setStatus,
  setShowModal,
  setMName, setMHost, setMPort, setMUser, setMPass, setMDb, setMSave, setMResult,
  execQuery,
  explainQuery,
  fmtSQL,
  txAction,
  reopenTab,
  closeTab,
  setSub,
  cellEdit,
  saveRow,
  refreshTab,
  loadTabs,
  showHistory,
  setShowHistory,
  queryHistory,
  setQueryHistory,
  newQuery,
  closedTabs,
  batchExpanded,
  setBatchExpanded,
  edMonaco,
  setEdMonaco,
  monacoRef,
  edRef,
  instancesRef,
  editorSplitPct,
  setEditorSplitPct,
  rezVRef,
  rezVFlag,
  dbPickerTabId,
  setDbPickerTabId,
  dbPickerSearch,
  setDbPickerSearch,
  theme,
  cancelQuery,
  exportResult,
}) {
  const [historySearch, setHistorySearch] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const historyRef = useRef(null);
  const setSubTab = (tid, st) => setOpenTabs(p => p.map(t => t.id === tid ? { ...t, subTab: st } : t));

  /* ----- History: click outside / Escape to close ----- */
  useEffect(() => {
    if (!showHistory) return;
    const onMouseDown = (e) => {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setShowHistory(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showHistory, setShowHistory]);

  if (!activeTab) {
    return (
      <div className="tab-content-empty">
        <div className="big-icon">{I.server}</div>
        <h2>Surge</h2>
        <p>Connect to a MySQL database to explore tables and run queries.</p>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => {
          setMName(''); setMHost('127.0.0.1'); setMPort(3306); setMUser('root'); setMPass(''); setMDb(''); setMSave(true); setMResult(null); setShowModal(true);
        }}>+ New Connection</button>
        <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.8 }}>
          <div>Run: <b style={{ color: 'var(--text-secondary)' }}>Ctrl+Enter</b></div>
          <div>Explain: <b style={{ color: 'var(--text-secondary)' }}>Ctrl+Shift+Enter</b></div>
          <div>Reopen tab: <b style={{ color: 'var(--text-secondary)' }}>Ctrl+Shift+T</b></div>
        </div>
      </div>
    );
  }

  if (activeTab.type === 'table') {
    if (activeTab.loading) return <div className="tab-content-empty"><div className="spinner" /><p>Loading {activeTab.tName}...</p></div>;
    return (
      <div className="tab-content">
        <div className="table-data-header">
          <div className="table-data-info">
            <span className="table-data-name">{activeTab.tName}</span>
            <span className="table-data-meta">{activeTab.dbName} · {activeTab.rows?.length || 0} rows</span>
            <div className="table-data-subtabs">
              {['data', 'ddl', 'indexes'].map(st => (
                <span key={st} className={`subtab${activeTab.subTab === st ? ' active' : ''}`} onClick={() => setSubTab(activeTab.id, st)}>
                  {st === 'data' ? 'Data' : st === 'ddl' ? 'DDL' : 'Indexes'}
                </span>
              ))}
            </div>
          </div>
        </div>
        {activeTab.subTab === 'data' && (
          <TableDataGrid
            columns={activeTab.columns || []}
            rows={activeTab.rows || []}
            pkColumns={activeTab.pkColumns || []}
            dirtyRows={activeTab.dirtyRows || {}}
            onCellChange={(ri, cn, v) => cellEdit(activeTab.id, ri, cn, v)}
            onSaveRow={() => saveRow(activeTab)}
            onRefresh={() => refreshTab(activeTab)}
          />
        )}
        {activeTab.subTab === 'ddl' && <DDLViewer ddl={activeTab.ddl} />}
        {activeTab.subTab === 'indexes' && <IndexesViewer indexes={activeTab.indexes} />}
      </div>
    );
  }

  // Query tab
  const tabInst = instances.find(i => i.id === activeTab.instId);
  const tabDbs = tabInst?.databases || [];

  return (
    <div className="tab-content editor-panel">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <span style={{ fontSize: 10, color: 'var(--text-muted)', marginRight: 6, whiteSpace: 'nowrap' }}>{tabInst?.name || 'No instance'}</span>
          {tabDbs.length > 0 ? (
            <div className="db-selector-wrap">
              <button
                className={`db-selector-btn${!activeTab.db ? ' db-selector-warn' : ''}`}
                onClick={() => {
                  setDbPickerTabId(dbPickerTabId === activeTab.id ? null : activeTab.id);
                  setDbPickerSearch('');
                }}
              >
                <span>{activeTab.db || 'Select database...'}</span>
                <span className="db-selector-arrow">{'\u25BC'}</span>
              </button>
              {dbPickerTabId === activeTab.id && (
                <div className="db-picker-dropdown" onClick={e => e.stopPropagation()}>
                  <input
                    className="conn-input"
                    placeholder="Search databases..."
                    value={dbPickerSearch}
                    onChange={e => setDbPickerSearch(e.target.value)}
                    autoFocus
                    style={{ margin: 6, width: 'calc(100% - 12px)', fontSize: 12, boxSizing: 'border-box' }}
                  />
                  <div className="db-picker-list">
                    {tabDbs.filter(d => !dbPickerSearch || d.name.toLowerCase().includes(dbPickerSearch.toLowerCase())).map(d => (
                      <div
                        key={d.name}
                        className={`db-picker-item${activeTab.db === d.name ? ' selected' : ''}`}
                        onClick={() => {
                          setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, db: d.name } : t));
                          setDbPickerTabId(null);
                          setDbPickerSearch('');
                          loadTabs(activeTab.instId, d.name);
                          setTimeout(() => edRef.current?.focus(), 50);
                        }}
                      >
                        <span className="tree-node-icon">{I.db}</span>
                        <span>{d.name}</span>
                        {activeTab.db === d.name && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 10 }}>active</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--red)' }}>No databases loaded</span>
          )}
        </div>
        <div className="editor-toolbar-right" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button className="btn btn-sm" onClick={() => txAction('begin')} title="Begin Transaction">{I.tx} Begin</button>
          <button className="btn btn-sm" onClick={() => txAction('commit')} title="Commit">Commit</button>
          <button className="btn btn-sm" onClick={() => txAction('rollback')} title="Rollback">Rollback</button>
          {selInst && <button className="btn btn-sm" onClick={cancelQuery} title="Cancel Running Query" style={{ color: 'var(--red)' }}>✕ Cancel</button>}
          <span className="toolbar-spacer" />
          <button className="btn btn-sm" onClick={() => setShowHistory(p => !p)} title="Query History (Ctrl+H)" style={{ position: 'relative' }}>
            ⌛ History
            {queryHistory.length > 0 && <span className="history-badge">{queryHistory.length}</span>}
          </button>
          <button className="btn btn-sm" onClick={reopenTab} disabled={!closedTabs.length} title="Reopen Closed Tab (Ctrl+Shift+T)">↩</button>
          <button className="btn btn-sm" onClick={fmtSQL} title="Format SQL">{I.fmt} Format</button>
          <button className="btn btn-sm" onClick={explainQuery} disabled={!selInst} title="Explain (Ctrl+Shift+Enter)">{I.search} Explain</button>
          <button className="run-btn" onClick={execQuery} disabled={!selInst} title="Run (Ctrl+Enter)">{I.run} Run</button>
        </div>
      </div>

      <div className="editor-area" style={{ flex: `${editorSplitPct} 0 0`, minHeight: 100 }}>
        <Editor
          height="100%"
          defaultLanguage="sql"
          defaultValue={activeTab.sql}
          beforeMount={m => {
            setEdMonaco(m);
            monacoRef.current = m;
            m.languages.setLanguageConfiguration('sql', { wordPattern: /[a-zA-Z_][\w$]*/ });
          }}
          onMount={ed => {
            edRef.current = ed;
            const m = monacoRef.current;
            if (m) {
              ed.addAction({ id: 'run', label: 'Run', keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.Enter], run: () => execQuery() });
              ed.addAction({ id: 'explain', label: 'Explain', keybindings: [m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.Enter], run: () => explainQuery() });
              ed.addAction({ id: 'triggerSuggest', label: 'Trigger Suggest', keybindings: [m.KeyMod.CtrlCmd | m.KeyCode.Space], run: () => ed.trigger('keyboard', 'editor.action.triggerSuggest', {}) });
              ed.addAction({ id: 'reopenTab', label: 'Reopen Closed Tab', keybindings: [m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.KeyT], run: () => reopenTab() });
              scheduleLint(ed.getModel(), m, instancesRef.current);
            }
          }}
          onChange={v => {
            const capturedTabId = activeTab?.id;
            clearTimeout(window.__sqlSyncTimer);
            window.__sqlSyncTimer = setTimeout(() => {
              setOpenTabs(p => p.map(t => t.id === capturedTabId ? { ...t, sql: v } : t));
            }, 1000);
            if (edRef.current && monacoRef.current) {
              scheduleLint(edRef.current.getModel(), monacoRef.current, instancesRef.current);
            }
          }}
          theme={theme === 'light' ? 'vs' : 'vs-dark'}
          options={{
            minimap: { enabled: false }, fontSize: 13,
            fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
            wordWrap: 'on', automaticLayout: true, lineNumbers: 'on',
            folding: true, scrollBeyondLastLine: false,
            tabCompletion: 'on', wordBasedSuggestions: 'off',
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            suggest: { showKeywords: true, showSnippets: true, showFunctions: true, showClasses: true, showFields: true, showStructs: true, showModules: true, showWords: false },
          }}
        />
      </div>

      <div className="resizer-v" ref={rezVRef} onMouseDown={() => { rezVFlag.current = true; }} />

      <div className="result-panel" style={{ flex: `${100 - editorSplitPct} 0 0`, minHeight: 60 }}>
        {activeTab.batchResults && activeTab.batchResults.length > 1 ? (
          <div className="batch-results" style={{ borderTop: 'none' }}>
            <div className="batch-header">
              <span className="stat">{activeTab.batchResults.length} statements</span>
              {(() => {
                const errCount = activeTab.batchResults.filter(b => !b.ok).length;
                const selCount = activeTab.batchResults.filter(b => b.ok && b.isSelect).length;
                const dmlCount = activeTab.batchResults.filter(b => b.ok && !b.isSelect).length;
                return <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>
                  {selCount > 0 ? `${selCount} SELECT` : ''}
                  {dmlCount > 0 ? `${selCount > 0 ? ', ' : ''}${dmlCount} DML` : ''}
                  {errCount > 0 ? `, ${errCount} error${errCount !== 1 ? 's' : ''}` : ''}
                </span>;
              })()}
              <div style={{ marginLeft: 'auto' }} className="result-actions">
                <button className="btn btn-sm" onClick={() => exportResult('csv')} title="Export all as CSV">CSV</button>
                <button className="btn btn-sm" onClick={() => exportResult('json')} title="Export all as JSON">JSON</button>
              </div>
            </div>
            <div className="batch-list" style={{ flex: 1, overflowY: 'auto' }}>
              {activeTab.batchResults.map((br, i) => {
                const isExpanded = batchExpanded[i];
                const shortSql = (br.sql || '').length > 60 ? (br.sql || '').slice(0, 60) + '\u2026' : (br.sql || '');
                return (
                  <div key={i} className={`batch-item${!br.ok ? ' batch-item-error' : ''}`}>
                    <div className="batch-item-header"
                      onClick={() => br.ok && br.isSelect && br.rows?.length > 0 && setBatchExpanded(p => ({ ...p, [i]: !p[i] }))}
                      style={{ cursor: br.ok && br.isSelect && br.rows?.length > 0 ? 'pointer' : 'default' }}>
                      <span className="batch-num">#{i + 1}</span>
                      <code className="batch-sql" title={br.sql}>{shortSql}</code>
                      {br.ok ? (
                        br.isSelect ? (
                          <span className="batch-stat batch-stat-select">{br.rows?.length ?? 0}r</span>
                        ) : (
                          <span className="batch-stat batch-stat-ok">{br.affectedRows ?? 0} affected</span>
                        )
                      ) : (
                        <span className="batch-stat batch-stat-err">{br.error}</span>
                      )}
                      <span className="batch-time">{br.elapsed ?? 0}ms</span>
                      {br.ok && br.isSelect && br.rows?.length > 0 && (
                        <span className="batch-expand-arrow">{isExpanded ? '\u25B4' : '\u25BE'}</span>
                      )}
                    </div>
                    {isExpanded && br.ok && br.isSelect && br.rows?.length > 0 && (
                      <div className="batch-item-body">
                        <QueryResultTable rows={br.rows} fields={br.fields} error={null} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="result-header">
              <div className="result-stats">
                {activeTab.error ? <span style={{ color: 'var(--red)' }}>Error: {activeTab.error}</span>
                  : activeTab.singleResult && !activeTab.singleResult.isSelect ? (
                    <span className="stat">OK, <span className="stat-value">{activeTab.singleResult.affectedRows ?? 0}</span> row(s) affected{activeTab.singleResult.changedRows ? ` (${activeTab.singleResult.changedRows} changed)` : ''}{activeTab.singleResult.elapsed != null ? <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{activeTab.singleResult.elapsed}ms</span> : null}</span>
                  ) : <><span className="stat">Rows: <span className="stat-value">{activeTab.results?.length ?? 0}</span></span>{activeTab.singleResult?.elapsed != null && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{activeTab.singleResult.elapsed}ms</span>}</>}
              </div>
              <div className="result-actions">
                <button className="btn btn-sm" onClick={() => exportResult('csv')} title="Export CSV">CSV</button>
                <button className="btn btn-sm" onClick={() => exportResult('json')} title="Export JSON">JSON</button>
              </div>
            </div>
            <QueryResultTable rows={activeTab.results} fields={activeTab.fields} error={activeTab.error} />
          </>
        )}

        {(activeTab.explainResults || activeTab.explainError) && (
          <div style={{ borderTop: '2px solid var(--accent)', marginTop: 8, paddingTop: 8 }}>
            <div className="result-header">
              <div className="result-stats">
                <span className="stat" style={{ color: 'var(--accent)' }}>{I.search} EXPLAIN</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{activeTab.explainResults?.length ?? 0} rows</span>
              </div>
              <button className="btn btn-sm" onClick={() => setOpenTabs(p => p.map(t => t.id === activeTab.id ? { ...t, explainResults: null, explainError: null } : t))}>{I.close}</button>
            </div>
            <QueryResultTable rows={activeTab.explainResults} fields={[]} error={activeTab.explainError} />
          </div>
        )}
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="history-dropdown" ref={historyRef}>
          <div className="history-header">
            <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>History</span>
            <input
              className="history-search"
              placeholder="Filter..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              autoFocus
            />
            <button className="btn btn-sm" onClick={() => { setQueryHistory([]); localStorage.setItem('sql-history', '[]'); setShowHistory(false); }}
              title="Clear All">Clear</button>
          </div>
          {(() => {
            const filtered = historySearch.trim()
              ? queryHistory.filter(h => h.sql.toLowerCase().includes(historySearch.trim().toLowerCase()))
              : queryHistory;
            if (filtered.length === 0) {
              return <div className="history-empty">{historySearch.trim() ? 'No matching queries' : 'No history yet. Run a query to start.'}</div>;
            }
            return (
              <div className="history-list">
                {filtered.map((h, i) => (
                  <div key={h.ts + '-' + i} className="history-item"
                    onClick={() => { newQuery(h.instId, h.db, h.sql); setShowHistory(false); }}>
                    <div className="history-item-body">
                      <code className="history-item-code" title={h.sql}>{h.sql}</code>
                      <div className="history-item-meta">
                        <span>{new Date(h.ts).toLocaleString()}</span>
                        {h.db && <span className="history-item-db">{h.db}</span>}
                      </div>
                    </div>
                    {copiedIdx === i ? (
                      <span className="history-item-copied">Copied!</span>
                    ) : (
                      <>
                        <button className="history-item-copy" title="Copy SQL"
                          onClick={e => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(h.sql);
                            setCopiedIdx(i);
                            setTimeout(() => setCopiedIdx(null), 1200);
                          }}>⧉</button>
                        <button className="history-item-delete" title="Remove"
                          onClick={e => {
                            e.stopPropagation();
                            const next = queryHistory.filter(item => item !== h);
                            setQueryHistory(next);
                            localStorage.setItem('sql-history', JSON.stringify(next));
                          }}>×</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
