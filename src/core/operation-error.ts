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
