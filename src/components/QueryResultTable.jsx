import { useState, useCallback, useEffect } from 'react';
import { escapeSQL } from '../utils/sqlGenerator';

/* ==================== Query Result Table ==================== */
export default function QueryResultTable({ rows, fields, error, tableName, toast, onSelectionChange }) {
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [ctxMenu, setCtxMenu] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.([...selected].map(i => rows[i]).filter(Boolean));
  }, [selected, rows, onSelectionChange]);

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  const toggleRow = (idx) => {
    setSelected(p => { const n = new Set(p); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; });
  };

  const togglePage = () => {
    setSelected(p => {
      const n = new Set(p);
      const allOnPage = paged.every(row => n.has(rows.indexOf(row)));
      paged.forEach(row => { const idx = rows.indexOf(row); if (allOnPage) n.delete(idx); else n.add(idx); });
      return n;
    });
  };

  const copyInsert = useCallback((row) => {
    if (!tableName) return;
    const cols = fields?.length ? fields.map(f => f.name) : Object.keys(row);
    const vals = cols.map(c => escapeSQL(row[c])).join(', ');
    const names = cols.map(c => `\`${c}\``).join(', ');
    const sql = `INSERT INTO \`${tableName}\` (${names}) VALUES (${vals});`;
    navigator.clipboard.writeText(sql).then(() => {
      toast?.('INSERT copied to clipboard', 'success');
    }).catch(() => {
      toast?.('Failed to copy', 'error');
    });
    setCtxMenu(null);
  }, [fields, tableName, toast]);

  const onContextMenu = useCallback((e, row) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, row });
  }, []);

  if (error) return <div style={{ padding: 12, color: 'var(--red)' }}>Error: {error}</div>;
  if (!rows || !rows.length) return (
    <div className="tab-content-empty" style={{ minHeight: 80, justifyContent: 'center' }}>
      <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 8 }}>{'\u2205'}</div>
      <p>Query returned no rows.</p>
    </div>
  );
  const cols = fields?.length ? fields.map(f => f.name) : Object.keys(rows[0] || {});
  const total = Math.ceil(rows.length / pageSize);
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  const selArr = [...selected];
  return (
    <div className="result-table-wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderBottom: '1px solid var(--border-light)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rows.length} rows</span>
        <div style={{ flex: 1 }} />
        <button className={`btn btn-sm${selectMode ? ' btn-active' : ''}`}
          onClick={() => { setSelectMode(v => !v); if (selectMode) setSelected(new Set()); }}
          style={selectMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}>
          {selectMode ? `${selArr.length} selected` : 'Select'}
        </button>
      </div>
      <table className="result-table">
        <thead><tr>
          {selectMode && (
            <th style={{ width: 32, textAlign: 'center' }}>
              <span className="custom-checkbox" onClick={(e) => { e.stopPropagation(); togglePage(); }}>
                <span className={paged.length > 0 && paged.every(row => selected.has(rows.indexOf(row))) ? 'custom-checkbox-mark checked' : 'custom-checkbox-mark'} />
              </span>
            </th>
          )}
          <th style={{ width: 40, textAlign: 'center' }}>#</th>
          {cols.map((n, i) => (
  <th key={n}>
    <span className="col-name">{n}</span>
    {fields?.[i] && <span className="col-type">{fields[i].type}</span>}
  </th>
))}
        </tr></thead>
        <tbody>
          {paged.map((row, ri) => {
            const rowIdx = rows.indexOf(row);
            const isSel = selected.has(rowIdx);
            return (
            <tr key={ri} className={isSel ? 'selected-row' : ''}
              onClick={selectMode ? () => toggleRow(rowIdx) : undefined}
              style={selectMode ? { cursor: 'pointer' } : {}}
              onContextMenu={(e) => onContextMenu(e, row)}>
              {selectMode && (
                <td style={{ textAlign: 'center' }}>
                  <span className="custom-checkbox" onClick={(e) => { e.stopPropagation(); toggleRow(rowIdx); }}>
                    <span className={isSel ? 'custom-checkbox-mark checked' : 'custom-checkbox-mark'} />
                  </span>
                </td>
              )}
              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>{rowIdx + 1}</td>
              {cols.map(cn => <td key={cn}>{row[cn] === null ? <span className="null-value">NULL</span> : String(row[cn])}</td>)}
            </tr>
          );
          })}
        </tbody>
      </table>
      {total > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', justifyContent: 'center' }}>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{page}/{total} ({selArr.length > 0 ? `${selArr.length} / ` : ''}{rows.length} rows)</span>
          <button className="btn btn-sm" disabled={page >= total} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <div className="context-menu" style={{ position: 'fixed', left: ctxMenu.x + 180 > window.innerWidth ? ctxMenu.x - 180 : ctxMenu.x, top: ctxMenu.y + 50 > window.innerHeight ? ctxMenu.y - 50 : ctxMenu.y, zIndex: 1000 }}>
          <div className="context-menu-item" onClick={() => copyInsert(ctxMenu.row)}>
            Copy Row as INSERT
          </div>
        </div>
      )}
    </div>
  );
}
