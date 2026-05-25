/* ==================== Indexes Viewer ==================== */
export default function IndexesViewer({ indexes }) {
  if (!indexes) return <div className="tab-content-empty" style={{ minHeight: 100 }}><div className="spinner" /></div>;
  if (!indexes.length) return <div className="tab-content-empty" style={{ minHeight: 100 }}><p>No indexes.</p></div>;
  return (
    <div className="indexes-view">
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
