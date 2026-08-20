import { StepRequestSchema } from "../model/schemas.js";
import type {
  Diagnostic,
  EventInstance,
  JsonObject,
  MachineSpec,
  OperationError,
  ResolvedEffectIntent,
  Snapshot,
  StepRequest,
  StepResult,
  ValueSource,
} from "../model/types.js";
import { cloneObject, resolveValueSource } from "./value-source.js";
import { validateFields, validateMachine } from "./validation.js";

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function inputError(message: string): OperationError {
  return { status: "error", error: { code: "INPUT_INVALID", message } };
}

function machineError(details: Diagnostic[]): OperationError {
  return {
    status: "error",
    error: { code: "MACHINE_INVALID", message: "Machine failed semantic validation.", details },
  };
}

function runtimeError(code: string, message: string, details?: Diagnostic[]): OperationError {
  const error: OperationError["error"] = { code, message };
  if (details && details.length > 0) error.details = details;
  return { status: "error", error };
}

export function initialSnapshot(machine: MachineSpec): Snapshot {
  return { state: machine.initial, context: cloneObject(machine.context?.initial ?? {}) };
}

export function enabledEvents(machine: MachineSpec, state: string): string[] {
  return Object.keys(machine.states[state]?.on ?? {}).sort(codeUnitCompare);
}

export function validateSnapshotForMachine(machine: MachineSpec, snapshot: Snapshot): OperationError | null {
  if (!machine.states[snapshot.state]) {
    return runtimeError("SNAPSHOT_STATE_UNKNOWN", `Snapshot state '${snapshot.state}' does not exist.`);
  }
  const contextDiagnostics = validateFields(snapshot.context, machine.context?.schema ?? {}, "$.snapshot.context");
  if (contextDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return runtimeError("SNAPSHOT_CONTEXT_INVALID", "Snapshot context does not match the machine context schema.", contextDiagnostics);
  }
  return null;
}

function validateEventPayload(machine: MachineSpec, event: EventInstance): OperationError | null {
  const eventDefinition = machine.events[event.type];
  if (!eventDefinition) return runtimeError("EVENT_UNKNOWN", `Event '${event.type}' is not declared.`);
  const payloadDiagnostics = validateFields(event.payload ?? {}, eventDefinition.fields ?? {}, "$.event.payload");
  if (payloadDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return runtimeError("EVENT_PAYLOAD_INVALID", "Event payload does not match its declared schema.", payloadDiagnostics);
  }
  return null;
}

function resolveRecord(
  sources: Record<string, ValueSource>,
  snapshot: Snapshot,
  event: EventInstance,
  path: string,
): { ok: true; value: JsonObject } | { ok: false; error: OperationError } {
  const output: JsonObject = {};
  for (const [name, source] of Object.entries(sources).sort(([left], [right]) => codeUnitCompare(left, right))) {
    const resolved = resolveValueSource(source, snapshot, event);
    if (!resolved.found || resolved.value === undefined) {
      return { ok: false, error: runtimeError("VALUE_NOT_FOUND", `Value source at '${path}.${name}' did not resolve.`) };
    }
    output[name] = resolved.value;
  }
  return { ok: true, value: output };
}

function resolveEffects(
  machine: MachineSpec,
  state: string,
  event: EventInstance,
  snapshot: Snapshot,
): ResolvedEffectIntent[] | OperationError {
  const effects = machine.states[state]?.on?.[event.type]?.effects ?? [];
  const output: ResolvedEffectIntent[] = [];
  for (let index = 0; index < effects.length; index += 1) {
    const effect = effects[index];
    if (!effect) continue;
    const input = resolveRecord(effect.input ?? {}, snapshot, event, `$.transition.effects[${index}].input`);
    if (!input.ok) return input.error;
    output.push({ type: effect.type, input: input.value });
  }
  return output;
}

export function stepValidatedMachine(
  machine: MachineSpec,
  inputSnapshot: Snapshot,
  inputEvent: EventInstance,
  guardResults?: Record<string, boolean>,
): StepResult {
  const snapshot = { state: inputSnapshot.state, context: cloneObject(inputSnapshot.context) };
  const event: EventInstance = {
    type: inputEvent.type,
    ...(inputEvent.payload ? { payload: cloneObject(inputEvent.payload) } : {}),
  };
  const snapshotFailure = validateSnapshotForMachine(machine, snapshot);
  if (snapshotFailure) return snapshotFailure;
  if (!machine.events[event.type]) return runtimeError("EVENT_UNKNOWN", `Event '${event.type}' is not declared.`);

  const transition = machine.states[snapshot.state]?.on?.[event.type];
  const base = {
    status: "ok" as const,
    before: snapshot,
    event,
    after: snapshot,
    guards: [] as Array<{ name: string; outcome: boolean | null }>,
    context_changes: {} as JsonObject,
    effects: [] as ResolvedEffectIntent[],
    enabled_events: enabledEvents(machine, snapshot.state),
  };

  if (!transition) return { ...base, accepted: false, reason: "NO_VALID_TRANSITION" };
  const payloadFailure = validateEventPayload(machine, event);
  if (payloadFailure) return payloadFailure;
  for (const guardName of Object.keys(guardResults ?? {})) {
    if (!machine.guards?.[guardName]) return runtimeError("GUARD_RESULT_UNKNOWN", `Guard result '${guardName}' is not declared.`);
  }
  if (transition.guard) {
    const outcome = guardResults?.[transition.guard];
    const guards = [{ name: transition.guard, outcome: outcome ?? null }];
    if (outcome === undefined) return { ...base, guards, accepted: false, reason: "GUARD_RESULT_REQUIRED" };
    if (!outcome) return { ...base, guards, accepted: false, reason: "GUARD_REJECTED" };
    base.guards = guards;
  }

  const contextChanges = resolveRecord(transition.assign ?? {}, snapshot, event, "$.transition.assign");
  if (!contextChanges.ok) return contextChanges.error;
  const afterContext = { ...cloneObject(snapshot.context), ...contextChanges.value };
  const afterDiagnostics = validateFields(afterContext, machine.context?.schema ?? {}, "$.after.context");
  if (afterDiagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return runtimeError("CONTEXT_ASSIGNMENT_INVALID", "Transition assignments produced invalid context.", afterDiagnostics);
  }
  const effects = resolveEffects(machine, snapshot.state, event, snapshot);
  if (!Array.isArray(effects)) return effects;
  const after = { state: transition.target, context: afterContext };
  return {
    ...base,
    accepted: true,
    transition: `${snapshot.state}.${event.type}`,
    after,
    context_changes: contextChanges.value,
    effects,
    enabled_events: enabledEvents(machine, after.state),
  };
}

export function stepMachine(input: StepRequest | unknown): StepResult {
  const parsed = StepRequestSchema.safeParse(input);
  if (!parsed.success) return inputError(parsed.error.issues[0]?.message ?? "Step request is invalid.");
  const request = parsed.data as StepRequest;
  const validation = validateMachine(request.machine);
  if (validation.status === "invalid") return machineError(validation.diagnostics);
  const snapshot = request.snapshot ?? initialSnapshot(request.machine);
  return stepValidatedMachine(request.machine, snapshot, request.event, request.guard_results);
}
