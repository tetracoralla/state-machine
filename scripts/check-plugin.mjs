import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const pluginRoot = resolve(root, "plugins/state-machine");
const bundledServer = resolve(pluginRoot, "server/index.mjs");
const plugin = JSON.parse(readFileSync(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
const transport = JSON.parse(readFileSync(resolve(pluginRoot, ".mcp.json"), "utf8"));
const skill = readFileSync(resolve(pluginRoot, "skills/use-state-machine/SKILL.md"), "utf8");
const metadata = readFileSync(resolve(pluginRoot, "skills/use-state-machine/agents/openai.yaml"), "utf8");

const failures = [];
if (!/^\d+\.\d+\.\d+$/.test(plugin.version ?? "")) failures.push("plugin version is not strict semver");
if (plugin.name !== "state-machine") failures.push("plugin name must match its folder");
if (plugin.skills !== "./skills/") failures.push("plugin skills path differs");
if (plugin.mcpServers !== "./.mcp.json") failures.push("plugin transport path differs");
if (!transport.mcpServers?.state_machine) failures.push("state_machine transport is missing");
const bundledServerExists = existsSync(bundledServer);
if (!bundledServerExists) failures.push("bundled MCP server is missing");
if (!skill.startsWith("---\nname: use-state-machine\n")) failures.push("Skill frontmatter or name differs");
if (!metadata.includes('value: "state_machine"')) failures.push("Skill does not declare the MCP dependency");
if (skill.includes("TODO") || metadata.includes("TODO")) failures.push("plugin contains unfinished placeholders");

const esbuildBin = resolve(root, "node_modules/.bin/esbuild");
if (!existsSync(esbuildBin)) {
  failures.push("esbuild is not installed; cannot verify the bundled server");
} else {
  const scratch = mkdtempSync(join(tmpdir(), "state-machine-plugin-check-"));
  try {
    const rebuilt = resolve(scratch, "index.mjs");
    const result = spawnSync(
      esbuildBin,
      [
        resolve(root, "src/adapters/mcp.ts"),
        "--bundle",
        "--platform=node",
        "--target=node22",
        "--format=esm",
        `--outfile=${rebuilt}`,
      ],
      { encoding: "utf8" },
    );
    if (result.status !== 0) {
      failures.push(`bundled MCP server could not be rebuilt: ${result.stderr}`);
    } else if (bundledServerExists && readFileSync(rebuilt, "utf8") !== readFileSync(bundledServer, "utf8")) {
      failures.push("bundled MCP server is stale; run npm run build:plugin");
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  failures.forEach((failure) => process.stderr.write(`plugin failure: ${failure}\n`));
  process.exit(1);
}
process.stdout.write("plugin checks passed\n");
