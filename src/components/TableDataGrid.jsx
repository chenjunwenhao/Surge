import { useState, useEffect } from 'react';
import I from '../utils/icons';

/* ==================== Paginated Table Data Grid ==================== */
export default function TableDataGrid({ columns, rows, pkColumns, dirtyRows, onCellChange, onSaveRow, onRefresh }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filter, setFilter] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [editCell, setEditCell] = useState(null);

  useEffect(() => { setPage(1); }, [rows]);

  if (!rows || !rows.length) {
    return <div className="tab-content-empty" style={{ minHeight: 100 }}>
      <div style={{ fontSize: 28, opacity: 0.2, marginBottom: 8 }}>{'\u2205'}</div>
      <p>This table is empty.</p>
    </div>;
  }

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

  return (
    <div className="table-grid-wrap">
      <div className="table-grid-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border-light)' }}>
        <input className="conn-input" placeholder="Filter..." value={filter}
          onChange={e => { setFilter(e.target.value); setPage(1); }}
          style={{ width: 200, padding: '3px 8px', fontSize: 12 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
          {filtered.length} / {rows.length} rows
        </span>
        <div style={{ flex: 1 }} />
        <select className="conn-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
          style={{ width: 70, padding: '3px 6px', fontSize: 12 }}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{page}/{totalPages || 1}</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        <button className="btn btn-sm" onClick={onRefresh}>{I.refresh} Refresh</button>
        <button className="btn btn-sm btn-primary" disabled={!Object.keys(dirtyRows || {}).length} onClick={onSaveRow}>Save Row</button>
      </div>

      <div className="table-grid-scroll">
      <table className="table-grid">
        <thead>
          <tr>
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
          {paged.map((row, ri) => (
            <tr key={(page - 1) * pageSize + ri} className={dirtyRows[(page - 1) * pageSize + ri] ? 'dirty-row' : ''}>
              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>{(page - 1) * pageSize + ri + 1}</td>
              {colNames.map(cn => {
                const cellIdx = (page - 1) * pageSize + ri;
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
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
