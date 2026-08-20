import { lstatSync, realpathSync, rmSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
const targets = [resolve(root, "dist"), resolve(root, "plugins/state-machine/server/index.mjs")];

export function assertContainedPathHasNoSymlinks(projectRoot, targetPath) {
  const resolvedRoot = realpathSync(projectRoot);
  const resolvedTarget = resolve(targetPath);
  const relativeTarget = relative(resolvedRoot, resolvedTarget);
  if (relativeTarget === "" || relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`)) {
    throw new Error(`Refusing to clean path outside project: ${resolvedTarget}`);
  }

  let cursor = resolvedRoot;
  for (const component of relativeTarget.split(sep)) {
    cursor = resolve(cursor, component);
    try {
      if (lstatSync(cursor).isSymbolicLink()) throw new Error(`Refusing to clean symbolic-link path component: ${cursor}`);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
      throw error;
    }
  }
}

export function cleanProject() {
  for (const target of targets) {
    assertContainedPathHasNoSymlinks(root, target);
    let stats;
    try {
      stats = lstatSync(target);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
    rmSync(target, { recursive: stats.isDirectory(), force: false });
  }
}

function isDirectEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectEntry()) cleanProject();
