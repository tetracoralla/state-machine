# Machine Spec v0.1

A Machine Spec is the complete executable definition of one finite-state
workflow. It is JSON-compatible data and may be written as JSON or YAML.

## Machine

| Field | Meaning |
| --- | --- |
| `version` | exactly `"0.1"` |
| `id` | stable machine identifier |
| `title` | optional human label |
| `initial` | id of the starting state |
| `context` | optional field schema and initial JSON object |
| `events` | declared event names and payload fields |
| `guards` | declared symbolic guard names |
| `states` | state definitions keyed by id |

Identifiers start with a letter and contain letters, digits, underscores, or
hyphens. Unknown fields are rejected.

## Fields

A context or event field declares `type`, optional `description`, and optional
`required`. Required defaults to `true`. Types are `string`, `number`,
`integer`, `boolean`, `object`, and `array`. Runtime snapshots and payloads are
closed-world: undeclared fields are errors.

## States and transitions

Each state may contain a human `title`, `description`, `final: true`, and an
`on` map. A final state cannot have outgoing transitions.

An `on` key is a declared event name. Its value has:

- `target`: a declared state id;
- `guard`: an optional declared guard name;
- `assign`: optional context-field assignments;
- `effects`: optional symbolic effect intents.

One state/event pair owns one transition in v0.1. Missing transitions are
ordinary `NO_VALID_TRANSITION` rejections. Once the event name is known to the
machine, payload and guard data that would only matter to an absent transition
are not evaluated.

## Guards

The kernel never evaluates guard expressions. If a transition names a guard,
the caller supplies that guard's boolean outcome with the step or simulation
event. Missing outcomes produce `GUARD_RESULT_REQUIRED`; `false` produces
`GUARD_REJECTED`. Neither rejection changes the snapshot or emits effects.

## Value sources

Assignments and effect inputs use a tagged value source:

```yaml
paid:
  kind: literal
  value: true

payment_id:
  kind: event
  path: payment_id

order_amount:
  kind: context
  path: amount
```

Paths are dot-delimited property paths. Reserved prototype segments are
rejected. Paths cannot traverse a declared scalar or array field. Assignment
sources whose types are statically known must match the target context field
(`integer` may be assigned to `number`). A missing runtime value is an error;
it is not coerced to `null`.

## Effects

An effect is data returned with an accepted transition:

```yaml
effects:
  - type: record_payment
    input:
      payment_id:
        kind: event
        path: payment_id
```

The kernel, CLI, MCP server, and browser simulator do not execute the effect.
An owning host may separately bind a reviewed executor under its own
authorization and transaction boundary.

## Limits

The executable limits live in `src/model/schemas.ts` and are returned by
`machine.inspect`. v0.1 bounds complete requests and responses, states, events,
guards, transitions, simulation length, path depth, fields, assignments,
effects, diagnostics, diff entries, JSON depth, JSON node count, and string
length.
