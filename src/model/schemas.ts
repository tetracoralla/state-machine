import * as z from "zod/v4";

import type { JsonObject, JsonValue } from "./types.js";

export const MODEL_LIMITS = Object.freeze({
  maxRequestBytes: 256 * 1024,
  maxResponseBytes: 256 * 1024,
  maxStates: 200,
  maxEvents: 200,
  maxGuards: 200,
  maxTransitions: 1_000,
  maxSimulationEvents: 200,
  maxPathDepth: 100,
  maxFields: 256,
  maxEffectsPerTransition: 50,
  maxAssignmentsPerTransition: 100,
  maxJsonDepth: 32,
  maxJsonNodes: 20_000,
  maxStringLength: 16_384,
  maxDiagnostics: 1_000,
  maxDiffChanges: 500,
});

export const IdentifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "Expected a letter followed by letters, digits, underscores, or hyphens.");

export const ValuePathSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/, "Expected a dot-delimited value path.")
  .refine(
    (path) => !path.split(".").some((segment) => ["__proto__", "prototype", "constructor"].includes(segment)),
    "Value path contains a reserved unsafe segment.",
  );

const BoundedStringSchema = z.string().max(MODEL_LIMITS.maxStringLength);

let RawJsonValueSchema: z.ZodType<JsonValue>;
RawJsonValueSchema = z.lazy(() =>
  z.union([
    BoundedStringSchema,
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(RawJsonValueSchema).max(1_000),
    z.record(z.string().max(256), RawJsonValueSchema),
  ]),
);

