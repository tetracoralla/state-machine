import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PassThrough } from "node:stream";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";

import { largeContextMachine, largeResponseMachine } from "../fixtures.js";
import {
  createBoundedStdioTransport,
  MCP_TRANSPORT_MAX_BUFFER_BYTES,
} from "../../src/adapters/mcp.js";

const root = resolve(import.meta.dirname, "../..");
const pluginRoot = resolve(root, "plugins/state-machine");
const machine = parse(readFileSync(resolve(root, "examples/order.machine.yaml"), "utf8")) as Record<string, unknown>;

describe("built plugin MCP stdio runtime", () => {
  let client: Client;

  beforeEach(async () => {
    client = new Client({ name: "state-machine-runtime-test", version: "1.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [resolve(pluginRoot, "server/index.mjs")],
        cwd: pluginRoot,
        stderr: "pipe",
      }),
    );
  });

  afterEach(async () => {
    await client.close();
  });

  it("closes the stdio carrier before buffering an oversized raw protocol message", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const transport = createBoundedStdioTransport(input, output);
    const messages: unknown[] = [];
    let transportError: Error | undefined;
    transport.onmessage = (message) => messages.push(message);
    transport.onerror = (error) => {
      transportError = error;
    };
    await transport.start();

    input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
    input.write(`${" ".repeat(MCP_TRANSPORT_MAX_BUFFER_BYTES + 1)}{}\n`);
    await new Promise((resolve) => setImmediate(resolve));

    expect(transportError?.message).toContain("ReadBuffer exceeded maximum size");
    expect(transportError?.message).toContain(String(MCP_TRANSPORT_MAX_BUFFER_BYTES));
    expect(messages).toHaveLength(1);
  });

  it("publishes exactly six direct read-only tools with discoverable schemas", async () => {
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual([
      "machine.validate",
      "machine.step",
      "machine.simulate",
      "machine.find_path",
      "machine.inspect",
      "machine.diff",
    ]);
    expect(listed.tools.every((tool) => tool.inputSchema.type === "object")).toBe(true);
    expect(listed.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(listed.tools.every((tool) => tool.annotations?.idempotentHint === true)).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(listed))).toBeLessThanOrEqual(36 * 1024);
  });

  it("steps an allowed transition in one structured tool call", async () => {
    const called = await client.callTool({
      name: "machine.step",
      arguments: {
        machine,
        event: { type: "PAYMENT_SUCCESS", payload: { amount: 128, payment_id: "pay_1024" } },
        guard_results: { payment_amount_matches: true },
      },
    });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      status: "ok",
      accepted: true,
      after: { state: "paid" },
      effects: [{ type: "record_payment" }],
    });
  });

  it("returns blocked transitions as ordinary deterministic results", async () => {
    const called = await client.callTool({
      name: "machine.step",
      arguments: {
        machine,
        snapshot: { state: "shipped", context: { amount: 128, paid: true } },
        event: { type: "CANCEL" },
      },
    });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "NO_VALID_TRANSITION",
      enabled_events: ["DELIVER"],
    });
  });

  it("keeps missing transitions ordinary even when the irrelevant payload is invalid", async () => {
    const called = await client.callTool({
      name: "machine.step",
      arguments: {
        machine,
        snapshot: { state: "shipped", context: { amount: 128, paid: true } },
        event: { type: "PAYMENT_SUCCESS", payload: { amount: "bad" } },
      },
    });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({ status: "ok", accepted: false, reason: "NO_VALID_TRANSITION" });
  });

  it("requires explicit guard facts and preserves state when a guard rejects", async () => {
    const request = {
      machine,
      event: { type: "PAYMENT_SUCCESS", payload: { amount: 128, payment_id: "pay_1024" } },
    };
    const missing = await client.callTool({ name: "machine.step", arguments: request });
    const rejected = await client.callTool({
      name: "machine.step",
      arguments: { ...request, guard_results: { payment_amount_matches: false } },
    });

    expect(missing.structuredContent).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "GUARD_RESULT_REQUIRED",
      after: { state: "pending" },
    });
    expect(rejected.structuredContent).toMatchObject({
      status: "ok",
      accepted: false,
      reason: "GUARD_REJECTED",
      after: { state: "pending" },
      effects: [],
    });
  });

  it("simulates a valid sequence followed by a blocked event", async () => {
    const called = await client.callTool({
      name: "machine.simulate",
      arguments: {
        machine,
        events: [
          {
            event: { type: "PAYMENT_SUCCESS", payload: { amount: 128, payment_id: "pay_1024" } },
            guard_results: { payment_amount_matches: true },
          },
          { event: { type: "START_FULFILLMENT" } },
          { event: { type: "SHIP" } },
          { event: { type: "CANCEL" } },
        ],
      },
    });

    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      status: "ok",
      accepted: false,
      final: { state: "shipped" },
      stopped_at: 3,
    });
  });

  it("simulates one event near the cumulative complexity limit", async () => {
    const called = await client.callTool({
      name: "machine.simulate",
      arguments: { machine: largeContextMachine(), events: [{ event: { type: "GO" } }] },
    });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({ status: "ok", accepted: true, final: { state: "done" } });
  });

  it("lets machine.validate report malformed candidates structurally", async () => {
    const called = await client.callTool({
      name: "machine.validate",
      arguments: { machine: { version: "0.1", id: "broken" } },
    });
    expect(called.isError).not.toBe(true);
    expect(called.structuredContent).toMatchObject({
      status: "invalid",
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "SCHEMA_INVALID" })]),
    });
  });

  it("rejects misspelled top-level request fields before execution", async () => {
    const called = await client.callTool({
      name: "machine.step",
      arguments: { machine, evnt: { type: "CANCEL" } },
    });
    expect(called.isError).toBe(true);
  });

  it("rejects an over-byte-limit request before validation executes", async () => {
    const oversizedMachine = Object.fromEntries(
      Array.from({ length: 1_500 }, (_, index) => [`field_${index}_${"x".repeat(190)}`, false]),
    );
    const called = await client.callTool({
      name: "machine.validate",
      arguments: { machine: oversizedMachine },
    });

    expect(called.isError).toBe(true);
    expect(called.structuredContent).toMatchObject({ status: "error", error: { code: "REQUEST_TOO_LARGE" } });
  });

  it("replaces an oversized structured result with a bounded operation error", async () => {
    const called = await client.callTool({
      name: "machine.step",
      arguments: { machine: largeResponseMachine(), event: { type: "GO" } },
    });

    expect(called.isError).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(called))).toBeLessThanOrEqual(256 * 1024);
    expect(called.structuredContent).toMatchObject({ status: "error", error: { code: "RESPONSE_TOO_LARGE" } });
  });
});
