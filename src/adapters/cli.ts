#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { diffMachines, findPath, inspectMachine, simulateMachine, stepMachine, validateMachine } from "../index.js";
import { readSourceFile } from "./source.js";

const HELP = `State Machine 0.1

Usage:
  state-machine validate <machine.yaml>
  state-machine inspect <machine.yaml>
  state-machine step <machine.yaml> --event '<json>' [--snapshot '<json>'] [--guards '<json>']
  state-machine simulate <machine.yaml> <events.yaml> [--continue]
  state-machine path <machine.yaml> <target> [--from <state>] [--max-depth <number>]
  state-machine diff <before.yaml> <after.yaml>

Options:
  --pretty     Indent JSON output
  --help       Show this help
`;

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseJsonOption(raw: string | undefined, label: string): unknown {
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON.`);
  }
}

function requireMachine(path: string | undefined): unknown {
  if (!path) throw new Error("A machine file is required.");
  const source = readSourceFile(path);
  if (!source.ok) throw new Error(`${source.error.code}: ${source.error.message}`);
  return source.value;
}

function emit(value: unknown, pretty: boolean): void {
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`);
}

function operationExitCode(value: unknown): number {
  if (value === null || typeof value !== "object" || !("status" in value)) return 0;
  return value.status === "error" || value.status === "invalid" ? 1 : 0;
}

export function runCli(argv: string[]): number {
  const args = argv.slice(2);
  const command = args[0];
  if (!command || command === "--help" || command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  const pretty = args.includes("--pretty");
  try {
    let result: unknown;
    if (command === "validate") result = validateMachine(requireMachine(args[1]));
    else if (command === "inspect") result = inspectMachine(requireMachine(args[1]));
    else if (command === "step") {
      const event = parseJsonOption(option(args, "--event"), "--event");
      if (!event) throw new Error("--event is required.");
      const snapshot = parseJsonOption(option(args, "--snapshot"), "--snapshot");
      const guards = parseJsonOption(option(args, "--guards"), "--guards");
      result = stepMachine({
        machine: requireMachine(args[1]),
        event,
        ...(snapshot ? { snapshot } : {}),
        ...(guards ? { guard_results: guards } : {}),
      });
    } else if (command === "simulate") {
      if (!args[2]) throw new Error("An events file is required.");
      const eventsSource = readSourceFile(args[2]);
      if (!eventsSource.ok) throw new Error(`${eventsSource.error.code}: ${eventsSource.error.message}`);
      const events = Array.isArray(eventsSource.value)
        ? eventsSource.value
        : (eventsSource.value as { events?: unknown }).events;
      result = simulateMachine({
        machine: requireMachine(args[1]),
        events,
        stop_on_rejection: !args.includes("--continue"),
      });
    } else if (command === "path") {
      if (!args[2]) throw new Error("A target state is required.");
      const rawDepth = option(args, "--max-depth");
      result = findPath({
        machine: requireMachine(args[1]),
        target: args[2],
        ...(option(args, "--from") ? { from: option(args, "--from") } : {}),
        ...(rawDepth ? { max_depth: Number(rawDepth) } : {}),
      });
    } else if (command === "diff") {
      result = diffMachines({ before: requireMachine(args[1]), after: requireMachine(args[2]) });
    } else {
      throw new Error(`Unknown command '${command}'.`);
    }
    emit(result, pretty);
    return operationExitCode(result);
  } catch (error) {
    emit({ status: "error", error: { code: "CLI_USAGE_ERROR", message: error instanceof Error ? error.message : "CLI failed." } }, pretty);
    return 2;
  }
}

function isDirectEntry(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectEntry()) process.exitCode = runCli(process.argv);
