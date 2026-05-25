/* ==================== SQL Formatter (smart indent) ==================== */
function formatSQL(sql) {
  const raw = sql.trim();
  if (!raw) return raw;

  // ── Tokenizer ──
  const tokens = [];
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "'" || ch === '"') {
      const q = ch; let s = q; i++;
      while (i < raw.length && raw[i] !== q) { if (raw[i] === '\\') { s += raw[i]; i++; } s += raw[i] || ''; i++; }
      if (i < raw.length) { s += q; i++; } tokens.push({ type: 'str', val: s }); continue;
    }
    if (ch === '`') { let s = '`'; i++; while (i < raw.length && raw[i] !== '`') { s += raw[i]; i++; } if (i < raw.length) { s += '`'; i++; } tokens.push({ type: 'id', val: s }); continue; }
    if (ch === '-' && raw[i + 1] === '-') { let s = ''; while (i < raw.length && raw[i] !== '\n') { s += raw[i]; i++; } tokens.push({ type: 'comment', val: s }); continue; }
    if (ch === '/' && raw[i + 1] === '*') { let s = ''; while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) { s += raw[i]; i++; } if (i < raw.length) { s += '*/'; i += 2; } tokens.push({ type: 'comment', val: s }); continue; }
    if ((ch === '<' || ch === '>') && raw[i + 1] === '=') { tokens.push({ type: 'punct', val: ch + '=' }); i += 2; continue; }
    if (ch === '<' && raw[i + 1] === '>') { tokens.push({ type: 'punct', val: '<>' }); i += 2; continue; }
    if (ch === '!' && raw[i + 1] === '=') { tokens.push({ type: 'punct', val: '!=' }); i += 2; continue; }
    if (ch === '|' && raw[i + 1] === '|') { tokens.push({ type: 'punct', val: '||' }); i += 2; continue; }
    if (';,()=<>!+-*/%'.includes(ch)) { tokens.push({ type: 'punct', val: ch }); i++; continue; }
    if (ch === '.') { tokens.push({ type: 'dot', val: '.' }); i++; continue; }
    if (/[0-9]/.test(ch)) { let n = ''; while (i < raw.length && /[0-9.]/.test(raw[i])) { n += raw[i]; i++; } tokens.push({ type: 'num', val: n }); continue; }
    let w = ''; while (i < raw.length && !/[\s;,()=<>!+\-*/%.'\"`]/.test(raw[i]) && raw[i] !== '-') { w += raw[i]; i++; }
    tokens.push({ type: 'word', val: w });
  }
  if (!tokens.length) return raw;

  // ── Keyword sets ──
  const JOIN_PRE = new Set(['JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'OUTER', 'NATURAL']);
  const LOGICAL = new Set(['AND', 'OR']);
  const SPACE_BEFORE_PAREN = new Set(['IN', 'EXISTS']);
  const SUBQUERY_KW = new Set(['EXISTS', 'IN', 'NOT']);
  const ALL_KW = new Set(['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
    'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
    'CROSS', 'FULL', 'NATURAL', 'USING', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'INSERT', 'INTO',
    'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'TABLE', 'INDEX', 'VIEW', 'DATABASE',
    'IF', 'ASC', 'DESC', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'AUTO_INCREMENT', 'UNIQUE', 'CHECK',
    'CASCADE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'REPLACE', 'EXPLAIN', 'DESCRIBE', 'SHOW', 'USE', 'LOCK', 'SHARE',
    'MODE', 'FOR', 'ANY', 'SOME', 'TRUE', 'FALSE', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COALESCE', 'NULLIF', 'CAST',
    'CONVERT', 'OVER', 'PARTITION', 'ROWS', 'RANGE', 'UNBOUNDED', 'PRECEDING', 'FOLLOWING', 'CURRENT', 'WITH',
    'RECURSIVE', 'EXCEPT', 'INTERSECT', 'ISNULL', 'DIV', 'MOD', 'REGEXP', 'RLIKE', 'XOR', 'BINARY', 'ESCAPE']);

  // ── Phase 1: classify tokens ──
  const classified = [];
  for (let ti = 0; ti < tokens.length; ti++) {
    const t = tokens[ti];
    if (t.type === 'word') {
      const up = t.val.toUpperCase();
      classified.push(ALL_KW.has(up) ? { type: 'kw', val: up } : { type: 'id', val: t.val });
    } else {
      classified.push(t);
    }
  }

  const peek = (idx, offset) => {
    let c = 0;
    for (let i = idx; i < classified.length; i++) {
      if (classified[i].type === 'comment') continue;
      if (c === offset) return classified[i];
      c++;
    }
    return null;
  };

  const peekNextKw = (idx) => {
    for (let i = idx; i < classified.length; i++) {
      const t = classified[i];
      if (t.type === 'comment') continue;
      if (t.type === 'kw') return t.val;
      if (t.type === 'punct' && t.val === '(') continue;
      return null;
    }
    return null;
  };

  // ── Phase 2: pretty-print ──
  const lines = [];
  let cur = '';
  let cIndent = 0;
  let curLevel = 0;
  let depth = 0;
  let caseStack = [];
  let inSelect = false;
  let inOrderBy = false;
  let inGroupBy = false;
  let needsSpace = false;
  let betweenAnd = 0;
  let lastKw = '';
  let sqStack = [];
  let selectInline = false;

  const SP4 = '    ';
  const contentIndent = () => cIndent + 1;

  const flush = (level) => {
    if (cur.trim()) {
      const lv = level !== undefined ? level : curLevel;
      lines.push(SP4.repeat(lv) + cur.trim());
    }
    cur = '';
    needsSpace = false;
  };

  const write = (text, noSpace) => {
    if (needsSpace && !noSpace) cur += ' ';
    cur += text;
    needsSpace = !noSpace;
  };

  const newLine = (level) => {
    flush(level);
    curLevel = level;
  };

  const startClause = (keyword, resetFlags = true) => {
    if (selectInline && inSelect) {
      // Inline SELECT: keep SELECT columns and FROM on same line
    } else {
      flush(curLevel);
    }
    write(keyword);
    curLevel = cIndent;
    selectInline = false;
    if (resetFlags) { inSelect = false; inOrderBy = false; inGroupBy = false; }
    needsSpace = true;
  };

  const blockClause = (keyword, resetFlags = true) => {
    flush(curLevel);
    lines.push(SP4.repeat(cIndent) + keyword);
    cur = ''; needsSpace = false;
    curLevel = contentIndent();
    if (resetFlags) { inSelect = false; inOrderBy = false; inGroupBy = false; }
    needsSpace = true;
  };

  for (let ti = 0; ti < classified.length; ti++) {
    const t = classified[ti];
    const n1 = peek(ti, 1);
    const n2 = peek(ti, 2);

    // ── Comments ──
    if (t.type === 'comment') {
      const ct = t.val.trim();
      if (ct.startsWith('/*')) {
        flush(curLevel);
        lines.push(ct);
        curLevel = cIndent;
      } else if (cur.trim()) {
        cur += ' ' + ct;
      } else {
        lines.push(SP4.repeat(curLevel) + ct);
      }
      continue;
    }

    // ── Semicolon ──
    if (t.type === 'punct' && t.val === ';') {
      flush(cIndent);
      if (!lines.length || lines[lines.length - 1] !== ';') lines.push(';');
      cIndent = 0; curLevel = 0; inSelect = false; inOrderBy = false; inGroupBy = false;
      depth = 0; caseStack = []; betweenAnd = 0; lastKw = ''; sqStack = [];
      continue;
    }

    // ── Parens ──
    if (t.type === 'punct' && t.val === '(') {
      const nextKw = peekNextKw(ti + 1);
      if (SUBQUERY_KW.has(lastKw) && nextKw === 'SELECT') {
        write('(');
        flush(curLevel);
        sqStack.push({ cIndent: cIndent, curLevel: curLevel });
        cIndent = curLevel + 1;
        curLevel = cIndent;
        cur = ''; needsSpace = false;
        depth++;
        continue;
      }
      depth++;
      if (needsSpace && SPACE_BEFORE_PAREN.has(lastKw)) {
        cur += ' (';
      } else {
        cur += '(';
      }
      needsSpace = false;
      continue;
    }
    if (t.type === 'punct' && t.val === ')') {
      if (depth > 0) {
        depth--;
        if (depth === 0 && sqStack.length > 0) {
          flush(curLevel);
          const saved = sqStack.pop();
          cIndent = saved.cIndent;
          curLevel = saved.curLevel;
          cur = SP4.repeat(curLevel) + ')';
          needsSpace = true;
          continue;
        }
      }
      cur += ')'; needsSpace = true;
      continue;
    }

    // ── Comma ──
    if (t.type === 'punct' && t.val === ',') {
      cur = cur.trimEnd() + ',';
      needsSpace = true;
      if (depth === 0 && (inSelect || inOrderBy || inGroupBy)) {
        newLine(contentIndent());
      }
      continue;
    }

    // ── Dot ──
    if (t.type === 'dot') {
      cur += '.';
      needsSpace = false;
      continue;
    }

    // ── Keywords ──
    if (t.type === 'kw') {
      const kw = t.val;
      lastKw = kw;

      // === UNION / INTERSECT / EXCEPT ===
      if (kw === 'UNION' || kw === 'INTERSECT' || kw === 'EXCEPT') {
        if (kw === 'UNION' && n1 && n1.type === 'kw' && n1.val === 'ALL') {
          flush(curLevel); lines.push(''); lines.push('UNION ALL');
          cur = ''; needsSpace = false; ti++;
          cIndent = 0; curLevel = 0; sqStack = []; inSelect = false; inOrderBy = false; inGroupBy = false; betweenAnd = 0;
          continue;
        }
        flush(curLevel); lines.push(''); lines.push(kw);
        cur = ''; needsSpace = false;
        cIndent = 0; curLevel = 0; sqStack = []; inSelect = false; inOrderBy = false; inGroupBy = false; betweenAnd = 0;
        continue;
      }

      // === SELECT ===
      if (kw === 'SELECT') {
        let hasComma = false;
        for (let j = ti + 1; j < classified.length; j++) {
          const ct = classified[j];
          if (ct.type === 'comment') continue;
          if (ct.type === 'punct' && ct.val === ',') { hasComma = true; break; }
          if (ct.type === 'kw' && (ct.val === 'FROM' || ct.val === 'UNION' || ct.val === 'WHERE' ||
              ct.val === 'GROUP' || ct.val === 'ORDER' || ct.val === 'HAVING' || ct.val === 'LIMIT' ||
              ct.val === 'INTERSECT' || ct.val === 'EXCEPT')) break;
        }
        flush(curLevel);
        if (hasComma) {
          lines.push(SP4.repeat(cIndent) + 'SELECT');
          cur = ''; curLevel = contentIndent();
        } else {
          write('SELECT');
          curLevel = cIndent;
          selectInline = true;
        }
        needsSpace = false;
        inSelect = true; inOrderBy = false; inGroupBy = false;
        needsSpace = true;
        continue;
      }

      // === CASE ===
      if (kw === 'CASE') {
        flush(curLevel);
        write('CASE');
        curLevel = contentIndent();
        caseStack.push({ indented: false });
        needsSpace = true;
        continue;
      }
      if (kw === 'WHEN' && caseStack.length > 0) {
        const cs = caseStack[caseStack.length - 1];
        if (!cs.indented) {
          flush(curLevel);
          cs.indented = true;
        } else {
          flush(curLevel);
        }
        curLevel = contentIndent() + 1;
        cur = SP4.repeat(curLevel) + 'WHEN';
        needsSpace = true;
        continue;
      }
      if (kw === 'THEN') {
        write('THEN');
        needsSpace = true;
        continue;
      }
      if (kw === 'ELSE' && caseStack.length > 0) {
        flush(curLevel);
        curLevel = contentIndent() + 1;
        cur = SP4.repeat(curLevel) + 'ELSE';
        needsSpace = true;
        continue;
      }
      if (kw === 'END' && caseStack.length > 0) {
        const cs = caseStack.pop();
        if (cs.indented) flush(curLevel);
        curLevel = contentIndent();
        cur = SP4.repeat(curLevel) + 'END';
        needsSpace = true;
        continue;
      }

      // === FROM ===
      if (kw === 'FROM') {
        startClause('FROM', true);
        continue;
      }

      // === WHERE / HAVING ===
      if (kw === 'WHERE' || kw === 'HAVING') {
        blockClause(kw, true);
        continue;
      }

      // === LIMIT ===
      if (kw === 'LIMIT') {
        startClause('LIMIT', true);
        continue;
      }

      // === GROUP BY / ORDER BY ===
      if ((kw === 'GROUP' || kw === 'ORDER') && n1 && n1.type === 'kw' && n1.val === 'BY') {
        blockClause(kw + ' BY', true);
        ti++;
        if (kw === 'ORDER') inOrderBy = true;
        if (kw === 'GROUP') inGroupBy = true;
        continue;
      }

      // === JOIN keywords ===
      if (JOIN_PRE.has(kw) && depth === 0) {
        flush(curLevel);
        if ((kw === 'INNER' || kw === 'CROSS') && n1 && n1.type === 'kw') {
          if (n1.val === 'OUTER' && n2 && n2.type === 'kw' && n2.val === 'JOIN') {
            write(kw + ' OUTER JOIN'); ti += 2;
            curLevel = cIndent; needsSpace = true; continue;
          }
          if (n1.val === 'JOIN') {
            write(kw + ' JOIN'); ti++;
            curLevel = cIndent; needsSpace = true; continue;
          }
        }
        if ((kw === 'LEFT' || kw === 'RIGHT' || kw === 'FULL') && n1 && n1.type === 'kw') {
          if (n1.val === 'OUTER' && n2 && n2.type === 'kw' && n2.val === 'JOIN') {
            write(kw + ' OUTER JOIN'); ti += 2;
            curLevel = cIndent; needsSpace = true; continue;
          }
          if (n1.val === 'JOIN') {
            write(kw + ' JOIN'); ti++;
            curLevel = cIndent; needsSpace = true; continue;
          }
        }
        if (kw === 'OUTER' && n1 && n1.type === 'kw' && n1.val === 'JOIN') {
          write('OUTER JOIN'); ti++;
          curLevel = cIndent; needsSpace = true; continue;
        }
        if (kw === 'JOIN' || kw === 'NATURAL') {
          write(kw);
          curLevel = cIndent; needsSpace = true; continue;
        }
        write(kw);
        needsSpace = true;
        continue;
      }

      // === ON ===
      if (kw === 'ON') {
        flush(cIndent);
        curLevel = contentIndent();
        cur = SP4.repeat(curLevel) + 'ON';
        needsSpace = true;
        continue;
      }

      // === BETWEEN tracking ===
      if (kw === 'BETWEEN') {
        write('BETWEEN');
        betweenAnd++;
        needsSpace = true;
        continue;
      }

      // === AND / OR at top level ===
      if (LOGICAL.has(kw) && depth === 0) {
        if (kw === 'AND' && betweenAnd > 0) {
          betweenAnd--;
          write('AND');
          needsSpace = true;
          continue;
        }
        newLine(contentIndent());
        write(kw);
        needsSpace = true;
        continue;
      }

      // === Other keywords ===
      write(kw);
      needsSpace = true;
      continue;
    }

    // ── Identifiers, strings, numbers, punctuation ──
    if (t.type === 'id' || t.type === 'str' || t.type === 'num' || t.type === 'punct') {
      write(t.val);
      continue;
    }
  }

  flush(curLevel);

  let result = lines.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.replace(/[ \t]+$/gm, '');
  return result.trim();
}

export default formatSQL;
