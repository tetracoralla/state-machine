#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import type * as z from "zod/v4";

import { diffMachines, findPath, inspectMachine, simulateMachine, stepMachine, validateMachine } from "../index.js";
import { SERVER_VERSION } from "../model/version.js";
import {
  DiffRequestSchema,
  DiffResultSchema,
  InspectRequestSchema,
  InspectResultSchema,
  MODEL_LIMITS,
  PathRequestSchema,
  PathResultSchema,
  SimulationRequestSchema,
  SimulationResultSchema,
  StepRequestSchema,
  StepResultSchema,
  ValidationRequestSchema,
  ValidationResultSchema,
} from "../model/schemas.js";
import type { OperationError } from "../model/types.js";
import {
  presentDiff,
  presentInspect,
  presentPath,
  presentSimulation,
  presentStep,
  presentValidation,
} from "../presentation.js";

export const TOOL_NAMES = [
  "machine.validate",
  "machine.step",
  "machine.simulate",
  "machine.find_path",
  "machine.inspect",
  "machine.diff",
] as const;

function requestWithinLimit(input: unknown): boolean {
  return Buffer.byteLength(JSON.stringify(input)) <= MODEL_LIMITS.maxRequestBytes;
}

function toolError(code: string, message: string) {
  const payload: OperationError = { status: "error", error: { code, message } };
  return {
    content: [{ type: "text" as const, text: `${code}: ${message}` }],
    structuredContent: payload as unknown as Record<string, unknown>,
    isError: true,
  };
}

function respond(result: object, summary: string, outputSchema: z.ZodType) {
  if (!outputSchema.safeParse(result).success) {
    return toolError("INTERNAL_OUTPUT_INVALID", "Tool result failed its executable output contract.");
  }
  const serialized = JSON.stringify(result);
  if (Buffer.byteLength(serialized) > MODEL_LIMITS.maxResponseBytes) {
    return toolError("RESPONSE_TOO_LARGE", "Result exceeds the complete response byte limit.");
  }
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent: result as Record<string, unknown>,
    ...("status" in result && result.status === "error" ? { isError: true } : {}),
  };
}

const annotations = {
  readOnlyHint: true,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "state-machine", version: SERVER_VERSION },
    {
      instructions:
        "Use machine.step for one current-state event, machine.simulate for an event sequence, machine.find_path for a shortest structural route, machine.validate after authoring or changing a spec, machine.inspect for compact topology, and machine.diff for semantic changes. Guard outcomes must come from explicit facts or an owning rules tool. Effects are intents only and are never executed by this server.",
    },
  );

  server.registerTool(
    TOOL_NAMES[0],
    {
      title: "Validate state machine",
      description: "Validate an inline finite-state Machine Spec for strict structure, references, reachability, dead ends, and final-state paths.",
      inputSchema: ValidationRequestSchema,
      annotations,
    },
    async ({ machine }) => {
      if (!requestWithinLimit({ machine })) return toolError("REQUEST_TOO_LARGE", "Request exceeds the byte limit.");
      const result = validateMachine(machine);
      return respond(result, presentValidation(result), ValidationResultSchema);
    },
  );

  server.registerTool(
    TOOL_NAMES[1],
    {
      title: "Step state machine",
      description: "Deterministically apply one declared event to an inline machine and snapshot; returns acceptance, next snapshot, guard trace, context changes, and symbolic effects.",
      inputSchema: StepRequestSchema,
      annotations,
    },
    async (request) => {
      if (!requestWithinLimit(request)) return toolError("REQUEST_TOO_LARGE", "Request exceeds the byte limit.");
      const result = stepMachine(request);
      return respond(result, presentStep(result), StepResultSchema);
    },
  );

  server.registerTool(
    TOOL_NAMES[2],
    {
      title: "Simulate state machine",
      description: "Run a bounded sequence of declared events without side effects; returns every accepted or rejected step and the final snapshot.",
      inputSchema: SimulationRequestSchema,
      annotations,
    },
    async (request) => {
      if (!requestWithinLimit(request)) return toolError("REQUEST_TOO_LARGE", "Request exceeds the byte limit.");
      const result = simulateMachine(request);
      return respond(result, presentSimulation(result), SimulationResultSchema);
    },
  );

  server.registerTool(
    TOOL_NAMES[3],
    {
      title: "Find state path",
      description: "Find a shortest structural event path between two states and report every named guard that the caller must evaluate.",
      inputSchema: PathRequestSchema,
      annotations,
    },
    async (request) => {
      if (!requestWithinLimit(request)) return toolError("REQUEST_TOO_LARGE", "Request exceeds the byte limit.");
      const result = findPath(request);
      return respond(result, presentPath(result), PathResultSchema);
    },
  );

  server.registerTool(
    TOOL_NAMES[4],
    {
      title: "Inspect state machine",
      description: "Return a compact deterministic inventory of states, events, guards, transitions, statistics, and execution limits.",
      inputSchema: InspectRequestSchema,
      annotations,
    },
    async ({ machine }) => {
      if (!requestWithinLimit({ machine })) return toolError("REQUEST_TOO_LARGE", "Request exceeds the byte limit.");
      const result = inspectMachine(machine);
      return respond(result, presentInspect(result), InspectResultSchema);
    },
  );

  server.registerTool(
    TOOL_NAMES[5],
    {
      title: "Diff state machines",
      description: "Compare two valid inline Machine Specs and return bounded semantic changes by stable data path.",
      inputSchema: DiffRequestSchema,
      annotations,
    },
    async (request) => {
      if (!requestWithinLimit(request)) return toolError("REQUEST_TOO_LARGE", "Request exceeds the byte limit.");
      const result = diffMachines(request);
      return respond(result, presentDiff(result), DiffResultSchema);
    },
  );

  return server;
}

function isDirectEntry(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectEntry()) {
  void serveStdio(createServer);
  console.error("state-machine MCP server running on stdio");
}
