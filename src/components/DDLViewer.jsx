import Editor from '@monaco-editor/react';

export default function DDLViewer({ ddl }) {
  if (!ddl) return <div className="tab-content-empty" style={{ minHeight: 100 }}><div className="spinner" /></div>;
  return (
    <div className="ddl-view" style={{ padding: 0 }}>
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
