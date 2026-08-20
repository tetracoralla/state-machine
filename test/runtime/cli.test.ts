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

  it("uses exit code 2 for missing option values and invalid path-depth syntax", () => {
    for (const args of [
      ["step", "examples/order.machine.yaml", "--event", JSON.stringify({ type: "CANCEL" }), "--snapshot"],
      ["path", "examples/order.machine.yaml", "completed", "--max-depth"],
      ["path", "examples/order.machine.yaml", "completed", "--max-depth", "1.5"],
      ["path", "examples/order.machine.yaml", "completed", "--max-depth", "101"],
      ["step", "examples/order.machine.yaml", "--event", JSON.stringify({ type: "CANCEL" }), "--gaurds", "{}"],
      ["step", "examples/order.machine.yaml", "--event", JSON.stringify({ type: "CANCEL" }), "--event", JSON.stringify({ type: "CANCEL" })],
    ]) {
      const executed = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
      expect(executed.status).toBe(2);
      expect(JSON.parse(executed.stdout)).toMatchObject({ status: "error", error: { code: "CLI_USAGE_ERROR" } });
    }
  });
});
