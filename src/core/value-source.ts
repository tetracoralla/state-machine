import type { EventInstance, JsonObject, JsonValue, Snapshot, ValueSource } from "../model/types.js";
import { RESERVED_SEGMENTS } from "../model/ordering.js";

function cloneJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneJson(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJson(item)])) as T;
  }
  return value;
}

function readPath(root: JsonObject, path: string): JsonValue | undefined {
  let current: JsonValue = root;
  for (const segment of path.split(".")) {
    if (RESERVED_SEGMENTS.includes(segment) || current === null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    if (!Object.hasOwn(current, segment)) return undefined;
    current = current[segment] as JsonValue;
    if (current === undefined) return undefined;
  }
  return current;
}

export interface ResolutionResult {
  found: boolean;
  value?: JsonValue;
}

export function resolveValueSource(source: ValueSource, snapshot: Snapshot, event: EventInstance): ResolutionResult {
  if (source.kind === "literal") return { found: true, value: cloneJson(source.value) };
  const root = source.kind === "event" ? event.payload ?? {} : snapshot.context;
  const value = readPath(root, source.path);
  return value === undefined ? { found: false } : { found: true, value: cloneJson(value) };
}

export function cloneObject(value: JsonObject): JsonObject {
  return cloneJson(value);
}

