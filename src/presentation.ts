import type {
  DiffResult,
  InspectResult,
  OperationError,
  PathResult,
  SimulationResult,
  StepResult,
  ValidationResult,
} from "./model/types.js";

export function presentValidation(result: ValidationResult): string {
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = result.diagnostics.length - errors;
  return result.status === "valid"
    ? `${result.machine_id ?? "Machine"} is valid${warnings > 0 ? ` with ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}.`
    : `Machine is invalid: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}.`;
}

export function presentOperationError(result: OperationError): string {
  return `${result.error.code}: ${result.error.message}`;
}

export function presentStep(result: StepResult): string {
  if (result.status === "error") return presentOperationError(result);
  if (!result.accepted) return `${result.event.type} was rejected in ${result.before.state}: ${result.reason}.`;
  const effects = result.effects.length > 0 ? ` ${result.effects.length} symbolic effect${result.effects.length === 1 ? "" : "s"} emitted.` : "";
  return `${result.event.type} moved ${result.before.state} → ${result.after.state}.${effects}`;
}

export function presentSimulation(result: SimulationResult | OperationError): string {
  if (result.status === "error") return presentOperationError(result);
  return `${result.steps.length} step${result.steps.length === 1 ? "" : "s"} simulated: ${result.initial.state} → ${result.final.state}${result.accepted ? "." : "; at least one event was rejected."}`;
}

export function presentPath(result: PathResult | OperationError): string {
  if (result.status === "error") return presentOperationError(result);
  if (result.status === "unreachable") return `${result.target} is not structurally reachable from ${result.from} within the requested depth.`;
  return result.steps.length === 0
    ? `${result.target} is already the current state.`
    : `Shortest structural path from ${result.from} to ${result.target}: ${result.steps.map((step) => step.event).join(" → ")}.`;
}

export function presentInspect(result: InspectResult | OperationError): string {
  if (result.status === "error") return presentOperationError(result);
  return `${result.machine_id}: ${result.stats.states} states, ${result.stats.transitions} transitions, ${result.stats.events} events.`;
}

export function presentDiff(result: DiffResult | OperationError): string {
  if (result.status === "error") return presentOperationError(result);
  if (result.status === "same") return "The two machines are semantically identical.";
  return `${result.changes.length} semantic change${result.changes.length === 1 ? "" : "s"}${result.truncated ? " (truncated at the limit)" : ""}.`;
}