function jsonValuesWithinLimits(values: unknown[]): boolean {
  const pending: Array<{ value: unknown; depth: number }> = values.map((value) => ({ value, depth: 1 }));
  let nodes = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) break;
    nodes += 1;
    if (nodes > MODEL_LIMITS.maxJsonNodes || current.depth > MODEL_LIMITS.maxJsonDepth) return false;
    if (Array.isArray(current.value)) {
      for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
    } else if (current.value !== null && typeof current.value === "object") {
      for (const child of Object.values(current.value as Record<string, unknown>)) {
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
  return true;
}

export const JsonValueSchema = z.preprocess(
  (value) => (jsonValuesWithinLimits([value]) ? value : Symbol("json_limit_exceeded")),
  RawJsonValueSchema,
) as z.ZodType<JsonValue>;

export const JsonObjectSchema = z.preprocess(
  (value) => (jsonValuesWithinLimits([value]) ? value : Symbol("json_limit_exceeded")),
  z.record(z.string().max(256), RawJsonValueSchema),
) as z.ZodType<JsonObject>;

export const FieldDefinitionSchema = z.strictObject({
  type: z.enum(["string", "number", "integer", "boolean", "object", "array"]),
  required: z.boolean().optional(),
  description: z.string().min(1).max(240).optional(),
});

export const EventDefinitionSchema = z.strictObject({
  description: z.string().min(1).max(240).optional(),
  fields: z.record(IdentifierSchema, FieldDefinitionSchema).optional(),
});

export const GuardDefinitionSchema = z.strictObject({
  description: z.string().min(1).max(240).optional(),
});

const LiteralValueSourceSchema = z.strictObject({
  kind: z.literal("literal"),
  value: JsonValueSchema,
});

const EventValueSourceSchema = z.strictObject({
  kind: z.literal("event"),
  path: ValuePathSchema,
});

const ContextValueSourceSchema = z.strictObject({
  kind: z.literal("context"),
  path: ValuePathSchema,
});

export const ValueSourceSchema = z.discriminatedUnion("kind", [
  LiteralValueSourceSchema,
  EventValueSourceSchema,
  ContextValueSourceSchema,
]);

export const EffectIntentDefinitionSchema = z.strictObject({
  type: IdentifierSchema,
  input: z.record(IdentifierSchema, ValueSourceSchema).optional(),
});

export const TransitionDefinitionSchema = z.strictObject({
  target: IdentifierSchema,
  guard: IdentifierSchema.optional(),
  assign: z.record(IdentifierSchema, ValueSourceSchema).optional(),
  effects: z.array(EffectIntentDefinitionSchema).max(MODEL_LIMITS.maxEffectsPerTransition).optional(),
});

export const StateDefinitionSchema = z.strictObject({
  title: z.string().min(1).max(120).optional(),
  description: z.string().min(1).max(500).optional(),
  final: z.boolean().optional(),
  on: z.record(IdentifierSchema, TransitionDefinitionSchema).optional(),
});

export const MachineSpecSchema = z
  .strictObject({
    version: z.literal("0.1"),
    id: IdentifierSchema,
    title: z.string().min(1).max(120).optional(),
    initial: IdentifierSchema,
    context: z
      .strictObject({
        schema: z.record(IdentifierSchema, FieldDefinitionSchema).optional(),
        initial: JsonObjectSchema.optional(),
      })
      .optional(),
    events: z.record(IdentifierSchema, EventDefinitionSchema),
    guards: z.record(IdentifierSchema, GuardDefinitionSchema).optional(),
    states: z.record(IdentifierSchema, StateDefinitionSchema),
  })
  .superRefine((machine, context) => {
    if (!jsonValuesWithinLimits([machine])) {
      context.addIssue({
        code: "custom",
        message: `Machine JSON exceeds the cumulative ${MODEL_LIMITS.maxJsonNodes}-node or ${MODEL_LIMITS.maxJsonDepth}-level limit.`,
      });
    }
    const stateEntries = Object.entries(machine.states);
    const eventEntries = Object.entries(machine.events);
    const guardEntries = Object.entries(machine.guards ?? {});
    if (stateEntries.length === 0 || stateEntries.length > MODEL_LIMITS.maxStates) {
      context.addIssue({ code: "custom", path: ["states"], message: `Expected 1-${MODEL_LIMITS.maxStates} states.` });
    }
    if (eventEntries.length > MODEL_LIMITS.maxEvents) {
      context.addIssue({ code: "custom", path: ["events"], message: `At most ${MODEL_LIMITS.maxEvents} events are allowed.` });
    }
    if (guardEntries.length > MODEL_LIMITS.maxGuards) {
      context.addIssue({ code: "custom", path: ["guards"], message: `At most ${MODEL_LIMITS.maxGuards} guards are allowed.` });
    }
    let transitions = 0;
    for (const [, state] of stateEntries) {
      transitions += Object.keys(state.on ?? {}).length;
      for (const transition of Object.values(state.on ?? {})) {
        if (Object.keys(transition.assign ?? {}).length > MODEL_LIMITS.maxAssignmentsPerTransition) {
          context.addIssue({ code: "custom", message: `A transition has more than ${MODEL_LIMITS.maxAssignmentsPerTransition} assignments.` });
        }
      }
    }
    if (transitions > MODEL_LIMITS.maxTransitions) {
      context.addIssue({ code: "custom", path: ["states"], message: `At most ${MODEL_LIMITS.maxTransitions} transitions are allowed.` });
    }
    if (Object.keys(machine.context?.schema ?? {}).length > MODEL_LIMITS.maxFields) {
      context.addIssue({ code: "custom", path: ["context", "schema"], message: `At most ${MODEL_LIMITS.maxFields} context fields are allowed.` });
    }
    for (const [eventName, event] of eventEntries) {
      if (Object.keys(event.fields ?? {}).length > MODEL_LIMITS.maxFields) {
        context.addIssue({ code: "custom", path: ["events", eventName, "fields"], message: `At most ${MODEL_LIMITS.maxFields} event fields are allowed.` });
      }
    }
  });

export const SnapshotSchema = z.strictObject({
  state: IdentifierSchema,
  context: JsonObjectSchema,
});

export const EventInstanceSchema = z.strictObject({
  type: IdentifierSchema,
  payload: JsonObjectSchema.optional(),
});

export const GuardResultsSchema = z.record(IdentifierSchema, z.boolean());

export const StepRequestSchema = z
  .strictObject({
    machine: MachineSpecSchema,
    snapshot: SnapshotSchema.optional(),
    event: EventInstanceSchema,
    guard_results: GuardResultsSchema.optional(),
  })
  .superRefine((request, context) => {
    if (!jsonValuesWithinLimits([request.machine, request.snapshot, request.event, request.guard_results])) {
      context.addIssue({ code: "custom", message: "Step request exceeds the cumulative JSON complexity limit." });
    }
  });

export const SimulationEventSchema = z.strictObject({
  event: EventInstanceSchema,
  guard_results: GuardResultsSchema.optional(),
});

export const SimulationRequestSchema = z
  .strictObject({
    machine: MachineSpecSchema,
    snapshot: SnapshotSchema.optional(),
    events: z.array(SimulationEventSchema).max(MODEL_LIMITS.maxSimulationEvents),
    stop_on_rejection: z.boolean().optional(),
  })
  .superRefine((request, context) => {
    if (!jsonValuesWithinLimits([request.machine, request.snapshot, request.events])) {
      context.addIssue({ code: "custom", message: "Simulation request exceeds the cumulative JSON complexity limit." });
    }
  });

export const PathRequestSchema = z.strictObject({
  machine: MachineSpecSchema,
  target: IdentifierSchema,
  from: IdentifierSchema.optional(),
  max_depth: z.number().int().min(0).max(MODEL_LIMITS.maxPathDepth).optional(),
});

export const ValidationRequestSchema = z.strictObject({ machine: JsonObjectSchema });
export const InspectRequestSchema = z.strictObject({ machine: MachineSpecSchema });
export const DiffRequestSchema = z
  .strictObject({ before: MachineSpecSchema, after: MachineSpecSchema })
  .superRefine((request, context) => {
    if (!jsonValuesWithinLimits([request.before, request.after])) {
      context.addIssue({ code: "custom", message: "Diff request exceeds the cumulative JSON complexity limit." });
    }
  });

export const DiagnosticSchema = z.strictObject({
  severity: z.enum(["error", "warning"]),
  code: z.string(),
  message: z.string(),
  path: z.string(),
});

export const ValidationResultSchema = z.strictObject({
  status: z.enum(["valid", "invalid"]),
  machine_id: z.string().optional(),
  diagnostics: z.array(DiagnosticSchema),
  stats: z
    .strictObject({
      states: z.number().int(),
      events: z.number().int(),
      guards: z.number().int(),
      transitions: z.number().int(),
      final_states: z.number().int(),
    })
    .optional(),
});

export const OperationErrorSchema = z.strictObject({
  status: z.literal("error"),
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    details: z.array(DiagnosticSchema).optional(),
  }),
});

