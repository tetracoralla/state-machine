#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { diffMachines, findPath, inspectMachine, simulateMachine, stepMachine, validateMachine } from "../index.js";
import { MODEL_LIMITS } from "../model/schemas.js";
import { readSourceFile } from "./source.js";

const HELP = `Step Switch 0.1

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
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

const COMMAND_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  validate: ["--pretty"],
  inspect: ["--pretty"],
  step: ["--event", "--snapshot", "--guards", "--pretty"],
  simulate: ["--continue", "--pretty"],
  path: ["--from", "--max-depth", "--pretty"],
  diff: ["--pretty"],
};

const VALUE_OPTIONS = new Set(["--event", "--snapshot", "--guards", "--from", "--max-depth"]);
const POSITIONAL_COUNTS: Readonly<Record<string, number>> = {
  validate: 1,
  inspect: 1,
  step: 1,
  simulate: 2,
  path: 2,
  diff: 2,
};

function validateArguments(args: string[], command: string): string[] {
  const allowed = COMMAND_OPTIONS[command];
  if (!allowed) throw new Error(`Unknown command '${command}'.`);
  const seen = new Set<string>();
  const positionals: string[] = [];
  for (let index = 1; index < args.length; index += 1) {
    const token = args[index];
    if (!token) continue;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    if (!allowed.includes(token)) throw new Error(`Unknown option '${token}' for '${command}'.`);
    if (seen.has(token)) throw new Error(`Option '${token}' may only be provided once.`);
    seen.add(token);
    if (VALUE_OPTIONS.has(token)) {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) throw new Error(`${token} requires a value.`);
      index += 1;
    }
  }
  const expected = POSITIONAL_COUNTS[command];
  if (expected === undefined || positionals.length !== expected) {
    throw new Error(`Command '${command}' requires exactly ${expected ?? 0} positional argument${expected === 1 ? "" : "s"}.`);
  }
  return positionals;
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

function boundedOutput(value: unknown, pretty: boolean): unknown {
  const serialized = JSON.stringify(value, null, pretty ? 2 : undefined);
  if (Buffer.byteLength(serialized) + 1 <= MODEL_LIMITS.maxResponseBytes) return value;
  return {
    status: "error",
    error: { code: "RESPONSE_TOO_LARGE", message: "Result exceeds the complete response byte limit." },
  };
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
    const positionals = validateArguments(args, command);
    let result: unknown;
    if (command === "validate") result = validateMachine(requireMachine(positionals[0]));
    else if (command === "inspect") result = inspectMachine(requireMachine(positionals[0]));
    else if (command === "step") {
      const event = parseJsonOption(option(args, "--event"), "--event");
      if (event === undefined) throw new Error("--event is required.");
      const snapshot = parseJsonOption(option(args, "--snapshot"), "--snapshot");
      const guards = parseJsonOption(option(args, "--guards"), "--guards");
      result = stepMachine({
        machine: requireMachine(positionals[0]),
        event,
        ...(snapshot !== undefined ? { snapshot } : {}),
        ...(guards !== undefined ? { guard_results: guards } : {}),
      });
    } else if (command === "simulate") {
      const eventsSource = readSourceFile(positionals[1] as string);
      if (!eventsSource.ok) throw new Error(`${eventsSource.error.code}: ${eventsSource.error.message}`);
      const eventsValue = eventsSource.value;
      const events = Array.isArray(eventsValue)
        ? eventsValue
        : eventsValue !== null && typeof eventsValue === "object"
          ? (eventsValue as { events?: unknown }).events
          : undefined;
      if (!Array.isArray(events)) {
        throw new Error("Events file must be a YAML/JSON array of events or an object with an events array.");
      }
      result = simulateMachine({
        machine: requireMachine(positionals[0]),
        events,
        stop_on_rejection: !args.includes("--continue"),
      });
    } else if (command === "path") {
      const rawDepth = option(args, "--max-depth");
      let maxDepth: number | undefined;
      if (rawDepth !== undefined) {
        maxDepth = Number(rawDepth);
        if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > MODEL_LIMITS.maxPathDepth) {
          throw new Error(`--max-depth must be an integer from 0 to ${MODEL_LIMITS.maxPathDepth}.`);
        }
      }
      const from = option(args, "--from");
      result = findPath({
        machine: requireMachine(positionals[0]),
        target: positionals[1] as string,
        ...(from !== undefined ? { from } : {}),
        ...(maxDepth !== undefined ? { max_depth: maxDepth } : {}),
      });
    } else if (command === "diff") {
      result = diffMachines({ before: requireMachine(positionals[0]), after: requireMachine(positionals[1]) });
    }
    const output = boundedOutput(result, pretty);
    emit(output, pretty);
    return operationExitCode(output);
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
