import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const pluginRoot = resolve(root, "plugins/state-machine");
const pluginJson = JSON.parse(readFileSync(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
const mcpJson = JSON.parse(readFileSync(resolve(pluginRoot, ".mcp.json"), "utf8"));
const skill = readFileSync(resolve(pluginRoot, "skills/use-state-machine/SKILL.md"), "utf8");
const mcpSource = readFileSync(resolve(root, "src/adapters/mcp.ts"), "utf8");
const coreSources = [
  "src/core/step.ts",
  "src/core/simulate.ts",
  "src/core/validation.ts",
  "src/core/value-source.ts",
].map((path) => readFileSync(resolve(root, path), "utf8"));

if (packageJson.name !== "@openadam/state-machine") failures.push("npm package identity differs");
if (packageJson.private !== true) failures.push("package must remain private until release is explicitly authorized");
if (packageJson.bin?.["state-machine"] !== "./dist/node/adapters/cli.js") failures.push("CLI entry differs");
if (packageJson.bin?.["state-machine-mcp"] !== "./dist/node/adapters/mcp.js") failures.push("MCP entry differs");
if (pluginJson.name !== "state-machine") failures.push("plugin identity differs");
if (pluginJson.version !== packageJson.version) failures.push("plugin and package versions differ");
if (pluginJson.interface?.displayName !== "State Machine") failures.push("plugin display name differs");
if (skill.includes("[TODO:")) failures.push("product Skill contains TODO placeholders");
for (const name of [
  "machine.validate",
  "machine.step",
  "machine.simulate",
  "machine.find_path",
  "machine.inspect",
  "machine.diff",
]) {
  if (!mcpSource.includes(`\"${name}\"`)) failures.push(`missing public tool ${name}`);
}
for (const annotation of ["readOnlyHint: true", "idempotentHint: true", "destructiveHint: false", "openWorldHint: false"]) {
  if (!mcpSource.includes(annotation)) failures.push(`missing MCP annotation ${annotation}`);
}
if (coreSources.some((source) => /\beval\s*\(|new\s+Function\s*\(/.test(source))) failures.push("forbidden raw source evaluation found");
if (mcpSource.includes("readFile") || mcpSource.includes("writeFile")) failures.push("MCP adapter must not gain ambient file access");
const serverConfig = mcpJson.mcpServers?.state_machine;
if (!serverConfig) failures.push("state_machine MCP server is not configured");
if (serverConfig?.cwd !== ".") failures.push("plugin MCP cwd must be plugin root");
const serverEntry = serverConfig?.args?.[0];
if (!serverEntry || !existsSync(resolve(pluginRoot, serverEntry))) failures.push("built plugin server entry is missing");
for (const filename of [
  "machine-spec.schema.json",
  "machine-step-request.schema.json",
  "machine-simulate-request.schema.json",
]) {
  if (!existsSync(resolve(root, "schemas", filename))) failures.push(`published schema missing: ${filename}`);
}

if (failures.length > 0) {
  failures.forEach((failure) => process.stderr.write(`contract failure: ${failure}\n`));
  process.exit(1);
}
process.stdout.write("contract checks passed\n");

