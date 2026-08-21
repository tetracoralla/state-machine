import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { lstatSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { runWebServer } from "../../dist/node/adapters/web-server.js";

const root = resolve(import.meta.dirname, "../..");
const server = resolve(root, "dist/node/adapters/web-server.js");

describe("built editor server CLI", () => {
  it("presents the Step Switch brand and stable command in help", () => {
    const executed = spawnSync(process.execPath, [server, "--help"], { cwd: root, encoding: "utf8" });
    expect(executed.status).toBe(0);
    expect(executed.stdout).toContain("Step Switch editor server 0.1");
    expect(executed.stdout).toContain("state-machine-ui");
  });

  it("rejects unknown, duplicate, missing, and invalid options without starting", () => {
    for (const args of [
      ["--unknown", "value"],
      ["--host"],
      ["--port", "4317", "--port", "4318"],
      ["--port", "0"],
      ["--port", "1.5"],
      ["--help", "--port", "4317"],
    ]) {
      const executed = spawnSync(process.execPath, [server, ...args], { cwd: root, encoding: "utf8" });
      expect(executed.status).toBe(2);
      expect(executed.stderr).toContain("CLI_USAGE_ERROR");
    }
  });

  it("exits with a clean usage error when the port is already bound", async () => {
    const blocker = createServer();
    void blocker.listen(0, "127.0.0.1");
    await once(blocker, "listening");
    const port = (blocker.address() as AddressInfo).port;
    try {
      const executed = spawnSync(process.execPath, [server, "--host", "127.0.0.1", "--port", String(port)], {
        cwd: root,
        encoding: "utf8",
      });
      expect(executed.status).toBe(2);
      expect(executed.stderr).toContain("CLI_USAGE_ERROR");
      expect(executed.stderr).toContain("EADDRINUSE");
      expect(executed.stderr).not.toContain("Unhandled");
    } finally {
      await new Promise<void>((resolveClose) => blocker.close(() => resolveClose()));
    }
  });

  it("serves only GET and HEAD files whose real paths stay inside the built UI", async () => {
    const scratchPrefix = "step-switch-web-test-";
    const scratchParent = realpathSync(tmpdir());
    const scratch = mkdtempSync(join(scratchParent, scratchPrefix));
    const link = resolve(root, "dist/ui/escape-probe.txt");
    writeFileSync(resolve(scratch, "outside.txt"), "outside");
    symlinkSync(resolve(scratch, "outside.txt"), link);
    const running = runWebServer([process.execPath, server, "--host", "127.0.0.1", "--port", "4329"]);
    expect(running).not.toBeNull();
    if (!running) return;
    try {
      await once(running, "listening");
      const head = await fetch("http://127.0.0.1:4329/index.html", { method: "HEAD" });
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");

      const post = await fetch("http://127.0.0.1:4329/index.html", { method: "POST" });
      expect(post.status).toBe(405);
      expect(post.headers.get("allow")).toBe("GET, HEAD");

      const escaped = await fetch("http://127.0.0.1:4329/escape-probe.txt");
      expect(escaped.status).toBe(403);
    } finally {
      await new Promise<void>((resolveClose, rejectClose) =>
        running.close((error) => (error ? rejectClose(error) : resolveClose())),
      );
      if (!lstatSync(link).isSymbolicLink()) throw new Error(`refusing to remove unexpected web test path: ${link}`);
      unlinkSync(link);
      const resolved = realpathSync(scratch);
      if (dirname(resolved) !== scratchParent || !basename(resolved).startsWith(scratchPrefix)) {
        throw new Error(`refusing to clean unexpected web test directory: ${resolved}`);
      }
      rmSync(resolved, { recursive: true });
    }
  });
});
