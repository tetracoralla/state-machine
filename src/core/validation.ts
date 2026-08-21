import type * as z from "zod/v4";

import { MachineSpecSchema, MODEL_LIMITS } from "../model/schemas.js";
import { codeUnitCompare } from "../model/ordering.js";
import type {
  Diagnostic,
  FieldDefinition,
  JsonObject,
  MachineSpec,
  MachineStats,
  ScalarType,
  ValidationResult,
  ValueSource,
} from "../model/types.js";

function zodPath(path: PropertyKey[]): string {
  if (path.length === 0) return "$";
  return `$${path.map((part) => (typeof part === "number" ? `[${part}]` : `.${String(part)}`)).join("")}`;
}

export function schemaDiagnostics(error: z.ZodError): Diagnostic[] {
  return error.issues.slice(0, MODEL_LIMITS.maxDiagnostics).map((issue) => ({
    severity: "error",
    code: "SCHEMA_INVALID",
    message: issue.message,
    path: zodPath(issue.path),
  }));
}

export function machineStats(machine: MachineSpec): MachineStats {
  return {
    states: Object.keys(machine.states).length,
    events: Object.keys(machine.events).length,
    guards: Object.keys(machine.guards ?? {}).length,
    transitions: Object.values(machine.states).reduce((count, state) => count + Object.keys(state.on ?? {}).length, 0),
    final_states: Object.values(machine.states).filter((state) => state.final === true).length,
  };
}

function matchesField(value: unknown, field: FieldDefinition): boolean {
  switch (field.type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
  }
}

export function validateFields(
  value: JsonObject,
  fields: Record<string, FieldDefinition>,
  basePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const name of Object.keys(value).sort(codeUnitCompare)) {
    if (!Object.hasOwn(fields, name)) {
      diagnostics.push({
        severity: "error",
        code: "FIELD_UNDECLARED",
        message: `Field '${name}' is not declared.`,
        path: `${basePath}.${name}`,
      });
    }
  }
  for (const [name, field] of Object.entries(fields).sort(([left], [right]) => codeUnitCompare(left, right))) {
    const current = Object.hasOwn(value, name) ? value[name] : undefined;
    if (current === undefined) {
      if (field.required !== false) {
        diagnostics.push({
          severity: "error",
          code: "FIELD_REQUIRED",
          message: `Required field '${name}' is missing.`,
          path: `${basePath}.${name}`,
        });
      }
      continue;
    }
    if (!matchesField(current, field)) {
      diagnostics.push({
        severity: "error",
        code: "FIELD_TYPE_MISMATCH",
        message: `Field '${name}' must be ${field.type}.`,
        path: `${basePath}.${name}`,
      });
    }
  }
  return diagnostics;
}

function firstPathSegment(source: ValueSource): string | null {
  return source.kind === "literal" ? null : source.path.split(".")[0] ?? null;
}

type InferredValueType = ScalarType | "null" | "unknown";

function literalType(value: ValueSource & { kind: "literal" }): InferredValueType {
  if (value.value === null) return "null";
  if (Array.isArray(value.value)) return "array";
  if (typeof value.value === "number") return Number.isInteger(value.value) ? "integer" : "number";
  if (typeof value.value === "string") return "string";
  if (typeof value.value === "boolean") return "boolean";
  return "object";
}

function sourceType(
  diagnostics: Diagnostic[],
  source: ValueSource,
  path: string,
  eventFields: Record<string, FieldDefinition>,
  contextFields: Record<string, FieldDefinition>,
): InferredValueType {
  if (source.kind === "literal") return literalType(source);
  const fields = source.kind === "event" ? eventFields : contextFields;
  const first = firstPathSegment(source);
  const field = first && Object.hasOwn(fields, first) ? fields[first] : undefined;
  if (!first || !field) return "unknown";
  if (source.path.includes(".")) {
    if (field.type !== "object") {
      diagnostics.push({
        severity: "error",
        code: "VALUE_PATH_NOT_TRAVERSABLE",
        message: `Value source '${source.path}' traverses through a ${field.type} field.`,
        path,
      });
    }
    return "unknown";
  }
  return field.type;
}

