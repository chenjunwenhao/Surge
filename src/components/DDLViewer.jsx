import Editor from '@monaco-editor/react';
import I from '../utils/icons';

export default function DDLViewer({ ddl, onRefresh }) {
  if (!ddl) return <div className="tab-content-empty" style={{ minHeight: 100 }}><div className="spinner" /></div>;
  return (
    <div className="ddl-view" style={{ padding: 0, position: 'relative' }}>
      {onRefresh && (
        <button className="btn btn-sm" style={{ position: 'absolute', top: 6, right: 6, zIndex: 1 }} title="Refresh DDL"
          onClick={onRefresh}>{I.refresh}</button>
      )}
      <Editor
        height="100%"
        defaultLanguage="sql"
        value={ddl}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
          wordWrap: 'on',
          lineNumbers: 'on',
          folding: true,
          scrollBeyondLastLine: false,
          domReadOnly: true,
          contextmenu: false,
        }}
      />
    </div>
  );
}
