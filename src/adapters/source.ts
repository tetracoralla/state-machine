import { readFileSync, statSync } from "node:fs";

import { MODEL_LIMITS } from "../model/schemas.js";
import { parseSourceText, type SourceError, type SourceResult } from "../model/source-text.js";

export type { SourceError, SourceResult };
export { parseSourceText };

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
