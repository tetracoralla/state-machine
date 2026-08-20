interface SourceEditorProps {
  source: string;
  onChange: (source: string) => void;
}

export function SourceEditor({ source, onChange }: SourceEditorProps) {
  const lines = source.split("\n").length;
  return (
    <section className="panel source-panel" aria-labelledby="definition-title">
      <div className="panel-heading">
        <h2 id="definition-title">Definition</h2>
        <span>{lines} lines</span>
      </div>
      <textarea
        className="source-textarea"
        value={source}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Machine definition"
        spellCheck={false}
      />
    </section>
  );
}

