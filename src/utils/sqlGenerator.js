/**
 * SQL Generator — generates INSERT / UPDATE statements from result rows.
 */

function escapeSQL(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  const s = String(val);
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function generateInsertSQL(rows, fields, tableName) {
  if (!rows || !rows.length || !fields || !fields.length) return '';
  const columns = fields.map(f => f.name);
  const colList = columns.map(c => `\`${c}\``).join(', ');
  const values = rows.map(row =>
    '(' + columns.map(c => escapeSQL(row[c])).join(', ') + ')'
  ).join(',\n');
  return `INSERT INTO \`${tableName}\` (${colList})\nVALUES\n${values};`;
}

export function generateUpdateSQL(rows, fields, tableName, whereColumns) {
  if (!rows || !rows.length || !fields || !fields.length || !whereColumns.length) return '';
  const allColumns = fields.map(f => f.name);
  const setColumns = allColumns.filter(c => !whereColumns.includes(c));
  if (!setColumns.length) return '';
  return rows.map(row => {
    const setClause = setColumns.map(c => `\`${c}\` = ${escapeSQL(row[c])}`).join(', ');
    const whereClause = whereColumns.map(c => `\`${c}\` = ${escapeSQL(row[c])}`).join(' AND ');
    return `UPDATE \`${tableName}\` SET ${setClause} WHERE ${whereClause};`;
  }).join('\n');
}
