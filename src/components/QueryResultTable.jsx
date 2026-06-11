import { useState } from 'react';

/* ==================== Query Result Table ==================== */
export default function QueryResultTable({ rows, fields, error }) {
  const [page, setPage] = useState(1);
  const pageSize = 100;
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
  return (
    <div className="result-table-wrap">
      <table className="result-table">
        <thead><tr>
          <th style={{ width: 40, textAlign: 'center' }}>#</th>
          {cols.map((n, i) => (
  <th key={n}>
    <span className="col-name">{n}</span>
    {fields?.[i] && <span className="col-type">{fields[i].type}</span>}
  </th>
))}
        </tr></thead>
        <tbody>
          {paged.map((row, ri) => (
            <tr key={ri}>
              <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11 }}>{(page - 1) * pageSize + ri + 1}</td>
              {cols.map(cn => <td key={cn}>{row[cn] === null ? <span className="null-value">NULL</span> : String(row[cn])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {total > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', justifyContent: 'center' }}>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{page}/{total} ({rows.length} rows)</span>
          <button className="btn btn-sm" disabled={page >= total} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
