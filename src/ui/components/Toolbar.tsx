import { useRef } from "react";

interface ToolbarProps {
  machineTitle: string;
  valid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImport: (source: string) => void;
  onExport: () => void;
  onReset: () => void;
}

export function Toolbar({
  machineTitle,
  valid,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImport,
  onExport,
  onReset,
}: ToolbarProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    onImport(await file.text());
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <header className="toolbar">
      <div className="product-lockup">
        <span className="product-mark" aria-hidden="true">S</span>
        <div>
          <p className="product-name">Step Switch</p>
          <p className="machine-title">{machineTitle}</p>
        </div>
      </div>
      <div className="toolbar-actions">
        <span className={`status-pill ${valid ? "status-valid" : "status-invalid"}`}>
          <span aria-hidden="true" className="status-dot" />
          {valid ? "Valid" : "Needs attention"}
        </span>
        <div className="button-group" aria-label="Edit history">
          <button type="button" className="quiet-button" onClick={onUndo} disabled={!canUndo}>Undo</button>
          <button type="button" className="quiet-button" onClick={onRedo} disabled={!canRedo}>Redo</button>
        </div>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept=".yaml,.yml,.json,application/json,text/yaml"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        <button type="button" className="quiet-button" onClick={() => fileInput.current?.click()}>Import</button>
        <button type="button" className="quiet-button" onClick={onExport} disabled={!valid}>Export</button>
        <button type="button" className="quiet-button" onClick={onReset}>Reset</button>
      </div>
    </header>
  );
}
