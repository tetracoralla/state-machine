# Review contract

## Development regression

`npm run check` must typecheck both runtimes, run positive and adversarial core
tests, mechanically compare published schemas and tool names, build the CLI,
MCP server, browser app, and plugin, run browser interaction and responsive
regressions, and validate the plugin layout. Negative coverage includes static
assignment type mismatches, scalar path traversal, exact diff truncation, and
single-event simulation near the cumulative JSON budget.

## Runtime Agent flow

Use the built stdio server. List tools and verify the six public names and
read-only annotations. Call `machine.step` for an allowed event, a missing
transition with an irrelevant invalid payload, a required guard without an
outcome, and a guard rejection. Call `machine.simulate` with a valid sequence
followed by a blocked event and with one event near the cumulative complexity
limit. Inputs above the declared limits and unknown fields must fail before
execution. The complete six-tool catalog must remain at or below 36 KiB. Built
CLI operation errors must exit `1`; command and file usage errors must exit `2`.

## Runtime human flow

Open the built app, edit the sample so validation changes, undo the edit, run an
allowed event, run a guarded event both rejected and accepted, inspect the trace
including resolved context changes and effect inputs, reload to confirm the
draft persists, and verify import/export or reset recovery. Invalid semantic
machines must expose path-operation failures rather than silently discarding
them. Inspect narrow, medium, and wide layouts.

## Business/experience acceptance

The owner decides whether the current topology, editing density, simulator
feedback, and overall visual quality fit repeated engineering use. Passing
commands and screenshots do not decide this lane.
