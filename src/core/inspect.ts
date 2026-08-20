import { MachineSpecSchema, MODEL_LIMITS } from "../model/schemas.js";
import { codeUnitCompare } from "../model/ordering.js";
import type { InspectResult, MachineSpec, OperationError } from "../model/types.js";
import { inputError, machineError } from "./operation-error.js";
import { machineStats, validateParsedMachine } from "./validation.js";

export function inspectMachine(input: unknown): InspectResult | OperationError {
  const parsed = MachineSpecSchema.safeParse(input);
  if (!parsed.success) return inputError(parsed.error.issues[0]?.message ?? "Machine is invalid.");
  const machine = parsed.data as MachineSpec;
  const validation = validateParsedMachine(machine);
  if (validation.status === "invalid") {
    return machineError(validation.diagnostics);
  }
  const stateEntries = Object.entries(machine.states).sort(([left], [right]) => codeUnitCompare(left, right));
  const states = stateEntries.map(([id, state]) => ({ id, title: state.title ?? null, final: state.final === true }));
  const transitions = stateEntries.flatMap(([from, state]) =>
      Object.entries(state.on ?? {})
        .sort(([left], [right]) => codeUnitCompare(left, right))
        .map(([event, transition]) => ({ from, event, to: transition.target, guard: transition.guard ?? null })),
    );
  return {
    status: "ok",
    machine_id: machine.id,
    initial: machine.initial,
    states,
    events: Object.keys(machine.events).sort(codeUnitCompare),
    guards: Object.keys(machine.guards ?? {}).sort(codeUnitCompare),
    transitions,
    stats: machineStats(machine),
    limits: { ...MODEL_LIMITS },
  };
}
