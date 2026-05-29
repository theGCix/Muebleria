import { build } from "esbuild";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

await build({
  entryPoints: [join(root, "src/server.ts")],
  outfile: join(root, "dist/server.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  external: [
    "@tanstack/react-start",
    "@tanstack/react-start/server-entry",
    "@tanstack/react-router",
    "@tanstack/react-query",
    "react",
    "react-dom",
  ],
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
});

console.log("Server built to dist/server.js");
