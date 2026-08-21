# Contributing

## Development loop

Node.js 22 or later and npm 10 or later are required.

```sh
npm ci
npm run check
```

`npm run check` runs type checks, core and adversarial tests, generated-schema
drift checks, clean path-safety checks, all builds, built CLI and MCP stdio
tests, an isolated tarball install, browser interaction tests, and repository
contract and plugin checks.

The npm project is intentionally private. Do not publish it. Supported user
distribution is the GitHub repository marketplace and the bundled Codex plugin.

## Surfaces and validation lanes

- `src/core` and `src/model` own deterministic business meaning.
- CLI, MCP, browser, and package surfaces must call the shared core.
- Unit tests do not prove the built CLI, MCP stdio transport, installed plugin,
  or browser flow. Keep those runtime lanes separate.
- `plugins/state-machine/server/index.mjs` is committed intentionally so a
  plugin installation does not require a build. Rebuild it after MCP changes.
- Test a clean repository checkout and a newly installed plugin before a
  release. Source checks do not establish installed-host routing.

## Product boundary

Read `AGENTS.md`, `docs/PRODUCT_MODEL.md`, and `docs/PRODUCT_IDENTITY.md` before
changing behavior or public identifiers. Step Switch does not execute effects,
evaluate expressions, access ambient files through MCP, or implement complete
statechart semantics.

## Pull requests

Keep changes scoped and include the smallest negative regression for parser,
guard, limit, path, response, persistence, or layout fixes. Report development,
Agent runtime, human runtime, and business/visual acceptance separately.

## License of contributions

Unless explicitly stated otherwise, any contribution intentionally submitted
for inclusion in Step Switch is provided under the Apache License 2.0, consistent
with section 5 of that license. Contributors must have the right to submit the
work and must preserve the license and attribution requirements of any included
third-party material.
