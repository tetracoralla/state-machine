import { describe, expect, it } from "vitest";

import { enabledEvents, stepMachine } from "../src/index.js";
import { orderMachine, paymentEvent } from "./fixtures.js";

describe("stepMachine", () => {
  it("applies a guarded transition, assignments, and symbolic effects", () => {
    const result = stepMachine({
      machine: orderMachine(),
      event: paymentEvent,
      guard_results: { payment_amount_matches: true },
    });
    expect(result).toMatchObject({
      status: "ok",
      accepted: true,
      transition: "pending.PAYMENT_SUCCESS",
      before: { state: "pending", context: { amount: 128, paid: false } },
      after: { state: "paid", context: { amount: 128, paid: true, payment_id: "pay_1024" } },
      guards: [{ name: "payment_amount_matches", outcome: true }],
      context_changes: { paid: true, payment_id: "pay_1024" },
      effects: [{ type: "record_payment", input: { payment_id: "pay_1024" } }],
      enabled_events: ["CANCEL", "START_FULFILLMENT"],
    });
  });

  it("requires an explicit guard outcome", () => {
    const result = stepMachine({ machine: orderMachine(), event: paymentEvent });
    expect(result).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "GUARD_RESULT_REQUIRED",
      after: { state: "pending" },
      guards: [{ name: "payment_amount_matches", outcome: null }],
    });
  });

  it("rejects a false guard without changing snapshot or emitting effects", () => {
    const result = stepMachine({
      machine: orderMachine(),
      event: paymentEvent,
      guard_results: { payment_amount_matches: false },
    });
    expect(result).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "GUARD_REJECTED",
      before: { state: "pending" },
      after: { state: "pending" },
      context_changes: {},
      effects: [],
    });
  });

  it("returns an ordinary missing-transition rejection", () => {
    const result = stepMachine({
      machine: orderMachine(),
      snapshot: { state: "shipped", context: { amount: 128, paid: true, payment_id: "pay_1024" } },
      event: { type: "CANCEL" },
    });
    expect(result).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "NO_VALID_TRANSITION",
      enabled_events: ["DELIVER"],
    });
  });

  it("does not validate an irrelevant payload when the declared event has no transition", () => {
    const result = stepMachine({
      machine: orderMachine(),
      snapshot: { state: "shipped", context: { amount: 128, paid: true, payment_id: "pay_1024" } },
      event: { type: "PAYMENT_SUCCESS", payload: { amount: "not-a-number" } },
      guard_results: { invented_policy: true },
    });
    expect(result).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "NO_VALID_TRANSITION",
      after: { state: "shipped" },
    });
  });

  it("rejects invalid event payloads before transition execution", () => {
    const result = stepMachine({
      machine: orderMachine(),
      event: { type: "PAYMENT_SUCCESS", payload: { amount: "128", payment_id: "pay_1024" } },
      guard_results: { payment_amount_matches: true },
    });
    expect(result).toMatchObject({ status: "error", error: { code: "EVENT_PAYLOAD_INVALID" } });
  });

  it("rejects undeclared guard outcomes", () => {
    const result = stepMachine({
      machine: orderMachine(),
      event: { type: "CANCEL" },
      guard_results: { invented_policy: true },
    });
    expect(result).toMatchObject({ status: "error", error: { code: "GUARD_RESULT_UNKNOWN" } });
  });

  it("sorts structurally enabled events deterministically", () => {
    expect(enabledEvents(orderMachine(), "paid")).toEqual(["CANCEL", "START_FULFILLMENT"]);
  });

  it("treats Object.prototype member names as undeclared events and transitions", () => {
    const machine = {
      version: "0.1" as const,
      id: "prototype-probe",
      initial: "start",
      events: { GO: {} },
      states: { start: { on: { GO: { target: "done" } } }, done: { final: true } },
    };
    expect(stepMachine({ machine, event: { type: "toString" } })).toMatchObject({
      status: "error",
      error: { code: "EVENT_UNKNOWN" },
    });
  });

  it("requires an explicit outcome for a guard named like an Object.prototype member", () => {
    const machine = {
      version: "0.1" as const,
      id: "prototype-guard",
      initial: "start",
      events: { GO: {} },
      guards: { valueOf: { description: "Named like a prototype member." } },
      states: { start: { on: { GO: { target: "done", guard: "valueOf" } } }, done: { final: true } },
    };
    expect(stepMachine({ machine, event: { type: "GO" }, guard_results: {} })).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "GUARD_RESULT_REQUIRED",
    });
  });

  it("does not confuse inherited properties with declared payload fields", () => {
    const machine = {
      version: "0.1" as const,
      id: "prototype-fields",
      initial: "start",
      events: { GO: { fields: { n: { type: "number" }, valueOf: { type: "string", required: false } } } },
      states: { start: { on: { GO: { target: "done" } } }, done: { final: true } },
    };
    expect(stepMachine({ machine, event: { type: "GO", payload: { n: 1 } } })).toMatchObject({
      status: "ok",
      accepted: true,
    });
    expect(stepMachine({ machine, event: { type: "GO", payload: { n: 1, toString: "undeclared" } } })).toMatchObject({
      status: "error",
      error: { code: "EVENT_PAYLOAD_INVALID" },
    });
  });

  it("rejects own __proto__ payload keys instead of silently dropping them", () => {
    const machine = {
      version: "0.1" as const,
      id: "proto-key",
      initial: "start",
      events: { GO: {} },
      states: { start: { on: { GO: { target: "done" } } }, done: { final: true } },
    };
    const payload = JSON.parse('{"__proto__": {"x": 1}}');
    expect(Object.prototype.hasOwnProperty.call(payload, "__proto__")).toBe(true);
    expect(stepMachine({ machine, event: { type: "GO", payload } })).toMatchObject({
      status: "error",
      error: { code: "INPUT_INVALID" },
    });
  });
});
