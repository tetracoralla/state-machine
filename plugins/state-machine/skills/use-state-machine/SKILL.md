---
name: use-state-machine
description: Use the Step Switch tools for concrete finite-state Machine Specs when an event must be accepted or rejected deterministically, a sequence should be simulated without side effects, a path to a state is needed, or a machine needs validation, inspection, or semantic comparison. Do not use for open-ended workflow design or to execute returned effects.
---

# Use Step Switch

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
