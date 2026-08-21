# Product identity

## Canonical name

- Display name: **Step Switch**
- Technical slug: `state-machine`
- Category: deterministic finite-state transition kernel for humans and AI Agents
- Canonical description: **Step Switch turns a finite workflow into executable,
  side-effect-free transition data.**

The name describes the mechanism rather than borrowing the railway occupation.
`Step` is one explicit event evaluated against the current snapshot; `Switch`
is the resulting declared state transition. The category language remains
literal and discoverable for technical users and Agents. Step Switch must not
be presented as an exclusive claim to the state-machine category, a complete
statechart runtime, or an XState/SCXML compatibility claim.

## Stable identifiers

| Surface | Identifier |
| --- | --- |
| Repository | `tetracoralla/state-machine` |
| Private Node workspace/library | `@openadam/state-machine` |
| CLI | `state-machine` |
| MCP CLI | `state-machine-mcp` |
| Browser CLI | `state-machine-ui` |
| Codex marketplace | `state-machine` |
| Codex plugin | `state-machine` |
| Codex Skill | `use-state-machine` |
| MCP server | `state-machine` |
| MCP configuration key | `state_machine` |
| MCP tools | `machine.validate`, `machine.step`, `machine.simulate`, `machine.find_path`, `machine.inspect`, `machine.diff` |

The public distribution channel is the GitHub repository marketplace and its
committed plugin. The Node package stays private: its scoped name is a stable
workspace/library identifier, not an npm release channel.

## Distribution

- Source and marketplace: `https://github.com/tetracoralla/state-machine`
- Stable install source: `tetracoralla/state-machine`, pinned to a release tag
- Install selector: `state-machine@state-machine`
- Release unit: the repository, including the committed prebuilt MCP server
- Project license: Apache License 2.0 (`Apache-2.0`)

Plugin users must not need an npm account, dependency installation, TypeScript,
or a build step. Contributors use npm to reproduce source, runtime, browser,
package, and plugin checks.

## Compatibility boundary

A display-name change does not authorize changes to package, CLI, plugin,
Skill, MCP server, configuration, or tool identifiers. Any stable identifier
change requires an explicit migration plan. Product scope remains governed by
`PRODUCT_MODEL.md` and the executable schemas.
