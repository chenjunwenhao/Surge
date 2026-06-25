/**
 * Parse CSV text into rows.
 * Handles: quoted fields, escaped quotes, CRLF/LF line endings, trailing empty line.
 */
export function parseCSV(text, hasHeader = null) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        // skip truly empty rows (trailing newline)
        if (row.length === 1 && row[0] === '') { row = []; continue; }
        rows.push(row);
        row = [];
      } else if (ch === '\r') {
        // skip CR
      } else {
        field += ch;
      }
    }
  }

  // Flush last field / row
  row.push(field);
  if (!(row.length === 1 && row[0] === '')) rows.push(row);

  if (rows.length === 0) return { columns: null, rows: [], hasHeader: false };

  // Auto-detect header: if first row values look like names (not numbers, not empty)
  const headerDetected = hasHeader !== null ? hasHeader : detectHeader(rows[0]);

  if (headerDetected) {
    const headers = rows[0];
    const data = rows.slice(1);
    return { columns: headers, rows: data, hasHeader: true };
  }

  return { columns: null, rows, hasHeader: false };
}

function detectHeader(firstRow) {
  if (!firstRow || firstRow.length === 0) return false;
  // Check every value: if >= 70% of them are non-numeric and non-empty, treat as header
  let nonNumeric = 0;
  for (const v of firstRow) {
    const trimmed = v.trim();
    if (trimmed !== '' && isNaN(Number(trimmed))) nonNumeric++;
  }
  return nonNumeric > 0 && nonNumeric / firstRow.length >= 0.7;
}

/**
 * Parse JSON text. Expects an array of objects.
 */
export function parseJSON(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
  if (data.length === 0) return { columns: null, rows: [], hasHeader: false };

  const columns = Object.keys(data[0]);
  const rows = data.map(obj => columns.map(c => {
    const v = obj[c];
    if (v === null || v === undefined) return '';
    return String(v);
  }));

  return { columns, rows, hasHeader: true };
}
