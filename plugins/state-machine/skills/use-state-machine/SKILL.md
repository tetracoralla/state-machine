---
name: use-state-machine
description: Use Step Switch for concrete state and event reasoning, including while implementing or debugging retries, cancellation, recovery, and other finite-state behavior. Validate or simulate a Machine Spec derived from accepted requirements, decide whether an event is legal, find a path, or compare changed behavior. The kernel does not design an open-ended workflow or execute effects.
---

# Use Step Switch

When a construction task involves interacting states, first reuse its existing
machine or derive a small concrete spec from the accepted behavior. Keep the
source requirements and unresolved choices alongside it; a guessed transition
is not a requirement. Use the result to choose or repair the implementation,
then inspect the real interaction and recovery. A valid spec or successful
simulation proves only the modeled behavior, not the completeness, visual
quality, persistence, or actual effects of the product. Do not shrink the task
to what this finite-state model supports. Skip modeling when it would add more
work than it removes.

Call the operation that answers the user's task directly:

- `machine.step` for one event against the current snapshot;
- `machine.simulate` for an ordered event sequence;
- `machine.find_path` for a shortest structural route to a target state;
- `machine.validate` after a Machine Spec is created or changed;
- `machine.inspect` for a compact topology inventory;
- `machine.diff` to compare two valid specs.

Use one tool call for an ordinary supported request. Do not list or inspect the
machine first when the requested operation already has the required input.

Treat named guards as unresolved until their boolean outcomes come from explicit
facts, an owning rules tool, or the user. Do not infer a favorable guard result.
Returned effects are symbolic intents only; never claim this plugin executed an
external action. Present rejected transitions with their stable reason and the
structurally enabled events. Do not retry invalid input by guessing changed
semantics.
