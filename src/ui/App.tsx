import { useCallback, useMemo, useState } from "react";
import sampleSource from "../../examples/order.machine.yaml?raw";

import { Simulator } from "./components/Simulator.js";
import { SourceEditor } from "./components/SourceEditor.js";
import { Toolbar } from "./components/Toolbar.js";
import { TopologyGraph } from "./components/TopologyGraph.js";
import { ValidationPanel } from "./components/ValidationPanel.js";
import { useDocumentSource } from "./hooks/use-document-source.js";
import { downloadSource, parseEditorSource } from "./lib/editor-source.js";

export function App() {
  const { source, setSource, undo, redo, reset, canUndo, canRedo, persistenceError } = useDocumentSource(sampleSource);
  const parsed = useMemo(() => parseEditorSource(source), [source]);
  const [currentState, setCurrentState] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const valid = parsed.validation.status === "valid" && parsed.machine !== null;

  const handleStateChange = useCallback((state: string) => setCurrentState(state), []);

  function handleImport(nextSource: string) {
    const next = parseEditorSource(nextSource);
    const parseFailure = next.validation.diagnostics.find((diagnostic) =>
      diagnostic.code === "SOURCE_PARSE_FAILED" || diagnostic.code === "REQUEST_TOO_LARGE",
    );
    if (parseFailure) {
      setNotice(`Import failed: ${parseFailure.message}`);
      return;
    }
    setSource(nextSource);
    setNotice(null);
  }

  function handleExport() {
    if (!parsed.machine || !valid) return;
    downloadSource(source, parsed.machine.id);
  }

  return (
    <div className="app-shell">
      <Toolbar
        machineTitle={parsed.machine?.title ?? parsed.machine?.id ?? "Untitled machine"}
        valid={valid}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onImport={handleImport}
        onExport={handleExport}
        onReset={reset}
      />
      {notice && (
        <div className="app-notice" role="alert">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss import error">Dismiss</button>
        </div>
      )}
      {persistenceError && (
        <div className="app-notice" role="alert">
          <span>{persistenceError}</span>
        </div>
      )}
      <main className="workspace">
        <div className="editor-grid">
          <div className="definition-stack">
            <SourceEditor source={source} onChange={setSource} />
            <ValidationPanel validation={parsed.validation} />
          </div>
          {parsed.machine ? (
            <TopologyGraph machine={parsed.machine} currentState={currentState || parsed.machine.initial} />
          ) : (
            <section className="panel unavailable-panel" aria-label="Topology unavailable">
              <strong>Topology unavailable</strong>
              <span>Resolve the definition errors to restore the graph and simulator.</span>
            </section>
          )}
        </div>
        {valid && parsed.machine ? (
          <Simulator machine={parsed.machine} revision={source} onStateChange={handleStateChange} />
        ) : (
          <section className="panel blocked-simulator" aria-label="Simulator unavailable">
            <strong>Simulator paused</strong>
            <span>The machine must be valid before events can run.</span>
          </section>
        )}
      </main>
    </div>
  );
}
