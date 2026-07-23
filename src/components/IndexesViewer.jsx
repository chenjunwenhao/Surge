/* ==================== Indexes Viewer ==================== */
import I from '../utils/icons';

export default function IndexesViewer({ indexes, onRefresh }) {
  if (!indexes) return <div className="tab-content-empty" style={{ minHeight: 100 }}><div className="spinner" /></div>;
  if (!indexes.length) return <div className="tab-content-empty" style={{ minHeight: 100 }}><p>No indexes.</p></div>;
  return (
    <div className="indexes-view" style={{ position: 'relative' }}>
      {onRefresh && (
        <button className="btn btn-sm" style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }} title="Refresh Indexes"
          onClick={onRefresh}>{I.refresh}</button>
      )}
      <table className="indexes-table"><thead><tr>
        <th>Key Name</th><th>Column</th><th>Unique</th><th>Type</th><th>Seq</th>
      </tr></thead><tbody>
        {indexes.map((idx, i) => (
          <tr key={i}><td style={{ fontWeight: 500 }}>{idx.Key_name}</td><td>{idx.Column_name}</td>
            <td>{idx.Non_unique === 0 ? 'YES' : 'no'}</td><td>{idx.Index_type}</td><td>{idx.Seq_in_index}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}
