import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["ts-src/**/*.test.ts"],
    // Allow process spawning
    isolate: false,
  },
});
