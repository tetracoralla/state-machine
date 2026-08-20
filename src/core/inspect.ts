import { MachineSpecSchema, MODEL_LIMITS } from "../model/schemas.js";
import type { InspectResult, MachineSpec, OperationError } from "../model/types.js";
import { machineStats, validateMachine } from "./validation.js";

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function inspectMachine(input: unknown): InspectResult | OperationError {
  const parsed = MachineSpecSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: { code: "INPUT_INVALID", message: parsed.error.issues[0]?.message ?? "Machine is invalid." } };
  const machine = parsed.data as MachineSpec;
  const validation = validateMachine(machine);
  if (validation.status === "invalid") {
    return { status: "error", error: { code: "MACHINE_INVALID", message: "Machine failed semantic validation.", details: validation.diagnostics } };
  }
  const states = Object.entries(machine.states)
    .sort(([left], [right]) => codeUnitCompare(left, right))
    .map(([id, state]) => ({ id, title: state.title ?? null, final: state.final === true }));
  const transitions = Object.entries(machine.states)
    .sort(([left], [right]) => codeUnitCompare(left, right))
    .flatMap(([from, state]) =>
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

