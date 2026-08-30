import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const failures = [];
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const packageLock = readFileSync(resolve(root, "package-lock.json"), "utf8");
const pluginRoot = resolve(root, "plugins/state-machine");
const pluginJson = JSON.parse(readFileSync(resolve(pluginRoot, ".codex-plugin/plugin.json"), "utf8"));
const marketplaceJson = JSON.parse(readFileSync(resolve(root, ".agents/plugins/marketplace.json"), "utf8"));
const mcpJson = JSON.parse(readFileSync(resolve(pluginRoot, ".mcp.json"), "utf8"));
const skill = readFileSync(resolve(pluginRoot, "skills/use-state-machine/SKILL.md"), "utf8");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const rootThirdPartyNotices = readFileSync(resolve(root, "THIRD_PARTY_NOTICES.md"), "utf8");
const pluginThirdPartyNotices = readFileSync(resolve(pluginRoot, "THIRD_PARTY_NOTICES.md"), "utf8");
const productIdentity = readFileSync(resolve(root, "docs/PRODUCT_IDENTITY.md"), "utf8");
const releaseProcess = readFileSync(resolve(root, "docs/RELEASE.md"), "utf8");
const mcpSource = readFileSync(resolve(root, "src/adapters/mcp.ts"), "utf8");
const coreSources = [
  "src/core/step.ts",
  "src/core/simulate.ts",
  "src/core/validation.ts",
  "src/core/value-source.ts",
].map((path) => readFileSync(resolve(root, path), "utf8"));

if (packageJson.name !== "@openadam/state-machine") failures.push("npm package identity differs");
if (packageJson.private !== true) failures.push("package must remain private for GitHub-first distribution");
if (packageJson.repository?.url !== "git+https://github.com/tetracoralla/state-machine.git") failures.push("repository URL differs");
if (packageJson.homepage !== "https://github.com/tetracoralla/state-machine#readme") failures.push("homepage URL differs");
if (packageLock.includes("registry.npmmirror.com")) failures.push("package lock contains a non-canonical registry host");
if (rootThirdPartyNotices !== pluginThirdPartyNotices) failures.push("root and plugin third-party notices differ");
if (packageJson.bin?.["state-machine"] !== "./dist/node/adapters/cli.js") failures.push("CLI entry differs");
if (packageJson.bin?.["state-machine-mcp"] !== "./dist/node/adapters/mcp.js") failures.push("MCP entry differs");
if (pluginJson.name !== "state-machine") failures.push("plugin identity differs");
if (pluginJson.version !== packageJson.version) failures.push("plugin and package versions differ");
const versionSource = readFileSync(resolve(root, "src/model/version.ts"), "utf8");
const serverVersion = /SERVER_VERSION\s*=\s*"([^"]+)"/.exec(versionSource)?.[1];
if (serverVersion !== packageJson.version) failures.push("server version literal differs from package.json");
if (pluginJson.interface?.displayName !== "Step Switch") failures.push("plugin display name differs");
if (pluginJson.homepage !== "https://github.com/tetracoralla/state-machine") failures.push("plugin homepage differs");
if (pluginJson.repository !== "https://github.com/tetracoralla/state-machine") failures.push("plugin repository differs");
if (pluginJson.interface?.websiteURL !== "https://github.com/tetracoralla/state-machine") failures.push("plugin website differs");
if (!Array.isArray(pluginJson.interface?.defaultPrompt) || pluginJson.interface.defaultPrompt.length > 3) {
  failures.push("plugin default prompts must contain one to three examples");
}
if (marketplaceJson.name !== "state-machine") failures.push("marketplace identity differs");
if (marketplaceJson.interface?.displayName !== "Step Switch") failures.push("marketplace display name differs");
const marketplacePlugin = marketplaceJson.plugins?.find((plugin) => plugin.name === "state-machine");
if (!marketplacePlugin) failures.push("marketplace does not publish the state-machine plugin");
if (marketplacePlugin?.source?.source !== "local" || marketplacePlugin?.source?.path !== "./plugins/state-machine") {
  failures.push("marketplace plugin source differs");
}
if (marketplacePlugin?.policy?.installation !== "AVAILABLE") failures.push("marketplace installation policy differs");
if (marketplacePlugin?.policy?.authentication !== "ON_INSTALL") failures.push("marketplace authentication policy differs");
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
for (const filename of [
  ".github/workflows/ci.yml",
  ".github/dependabot.yml",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "plugins/state-machine/LICENSE",
  "plugins/state-machine/NOTICE",
  "plugins/state-machine/THIRD_PARTY_NOTICES.md",
  "plugins/state-machine/server/index.mjs.LEGAL.txt",
  "THIRD_PARTY_NOTICES.md",
  "docs/PRODUCT_IDENTITY.md",
  "docs/RELEASE.md",
]) {
  if (!existsSync(resolve(root, filename))) failures.push(`release file missing: ${filename}`);
}
for (const command of [
  "codex plugin marketplace add tetracoralla/state-machine --ref v0.1.0",
  "codex plugin add state-machine@state-machine",
]) {
  if (!readme.includes(command) || !releaseProcess.includes(command)) failures.push(`install contract missing: ${command}`);
}
if (!productIdentity.includes("The Node package stays private")) failures.push("product identity does not preserve the private package boundary");
if (!productIdentity.includes("Display name: **Step Switch**")) failures.push("Step Switch display identity is missing");
if (!productIdentity.includes("Technical slug: `state-machine`")) failures.push("stable technical slug is missing");
if (!releaseProcess.includes("Do not run `npm publish`")) failures.push("release process does not prohibit npm publication");

if (failures.length > 0) {
  failures.forEach((failure) => process.stderr.write(`contract failure: ${failure}\n`));
  process.exit(1);
}
process.stdout.write("contract checks passed\n");
