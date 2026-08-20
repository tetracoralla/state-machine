export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export type ScalarType = "string" | "number" | "integer" | "boolean" | "object" | "array";

export interface FieldDefinition {
  type: ScalarType;
  required?: boolean;
  description?: string;
}

export interface EventDefinition {
  description?: string;
  fields?: Record<string, FieldDefinition>;
}

export interface GuardDefinition {
  description?: string;
}

export type ValueSource =
  | { kind: "literal"; value: JsonValue }
  | { kind: "event"; path: string }
  | { kind: "context"; path: string };

export interface EffectIntentDefinition {
  type: string;
  input?: Record<string, ValueSource>;
}

export interface TransitionDefinition {
  target: string;
  guard?: string;
  assign?: Record<string, ValueSource>;
  effects?: EffectIntentDefinition[];
}

export interface StateDefinition {
  title?: string;
  description?: string;
  final?: boolean;
  on?: Record<string, TransitionDefinition>;
}

export interface MachineSpec {
  version: "0.1";
  id: string;
  title?: string;
  initial: string;
  context?: {
    schema?: Record<string, FieldDefinition>;
    initial?: JsonObject;
  };
  events: Record<string, EventDefinition>;
  guards?: Record<string, GuardDefinition>;
  states: Record<string, StateDefinition>;
}

export interface Snapshot {
  state: string;
  context: JsonObject;
}

export interface EventInstance {
  type: string;
  payload?: JsonObject;
}

export interface StepRequest {
  machine: MachineSpec;
  snapshot?: Snapshot;
  event: EventInstance;
  guard_results?: Record<string, boolean>;
}

export interface SimulationEvent {
  event: EventInstance;
  guard_results?: Record<string, boolean>;
}

export interface SimulationRequest {
  machine: MachineSpec;
  snapshot?: Snapshot;
  events: SimulationEvent[];
  stop_on_rejection?: boolean;
}

export interface PathRequest {
  machine: MachineSpec;
  target: string;
  from?: string;
  max_depth?: number;
}

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  path: string;
}

export interface MachineStats {
  states: number;
  events: number;
  guards: number;
  transitions: number;
  final_states: number;
}

export interface ValidationResult {
  status: "valid" | "invalid";
  machine_id?: string;
  diagnostics: Diagnostic[];
  stats?: MachineStats;
}

export interface OperationError {
  status: "error";
  error: {
    code: string;
    message: string;
    details?: Diagnostic[];
  };
}

export interface ResolvedEffectIntent {
  type: string;
  input: JsonObject;
}

export type StepRejectionReason =
  | "NO_VALID_TRANSITION"
  | "GUARD_RESULT_REQUIRED"
  | "GUARD_REJECTED";

export interface GuardCheck {
  name: string;
  outcome: boolean | null;
}

export interface StepSuccess {
  status: "ok";
  accepted: true;
  before: Snapshot;
  event: EventInstance;
  transition: string;
  after: Snapshot;
  guards: GuardCheck[];
  context_changes: JsonObject;
  effects: ResolvedEffectIntent[];
  enabled_events: string[];
}

export interface StepRejection {
  status: "ok";
  accepted: false;
  reason: StepRejectionReason;
  before: Snapshot;
  event: EventInstance;
  after: Snapshot;
  guards: GuardCheck[];
  context_changes: JsonObject;
  effects: ResolvedEffectIntent[];
  enabled_events: string[];
}

export type StepResult = StepSuccess | StepRejection | OperationError;

export interface SimulationResult {
  status: "ok";
  accepted: boolean;
  initial: Snapshot;
  final: Snapshot;
  steps: Array<StepSuccess | StepRejection>;
  stopped_at: number | null;
}

export interface PathStep {
  from: string;
  event: string;
  to: string;
  guard: string | null;
}

export interface PathResult {
  status: "found" | "unreachable";
  from: string;
  target: string;
  steps: PathStep[];
  required_guards: string[];
}

export interface ReachabilityResult {
  status: "ok";
  from: string;
  reachable: string[];
  unreachable: string[];
}

export interface InspectResult {
  status: "ok";
  machine_id: string;
  initial: string;
  states: Array<{ id: string; title: string | null; final: boolean }>;
  events: string[];
  guards: string[];
  transitions: Array<{ from: string; event: string; to: string; guard: string | null }>;
  stats: MachineStats;
  limits: Record<string, number>;
}

export interface SemanticChange {
  kind: "added" | "removed" | "changed";
  path: string;
  before?: JsonValue;
  after?: JsonValue;
}

export interface DiffResult {
  status: "same" | "different";
  changes: SemanticChange[];
  truncated: boolean;
}

