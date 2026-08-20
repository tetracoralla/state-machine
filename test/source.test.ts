import { describe, expect, it } from "vitest";

import { MODEL_LIMITS } from "../src/model/schemas.js";
import { parseSourceText, sourceByteLength } from "../src/model/source-text.js";

describe("shared source parsing", () => {
  it("counts UTF-8 bytes consistently across Node and browser callers", () => {
    expect(sourceByteLength("é")).toBe(2);
    expect(parseSourceText("x".repeat(MODEL_LIMITS.maxRequestBytes + 1))).toMatchObject({
      ok: false,
      error: { code: "REQUEST_TOO_LARGE" },
    });
  });

  it("keeps strict YAML parse failures in the shared carrier", () => {
    expect(parseSourceText("id: first\nid: second\n")).toMatchObject({
      ok: false,
      error: { code: "SOURCE_PARSE_FAILED" },
    });
  });

  it("parses a valid YAML object without applying machine semantics", () => {
    expect(parseSourceText("version: '0.1'\nid: sample\n")).toEqual({
      ok: true,
      value: { version: "0.1", id: "sample" },
    });
  });
});
