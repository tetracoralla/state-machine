import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const target = resolve(root, "plugins/state-machine/THIRD_PARTY_NOTICES.md");
const pluginLicenseTarget = resolve(root, "plugins/state-machine/LICENSE");
const pluginNoticeTarget = resolve(root, "plugins/state-machine/NOTICE");
const packageNames = [
  "@modelcontextprotocol/core",
  "@modelcontextprotocol/server",
  "react",
  "react-dom",
  "scheduler",
  "yaml",
  "zod",
];

function packageRoot(name) {
  return resolve(root, "node_modules", ...name.split("/"));
}

const licenseGroups = new Map();
for (const name of packageNames) {
  const directory = packageRoot(name);
  const metadata = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
  const license = readFileSync(resolve(directory, "LICENSE"), "utf8").trim();
  const packages = licenseGroups.get(license) ?? [];
  packages.push(`${metadata.name} ${metadata.version}`);
  licenseGroups.set(license, packages);
}

const sections = [...licenseGroups.entries()].map(
  ([license, packages]) => `## ${packages.join(", ")}\n\n\`\`\`text\n${license}\n\`\`\``,
);
const output = `# Third-party notices

Step Switch bundles the following third-party software in its browser and MCP
distributions. This file is generated from the exact dependency versions in
the lockfile; run \`npm run generate:licenses\` after changing dependencies.

${sections.join("\n\n")}
`;
const pluginLicense = readFileSync(resolve(root, "LICENSE"), "utf8");
const pluginNotice = `Step Switch
Copyright 2026 openAdam

This product includes software developed by third parties. Dependency license
and attribution information is included in THIRD_PARTY_NOTICES.md.
`;
const artifacts = [
  [target, output],
  [pluginLicenseTarget, pluginLicense],
  [pluginNoticeTarget, pluginNotice],
];

if (process.argv.includes("--check")) {
  for (const [path, expected] of artifacts) {
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      // Report missing generated artifacts through the same drift message.
    }
    if (current !== expected) {
      process.stderr.write("plugin license artifacts are stale; run npm run generate:licenses\n");
      process.exit(1);
    }
  }
} else {
  for (const [path, content] of artifacts) writeFileSync(path, content);
  process.stdout.write("plugin license artifacts generated\n");
}
