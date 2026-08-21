# Step Switch repository contract

## Product boundary

This repository owns a deterministic finite-state transition kernel and two
thin surfaces: a technical human editor/simulator and read-only Agent tools. It
does not own production workflow orchestration, arbitrary expression
evaluation, policy judgment, external side effects, or a complete statechart
runtime.

The canonical product model is `docs/PRODUCT_MODEL.md`. Executable Zod schemas
in `src/model/schemas.ts` own the runtime, CLI, MCP, examples, UI, and published
schema contract.

## Invariants

- `step` is a pure function of machine, snapshot, event, and explicit guard
  outcomes. The kernel never executes user code or external effects.
- Effects are symbolic intents. Simulation returns them; a host decides whether
  a separately authorized executor may act on them.
- Guards are named symbols. The caller supplies their boolean outcomes; the
  kernel does not recreate the Decision Table or expression interpreter.
- Context assignment uses the tagged `literal`, `event`, and `context` value
  sources only. Reject unknown fields and unsafe prototype-path segments.
- One state/event pair owns at most one transition in v0.1. An absent
  transition is an ordinary deterministic rejection, not an inferred action.
- Final states cannot have outgoing transitions. Every target, event, and guard
  reference must exist.
- MCP tools accept inline data only and are read-only, idempotent, bounded, and
  closed-world. Do not add ambient filesystem access.
- Apply request-wide state, transition, event-sequence, depth, byte, and
  response limits cumulatively.

## Validation lanes

Run `npm run check` for development regression. Separately exercise the built
CLI, MCP stdio transport, and browser editor/simulator before claiming those
runtime surfaces work. Business/experience acceptance remains the owner's
judgment after opening the current interface.

Do not commit automatically.
