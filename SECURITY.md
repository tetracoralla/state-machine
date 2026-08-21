# Security policy

## Supported version

Security fixes target the latest release on the `main` branch.

Step Switch treats Machine Specs, snapshots, events, and guard outcomes as
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

## Report a vulnerability

When private vulnerability reporting is enabled for
`tetracoralla/state-machine`, use GitHub's **Report a vulnerability** button. If
that private option is unavailable, open an issue containing no vulnerability
details and ask the maintainers for a private contact route. Include the
affected version, a minimal reproduction, expected impact, and any known
workaround in the eventual private report. Do not put exploit details,
credentials, production data, or third-party personal information in a public
issue.
