# Changelog

All notable changes to Step Switch are documented here.

## 0.1.1 - Unreleased

- Capped raw MCP stdio messages before the SDK's larger default buffer can
  accumulate them.
- Cleared stale path results whenever the simulator advances to another state.
- Completed standalone plugin license attribution and pinned CI supply-chain
  dependencies.
- Coordinated the React, Vite, React plugin, and DOM test-runtime updates that
  were unsafe as separate automated dependency pull requests.

## 0.1.0 - 2026-08-21

- Adopted **Step Switch** as the display brand while preserving the stable
  `state-machine` package, CLI, plugin, Skill, MCP server, configuration, and
  `machine.*` tool identifiers.
- Added the strict finite-state Machine Spec v0.1 and generated JSON Schemas.
- Added deterministic validation, step, simulation, reachability, shortest
  path, inspection, and semantic diff operations.
- Added CLI, six read-only MCP tools, and a bundled Codex plugin.
- Added the browser definition editor, topology, simulator, trace, symbolic
  effects, import/export, persistence, and recovery flows.
- Added cumulative input and response limits, prototype-path protections,
  package/runtime/browser checks, and GitHub-first release infrastructure.
