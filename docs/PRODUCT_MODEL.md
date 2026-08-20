# Product model

## The product object

The product edits and runs one finite-state `Machine Spec`: named states,
events, symbolic guards, pure context assignments, and symbolic effect intents.
The spec is executable data, not JavaScript or an orchestration script.

The human user is an engineer or domain owner turning a bounded workflow into a
reviewable YAML/JSON definition. They edit the source, see its topology, validate
it, simulate allowed and blocked events, inspect emitted effects, find a route
to a target state, and import or export the spec.

The Agent user already has a machine and current snapshot. It needs software to
answer “is this event legal now?”, “what state and context result?”, “what
effects would be requested?”, “what happens across this sequence?”, or “how can
this state be reached?” without model judgment.

## Human flow

The single workspace has three linked carriers:

- the source editor owns the complete canonical YAML/JSON definition;
- the topology view shows states and transitions and follows the selected or
  simulated state;
- the simulator shows the current snapshot, structurally enabled events, guard
  outcomes, transition trace, context changes, and symbolic effects.

Validation stays next to the source object. Import replaces the draft only after
the selected file parses. Export downloads the current valid spec. A local draft
is restored on reload; reset returns to the shipped order-flow example. Source
history supports undo and redo during the session.

## Shared deterministic core

Every surface calls the same operations:

- `validateMachine` checks structure and semantic graph properties;
- `stepMachine` performs one pure transition;
- `simulateMachine` runs a bounded event sequence and records every step;
- `findPath` returns a shortest structural event path and named guard needs;
- `reachableStates` computes structural reachability;
- `inspectMachine` returns compact states, events, transitions, and limits;
- `diffMachines` reports semantic changes by stable machine paths.

The first release supports finite states, one initial state, final states, named
events, named guards, explicit event/context value selection, symbolic effects,
validation, simulation, reachability, shortest path, inspection, and semantic
diff.

## Agent contract and route budget

The MCP server exposes six direct read-only tools: `machine.validate`,
`machine.step`, `machine.simulate`, `machine.find_path`, `machine.inspect`, and
`machine.diff`. A normal supported request should use one tool call. Invalid
input returns one stable error; the Agent must not repair meaning by guessing.
The discovery response publishes strict input shapes within a 36 KiB catalog
budget; every result is still checked against its executable output schema.

Machine data is inline. This avoids granting the plugin ambient file authority.
The CLI accepts explicit human-selected paths and uses the same core.

## Composition boundary

The state machine owns `state + event -> transition` only. A transition may name
a guard, but the caller supplies the evaluated boolean. A transition may emit an
effect intent, but the kernel never executes it. Context updates can copy a
declared event/context value or use an explicit JSON literal; they cannot run an
expression.

Decision Table may evaluate business conditions before a guarded step.
Equatorium may evaluate a standardized expression before the caller prepares an
event or guard result. Data Transformer may prepare event payloads or effect
inputs. None is embedded or reimplemented here.

## Explicit non-goals for v0.1

- hierarchical, parallel, history, eventless, delayed, or actor states;
- arbitrary expressions, callbacks, scripts, regular expressions, or codegen;
- executing effects, calling APIs, or mutating production systems;
- BPMN/SCXML/XState compatibility claims;
- AI generation or review of business rules;
- collaboration, hosted registries, accounts, or publishing workflows.
