import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const root = process.cwd();
const scratchParent = realpathSync(tmpdir());
const scratchPrefix = "state-machine-package-check-";
const scratch = mkdtempSync(join(scratchParent, scratchPrefix));

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function cleanScratch() {
  const resolved = realpathSync(scratch);
  const metadata = lstatSync(scratch);
  if (
    resolved !== scratch ||
    dirname(resolved) !== scratchParent ||
    !basename(resolved).startsWith(scratchPrefix) ||
    !metadata.isDirectory() ||
    metadata.isSymbolicLink()
  ) {
    throw new Error(`refusing to clean unexpected scratch path: ${scratch}`);
  }
  rmSync(resolved, { recursive: true });
}

try {
  const packOutput = run(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", scratch],
    root,
  );
  const packed = JSON.parse(packOutput);
  if (!Array.isArray(packed) || packed.length !== 1) throw new Error("npm pack returned an unexpected result");

  const archive = resolve(scratch, packed[0].filename);
  if (dirname(archive) !== scratch) throw new Error("npm pack archive escaped the scratch directory");

  const fileNames = new Set((packed[0].files ?? []).map((file) => file.path));
  for (const required of [
    "dist/node/adapters/cli.js",
    "dist/node/index.js",
    "dist/node/index.d.ts",
    "plugins/state-machine/.codex-plugin/plugin.json",
    "plugins/state-machine/LICENSE",
    "plugins/state-machine/NOTICE",
    "plugins/state-machine/server/index.mjs",
    "plugins/state-machine/THIRD_PARTY_NOTICES.md",
    "README.md",
    "LICENSE",
    "NOTICE",
  ]) {
    if (!fileNames.has(required)) throw new Error(`packed artifact is missing ${required}`);
  }
  for (const fileName of fileNames) {
    if (fileName.endsWith(".map")) throw new Error(`packed artifact contains source map ${fileName}`);
    if (fileName.startsWith("docs/progress/")) throw new Error(`packed artifact contains internal progress record ${fileName}`);
  }
  if ((packed[0].unpackedSize ?? Number.POSITIVE_INFINITY) > 2_000_000) {
    throw new Error(`packed artifact exceeds the 2 MB unpacked limit: ${packed[0].unpackedSize}`);
  }

  const consumer = resolve(scratch, "consumer");
  mkdirSync(consumer);
  writeFileSync(resolve(consumer, "package.json"), '{"name":"state-machine-package-check","private":true}\n');
  run(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", archive],
    consumer,
  );

  const installedRoot = resolve(consumer, "node_modules/@openadam/state-machine");
  const cliOutput = run(
    process.execPath,
    [
      resolve(installedRoot, "dist/node/adapters/cli.js"),
      "validate",
      resolve(installedRoot, "examples/order.machine.yaml"),
    ],
    consumer,
  );
  const result = JSON.parse(cliOutput);
  if (result.status !== "valid" || result.machine_id !== "order-lifecycle" || result.stats?.states !== 6) {
    throw new Error(`installed CLI returned an unexpected result: ${cliOutput}`);
  }

  process.stdout.write(
    `package checks passed (${packed[0].size} bytes packed, ${packed[0].unpackedSize} bytes unpacked)\n`,
  );
} catch (error) {
  process.stderr.write(`package check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  cleanScratch();
}
