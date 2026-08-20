import { parse } from "yaml";

import { MODEL_LIMITS } from "./schemas.js";

export interface SourceResult {
  ok: true;
  value: unknown;
}

export interface SourceError {
  ok: false;
  error: { code: string; message: string };
}

export function sourceByteLength(source: string): number {
  return new TextEncoder().encode(source).byteLength;
}

export function parseSourceText(source: string): SourceResult | SourceError {
  if (sourceByteLength(source) > MODEL_LIMITS.maxRequestBytes) {
    return { ok: false, error: { code: "REQUEST_TOO_LARGE", message: "Source exceeds the request byte limit." } };
  }
  try {
    return { ok: true, value: parse(source, { maxAliasCount: 50, strict: true }) };
  } catch (error) {
    return {
      ok: false,
      error: { code: "SOURCE_PARSE_FAILED", message: error instanceof Error ? error.message : "Source could not be parsed." },
    };
  }
}