const SnapshotResultSchema = z.strictObject({ state: z.string(), context: JsonObjectSchema });
const GuardCheckSchema = z.strictObject({ name: z.string(), outcome: z.boolean().nullable() });
const EffectResultSchema = z.strictObject({ type: z.string(), input: JsonObjectSchema });

const StepBaseResultShape = {
  status: z.literal("ok"),
  before: SnapshotResultSchema,
  event: EventInstanceSchema,
  after: SnapshotResultSchema,
  guards: z.array(GuardCheckSchema),
  context_changes: JsonObjectSchema,
  effects: z.array(EffectResultSchema),
  enabled_events: z.array(z.string()),
};

export const StepAcceptedResultSchema = z.strictObject({
  ...StepBaseResultShape,
  accepted: z.literal(true),
  transition: z.string(),
});

export const StepRejectedResultSchema = z.strictObject({
  ...StepBaseResultShape,
  accepted: z.literal(false),
  reason: z.enum(["NO_VALID_TRANSITION", "GUARD_RESULT_REQUIRED", "GUARD_REJECTED"]),
});

export const StepResultSchema = z.union([StepAcceptedResultSchema, StepRejectedResultSchema, OperationErrorSchema]);

export const SimulationResultSchema = z.union([
  z.strictObject({
    status: z.literal("ok"),
    accepted: z.boolean(),
    initial: SnapshotResultSchema,
    final: SnapshotResultSchema,
    steps: z.array(z.union([StepAcceptedResultSchema, StepRejectedResultSchema])),
    stopped_at: z.number().int().nullable(),
  }),
  OperationErrorSchema,
]);

export const PathResultSchema = z.union([
  z.strictObject({
    status: z.enum(["found", "unreachable"]),
    from: z.string(),
    target: z.string(),
    steps: z.array(z.strictObject({ from: z.string(), event: z.string(), to: z.string(), guard: z.string().nullable() })),
    required_guards: z.array(z.string()),
  }),
  OperationErrorSchema,
]);

export const InspectResultSchema = z.union([
  z.strictObject({
    status: z.literal("ok"),
    machine_id: z.string(),
    initial: z.string(),
    states: z.array(z.strictObject({ id: z.string(), title: z.string().nullable(), final: z.boolean() })),
    events: z.array(z.string()),
    guards: z.array(z.string()),
    transitions: z.array(z.strictObject({ from: z.string(), event: z.string(), to: z.string(), guard: z.string().nullable() })),
    stats: z.strictObject({
      states: z.number().int(),
      events: z.number().int(),
      guards: z.number().int(),
      transitions: z.number().int(),
      final_states: z.number().int(),
    }),
    limits: z.record(z.string(), z.number()),
  }),
  OperationErrorSchema,
]);

export const DiffResultSchema = z.union([
  z.strictObject({
    status: z.enum(["same", "different"]),
    changes: z.array(
      z.strictObject({
        kind: z.enum(["added", "removed", "changed"]),
        path: z.string(),
        before: JsonValueSchema.optional(),
        after: JsonValueSchema.optional(),
      }),
    ),
    truncated: z.boolean(),
  }),
  OperationErrorSchema,
]);
