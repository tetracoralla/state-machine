# State Machine

State Machine turns a finite business workflow into executable data. Given one
Machine Spec, a snapshot, and an event, it deterministically accepts or rejects
the transition, returns the next snapshot, and emits symbolic effect intents.
It never executes those effects.

The repository includes one shared TypeScript core, a CLI, six read-only MCP
tools in a Codex plugin, and a browser editor/simulator.

## Run the editor

```bash
npm install --legacy-peer-deps
npm run build
npm run start:ui
```

Open `http://127.0.0.1:4317`. The workspace ships with an order lifecycle
example. Edit the YAML definition, inspect validation and topology, choose
explicit guard outcomes, run events, inspect the trace and effect intents, find
a route to a target state, and import or export the spec.

For development with live reload:

```bash
npm run dev:ui
```

## Use the CLI

```bash
npm run build

node dist/node/adapters/cli.js validate examples/order.machine.yaml --pretty

node dist/node/adapters/cli.js step examples/order.machine.yaml \
  --event '{"type":"PAYMENT_SUCCESS","payload":{"amount":128,"payment_id":"pay_1024"}}' \
  --guards '{"payment_amount_matches":true}' \
  --pretty

node dist/node/adapters/cli.js simulate \
  examples/order.machine.yaml \
  examples/order.events.yaml \
  --pretty

node dist/node/adapters/cli.js path \
  examples/order.machine.yaml \
  completed \
  --pretty
```

The CLI also supports `inspect` and `diff`. Run it without arguments for the
complete command summary. Exit code `0` means the operation completed, including
ordinary transition rejections and unreachable paths. Exit code `1` means the
machine or operation result is invalid; exit code `2` is reserved for command,
file, or JSON usage errors. Every outcome is still emitted as JSON.

## Use the Agent tools

The built plugin is `plugins/state-machine`. It contains the bundled stdio MCP
server, manifest, and `use-state-machine` Skill. Add that directory to a local
plugin marketplace using the current Codex development flow, refresh Codex, and
test it in a new task. This repository does not modify a personal marketplace or
install itself automatically. See the current [OpenAI plugin development guide](https://learn.chatgpt.com/docs/build-plugins).

Public tools:

| Tool | Result |
| --- | --- |
| `machine.validate` | strict structure and semantic graph diagnostics |
| `machine.step` | one accepted or rejected event with next snapshot and effects |
| `machine.simulate` | bounded event trace and final snapshot |
| `machine.find_path` | shortest structural route and required guard names |
| `machine.inspect` | compact states, events, transitions, statistics, and limits |
| `machine.diff` | bounded semantic changes between two valid specs |

All tools accept inline data, make no external changes, and publish strict input
schemas. Results are checked against the executable output schemas before they
leave the server. The six-tool discovery catalog is capped at 36 KiB by the
runtime contract. A normal request should use one direct tool call.

## Machine Spec

The canonical format is YAML or JSON with `version: "0.1"`, an `initial` state,
declared context and event fields, named guards, and a state map. Each state/event
pair owns at most one transition. Context assignment uses only tagged `literal`,
`event`, or `context` value sources. Effects contain only a symbolic `type` and
input value sources.

See [Machine Spec v0.1](docs/MACHINE_SPEC.md), the generated
[`machine-spec.schema.json`](schemas/machine-spec.schema.json), and the shipped
[`order.machine.yaml`](examples/order.machine.yaml).

## Verify the project

```bash
npm run check
```

This runs type checks, core tests, schema drift checks, all builds, built CLI and
MCP stdio tests, browser interaction and responsive regressions, and
plugin/contract checks. Overall visual and business acceptance remains the
owner's rendered-runtime judgment; its current route is recorded in
[`docs/REVIEW_CONTRACT.md`](docs/REVIEW_CONTRACT.md).

## Boundary

v0.1 intentionally excludes hierarchical, parallel, history, delayed, actor,
and eventless statechart semantics. It also excludes expression evaluation,
effect execution, production orchestration, AI-generated business rules, and
XState/SCXML compatibility claims. The current product boundary is maintained in
[`docs/PRODUCT_MODEL.md`](docs/PRODUCT_MODEL.md).
