/** Compile the Express server to dist/server.js so production start is plain node. */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const esbuild = createRequire(path.join(root, "package.json"))("esbuild");

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "dist/server.js",
  target: "node22",
  legalComments: "none",
  logLevel: "info",
  sourcemap: false,
});
await esbuild.stop();
