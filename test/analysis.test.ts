import { describe, expect, it } from "vitest";

import { diffMachines, findPath, inspectMachine, reachableStates, simulateMachine, stepMachine } from "../src/index.js";
import type { MachineSpec } from "../src/model/types.js";
import { largeContextMachine, orderMachine, paymentEvent } from "./fixtures.js";

describe("simulation and graph analysis", () => {
  it("keeps one-event simulation equivalent to a direct step near the request complexity limit", () => {
    const machine = largeContextMachine();
    const direct = stepMachine({ machine, event: { type: "GO" } });
    const result = simulateMachine({ machine, events: [{ event: { type: "GO" } }] });
    expect(direct).toMatchObject({ status: "ok", accepted: true, after: { state: "done" } });
    expect(result).toMatchObject({ status: "ok", accepted: true, final: { state: "done" } });
  });

  it("validates the machine even when a simulation has no events", () => {
    const machine = orderMachine();
    machine.initial = "missing";
    expect(simulateMachine({ machine, events: [] })).toMatchObject({
      status: "error",
      error: { code: "MACHINE_INVALID" },
    });
  });

  it("simulates an accepted sequence and stops at the first blocked event", () => {
    const result = simulateMachine({
      machine: orderMachine(),
      events: [
        { event: paymentEvent, guard_results: { payment_amount_matches: true } },
        { event: { type: "START_FULFILLMENT" } },
        { event: { type: "SHIP" } },
        { event: { type: "CANCEL" } },
        { event: { type: "DELIVER" } },
      ],
    });
    expect(result).toMatchObject({
      status: "ok",
      accepted: false,
      final: { state: "shipped" },
      stopped_at: 3,
    });
    if (result.status === "ok") {
      expect(result.steps).toHaveLength(4);
      expect(result.steps[3]).toMatchObject({ accepted: false, reason: "NO_VALID_TRANSITION" });
    }
  });

  it("can continue after a rejection without changing the current snapshot", () => {
    const result = simulateMachine({
      machine: orderMachine(),
      snapshot: { state: "shipped", context: { amount: 128, paid: true } },
      events: [{ event: { type: "CANCEL" } }, { event: { type: "DELIVER" } }],
      stop_on_rejection: false,
    });
    expect(result).toMatchObject({ status: "ok", accepted: false, final: { state: "completed" }, stopped_at: null });
  });

  it("finds the deterministic shortest structural path and guard needs", () => {
    const result = findPath({ machine: orderMachine(), target: "completed" });
    expect(result).toMatchObject({
      status: "found",
      from: "pending",
      target: "completed",
      required_guards: ["payment_amount_matches"],
    });
    if (result.status === "found") {
      expect(result.steps.map((step) => step.event)).toEqual([
        "PAYMENT_SUCCESS",
        "START_FULFILLMENT",
        "SHIP",
        "DELIVER",
      ]);
    }
  });

  it("reports reachable and compact inspect views", () => {
    expect(reachableStates(orderMachine())).toMatchObject({
      status: "ok",
      unreachable: [],
      reachable: ["cancelled", "completed", "fulfilling", "paid", "pending", "shipped"],
    });
    expect(inspectMachine(orderMachine())).toMatchObject({
      status: "ok",
      machine_id: "order-lifecycle",
      stats: { states: 6, transitions: 6 },
    });
  });

  it("returns bounded semantic changes and same-machine identity", () => {
    expect(diffMachines({ before: orderMachine(), after: orderMachine() })).toEqual({
      status: "same",
      changes: [],
      truncated: false,
    });
    const after = orderMachine();
    after.states.paid = { on: { START_FULFILLMENT: { target: "fulfilling" } } };
    const result = diffMachines({ before: orderMachine(), after });
    expect(result).toMatchObject({ status: "different", truncated: false });
    if (result.status === "different") {
      expect(result.changes).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "removed", path: "$.states.paid.on.CANCEL" })]),
      );
    }
  });

  it("marks diff truncation only when more changes exist than are returned", () => {
    const metadataMachine = (label: string): MachineSpec => ({
      version: "0.1",
      id: "diff-boundary",
      initial: "state_0",
      events: Object.fromEntries(
        Array.from({ length: 100 }, (_, index) => [`EVENT_${index}`, { description: `${label} event ${index}` }]),
      ),
      states: Object.fromEntries(
        Array.from({ length: 200 }, (_, index) => [
          `state_${index}`,
          { final: true, title: `${label} title ${index}`, description: `${label} description ${index}` },
        ]),
      ),
    });
    const before = metadataMachine("before");
    const after = metadataMachine("after");
    const exact = diffMachines({ before, after });
    expect(exact).toMatchObject({ status: "different", truncated: false });
    if (exact.status === "different") expect(exact.changes).toHaveLength(500);

    after.title = "one extra change";
    const over = diffMachines({ before, after });
    expect(over).toMatchObject({ status: "different", truncated: true });
    if (over.status === "different") expect(over.changes).toHaveLength(500);
  });
});
