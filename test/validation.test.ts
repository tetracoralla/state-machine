import { describe, expect, it } from "vitest";

import { MachineSpecSchema, StepRequestSchema, stepMachine, validateMachine } from "../src/index.js";
import type { MachineSpec } from "../src/index.js";
import { orderMachine } from "./fixtures.js";

describe("validateMachine", () => {
  it("accepts the canonical order machine", () => {
    const result = validateMachine(orderMachine());
    expect(result).toMatchObject({
      status: "valid",
      machine_id: "order-lifecycle",
      diagnostics: [],
      stats: { states: 6, events: 5, guards: 2, transitions: 6, final_states: 2 },
    });
  });

  it("reports structural reference and final-state failures", () => {
    const machine = orderMachine();
    machine.initial = "missing";
    machine.states.completed = { final: true, on: { CANCEL: { target: "gone", guard: "missing_guard" } } };
    const result = validateMachine(machine);
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "INITIAL_STATE_UNKNOWN",
        "FINAL_STATE_HAS_TRANSITIONS",
        "TARGET_STATE_UNKNOWN",
        "GUARD_UNKNOWN",
      ]),
    );
  });

  it("warns about unreachable states, dead ends, and states with no final path", () => {
    const machine = orderMachine();
    machine.states.orphan = {};
    const result = validateMachine(machine);
    expect(result.status).toBe("valid");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "NONFINAL_DEAD_END", path: "$.states.orphan" }),
        expect.objectContaining({ code: "STATE_UNREACHABLE", path: "$.states.orphan" }),
      ]),
    );
  });

  it("rejects undeclared assignment targets and value-source roots", () => {
    const machine = orderMachine();
    const transition = machine.states.pending?.on?.PAYMENT_SUCCESS;
    expect(transition).toBeDefined();
    if (!transition) return;
    transition.assign = {
      typo: { kind: "context", path: "not_declared.value" },
    };
    const result = validateMachine(machine);
    expect(result.status).toBe("invalid");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["CONTEXT_ASSIGN_UNDECLARED", "CONTEXT_VALUE_UNDECLARED"]),
    );
  });

  it("rejects statically incompatible context assignments", () => {
    const machine = orderMachine();
    const transition = machine.states.pending?.on?.PAYMENT_SUCCESS;
    expect(transition).toBeDefined();
    if (!transition) return;
    transition.assign = {
      paid: { kind: "literal", value: "yes" },
      payment_id: { kind: "event", path: "amount" },
    };
    const result = validateMachine(machine);
    expect(result.status).toBe("invalid");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CONTEXT_ASSIGN_TYPE_MISMATCH", path: "$.states.pending.on.PAYMENT_SUCCESS.assign.paid" }),
        expect.objectContaining({ code: "CONTEXT_ASSIGN_TYPE_MISMATCH", path: "$.states.pending.on.PAYMENT_SUCCESS.assign.payment_id" }),
      ]),
    );
  });

  it("rejects paths that traverse scalar fields", () => {
    const machine = orderMachine();
    const transition = machine.states.pending?.on?.PAYMENT_SUCCESS;
    expect(transition).toBeDefined();
    if (!transition) return;
    transition.assign = { payment_id: { kind: "event", path: "amount.value" } };
    const result = validateMachine(machine);
    expect(result).toMatchObject({
      status: "invalid",
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "VALUE_PATH_NOT_TRAVERSABLE" })]),
    });
  });

  it("rejects unknown fields and unsafe value paths at the executable schema", () => {
    expect(MachineSpecSchema.safeParse({ ...orderMachine(), surprise: true }).success).toBe(false);
    const machine = orderMachine();
    const transition = machine.states.pending?.on?.PAYMENT_SUCCESS;
    expect(transition).toBeDefined();
    if (!transition) return;
    transition.assign = { paid: { kind: "event", path: "__proto__.polluted" } };
    expect(MachineSpecSchema.safeParse(machine).success).toBe(false);
  });

  it("enforces the JSON node budget cumulatively across one request", () => {
    const makeLargeObject = () =>
      Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`field_${index}`, Array.from({ length: 100 }, () => index)]));
    const machine = orderMachine();
    machine.context = { ...machine.context, initial: makeLargeObject() };

    expect(MachineSpecSchema.safeParse(machine).success).toBe(true);
    expect(
      StepRequestSchema.safeParse({
        machine,
        snapshot: { state: machine.initial, context: makeLargeObject() },
        event: { type: "CANCEL" },
      }).success,
    ).toBe(false);
  });

  it("treats Object.prototype member names as nonexistent states", () => {
    const targetMachine = orderMachine();
    const transition = targetMachine.states.pending?.on?.PAYMENT_SUCCESS;
    expect(transition).toBeDefined();
    if (transition) transition.target = "toString";
    expect(validateMachine(targetMachine).status).toBe("invalid");

    const initialMachine = orderMachine();
    initialMachine.initial = "hasOwnProperty";
    const initialResult = validateMachine(initialMachine);
    expect(initialResult.status).toBe("invalid");
    expect(initialResult.diagnostics).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "INITIAL_STATE_UNKNOWN" })]),
    );
  });

  it("flags transitions and assignments that use Object.prototype member names", () => {
    const machine: MachineSpec = {
      version: "0.1",
      id: "prototype-members",
      initial: "start",
      context: { schema: { amount: { type: "number" } }, initial: { amount: 1 } },
      events: { GO: {} },
      states: {
        start: {
          on: {
            GO: { target: "done", assign: { toString: { kind: "literal" as const, value: 1 } } },
            valueOf: { target: "done" },
          },
        },
        done: { final: true },
      },
    };
    const result = validateMachine(machine);
    expect(result.status).toBe("invalid");
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EVENT_UNKNOWN", path: "$.states.start.on.valueOf" }),
        expect.objectContaining({ code: "CONTEXT_ASSIGN_UNDECLARED", path: "$.states.start.on.GO.assign.toString" }),
      ]),
    );
  });

  it("accepts hyphenated identifiers in value paths", () => {
    const machine: MachineSpec = {
      version: "0.1",
      id: "hyphen-fields",
      initial: "start",
      context: { schema: { "retry-count": { type: "integer", required: false } }, initial: {} },
      events: { GO: { fields: { "retry-count": { type: "integer", required: false } } } },
      states: { start: { on: { GO: { target: "done", assign: { "retry-count": { kind: "event", path: "retry-count" } } } } }, done: { final: true } },
    };
    expect(validateMachine(machine)).toMatchObject({ status: "valid", diagnostics: [] });
    expect(stepMachine({ machine, event: { type: "GO", payload: { "retry-count": 2 } } })).toMatchObject({
      status: "ok",
      accepted: true,
      after: { context: { "retry-count": 2 } },
    });
  });
});
