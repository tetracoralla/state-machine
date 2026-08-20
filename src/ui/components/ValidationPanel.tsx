import type { ValidationResult } from "../../model/types.js";

interface ValidationPanelProps {
  validation: ValidationResult;
}

export function ValidationPanel({ validation }: ValidationPanelProps) {
  const errors = validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = validation.diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  return (
    <section className="validation-panel" aria-live="polite" aria-label="Validation results">
      <div className="validation-summary">
        <span>{errors.length} errors</span>
        <span>{warnings.length} warnings</span>
      </div>
      {validation.diagnostics.length > 0 && (
        <ol className="diagnostic-list">
          {validation.diagnostics.slice(0, 8).map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${diagnostic.path}-${index}`} className={`diagnostic diagnostic-${diagnostic.severity}`}>
              <span className="diagnostic-code">{diagnostic.code}</span>
              <span>{diagnostic.message}</span>
              <code>{diagnostic.path}</code>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

