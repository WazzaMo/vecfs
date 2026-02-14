import { build } from "esbuild";

await build({
  entryPoints: ["ts-src/mcp-server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  minify: true,
  treeShaking: true,
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  outfile: "dist/mcp-server.js",
});
