import { build } from "esbuild";

await build({
  entryPoints: ["ts-src/mcp-server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  minify: true,
  treeShaking: true,
  external: ["fastembed"],
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  outfile: "dist/mcp-server.js",
});
