import type { MachineSpec, ValidationResult } from "../../model/types.js";
import { schemaDiagnostics, validateParsedMachine } from "../../core/validation.js";
import { MachineSpecSchema } from "../../model/schemas.js";
import { parseSourceText } from "../../model/source-text.js";

export interface ParsedEditorSource {
  machine: MachineSpec | null;
  validation: ValidationResult;
}

function sourceDiagnostic(code: string, message: string): ValidationResult {
  return {
    status: "invalid",
    diagnostics: [{ severity: "error", code, message, path: "$" }],
  };
}

export function parseEditorSource(source: string): ParsedEditorSource {
  const parsed = parseSourceText(source);
  if (!parsed.ok) {
    return { machine: null, validation: sourceDiagnostic(parsed.error.code, parsed.error.message) };
  }
  const structural = MachineSpecSchema.safeParse(parsed.value);
  if (!structural.success) {
    return { machine: null, validation: { status: "invalid", diagnostics: schemaDiagnostics(structural.error) } };
  }
  const machine = structural.data as MachineSpec;
  return { machine, validation: validateParsedMachine(machine) };
}

export function downloadSource(source: string, machineId: string): void {
  const blob = new Blob([source], { type: "application/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${machineId}.machine.yaml`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
