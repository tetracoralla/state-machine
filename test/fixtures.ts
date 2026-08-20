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

