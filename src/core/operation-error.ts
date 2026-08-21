import { MODEL_LIMITS } from "../model/schemas.js";
import type { Diagnostic, OperationError } from "../model/types.js";

export function inputError(message: string): OperationError {
  return { status: "error", error: { code: "INPUT_INVALID", message } };
}

export function machineError(details: Diagnostic[]): OperationError {
  return {
    status: "error",
    error: { code: "MACHINE_INVALID", message: "Machine failed semantic validation.", details },
  };
}

export function runtimeError(code: string, message: string, details?: Diagnostic[]): OperationError {
  const error: OperationError["error"] = { code, message };
  if (details && details.length > 0) error.details = details;
  return { status: "error", error };
}

export function boundedOperationResult<T extends object>(result: T): T | OperationError {
  try {
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength <= MODEL_LIMITS.maxResponseBytes) return result;
  } catch {
    // Treat an unserializable result as an internal response-boundary failure.
  }
  return runtimeError("RESPONSE_TOO_LARGE", "Result exceeds the complete response byte limit.");
}
