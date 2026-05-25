/* ==================== SQL Linter ==================== */
const SQL_KW = new Set([
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'AS',
  'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'CROSS', 'FULL', 'NATURAL', 'USING', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'ALL', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP',
  'TRUNCATE', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'IF', 'ASC', 'DESC', 'PRIMARY', 'KEY', 'FOREIGN',
  'REFERENCES', 'DEFAULT', 'AUTO_INCREMENT', 'UNIQUE', 'CHECK', 'CASCADE', 'BEGIN', 'COMMIT', 'ROLLBACK',
  'REPLACE', 'EXPLAIN', 'DESCRIBE', 'SHOW', 'USE', 'LOCK', 'SHARE', 'MODE', 'FOR',
]);

function editDist1(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === bl) {
    let diffs = 0;
    for (let i = 0; i < al; i++) { if (a[i] !== b[i] && ++diffs > 1) return 99; }
    return diffs;
  }
  if (Math.abs(al - bl) === 1) {
    const shorter = al < bl ? a : b;
    const longer = al < bl ? b : a;
    let si = 0, li = 0, diffs = 0;
    while (si < shorter.length && li < longer.length) {
      if (shorter[si] === longer[li]) { si++; li++; }
      else { diffs++; li++; if (diffs > 1) return 99; }
    }
    return diffs + (longer.length - li);
  }
  return 99;
}

function findClosest1(word, dict) {
  for (const kw of dict) {
    if (editDist1(word, kw) === 1) return kw;
  }
  return null;
}

const CJK_FULL_RE = /[\u3000-\u303F\uFF00-\uFFEF\u4E00-\u9FFF\u3400-\u4DBF]/g;

export function lintSQL(model, monaco, instances) {
  const markers = [];
  const text = model.getValue();
  if (!text.trim()) { monaco.editor.setModelMarkers(model, 'sql-linter', []); return; }

  const knownNames = new Set();
  (instances || []).forEach(inst => {
    if (inst.dbTables) Object.values(inst.dbTables).forEach(tabs => tabs.forEach(t => knownNames.add(t.TABLE_NAME.toUpperCase())));
    if (inst.tableColumns) Object.values(inst.tableColumns).forEach(cols => cols.forEach(c => knownNames.add(c.COLUMN_NAME.toUpperCase())));
  });

  const lines = text.split('\n');
  const wordRe = /[a-zA-Z_]\w*/g;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const ln = li + 1;
    const trimmed = line.trim();
    if (!trimmed) continue;

    let m;
    CJK_FULL_RE.lastIndex = 0;
    while ((m = CJK_FULL_RE.exec(line)) !== null) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `中文字符/全角标点 "${m[0]}" 会导致 SQL 语法错误`,
        startLineNumber: ln, startColumn: m.index + 1,
        endLineNumber: ln, endColumn: m.index + 2,
      });
    }

    const candWords = [];
    wordRe.lastIndex = 0;
    let prevWord = '';
    while ((m = wordRe.exec(line)) !== null) {
      const w = m[0];
      const up = w.toUpperCase();
      const col = m.index + 1;
      if (candWords.length === 0 && col === 1 + (line.length - trimmed.length)) {
        candWords.push({ word: w, col });
      }
      if (prevWord === 'AND' || prevWord === 'OR' || prevWord === 'ON') {
        candWords.push({ word: w, col });
      }
      prevWord = up;
    }

    for (const cw of candWords) {
      const up = cw.word.toUpperCase();
      if (SQL_KW.has(up)) continue;
      if (knownNames.has(up)) continue;
      if (up.length < 4) continue;
      if (up.includes('_')) continue;
      if (!/[AEIOU]/.test(up.slice(0, 3))) continue;

      const fix = findClosest1(up, SQL_KW);
      if (fix) {
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `"${cw.word}" 可能是拼写错误，想说 "${fix}" 吗？`,
          startLineNumber: ln, startColumn: cw.col,
          endLineNumber: ln, endColumn: cw.col + cw.word.length,
        });
      }
    }
  }

  monaco.editor.setModelMarkers(model, 'sql-linter', markers);
}

let lintTimer = null;
let lastLintVersion = 0;
let lastLintText = '';

export function scheduleLint(model, monaco, instances) {
  try {
    clearTimeout(lintTimer);
    if (model.getValueLength() > 200000) return;
    const version = model.getVersionId();
    if (version === lastLintVersion) return;
    lintTimer = setTimeout(() => {
      try {
        const text = model.getValue();
        if (text === lastLintText) return;
        lastLintText = text;
        lastLintVersion = model.getVersionId();
        lintSQL(model, monaco, instances);
      } catch (e) { console.error('Lint error:', e); }
    }, 400);
  } catch (e) {
    console.error('scheduleLint error:', e);
  }
}
