import { useState, useEffect, useCallback } from 'react';
import I from '../utils/icons';
import { escapeSQL, generateInsertSQL, generateUpdateSQL } from '../utils/sqlGenerator';

/* ==================== Paginated Table Data Grid ==================== */
export default function TableDataGrid({ columns, rows, pkColumns, dirtyRows, onCellChange, onSaveRow, onRefresh, onInsertRow, onDeleteRows, toast, tableName }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [editCell, setEditCell] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [newRow, setNewRow] = useState(null); // { col: value, ... } for inline insert
  const [sqlMenu, setSqlMenu] = useState(null); // 'insert' | 'update' | null
  const [exportMenu, setExportMenu] = useState(null); // 'csv' | 'json' | 'xlsx'
  const [selectMode, setSelectMode] = useState(false);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [rows]);

  const colNames = columns.map(c => c.COLUMN_NAME);

  let filtered = rows;
  if (filter) {
    const f = filter.toLowerCase();
    filtered = rows.filter(row =>
      colNames.some(cn => String(row[cn] ?? '').toLowerCase().includes(f))
    );
  }

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selArr = [...selected];
  const hasSelection = selArr.length > 0;
  const hasDirty = Object.keys(dirtyRows || {}).length > 0;
  const tblName = tableName || '';

  // Toggle a row selection
  const toggleRow = (rowIdx) => {
    setSelected(p => { const n = new Set(p); if (n.has(rowIdx)) n.delete(rowIdx); else n.add(rowIdx); return n; });
  };

  // Toggle all on current page
  const togglePage = () => {
    setSelected(p => {
      const n = new Set(p);
      const allOnPage = paged.every(row => n.has(rows.indexOf(row)));
      paged.forEach(row => { const idx = rows.indexOf(row); if (allOnPage) n.delete(idx); else n.add(idx); });
      return n;
    });
  };

  // ----- Insert new row -----
  const startInsert = () => {
    setNewRow(Object.fromEntries(columns.map(c => [c.COLUMN_NAME, null])));
    setSqlMenu(null);
  };
  const cancelInsert = () => setNewRow(null);
  const commitInsert = async () => {
    if (!newRow || !onInsertRow) return;
    await onInsertRow(newRow);
    setNewRow(null);
  };

  // ----- Delete selected -----
  const deleteSelected = async () => {
    if (!onDeleteRows || selArr.length === 0) return;
    await onDeleteRows(selArr);
    setSelected(new Set());
  };

  // ----- Generate SQL -----
  const genSql = (type) => {
    if (selArr.length === 0) {
      toast?.('No rows selected', 'warning');
      return;
    }
    const selRows = selArr.map(i => rows[i]).filter(Boolean);
    const fields = columns.map(c => ({ name: c.COLUMN_NAME }));
    let sql = '';
    if (type === 'insert') {
      sql = generateInsertSQL(selRows, fields, tblName);
    } else {
      sql = generateUpdateSQL(selRows, fields, tblName, pkColumns);
    }
    if (!sql) { toast?.('Could not generate SQL', 'warning'); return; }
    navigator.clipboard.writeText(sql).then(() => {
      toast?.(`${type === 'insert' ? 'INSERT' : 'UPDATE'} (${selRows.length} rows) copied`, 'success');
    }).catch(() => toast?.('Copy failed', 'error'));
    setSqlMenu(null);
  };

  // ----- Export selected / all -----
  const doExport = (format) => {
    const exportRows = selArr.length > 0 ? selArr.map(i => rows[i]).filter(Boolean) : rows;
    const cols = colNames;
    if (exportRows.length === 0) { toast?.('No rows to export', 'warning'); return; }

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(exportRows, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${tblName || 'export'}.json`);
    } else if (format === 'csv') {
      const header = cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
      const body = exportRows.map(r => cols.map(c => {
        const v = r[c];
        if (v === null || v === undefined) return '';
        const s = String(v);
        return `"${s.replace(/"/g, '""')}"`;
      }).join(',')).join('\n');
      const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8' });
      downloadBlob(blob, `${tblName || 'export'}.csv`);
    } else if (format === 'xlsx') {
      // Dynamic import XLSX only when needed
      import('xlsx').then(XLSX => {
        const sheet = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, sheet, tblName || 'Sheet1');
        XLSX.writeFile(wb, `${tblName || 'export'}.xlsx`);
      }).catch(() => toast?.('XLSX export requires xlsx library', 'error'));
    }
    setExportMenu(null);
  };

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  // Close menus on outside click
  useEffect(() => {
    if (!sqlMenu && !exportMenu) return;
    const h = () => { setSqlMenu(null); setExportMenu(null); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [sqlMenu, exportMenu]);

  return (
    <div className="table-grid-wrap">
      <div className="table-grid-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
        <input className="conn-input" placeholder="Filter..." value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1); }}
          style={{ width: 180, padding: '3px 8px', fontSize: 12 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
          {filtered.length} / {rows.length} rows {hasSelection && <span style={{ color: 'var(--accent)' }}>({selArr.length} selected)</span>}
        </span>
        <div style={{ flex: 1 }} />
        <select className="conn-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ width: 64, padding: '3px 6px', fontSize: 12 }}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{page}/{totalPages || 1}</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        <span style={{ borderLeft: '1px solid var(--border-light)', height: 18, margin: '0 2px' }} />
        <button className="btn btn-sm" onClick={onRefresh}>{I.refresh} Refresh</button>
        <button className="btn btn-sm" onClick={startInsert} title="Insert a new row">+ Row</button>
        <button className={`btn btn-sm${selectMode ? ' btn-active' : ''}`}
          onClick={() => { setSelectMode(v => !v); if (selectMode) setSelected(new Set()); }}
          title={selectMode ? 'Exit selection mode' : 'Enter selection mode'} style={selectMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>
          {selectMode ? '✓ Select' : 'Select'}
        </button>
        {selectMode && selArr.length > 0 && <>
          <button className="btn btn-sm" style={{ color: 'var(--red)' }} onClick={deleteSelected} title="Delete selected rows">🗑 Del ({selArr.length})</button>
          <div style={{ position: 'relative' }}>
            <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setSqlMenu(sqlMenu ? null : 'open'); setExportMenu(null); }} title="Generate INSERT/UPDATE for selected rows">SQL ▾</button>
            {sqlMenu && (
              <div className="context-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, minWidth: 160 }}>
                <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); genSql('insert'); }}>Generate INSERT ({selArr.length} rows)</div>
                <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); genSql('update'); }}>Generate UPDATE ({selArr.length} rows)</div>
              </div>
            )}
          </div>
        </>}
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm" onClick={e => { e.stopPropagation(); setExportMenu(exportMenu ? null : 'open'); setSqlMenu(null); }}>Export ▾</button>
          {exportMenu && (
            <div className="context-menu" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, minWidth: 140 }}>
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); doExport('csv'); }}>CSV {hasSelection ? `(${selArr.length} selected)` : '(all)'}</div>
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); doExport('json'); }}>JSON {hasSelection ? `(${selArr.length} selected)` : '(all)'}</div>
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); doExport('xlsx'); }}>XLSX {hasSelection ? `(${selArr.length} selected)` : '(all)'}</div>
            </div>
          )}
        </div>
        <button className="btn btn-sm btn-primary" disabled={!hasDirty} onClick={onSaveRow}>Save Row</button>
      </div>

      <div className="table-grid-scroll">
      <table className="table-grid">
        <thead>
          <tr>
            {selectMode && (
              <th style={{ width: 28, textAlign: 'center', cursor: 'pointer' }} onClick={togglePage}>
                <input type="checkbox" checked={paged.length > 0 && paged.every(row => selected.has(rows.indexOf(row)))}
                  onChange={togglePage} style={{ margin: 0, cursor: 'pointer' }} />
              </th>
            )}
            <th style={{ width: 36, textAlign: 'center' }}>#</th>
            {columns.map(col => (
              <th key={col.COLUMN_NAME} style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (sortCol !== col.COLUMN_NAME) { setSortCol(col.COLUMN_NAME); setSortDir('asc'); }
                  else if (sortDir === 'asc') setSortDir('desc');
                  else { setSortCol(null); setSortDir('asc'); }
                }}>
                <span className="col-name">{col.COLUMN_NAME} {sortCol === col.COLUMN_NAME ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}</span>
                <span className="col-type">{col.DATA_TYPE}</span>
                {col.COLUMN_KEY === 'PRI' && <span style={{ color: 'var(--yellow)', marginLeft: 4 }}>PK</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* New row insert form */}
          {newRow && (
            <tr className="new-row">
              {selectMode && <td style={{ textAlign: 'center' }} />}
              <td style={{ textAlign: 'center' }}>
                <button className="btn btn-sm btn-primary" style={{ padding: '2px 6px', fontSize: 11, whiteSpace: 'nowrap' }}
                  onClick={commitInsert} title="Commit insert">{'\u2713'}</button>
              </td>
              <td style={{ textAlign: 'center', color: 'var(--accent)', fontSize: 11 }}>NEW</td>
              {colNames.map(cn => (
                <td key={cn}>
                  <input className="cell-input"
                    value={newRow[cn] === null ? '' : String(newRow[cn])}
                    onChange={e => setNewRow(p => ({ ...p, [cn]: e.target.value === '' ? null : e.target.value }))}
                    placeholder="NULL"
                    style={{ borderColor: 'var(--accent)' }}
                  />
                </td>
              ))}
            </tr>
          )}
          {paged.map((row, ri) => {
            const rowIdx = rows.indexOf(row);
            const isDirty = dirtyRows[rowIdx];
            const isSel = selected.has(rowIdx);
            return (
            <tr key={rowIdx} className={(isDirty ? 'dirty-row' : '') + (isSel ? ' selected-row' : '')} onClick={selectMode ? () => toggleRow(rowIdx) : undefined} style={selectMode ? { cursor: 'pointer' } : {}}>
              {selectMode && (
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={isSel} onChange={() => toggleRow(rowIdx)}
                    style={{ margin: 0, cursor: 'pointer' }} />
                </td>
              )}
              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>{rowIdx + 1}</td>
              {colNames.map(cn => {
                const cellIdx = rowIdx;
                const isEditing = editCell && editCell.row === cellIdx && editCell.col === cn;
                return (
                  <td key={cn} onDoubleClick={() => setEditCell({ row: cellIdx, col: cn, value: row[cn] ?? '' })} style={{ cursor: 'text' }}>
                    {isEditing ? (
                      <input className="cell-input"
                        defaultValue={editCell.value}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Escape') { setEditCell(null); }
                          if (e.key === 'Enter') { onCellChange(cellIdx, cn, e.target.value); setEditCell(null); }
                        }}
                        onBlur={e => { onCellChange(cellIdx, cn, e.target.value); setEditCell(null); }}
                      />
                    ) : (
                      <span style={{ color: row[cn] === null ? 'var(--text-muted)' : undefined, fontStyle: row[cn] === null ? 'italic' : undefined }}>
                        {row[cn] === null ? 'NULL' : String(row[cn])}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