function assignmentTypesCompatible(target: ScalarType, source: InferredValueType): boolean {
  if (source === "unknown") return true;
  if (target === "number" && source === "integer") return true;
  return target === source;
}

function checkValueSource(
  diagnostics: Diagnostic[],
  source: ValueSource,
  path: string,
  eventFields: Record<string, FieldDefinition>,
  contextFields: Record<string, FieldDefinition>,
): InferredValueType {
  const first = firstPathSegment(source);
  if (!first) return sourceType(diagnostics, source, path, eventFields, contextFields);
  if (source.kind === "event" && !Object.hasOwn(eventFields, first)) {
    diagnostics.push({
      severity: "error",
      code: "EVENT_VALUE_UNDECLARED",
      message: `Event value source '${source.path}' starts with an undeclared event field.`,
      path,
    });
  }
  if (source.kind === "context" && !Object.hasOwn(contextFields, first)) {
    diagnostics.push({
      severity: "error",
      code: "CONTEXT_VALUE_UNDECLARED",
      message: `Context value source '${source.path}' starts with an undeclared context field.`,
      path,
    });
  }
  return sourceType(diagnostics, source, path, eventFields, contextFields);
}

function structurallyReachable(machine: MachineSpec, start: string): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const stateId = queue.shift();
    if (!stateId || visited.has(stateId) || !Object.hasOwn(machine.states, stateId)) continue;
    visited.add(stateId);
    const targets = Object.values(machine.states[stateId]?.on ?? {})
      .map((transition) => transition.target)
      .sort(codeUnitCompare);
    queue.push(...targets);
  }
  return visited;
}

function statesThatCanReachFinal(machine: MachineSpec): Set<string> {
  const reverse = new Map<string, Set<string>>();
  for (const stateId of Object.keys(machine.states)) reverse.set(stateId, new Set());
  for (const [from, state] of Object.entries(machine.states)) {
    for (const transition of Object.values(state.on ?? {})) reverse.get(transition.target)?.add(from);
  }
  const reachable = new Set<string>();
  const queue = Object.entries(machine.states)
    .filter(([, state]) => state.final === true)
    .map(([id]) => id);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    queue.push(...[...(reverse.get(current) ?? [])].sort(codeUnitCompare));
  }
  return reachable;
}

export function validateMachine(input: unknown): ValidationResult {
  const parsed = MachineSpecSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid", diagnostics: schemaDiagnostics(parsed.error) };
  return validateParsedMachine(parsed.data as MachineSpec);
}

