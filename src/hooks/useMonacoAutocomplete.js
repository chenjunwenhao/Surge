import { useEffect, useRef } from 'react';

const KW = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'AS', 'DISTINCT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'EXPLAIN', 'DESC', 'SHOW', 'USE', 'SET', 'BEGIN', 'COMMIT', 'ROLLBACK', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'AUTO_INCREMENT', 'UNIQUE', 'CHECK', 'CASCADE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'INTO', 'VALUES', 'IF'];

const FN = ['COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'GROUP_CONCAT', 'COALESCE', 'IFNULL', 'NULLIF', 'IF', 'CAST', 'CONVERT', 'DATE_FORMAT', 'NOW', 'CURDATE', 'CURTIME', 'UNIX_TIMESTAMP', 'FROM_UNIXTIME', 'DATEDIFF', 'TIMESTAMPDIFF', 'CONCAT', 'SUBSTRING', 'SUBSTR', 'REPLACE', 'TRIM', 'UPPER', 'LOWER', 'LENGTH', 'CHAR_LENGTH', 'ROUND', 'FLOOR', 'CEIL', 'ABS', 'MOD', 'RAND', 'UUID', 'MD5', 'SHA1', 'JSON_EXTRACT', 'JSON_UNQUOTE', 'DATE', 'YEAR', 'MONTH', 'DAY'];

export default function useMonacoAutocomplete(edMonaco, instancesRef) {
  const cpRef = useRef(null);
  const suggestCacheRef = useRef({ allTabs: [], allCols: [], allDbs: new Set(), version: 0 });

  useEffect(() => {
    if (!edMonaco) return;
    if (cpRef.current) cpRef.current.dispose();

    cpRef.current = edMonaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: [' ', '.', ',', '(', ')'],
      provideCompletionItems: (model, pos) => {
        try {
          const word = model.getWordUntilPosition(pos);
          const wordText = word.word.toLowerCase();
          const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
          const instances = instancesRef.current;
          const cache = suggestCacheRef.current;
          const fingerprint = instances.reduce((s, i) => s + '|' + (i.databases?.length || 0) + ':' + Object.keys(i.dbTables || {}).reduce((a, k) => a + (i.dbTables[k]?.length || 0), 0), '');
          if (cache._fp !== fingerprint) {
            cache.allTabs = []; cache.allCols = []; cache.allDbs = new Set();
            instances.forEach(inst => {
              inst.databases?.forEach(d => cache.allDbs.add(d.name));
              if (inst.dbTables) Object.entries(inst.dbTables).forEach(([db, tabs]) => tabs.forEach(t => cache.allTabs.push({ name: t.TABLE_NAME, db, type: t.TABLE_TYPE })));
              if (inst.tableColumns) Object.entries(inst.tableColumns).forEach(([tbl, cols]) => cols.forEach(c => cache.allCols.push({ table: tbl, col: c.COLUMN_NAME, type: c.DATA_TYPE })));
            });
            cache._fp = fingerprint;
          }
          const { allTabs, allCols, allDbs } = cache;

          const line = model.getLineContent(pos.lineNumber);
          const before = line.substring(0, pos.column - 1).trim();
          const beforeUpper = before.toUpperCase();
          const tokens = beforeUpper.split(/\s+/);
          const lastToken = tokens[tokens.length - 1] || '';

          const dotIdx = line.lastIndexOf('.', pos.column - 2);
          let dotTable = '';
          if (dotIdx >= 0) {
            const bd = line.substring(0, dotIdx).trim().split(/\s+/);
            dotTable = (bd[bd.length - 1] || '').replace(/[\`"'[\]]/g, '');
          }

          const MAX_SUGGESTIONS = 2000;
          const afterFrom = /\bFROM\s*$/i.test(beforeUpper) || /\bJOIN\s*$/i.test(beforeUpper) || /\bINTO\s*$/i.test(beforeUpper) || /\bUPDATE\s*$/i.test(beforeUpper) || /\bTABLE\s*$/i.test(beforeUpper);
          const afterSel = /\bSELECT\s*$/i.test(beforeUpper) || /,\s*$/i.test(beforeUpper) || /\bSELECT\s+[^\n]*,\s*$/i.test(beforeUpper);
          const afterWhere = /\bWHERE\s*$/i.test(beforeUpper) || /\bAND\s*$/i.test(beforeUpper) || /\bOR\s*$/i.test(beforeUpper) || /\bON\s*$/i.test(beforeUpper) || /\bSET\s*$/i.test(beforeUpper) || /\bHAVING\s*$/i.test(beforeUpper) || /\bBY\s*$/i.test(beforeUpper);
          const typingWord = wordText.length > 0;

          const sug = [];

          if (dotTable) {
            allCols.filter(c => c.table.toLowerCase() === dotTable.toLowerCase()).forEach(c => sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: c.type, range }));
            if (sug.length) return { suggestions: sug };
          }

          if (afterFrom) {
            allTabs.forEach(t => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: t.name, kind: t.type === 'VIEW' ? edMonaco.languages.CompletionItemKind.Struct : edMonaco.languages.CompletionItemKind.Class, insertText: t.name, detail: `${t.db} \u00B7 ${t.type || 'TABLE'}`, range, sortText: '0' + t.name }); });
            allDbs.forEach(db => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: db, kind: edMonaco.languages.CompletionItemKind.Module, insertText: db, detail: 'database', range, sortText: '1' + db }); });
            if (typingWord) sug.forEach(s => { s.filterText = s.label; });
            if (sug.length) return { suggestions: sug };
          }

          if (afterSel) {
            allCols.forEach(c => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: `${c.table} \u00B7 ${c.type}`, range, sortText: '0' + c.col }); });
            allTabs.forEach(t => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: t.name + '.*', kind: edMonaco.languages.CompletionItemKind.Field, insertText: t.name + '.*', detail: `all columns of ${t.name}`, range, sortText: '2' + t.name }); });
            if (typingWord) sug.forEach(s => { s.filterText = s.label; });
            if (sug.length) return { suggestions: sug };
          }

          if (afterWhere) {
            allCols.forEach(c => { if (sug.length < MAX_SUGGESTIONS) sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: `${c.table} \u00B7 ${c.type}`, range, sortText: '0' + c.col }); });
            if (typingWord) sug.forEach(s => { s.filterText = s.label; });
            if (sug.length) return { suggestions: sug };
          }

          let cnt = 0;
          allTabs.forEach(t => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: t.name, kind: t.type === 'VIEW' ? edMonaco.languages.CompletionItemKind.Struct : edMonaco.languages.CompletionItemKind.Class, insertText: t.name, detail: `${t.db} \u00B7 ${t.type || 'TABLE'}`, range, sortText: '0' + t.name }); });
          allCols.forEach(c => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: c.col, kind: edMonaco.languages.CompletionItemKind.Field, insertText: c.col, detail: `${c.table} \u00B7 ${c.type}`, range, sortText: '1' + c.col }); });
          allDbs.forEach(db => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: db, kind: edMonaco.languages.CompletionItemKind.Module, insertText: db, detail: 'database', range, sortText: '2' + db }); });
          FN.forEach(fn => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: fn, kind: edMonaco.languages.CompletionItemKind.Function, insertText: fn + '()', detail: 'function', range, sortText: 'y' + fn }); });
          KW.forEach(kw => { if (cnt++ < MAX_SUGGESTIONS) sug.push({ label: kw, kind: edMonaco.languages.CompletionItemKind.Keyword, insertText: kw + ' ', detail: 'keyword', range, sortText: 'z' + kw }); });

          if (typingWord) sug.forEach(s => { if (!s.filterText) s.filterText = s.label; });
          return { suggestions: sug };
        } catch (e) {
          console.error('Completion error:', e);
          return { suggestions: [] };
        }
      },
    });
    return () => cpRef.current?.dispose();
  }, [edMonaco]);
}
