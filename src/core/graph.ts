import { MachineSpecSchema, MODEL_LIMITS, PathRequestSchema } from "../model/schemas.js";
import { codeUnitCompare } from "../model/ordering.js";
import type {
  MachineSpec,
  OperationError,
  PathRequest,
  PathResult,
  PathStep,
  ReachabilityResult,
} from "../model/types.js";
import { inputError, machineError } from "./operation-error.js";
import { validateParsedMachine } from "./validation.js";

function invalidMachine(machine: MachineSpec): OperationError | null {
  const validation = validateParsedMachine(machine);
  return validation.status === "invalid" ? machineError(validation.diagnostics) : null;
}

function outgoing(machine: MachineSpec, state: string): PathStep[] {
  const on = Object.hasOwn(machine.states, state) ? machine.states[state]?.on : undefined;
  return Object.entries(on ?? {})
    .sort(([left], [right]) => codeUnitCompare(left, right))
    .map(([event, transition]) => ({
      from: state,
      event,
      to: transition.target,
      guard: transition.guard ?? null,
    }));
}

export function reachableStates(input: unknown, from?: string): ReachabilityResult | OperationError {
  const parsed = MachineSpecSchema.safeParse(input);
  if (!parsed.success) return inputError(parsed.error.issues[0]?.message ?? "Machine is invalid.");
  const machine = parsed.data as MachineSpec;
  const failure = invalidMachine(machine);
  if (failure) return failure;
  const start = from ?? machine.initial;
  if (!Object.hasOwn(machine.states, start)) {
    return { status: "error", error: { code: "START_STATE_UNKNOWN", message: `State '${start}' does not exist.` } };
  }
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    queue.push(...outgoing(machine, current).map((step) => step.to));
  }
  const all = Object.keys(machine.states).sort(codeUnitCompare);
  return {
    status: "ok",
    from: start,
    reachable: all.filter((state) => visited.has(state)),
    unreachable: all.filter((state) => !visited.has(state)),
  };
}

export function findPath(input: PathRequest | unknown): PathResult | OperationError {
  const parsed = PathRequestSchema.safeParse(input);
  if (!parsed.success) return inputError(parsed.error.issues[0]?.message ?? "Path request is invalid.");
  const request = parsed.data as PathRequest;
  const failure = invalidMachine(request.machine);
  if (failure) return failure;
  const from = request.from ?? request.machine.initial;
  if (!Object.hasOwn(request.machine.states, from)) {
    return { status: "error", error: { code: "START_STATE_UNKNOWN", message: `State '${from}' does not exist.` } };
  }
  if (!Object.hasOwn(request.machine.states, request.target)) {
    return { status: "error", error: { code: "TARGET_STATE_UNKNOWN", message: `State '${request.target}' does not exist.` } };
  }
  const maxDepth = request.max_depth ?? MODEL_LIMITS.maxPathDepth;
  const queue: Array<{ state: string; steps: PathStep[] }> = [{ state: from, steps: [] }];
  const bestDepth = new Map<string, number>([[from, 0]]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.state === request.target) {
      return {
        status: "found",
        from,
        target: request.target,
        steps: current.steps,
        required_guards: [...new Set(current.steps.flatMap((step) => (step.guard ? [step.guard] : [])))].sort(codeUnitCompare),
      };
    }
    if (current.steps.length >= maxDepth) continue;
    for (const step of outgoing(request.machine, current.state)) {
      const nextDepth = current.steps.length + 1;
      const known = bestDepth.get(step.to);
      if (known !== undefined && known <= nextDepth) continue;
      bestDepth.set(step.to, nextDepth);
      queue.push({ state: step.to, steps: [...current.steps, step] });
    }
  }
  return { status: "unreachable", from, target: request.target, steps: [], required_guards: [] };
}
