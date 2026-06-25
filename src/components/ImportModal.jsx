import { useState, useEffect, useRef, useCallback } from 'react';
import { parseCSV, parseJSON } from '../utils/csvParser';
import api from '../utils/api';

/**
 * Data Import Modal
 * Supports CSV and JSON file import into a MySQL table.
 * Flow: select file → parse & preview → confirm column mapping → batch INSERT.
 */
export default function ImportModal({ show, instId, dbName, tName, onClose, toast }) {
  // Step: 'upload' | 'preview' | 'importing' | 'done'
  const [step, setStep] = useState('upload');
  const [table, setTable] = useState(tName || '');
  const [parsedCols, setParsedCols] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [columnNames, setColumnNames] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ total: 0, done: 0, errors: [] });
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  // Reset when shown
  useEffect(() => {
    if (show) {
      setStep('upload');
      setTable(tName || '');
      setParsedCols(null);
      setParsedRows([]);
      setHasHeader(true);
      setColumnNames([]);
      setPreviewRows([]);
      setImporting(false);
      setProgress({ total: 0, done: 0, errors: [] });
      setFileName('');
    }
  }, [show, tName]);

  // Escape key
  useEffect(() => {
    if (!show || importing) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [show, onClose, importing]);

  // Process file
  const processFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const isJSON = file.name.toLowerCase().endsWith('.json');

        let result;
        if (isJSON) {
          result = parseJSON(text);
        } else {
          result = parseCSV(text, hasHeader);
        }

        if (!result.rows.length) {
          toast('No data found in file', 'warning');
          return;
        }

        // Normalize column count
        const maxCols = Math.max(
          ...result.rows.map(r => r.length),
          result.columns ? result.columns.length : 0
        );

        // Pad short rows
        const normalizedRows = result.rows.map(r => {
          while (r.length < maxCols) r.push('');
          return r;
        });

        let cols;
        if (result.hasHeader && result.columns) {
          cols = result.columns.map(c => {
            // Clean up column name: remove quotes, trim
            let name = c.trim();
            if ((name.startsWith('"') && name.endsWith('"')) ||
                (name.startsWith("'") && name.endsWith("'"))) {
              name = name.slice(1, -1);
            }
            return name || `col_${Math.random().toString(36).slice(2, 6)}`;
          });
        } else {
          cols = Array.from({ length: maxCols }, (_, i) => `column_${i + 1}`);
        }

        setParsedCols(cols);
        setParsedRows(normalizedRows);
        setColumnNames(cols);
        setPreviewRows(normalizedRows.slice(0, 10));
        setStep('preview');
      } catch (err) {
        toast('Parse error: ' + (err.message || String(err)), 'error');
      }
    };
    reader.onerror = () => toast('Failed to read file', 'error');
    reader.readAsText(file);
  }, [hasHeader, toast]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const updateColName = (idx, val) => {
    setColumnNames(prev => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  // Batch import
  const doImport = async () => {
    const finalCols = columnNames.filter(c => c.trim());
    if (!finalCols.length) { toast('No columns specified', 'warning'); return; }
    if (!table.trim()) { toast('Table name required', 'warning'); return; }

    setImporting(true);
    setStep('importing');
    setProgress({ total: parsedRows.length, done: 0, errors: [] });

    const batchSize = 200;
    let totalDone = 0;
    const allErrors = [];

    try {
      for (let i = 0; i < parsedRows.length; i += batchSize) {
        const batch = parsedRows.slice(i, i + batchSize);
        const trimmed = batch.map(row => {
          // Trim row to match column count (use only columns with names)
          const result = new Array(finalCols.length).fill(null);
          for (let j = 0; j < Math.min(finalCols.length, row.length); j++) {
            result[j] = row[j];
          }
          return result;
        });

        try {
          const r = await api('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instanceId: instId || 'default',
              database: dbName,
              table: table.trim(),
              columns: finalCols,
              rows: trimmed,
            }),
          });

          if (r.ok) {
            totalDone += (r.inserted || trimmed.length);
          } else {
            allErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${r.error}`);
          }
        } catch (e) {
          allErrors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${e.message || String(e)}`);
        }

        setProgress({ total: parsedRows.length, done: totalDone, errors: allErrors });
      }
    } finally {
      setStep('done');
      setImporting(false);
      if (allErrors.length === 0) {
        toast(`${totalDone} row(s) imported`, 'success');
      } else if (totalDone > 0) {
        toast(`${totalDone} row(s) imported, ${allErrors.length} batch(es) failed`, 'warning');
      } else {
        toast('Import failed', 'error');
      }
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={importing ? null : onClose}>
      <div className="import-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="confirm-dialog-header">
          <span>Import Data</span>
          {!importing && (
            <button className="btn btn-sm" onClick={onClose}>&times;</button>
          )}
        </div>

        {/* Body */}
        <div className="import-body">
          {/* Step: upload */}
          {step === 'upload' && (
            <>
              <div className="gen-row">
                <label className="gen-label">Table</label>
                <input
                  className="conn-input"
                  style={{ width: 260 }}
                  value={table}
                  onChange={e => setTable(e.target.value)}
                  placeholder="table_name"
                />
              </div>

              <div
                className={`import-dropzone${dragOver ? ' dragover' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <div className="import-dropzone-icon">{'\u2B07'}</div>
                <div className="import-dropzone-text">
                  {dragOver ? 'Drop file here' : 'Click or drag a CSV/JSON file here'}
                </div>
                <div className="import-dropzone-hint">.csv, .json</div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              {fileName && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Selected: {fileName}</div>}
            </>
          )}

          {/* Step: preview */}
          {step === 'preview' && (
            <>
              {/* Column name editing */}
              <div className="import-section">
                <div className="import-section-title">
                  Column Mapping ({parsedCols?.length || 0} columns, {parsedRows.length} rows)
                </div>
                <div className="import-col-grid">
                  {columnNames.map((name, idx) => (
                    <div key={idx} className="import-col-item">
                      <span className="import-col-idx">{idx + 1}</span>
                      <input
                        className="conn-input import-col-input"
                        value={name}
                        onChange={e => updateColName(idx, e.target.value)}
                        placeholder={`col_${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview table */}
              <div className="import-section">
                <div className="import-section-title">
                  Preview (first {previewRows.length} rows)
                </div>
                <div className="import-preview-wrap">
                  <table className="result-table" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        {columnNames.map((name, idx) => (
                          <th key={idx}>{name || `col_${idx + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, ri) => (
                        <tr key={ri}>
                          <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{ri + 1}</td>
                          {columnNames.map((_, ci) => (
                            <td key={ci} className={row[ci] === '' || row[ci] === undefined ? 'null-value' : ''}>
                              {row[ci] === '' || row[ci] === undefined ? 'NULL' : row[ci]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="import-actions">
                <button className="btn" onClick={() => { setStep('upload'); setFileName(''); }}>
                  {'\u2190'} Back
                </button>
                <div style={{ flex: 1 }} />
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={doImport}>
                  Import {parsedRows.length} Rows
                </button>
              </div>
            </>
          )}

          {/* Step: importing */}
          {step === 'importing' && (
            <div className="import-progress">
              <div className="import-progress-text">
                Importing... {progress.done} / {progress.total} rows
              </div>
              <div className="import-progress-bar">
                <div
                  className="import-progress-fill"
                  style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
                />
              </div>
              {progress.errors.length > 0 && (
                <div className="import-progress-errors">
                  {progress.errors.map((err, i) => (
                    <div key={i} className="import-error-item">{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="import-done">
              <div className={`import-done-icon${progress.errors.length === 0 ? ' success' : ''}`}>
                {progress.errors.length === 0 ? '\u2714' : '\u26A0'}
              </div>
              <div className="import-done-text">
                {progress.done} row(s) imported
                {progress.errors.length > 0 && (
                  <span className="import-done-warn">
                    {'\n'}{progress.errors.length} batch(es) had errors
                  </span>
                )}
              </div>
              <div className="import-done-actions">
                {progress.errors.length > 0 && (
                  <div className="import-progress-errors" style={{ marginBottom: 12 }}>
                    {progress.errors.map((err, i) => (
                      <div key={i} className="import-error-item">{err}</div>
                    ))}
                  </div>
                )}
                <button className="btn" onClick={() => { onClose(); }}>Close</button>
                <button className="btn" onClick={() => setStep('preview')}>Back to Preview</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
