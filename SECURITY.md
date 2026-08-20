# Security

State Machine treats Machine Specs, snapshots, events, and guard outcomes as
untrusted data.

- The core never evaluates JavaScript, expressions, callbacks, or regular
  expressions supplied by a caller.
- Value lookup is limited to validated property paths and blocks prototype
  segments.
- Effects are returned as symbolic data and are never executed.
- MCP tools accept inline data only and have no filesystem, network, credential,
  or external mutation authority.
- Request and response bytes, graph size, event sequences, JSON shape, path
  depth, diagnostics, and diffs are bounded.
- The browser server serves only built files below its fixed distribution root
  and rejects traversal.

Do not put credentials in a Machine Spec, event, context, guard result, or
effect intent. A host that executes an effect is a separate security boundary
and must validate current authorization, trusted facts, idempotency, and the
exact pending action itself.

For private vulnerability reporting, contact the repository owner through the
private security-reporting route on the eventual source host. Do not publish
exploit details in a public issue before a private route is available.

