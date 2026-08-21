import { spawnSync } from "node:child_process";
import { lstatSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const checker = resolve(root, "scripts/check-release-hygiene.mjs");

describe("release hygiene", () => {
  it("rejects a tracked symbolic link without reading its target", () => {
    const scratchParent = realpathSync(tmpdir());
    const scratchPrefix = "step-switch-release-hygiene-";
    const scratch = mkdtempSync(join(scratchParent, scratchPrefix));
    try {
      const outside = resolve(scratch, "outside.txt");
      const link = resolve(scratch, "linked.txt");
      writeFileSync(outside, "ordinary external content\n");
      symlinkSync(outside, link);
      expect(spawnSync("git", ["init", "--quiet"], { cwd: scratch }).status).toBe(0);
      expect(spawnSync("git", ["add", "linked.txt"], { cwd: scratch }).status).toBe(0);

      const checked = spawnSync(process.execPath, [checker], { cwd: scratch, encoding: "utf8" });
      expect(checked.status).toBe(1);
      expect(checked.stderr).toContain("linked.txt: symbolic links must not be released");
      expect(checked.stderr).not.toContain("ordinary external content");
    } finally {
      const resolvedScratch = realpathSync(scratch);
      const metadata = lstatSync(scratch);
      if (
        resolvedScratch !== scratch ||
        dirname(resolvedScratch) !== scratchParent ||
        !basename(resolvedScratch).startsWith(scratchPrefix) ||
        !metadata.isDirectory() ||
        metadata.isSymbolicLink()
      ) {
        throw new Error(`refusing to clean unexpected release-hygiene test path: ${scratch}`);
      }
      rmSync(resolvedScratch, { recursive: true, force: false });
    }
  });
});
