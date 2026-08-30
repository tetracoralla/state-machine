# Review contract

## Development regression

`npm run check` must typecheck both runtimes, run positive and adversarial core
tests, mechanically compare published schemas and tool names, build the CLI,
MCP server, browser app, and plugin, run browser interaction and responsive
regressions, install the packed project in an isolated consumer directory, and
validate the plugin and marketplace layout. Negative coverage includes static
assignment type mismatches, scalar path traversal, exact diff truncation,
single-event simulation near the cumulative JSON budget, and the shipped
topology overflowing its 1200px workspace. Responsive checks must also prove
that medium widths reflow before panels become cramped and that page, source,
and narrow-topology scrolling change the real scroll position.
Multi-step simulation must stop with `RESPONSE_TOO_LARGE` before repeated
snapshots amplify an otherwise valid request beyond the cumulative response
budget.
The release-hygiene gate must enumerate tracked and unignored candidate files
and reject credential patterns, machine-local absolute paths, dependency/build
directories, source maps, and package archives.

## Runtime Agent flow

Use the built stdio server. List tools and verify the six public names and
read-only annotations. Call `machine.step` for an allowed event, a missing
transition with an irrelevant invalid payload, a required guard without an
outcome, and a guard rejection. Call `machine.simulate` with a valid sequence
followed by a blocked event and with one event near the cumulative complexity
limit. Inputs above the declared limits and unknown fields must fail before
execution. The stdio transport must also close any raw protocol message above
320 KiB before the SDK's larger default buffer can accumulate it. The complete
six-tool catalog must remain at or below 36 KiB. Built CLI operation errors must
exit `1`; command and file usage errors must exit `2`.
Unknown, duplicate, missing-value, and out-of-range CLI options must fail as
usage errors rather than being ignored or reaching the kernel.

## Runtime human flow

Open the built app, edit the sample so validation changes, undo the edit, run an
allowed event, run a guarded event both rejected and accepted, inspect the trace
including resolved context changes and effect inputs, reload to confirm the
draft persists, and verify import/export or reset recovery. Invalid semantic
machines must expose path-operation failures rather than silently discarding
them. A malformed import must preserve the current draft, and unavailable local
storage must leave editing usable while showing the reload-loss risk. Inspect
narrow, medium, 1200px, and wide layouts. At medium widths the definition and
topology must reflow vertically; at narrow widths the readable topology may
scroll horizontally, while the document and source editor remain independently
operable.

## Source release

The GitHub-first release must include the repo marketplace and committed plugin
server, keep the Node package private, pass CI on supported Node versions, and
leave generated schemas and plugin artifacts clean after `npm run check`.
Source release does not establish installed-host activation.

## Business/experience acceptance

The owner decides whether the current topology, editing density, simulator
feedback, and overall visual quality fit repeated engineering use. Passing
commands and screenshots do not decide this lane.