export function validateParsedMachine(machine: MachineSpec): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const contextFields = machine.context?.schema ?? {};

  if (!Object.hasOwn(machine.states, machine.initial)) {
    diagnostics.push({
      severity: "error",
      code: "INITIAL_STATE_UNKNOWN",
      message: `Initial state '${machine.initial}' does not exist.`,
      path: "$.initial",
    });
  }

  diagnostics.push(...validateFields(machine.context?.initial ?? {}, contextFields, "$.context.initial"));

  const usedEvents = new Set<string>();
  const usedGuards = new Set<string>();
  for (const [stateId, state] of Object.entries(machine.states).sort(([left], [right]) => codeUnitCompare(left, right))) {
    const transitions = state.on ?? {};
    if (state.final === true && Object.keys(transitions).length > 0) {
      diagnostics.push({
        severity: "error",
        code: "FINAL_STATE_HAS_TRANSITIONS",
        message: `Final state '${stateId}' cannot have outgoing transitions.`,
        path: `$.states.${stateId}.on`,
      });
    }
    if (state.final !== true && Object.keys(transitions).length === 0) {
      diagnostics.push({
        severity: "warning",
        code: "NONFINAL_DEAD_END",
        message: `Non-final state '${stateId}' has no outgoing transitions.`,
        path: `$.states.${stateId}`,
      });
    }
    for (const [eventName, transition] of Object.entries(transitions).sort(([left], [right]) => codeUnitCompare(left, right))) {
      usedEvents.add(eventName);
      const transitionPath = `$.states.${stateId}.on.${eventName}`;
      const eventDefinition = Object.hasOwn(machine.events, eventName) ? machine.events[eventName] : undefined;
      if (!eventDefinition) {
        diagnostics.push({
          severity: "error",
          code: "EVENT_UNKNOWN",
          message: `Transition uses undeclared event '${eventName}'.`,
          path: transitionPath,
        });
      }
      if (!Object.hasOwn(machine.states, transition.target)) {
        diagnostics.push({
          severity: "error",
          code: "TARGET_STATE_UNKNOWN",
          message: `Transition target '${transition.target}' does not exist.`,
          path: `${transitionPath}.target`,
        });
      }
      if (transition.guard) {
        usedGuards.add(transition.guard);
        if (!(machine.guards && Object.hasOwn(machine.guards, transition.guard))) {
          diagnostics.push({
            severity: "error",
            code: "GUARD_UNKNOWN",
            message: `Transition uses undeclared guard '${transition.guard}'.`,
            path: `${transitionPath}.guard`,
          });
        }
      }
      const eventFields = eventDefinition?.fields ?? {};
      for (const [fieldName, source] of Object.entries(transition.assign ?? {})) {
        const targetField = Object.hasOwn(contextFields, fieldName) ? contextFields[fieldName] : undefined;
        if (!targetField) {
          diagnostics.push({
            severity: "error",
            code: "CONTEXT_ASSIGN_UNDECLARED",
            message: `Assignment targets undeclared context field '${fieldName}'.`,
            path: `${transitionPath}.assign.${fieldName}`,
          });
        }
        const assignmentPath = `${transitionPath}.assign.${fieldName}`;
        const inferredSourceType = checkValueSource(diagnostics, source, assignmentPath, eventFields, contextFields);
        if (targetField && !assignmentTypesCompatible(targetField.type, inferredSourceType)) {
          diagnostics.push({
            severity: "error",
            code: "CONTEXT_ASSIGN_TYPE_MISMATCH",
            message: `Assignment to '${fieldName}' requires ${targetField.type}, but the source is ${inferredSourceType}.`,
            path: assignmentPath,
          });
        }
      }
      transition.effects?.forEach((effect, effectIndex) => {
        for (const [inputName, source] of Object.entries(effect.input ?? {})) {
          checkValueSource(
            diagnostics,
            source,
            `${transitionPath}.effects[${effectIndex}].input.${inputName}`,
            eventFields,
            contextFields,
          );
        }
      });
    }
  }

  for (const eventName of Object.keys(machine.events).sort(codeUnitCompare)) {
    if (!usedEvents.has(eventName)) {
      diagnostics.push({
        severity: "warning",
        code: "EVENT_UNUSED",
        message: `Event '${eventName}' is declared but never used.`,
        path: `$.events.${eventName}`,
      });
    }
  }
  for (const guardName of Object.keys(machine.guards ?? {}).sort(codeUnitCompare)) {
    if (!usedGuards.has(guardName)) {
      diagnostics.push({
        severity: "warning",
        code: "GUARD_UNUSED",
        message: `Guard '${guardName}' is declared but never used.`,
        path: `$.guards.${guardName}`,
      });
    }
  }

  if (Object.hasOwn(machine.states, machine.initial)) {
    const reachable = structurallyReachable(machine, machine.initial);
    for (const stateId of Object.keys(machine.states).sort(codeUnitCompare)) {
      if (!reachable.has(stateId)) {
        diagnostics.push({
          severity: "warning",
          code: "STATE_UNREACHABLE",
          message: `State '${stateId}' is not structurally reachable from '${machine.initial}'.`,
          path: `$.states.${stateId}`,
        });
      }
    }
    const finalReachable = statesThatCanReachFinal(machine);
    for (const stateId of [...reachable].sort(codeUnitCompare)) {
      if (!finalReachable.has(stateId)) {
        diagnostics.push({
          severity: "warning",
          code: "NO_PATH_TO_FINAL",
          message: `State '${stateId}' has no structural path to a final state.`,
          path: `$.states.${stateId}`,
        });
      }
    }
  }

  const limited = diagnostics.slice(0, MODEL_LIMITS.maxDiagnostics);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === "error");
  return {
    status: hasErrors ? "invalid" : "valid",
    machine_id: machine.id,
    diagnostics: limited,
    stats: machineStats(machine),
  };
}
