import { build } from "esbuild";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const infraRoot = path.join(scriptDir, "..");
const outdir = path.join(infraRoot, "dist/import-service");

await rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: [
    {
      in: path.join(infraRoot, "lib/import-service/import-products-file.ts"),
      out: "import-products-file",
    },
    {
      in: path.join(infraRoot, "lib/import-service/import-file-parser.ts"),
      out: "import-file-parser",
    },
  ],
  bundle: true,
  external: ["@aws-sdk/*"],
  format: "cjs",
  outdir,
  platform: "node",
  sourcemap: true,
  target: "node20",
});
