import assert from "node:assert/strict";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { assertContainedPathHasNoSymlinks } from "./clean.mjs";

const scratch = mkdtempSync(join(tmpdir(), "state-machine-clean-safety-"));

try {
  const projectRoot = resolve(scratch, "project");
  const outsideRoot = resolve(scratch, "outside");
  mkdirSync(resolve(projectRoot, "plugins/state-machine"), { recursive: true });
  mkdirSync(outsideRoot, { recursive: true });
  const sentinel = resolve(outsideRoot, "index.mjs");
  writeFileSync(sentinel, "must remain\n", "utf8");
  symlinkSync(outsideRoot, resolve(projectRoot, "plugins/state-machine/server"));
  const canonicalProjectRoot = realpathSync(projectRoot);

  assert.throws(
    () =>
      assertContainedPathHasNoSymlinks(
        canonicalProjectRoot,
        resolve(canonicalProjectRoot, "plugins/state-machine/server/index.mjs"),
      ),
    /symbolic-link path component/,
  );
  assert.throws(
    () => assertContainedPathHasNoSymlinks(canonicalProjectRoot, resolve(canonicalProjectRoot, "../outside/index.mjs")),
    /outside project/,
  );
  assert.equal(readFileSync(sentinel, "utf8"), "must remain\n");
  process.stdout.write("clean path-safety checks passed\n");
} finally {
  const resolvedScratch = realpathSync(scratch);
  const resolvedTempRoot = realpathSync(tmpdir());
  if (!resolvedScratch.startsWith(`${resolvedTempRoot}${sep}`) || lstatSync(resolvedScratch).isSymbolicLink()) {
    throw new Error(`Refusing to remove unexpected test scratch path: ${resolvedScratch}`);
  }
  rmSync(resolvedScratch, { recursive: true, force: false });
}
