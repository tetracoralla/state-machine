import { parse } from "yaml";

import { MachineSpecSchema, MODEL_LIMITS } from "../../model/schemas.js";
import type { MachineSpec, ValidationResult } from "../../model/types.js";
import { validateMachine } from "../../core/validation.js";

export interface ParsedEditorSource {
  machine: MachineSpec | null;
  validation: ValidationResult;
}

export function parseEditorSource(source: string): ParsedEditorSource {
  if (new TextEncoder().encode(source).byteLength > MODEL_LIMITS.maxRequestBytes) {
    return {
      machine: null,
      validation: {
        status: "invalid",
        diagnostics: [
          {
            severity: "error",
            code: "REQUEST_TOO_LARGE",
            message: "Definition exceeds the request byte limit.",
            path: "$",
          },
        ],
      },
    };
  }
  let raw: unknown;
  try {
    raw = parse(source, { maxAliasCount: 50, strict: true });
  } catch (error) {
    return {
      machine: null,
      validation: {
        status: "invalid",
        diagnostics: [
          {
            severity: "error",
            code: "SOURCE_PARSE_FAILED",
            message: error instanceof Error ? error.message : "Definition could not be parsed.",
            path: "$",
          },
        ],
      },
    };
  }
  const structural = MachineSpecSchema.safeParse(raw);
  const validation = validateMachine(raw);
  return { machine: structural.success ? (structural.data as MachineSpec) : null, validation };
}

export function downloadSource(source: string, machineId: string): void {
  const blob = new Blob([source], { type: "application/yaml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${machineId}.machine.yaml`;
  anchor.click();
  URL.revokeObjectURL(url);
}

