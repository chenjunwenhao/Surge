import { useState, useEffect, useRef, useMemo } from 'react';
import { generateInsertSQL, generateUpdateSQL } from '../utils/sqlGenerator';

export default function GenerateSqlModal({ show, rows, fields, tableName, pkColumns, onClose, toast }) {
  const [dmlType, setDmlType] = useState('INSERT');
  const [tblName, setTblName] = useState(tableName || '');
  const [whereCols, setWhereCols] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (show) {
      setTblName(tableName || '');
      setDmlType('INSERT');
      setWhereCols(pkColumns || []);
    }
  }, [show, tableName, pkColumns]);

  // Toggle a WHERE column
  const toggleWhereCol = (col) => {
    setWhereCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  // Generate SQL preview
  const sql = useMemo(() => {
    if (!rows || !fields) return '';
    if (dmlType === 'INSERT') return generateInsertSQL(rows, fields, tblName);
    return generateUpdateSQL(rows, fields, tblName, whereCols);
  }, [rows, fields, tblName, dmlType, whereCols]);

  // Copy to clipboard
  const copy = async () => {
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      toast('Copied to clipboard', 'success');
    } catch (_) {
      // Fallback for non-HTTPS / older browsers
      textareaRef.current?.select();
      document.execCommand('copy');
      toast('Copied to clipboard', 'success');
    }
  };

  // Escape key
  useEffect(() => {
    if (!show) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [show, onClose]);

  if (!show) return null;

  const cols = fields ? fields.map(f => f.name) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="generate-sql-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-dialog-header">
          <span>Generate SQL</span>
          <button className="btn btn-sm" onClick={onClose}>&times;</button>
        </div>

        <div className="generate-sql-body">
          {/* Type toggle */}
          <div className="gen-row">
            <label className="gen-label">Type</label>
            <div className="gen-toggle">
              <button
                className={`gen-toggle-btn${dmlType === 'INSERT' ? ' active' : ''}`}
                onClick={() => setDmlType('INSERT')}
              >INSERT</button>
              <button
                className={`gen-toggle-btn${dmlType === 'UPDATE' ? ' active' : ''}`}
                onClick={() => setDmlType('UPDATE')}
              >UPDATE</button>
            </div>
          </div>

          {/* Table name */}
          <div className="gen-row">
            <label className="gen-label" htmlFor="gen-tbl">Table</label>
            <input
              id="gen-tbl"
              className="conn-input"
              style={{ width: 220 }}
              value={tblName}
              onChange={e => setTblName(e.target.value)}
              placeholder="table_name"
            />
          </div>

          {/* WHERE columns (UPDATE only) */}
          {dmlType === 'UPDATE' && cols.length > 0 && (
            <div className="gen-row">
              <label className="gen-label">WHERE cols</label>
              <div className="gen-checkboxes">
                {cols.map(c => (
                  <label key={c} className="gen-check">
                    <input
                      type="checkbox"
                      checked={whereCols.includes(c)}
                      onChange={() => toggleWhereCol(c)}
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Row count */}
          <div className="gen-row" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {rows ? rows.length : 0} row(s)
          </div>

          {/* SQL Preview */}
          <textarea
            ref={textareaRef}
            className="gen-textarea"
            readOnly
            value={sql}
            rows={12}
            onClick={() => textareaRef.current?.select()}
          />
        </div>

        <div className="confirm-dialog-footer">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={copy} disabled={!sql}>
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
}
