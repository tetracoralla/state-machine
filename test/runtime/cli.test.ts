import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const cli = resolve(root, "dist/node/adapters/cli.js");

function run(args: string[]): unknown {
  return JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" })) as unknown;
}

describe("built CLI", () => {
  it("validates and steps the shipped machine", () => {
    expect(run(["validate", "examples/order.machine.yaml"])).toMatchObject({ status: "valid", machine_id: "order-lifecycle" });
    expect(
      run([
        "step",
        "examples/order.machine.yaml",
        "--event",
        JSON.stringify({ type: "PAYMENT_SUCCESS", payload: { amount: 128, payment_id: "pay_1024" } }),
        "--guards",
        JSON.stringify({ payment_amount_matches: true }),
      ]),
    ).toMatchObject({ status: "ok", accepted: true, after: { state: "paid" } });
  });

  it("simulates the blocked shipped-to-cancelled sequence", () => {
    expect(run(["simulate", "examples/order.machine.yaml", "examples/order.events.yaml"])).toMatchObject({
      status: "ok",
      accepted: false,
      final: { state: "shipped" },
      stopped_at: 3,
    });
  });

  it("uses exit code 1 for a well-formed operation error", () => {
    const executed = spawnSync(
      process.execPath,
      [
        cli,
        "step",
        "examples/order.machine.yaml",
        "--event",
        JSON.stringify({ type: "PAYMENT_SUCCESS", payload: { amount: "bad", payment_id: "pay_1024" } }),
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(executed.status).toBe(1);
    expect(JSON.parse(executed.stdout)).toMatchObject({ status: "error", error: { code: "EVENT_PAYLOAD_INVALID" } });
  });
});
