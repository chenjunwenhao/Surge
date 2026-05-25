import I from '../utils/icons';

/* ==================== Query Picker (New Query dropdown) ==================== */
export default function QueryPicker({
  instances,
  savedConns,
  showPicker,
  onClose,
  pickerExpand,
  setPickerExpand,
  pickerConnecting,
  setPickerConnecting,
  pickerDbSearch,
  setPickerDbSearch,
  connSaved,
  newQuery,
  loadTabs,
  setInstances,
}) {
  if (!showPicker) return null;

  const connectedNames = new Set(instances.filter(i => i.connected).map(i => i.name));
  const items = [
    ...instances.filter(i => i.connected).map(inst => ({
      type: 'connected', key: inst.id, inst, name: inst.name, dbs: inst.databases || [],
    })),
    ...savedConns.filter(c => !connectedNames.has(c.name)).map(c => ({
      type: 'saved', key: c.id, conn: c, name: c.name, dbs: [],
    })),
  ];

  return (
    <>
      <div className="query-picker-overlay" onClick={onClose} />
      <div className="query-picker" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 1001 }}>
        <div className="query-picker-header">
          <span>New Query</span>
          <button className="btn-icon" onClick={onClose}>{I.close}</button>
        </div>
        <div className="query-picker-body">
          {items.length === 0 ? (
            <div className="tree-empty" style={{ padding: 16, textAlign: 'center' }}>No connections — save one first</div>
          ) : (
            items.map(item => {
              const isExpanded = pickerExpand === item.key;
              const isConnecting = pickerConnecting === item.key;
              return (
                <div key={item.key} className="picker-inst-group">
                  <div
                    className="picker-inst-row"
                    onClick={async () => {
                      if (item.type === 'saved') {
                        setPickerConnecting(item.key);
                        try {
                          await connSaved(item.conn);
                          // react state update from connSaved is async, wait a tick
                          await new Promise(r => setTimeout(r, 50));
                          setInstances(prev => {
                            const newInst = prev.find(i => i.name === item.name && i.connected);
                            if (newInst) setPickerExpand(newInst.id);
                            return prev;
                          });
                        } catch (e) { /* ignore */ }
                        setPickerConnecting(null);
                      } else {
                        setPickerExpand(isExpanded ? null : item.key);
                        setPickerDbSearch('');
                      }
                    }}
                  >
                    <span className="tree-node-arrow" style={{ fontSize: 10, marginRight: 4 }}>
                      {isConnecting ? '\u23F3' : isExpanded ? '\u25BE' : '\u25B8'}
                    </span>
                    <span className="tree-node-icon" style={{ color: item.type === 'saved' ? 'var(--text-muted)' : undefined }}>{I.server}</span>
                    <span className="picker-label" style={{ color: item.type === 'saved' ? 'var(--text-muted)' : undefined }}>{item.name}</span>
                    {item.type === 'connected' && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{item.dbs.length} db{item.dbs.length !== 1 ? 's' : ''}</span>
                    )}
                    {item.type === 'saved' && (
                      <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>connect</span>
                    )}
                  </div>
                  {isExpanded && item.type === 'connected' && (
                    <div className="picker-db-list">
                      {item.dbs.length === 0 ? (
                        <div className="picker-db-row" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No databases loaded</div>
                      ) : (
                        <>
                          <input
                            className="conn-input"
                            placeholder="Search databases..."
                            value={pickerDbSearch}
                            onChange={e => setPickerDbSearch(e.target.value)}
                            autoFocus
                            style={{ margin: '4px 6px', width: 'calc(100% - 12px)', fontSize: 12, boxSizing: 'border-box' }}
                          />
                          {item.dbs.filter(db => !pickerDbSearch || db.name.toLowerCase().includes(pickerDbSearch.toLowerCase())).map(db => (
                            <div key={db.name} className="picker-db-row" onClick={() => { loadTabs(item.inst.id, db.name); newQuery(item.inst.id, db.name); setPickerDbSearch(''); }}>
                              <span className="tree-node-icon">{I.db}</span>
                              <span className="picker-label">{db.name}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
