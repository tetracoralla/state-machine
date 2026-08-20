import { DiffRequestSchema, MODEL_LIMITS } from "../model/schemas.js";
import type { DiffResult, JsonValue, MachineSpec, OperationError, SemanticChange } from "../model/types.js";
import { validateMachine } from "./validation.js";

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectChanges(
  before: JsonValue | undefined,
  after: JsonValue | undefined,
  path: string,
  changes: SemanticChange[],
): void {
  if (changes.length > MODEL_LIMITS.maxDiffChanges) return;
  if (before === undefined) {
    changes.push({ kind: "added", path, after: after as JsonValue });
    return;
  }
  if (after === undefined) {
    changes.push({ kind: "removed", path, before });
    return;
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) collectChanges(before[index], after[index], `${path}[${index}]`, changes);
    return;
  }
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(codeUnitCompare);
    for (const key of keys) collectChanges(before[key], after[key], `${path}.${key}`, changes);
    return;
  }
  if (!Object.is(before, after)) changes.push({ kind: "changed", path, before, after });
}

export function diffMachines(input: unknown): DiffResult | OperationError {
  const parsed = DiffRequestSchema.safeParse(input);
  if (!parsed.success) return { status: "error", error: { code: "INPUT_INVALID", message: parsed.error.issues[0]?.message ?? "Diff request is invalid." } };
  const before = parsed.data.before as MachineSpec;
  const after = parsed.data.after as MachineSpec;
  const beforeValidation = validateMachine(before);
  const afterValidation = validateMachine(after);
  if (beforeValidation.status === "invalid" || afterValidation.status === "invalid") {
    return {
      status: "error",
      error: {
        code: "MACHINE_INVALID",
        message: "Both machines must pass semantic validation before diffing.",
        details: [...beforeValidation.diagnostics, ...afterValidation.diagnostics].slice(0, MODEL_LIMITS.maxDiagnostics),
      },
    };
  }
  const changes: SemanticChange[] = [];
  collectChanges(before as unknown as JsonValue, after as unknown as JsonValue, "$", changes);
  return {
    status: changes.length === 0 ? "same" : "different",
    changes: changes.slice(0, MODEL_LIMITS.maxDiffChanges),
    truncated: changes.length > MODEL_LIMITS.maxDiffChanges,
  };
}
