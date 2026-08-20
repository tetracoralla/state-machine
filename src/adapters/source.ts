import { readFileSync, statSync } from "node:fs";

import { parse } from "yaml";

import { MODEL_LIMITS } from "../model/schemas.js";

export interface SourceResult {
  ok: true;
  value: unknown;
}

export interface SourceError {
  ok: false;
  error: { code: string; message: string };
}

export function parseSourceText(source: string): SourceResult | SourceError {
  if (Buffer.byteLength(source) > MODEL_LIMITS.maxRequestBytes) {
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

export function readSourceFile(path: string): SourceResult | SourceError {
  try {
    const stats = statSync(path);
    if (!stats.isFile()) return { ok: false, error: { code: "SOURCE_NOT_FILE", message: `Source path is not a regular file: ${path}` } };
    if (stats.size > MODEL_LIMITS.maxRequestBytes) {
      return { ok: false, error: { code: "REQUEST_TOO_LARGE", message: "Source exceeds the request byte limit." } };
    }
    return parseSourceText(readFileSync(path, "utf8"));
  } catch (error) {
    return {
      ok: false,
      error: { code: "SOURCE_READ_FAILED", message: error instanceof Error ? error.message : `Could not read ${path}.` },
    };
  }
}

