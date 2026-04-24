import { build } from "esbuild";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const infraRoot = path.join(scriptDir, "..");
const outdir = path.join(infraRoot, "dist/product-service");

await rm(outdir, { recursive: true, force: true });

await build({
  entryPoints: [
    {
      in: path.join(infraRoot, "lib/product-service/get-products-list.ts"),
      out: "get-products-list",
    },
    {
      in: path.join(infraRoot, "lib/product-service/get-products-by-id.ts"),
      out: "get-products-by-id",
    },
  ],
  bundle: true,
  format: "cjs",
  outdir,
  platform: "node",
  sourcemap: true,
  target: "node20",
});
