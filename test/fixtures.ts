import type { MachineSpec } from "../src/model/types.js";

export function orderMachine(): MachineSpec {
  return {
    version: "0.1",
    id: "order-lifecycle",
    title: "Order lifecycle",
    initial: "pending",
    context: {
      schema: {
        amount: { type: "number" },
        paid: { type: "boolean" },
        payment_id: { type: "string", required: false },
      },
      initial: { amount: 128, paid: false },
    },
    events: {
      PAYMENT_SUCCESS: {
        fields: {
          amount: { type: "number" },
          payment_id: { type: "string" },
        },
      },
      START_FULFILLMENT: {},
      CANCEL: {},
      SHIP: {},
      DELIVER: {},
    },
    guards: {
      payment_amount_matches: { description: "The amount matches." },
      cancellation_allowed: { description: "Cancellation policy passed." },
    },
    states: {
      pending: {
        on: {
          PAYMENT_SUCCESS: {
            target: "paid",
            guard: "payment_amount_matches",
            assign: {
              paid: { kind: "literal", value: true },
              payment_id: { kind: "event", path: "payment_id" },
            },
            effects: [
              {
                type: "record_payment",
                input: { payment_id: { kind: "event", path: "payment_id" } },
              },
            ],
          },
          CANCEL: { target: "cancelled" },
        },
      },
      paid: {
        on: {
          START_FULFILLMENT: { target: "fulfilling" },
          CANCEL: { target: "cancelled", guard: "cancellation_allowed" },
        },
      },
      fulfilling: { on: { SHIP: { target: "shipped" } } },
      shipped: { on: { DELIVER: { target: "completed" } } },
      cancelled: { final: true },
      completed: { final: true },
    },
  };
}

export const paymentEvent = {
  type: "PAYMENT_SUCCESS",
  payload: { amount: 128, payment_id: "pay_1024" },
};

export function largeContextMachine(): MachineSpec {
  const data = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [`batch_${index}`, Array.from({ length: 950 }, () => 0)]));
  return {
    version: "0.1",
    id: "large-context",
    initial: "pending",
    context: { schema: { data: { type: "object" } }, initial: { data } },
    events: { GO: {} },
    states: { pending: { on: { GO: { target: "done" } } }, done: { final: true } },
  };
}

export function largeResponseMachine(): MachineSpec {
  const data = Object.fromEntries(
    Array.from({ length: 14 }, (_, index) => [`part_${index}`, "x".repeat(16_000)]),
  );
  return {
    version: "0.1",
    id: "large-response",
    initial: "active",
    context: { schema: { data: { type: "object" } }, initial: { data } },
    events: { GO: {} },
    states: { active: { on: { GO: { target: "active" } } } },
  };
}
