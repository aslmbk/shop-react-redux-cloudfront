import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const infraRoot = path.join(scriptDir, "..");

/** Directory names to skip entirely (no traversal). */
const IGNORE_DIR_NAMES = new Set([
  "node_modules",
  "dist",
  "resources",
  "cdk.out",
]);

/**
 * Removes .js and .d.ts emitted by `tsc` next to each .ts source.
 * Skips node_modules, dist, resources, cdk.out; does not touch .mjs.
 */
async function* walkTsFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (IGNORE_DIR_NAMES.has(ent.name)) continue;
      yield* walkTsFiles(abs);
      continue;
    }
    if (!ent.isFile()) continue;
    if (ent.name.endsWith(".d.ts")) continue;
    if (!ent.name.endsWith(".ts")) continue;
    yield abs;
  }
}

async function main() {
  const removed = [];
  for await (const tsPath of walkTsFiles(infraRoot)) {
    const dir = path.dirname(tsPath);
    const base = path.basename(tsPath, ".ts");
    for (const ext of [".js", ".d.ts"]) {
      const artifact = path.join(dir, base + ext);
      try {
        await fs.unlink(artifact);
        removed.push(path.relative(infraRoot, artifact));
      } catch (err) {
        if (err && err.code === "ENOENT") continue;
        throw err;
      }
    }
  }
  if (removed.length) {
    for (const rel of removed.sort()) {
      console.log("removed", rel);
    }
    console.log(`removed ${removed.length} file(s)`);
  } else {
    console.log("nothing to remove");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
