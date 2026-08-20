import { describe, expect, it } from "vitest";

import * as publicApi from "../../dist/node/index.js";

describe("built package public API", () => {
  it("keeps validated entry points public and parsed-only seams internal", () => {
    expect(publicApi).toHaveProperty("validateMachine");
    expect(publicApi).toHaveProperty("stepMachine");
    expect(publicApi).not.toHaveProperty("validateParsedMachine");
    expect(publicApi).not.toHaveProperty("stepValidatedMachine");
  });

  it("returns a structured validation result for untrusted input", () => {
    expect(publicApi.validateMachine({})).toMatchObject({
      status: "invalid",
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "SCHEMA_INVALID" })]),
    });
  });
});
