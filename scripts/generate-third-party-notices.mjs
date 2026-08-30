import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const targets = [
  resolve(root, "THIRD_PARTY_NOTICES.md"),
  resolve(root, "plugins/state-machine/THIRD_PARTY_NOTICES.md"),
];
const pluginLicenseTarget = resolve(root, "plugins/state-machine/LICENSE");
const pluginNoticeTarget = resolve(root, "plugins/state-machine/NOTICE");
const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));

function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const packageDirectories = [...new Set(Object.entries(lock.packages)
  .filter(([path, metadata]) => path.includes("node_modules/") && metadata.dev !== true && metadata.link !== true)
  .map(([path]) => resolve(root, path)))]
  .sort(compareCodeUnits);
if (packageDirectories.length === 0) {
  throw new Error("No production dependency inventory was found in package-lock.json");
}

const licenseGroups = new Map();
for (const directory of packageDirectories) {
  const metadata = JSON.parse(readFileSync(resolve(directory, "package.json"), "utf8"));
  const license = readFileSync(resolve(directory, "LICENSE"), "utf8").trim();
  const packages = licenseGroups.get(license) ?? [];
  packages.push(`${metadata.name} ${metadata.version}`);
  licenseGroups.set(license, packages);
}
for (const packages of licenseGroups.values()) packages.sort(compareCodeUnits);

const sections = [...licenseGroups.entries()].map(
  ([license, packages]) => `## ${packages.join(", ")}\n\n\`\`\`text\n${license}\n\`\`\``,
);
const output = `# Third-party notices

Step Switch distributes or embeds the following production dependency closure
across its npm, browser, and MCP surfaces. This file is generated from the
exact non-development package versions in the lockfile; run
\`npm run generate:licenses\` after changing dependencies.

${sections.join("\n\n")}
`;
const pluginLicense = readFileSync(resolve(root, "LICENSE"), "utf8");
const pluginNotice = `Step Switch
Copyright 2026 openAdam

This product includes software developed by third parties. Dependency license
and attribution information is included in THIRD_PARTY_NOTICES.md.
`;
const artifacts = [
  ...targets.map((path) => [path, output]),
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
