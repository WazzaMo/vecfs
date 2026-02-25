import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  minify: true,
  treeShaking: true,
  external: ["fastembed"],
  banner: {
    js: "#!/usr/bin/env node\nimport { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
};

await build({
  ...shared,
  entryPoints: ["ts-src/mcp-server.ts"],
  outfile: "dist/mcp-server.js",
});

await build({
  ...shared,
  entryPoints: ["ts-src/embed-cli.ts"],
  outfile: "dist/embed-cli.js",
});
