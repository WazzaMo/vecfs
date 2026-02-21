import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { tmpdir } from "os";
import { getConfigPath, loadConfig } from "./config.js";

describe("config", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;
  let savedEnv: { VECFS_FILE?: string; PORT?: string; VECFS_CONFIG?: string };

  beforeEach(async () => {
    tmpDir = path.join(
      tmpdir(),
      "vecfs-config-test-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    );
    await fs.mkdir(tmpDir, { recursive: true });
    savedEnv = {
      VECFS_FILE: process.env.VECFS_FILE,
      PORT: process.env.PORT,
      VECFS_CONFIG: process.env.VECFS_CONFIG,
    };
    delete process.env.VECFS_FILE;
    delete process.env.PORT;
    delete process.env.VECFS_CONFIG;
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    process.env.VECFS_FILE = savedEnv.VECFS_FILE;
    process.env.PORT = savedEnv.PORT;
    process.env.VECFS_CONFIG = savedEnv.VECFS_CONFIG;
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  describe("getConfigPath", () => {
    it("returns null when no config file exists", async () => {
      process.chdir(tmpDir);
      const p = await getConfigPath();
      expect(p).toBeNull();
    });

    it("returns path when vecfs.yaml exists in cwd", async () => {
      process.chdir(tmpDir);
      await fs.writeFile(
        path.join(tmpDir, "vecfs.yaml"),
        "storage:\n  file: from-file.jsonl\n",
      );
      const p = await getConfigPath();
      expect(p).toBe(path.join(tmpDir, "vecfs.yaml"));
    });

    it("returns path when VECFS_CONFIG points to existing file", async () => {
      const configPath = path.join(tmpDir, "custom.yaml");
      await fs.writeFile(configPath, "mcp:\n  port: 4000\n");
      process.env.VECFS_CONFIG = configPath;
      const p = await getConfigPath();
      expect(p).toBe(configPath);
    });

    it("returns path when --config points to existing file", async () => {
      const configPath = path.join(tmpDir, "explicit.yaml");
      await fs.writeFile(configPath, "storage:\n  file: explicit.jsonl\n");
      const argv = ["node", "mcp-server.js", "--config", configPath];
      const p = await getConfigPath(argv);
      expect(p).toBe(configPath);
    });
  });

  describe("loadConfig", () => {
    it("returns defaults when no config file exists", async () => {
      process.chdir(tmpDir);
      const config = await loadConfig();
      expect(config.storage.file).toBe("./vecfs-data.jsonl");
      expect(config.mcp.port).toBe(3000);
    });

    it("uses VECFS_FILE and PORT when set", async () => {
      process.chdir(tmpDir);
      process.env.VECFS_FILE = "/tmp/env-storage.jsonl";
      process.env.PORT = "9999";
      const config = await loadConfig();
      expect(config.storage.file).toBe("/tmp/env-storage.jsonl");
      expect(config.mcp.port).toBe(9999);
    });

    it("uses values from config file when present", async () => {
      process.chdir(tmpDir);
      await fs.writeFile(
        path.join(tmpDir, "vecfs.yaml"),
        [
          "storage:",
          "  file: from-yaml.jsonl",
          "mcp:",
          "  port: 4000",
        ].join("\n"),
      );
      const config = await loadConfig();
      expect(config.storage.file).toBe("from-yaml.jsonl");
      expect(config.mcp.port).toBe(4000);
    });

    it("lets env override config file values", async () => {
      process.chdir(tmpDir);
      await fs.writeFile(
        path.join(tmpDir, "vecfs.yaml"),
        [
          "storage:",
          "  file: from-yaml.jsonl",
          "mcp:",
          "  port: 4000",
        ].join("\n"),
      );
      process.env.VECFS_FILE = "/override/file.jsonl";
      process.env.PORT = "5000";
      const config = await loadConfig();
      expect(config.storage.file).toBe("/override/file.jsonl");
      expect(config.mcp.port).toBe(5000);
    });

    it("uses --config path when provided in argv", async () => {
      const configPath = path.join(tmpDir, "via-argv.yaml");
      await fs.writeFile(
        configPath,
        [
          "storage:",
          "  file: argv-storage.jsonl",
          "mcp:",
          "  port: 6000",
        ].join("\n"),
      );
      const argv = ["node", "mcp-server.js", "--config", configPath];
      const config = await loadConfig(argv);
      expect(config.storage.file).toBe("argv-storage.jsonl");
      expect(config.mcp.port).toBe(6000);
    });

    it("accepts mcp.port as string in YAML", async () => {
      process.chdir(tmpDir);
      await fs.writeFile(
        path.join(tmpDir, "vecfs.yaml"),
        "mcp:\n  port: \"7000\"\n",
      );
      const config = await loadConfig();
      expect(config.mcp.port).toBe(7000);
    });
  });
});
