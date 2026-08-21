# Release process

Step Switch is distributed GitHub-first. The repository contains the source,
repo marketplace, and committed prebuilt Codex plugin. The private Node package
is a contributor and package-validation surface; it is not published to npm.

## Prepare a candidate

1. Confirm `package.json`, `src/model/version.ts`, the plugin manifest, and the
   release tag all use the same strict semantic version.
2. Run `npm ci` on Node.js 22 or later.
3. Run `npm run check` and confirm the generated plugin and schemas leave no
   unexpected diff.
4. Inspect `npm pack --dry-run --json`; the package check must also pass from an
   isolated consumer directory without lifecycle scripts.
5. Review the complete diff, license, notice, security policy, changelog,
   marketplace metadata, and installation instructions.
6. Confirm the standalone plugin contains `LICENSE`, `NOTICE`, and
   `THIRD_PARTY_NOTICES.md`, regenerated from the locked runtime dependencies.

## Validate the release lanes

### Source release

- CI passes on every supported Node version.
- The repository is clean after `npm run check`.
- No credential, local path, generated browser artifact, or dependency folder
  is tracked.
- Release hygiene passes against tracked and unignored candidate files, not only
  the current Git index.

### Built runtime

- Run a valid and rejected transition through the built CLI.
- List and call all six tools through the bundled MCP stdio server.
- Confirm unknown fields and oversized requests fail before execution.

### Installed Agent runtime

After the candidate commit is available from GitHub:

```sh
codex plugin marketplace add tetracoralla/state-machine --ref v0.1.0
codex plugin add state-machine@state-machine
```

Restart ChatGPT or Codex, open a new task, and test representative direct,
indirect, negative, and boundary requests. Record the selected tool, call count,
retries, and any generic fallback. A correct answer from shell or model reasoning
does not prove plugin activation.

### Human runtime

Open the built editor and complete the sequence in `REVIEW_CONTRACT.md`,
including validation recovery, guarded reject/pass, trace/effects, persistence,
import/export, and narrow, 1200px, and wide layout checks.

### Business and visual acceptance

The owner reviews the current interface and positioning. Automated checks do
not decide whether the product is useful or visually ready.

## Publish

Creating the public repository, pushing commits, creating a tag or GitHub
release, installing into a personal marketplace, submitting to the universal
plugin directory, and announcing the release are explicit owner-authorized
external actions. Do not perform them as part of an ordinary local hardening
pass.

After authorization, create or update `tetracoralla/state-machine`, push the
reviewed commit, enable private vulnerability reporting, tag the matching
version, run CI, and repeat installed-host validation from the tagged
marketplace snapshot. Do not run `npm publish`.
