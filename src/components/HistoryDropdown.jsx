import I from '../utils/icons';

/* ==================== History Dropdown ==================== */
export default function HistoryDropdown({
  show,
  queryHistory,
  setQueryHistory,
  onClose,
  onQueryClick,
}) {
  if (!show) return null;

  return (
    <div className="history-dropdown" style={{ position: 'absolute', top: 36, right: 8, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, maxHeight: 300, overflowY: 'auto', width: 360, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Query History ({queryHistory.length})</span>
        <button className="btn btn-sm" onClick={() => { setQueryHistory([]); localStorage.setItem('sql-history', '[]'); onClose(); }}>Clear All</button>
      </div>
      {queryHistory.length === 0 ? (
        <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 12 }}>No history yet. Run a query to start.</div>
      ) : (
        queryHistory.slice(0, 30).map((h, i) => (
          <div key={i} className="history-item" style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 11 }}
            onClick={() => onQueryClick(h)}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            <code style={{ display: 'block', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis', maxHeight: 40, color: 'var(--text)' }}>{h.sql?.length > 100 ? h.sql.slice(0, 100) + '...' : h.sql}</code>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(h.ts).toLocaleString()}</span>
          </div>
        ))
      )}
    </div>
  );
}
