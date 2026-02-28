import * as fs from "fs/promises";
import * as path from "path";
import { homedir } from "os";
import YAML from "yaml";

export type EmbedderProvider = "fastembed" | "transformers" | "onnx";

export interface VecFSConfig {
  storage: { file: string };
  mcp: { port: number };
  embedder?: { provider?: EmbedderProvider; model?: string };
}

const DEFAULT_STORAGE_FILE = "./vecfs-data.jsonl";
const DEFAULT_MCP_PORT = 3000;

/**
 * Resolves the path to the config file in lookup order:
 * 1. VECFS_CONFIG env, or --config <path> in argv
 * 2. ./vecfs.yaml, ./.vecfs.yaml
 * 3. ~/.config/vecfs/vecfs.yaml
 * Returns the first path that exists, or null if none found.
 */
export async function getConfigPath(argv: string[] = process.argv): Promise<string | null> {
  const envPath = process.env.VECFS_CONFIG;
  if (envPath) {
    try {
      await fs.access(envPath);
      return envPath;
    } catch {
      // fall through to next candidates
    }
  }

  const configIdx = argv.indexOf("--config");
  if (configIdx !== -1 && argv[configIdx + 1]) {
    const explicitPath = path.resolve(argv[configIdx + 1]);
    try {
      await fs.access(explicitPath);
      return explicitPath;
    } catch {
      // fall through
    }
  }

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "vecfs.yaml"),
    path.join(cwd, ".vecfs.yaml"),
    path.join(homedir(), ".config", "vecfs", "vecfs.yaml"),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * Loads VecFS config from the first found config file, then applies env overrides.
 * VECFS_FILE overrides storage.file; PORT overrides mcp.port.
 */
export async function loadConfig(argv: string[] = process.argv): Promise<VecFSConfig> {
  const configPath = await getConfigPath(argv);
  let raw: Record<string, unknown> = {};

  if (configPath) {
    try {
      const content = await fs.readFile(configPath, "utf-8");
      raw = YAML.parse(content) ?? {};
    } catch {
      // use defaults on parse error
    }
  }

  const storage = (raw.storage as Record<string, unknown>) ?? {};
  const mcp = (raw.mcp as Record<string, unknown>) ?? {};

  let storageFile =
    typeof storage.file === "string" ? storage.file : DEFAULT_STORAGE_FILE;
  let mcpPort =
    typeof mcp.port === "number"
      ? mcp.port
      : typeof mcp.port === "string"
        ? parseInt(mcp.port, 10)
        : DEFAULT_MCP_PORT;

  const embedder = (raw.embedder as Record<string, unknown>) ?? {};
  const validProviders: EmbedderProvider[] = ["fastembed", "transformers", "onnx"];
  let embedderProvider: EmbedderProvider =
    typeof embedder.provider === "string" && validProviders.includes(embedder.provider as EmbedderProvider)
      ? (embedder.provider as EmbedderProvider)
      : "fastembed";
  const embedderModel =
    typeof embedder.model === "string" ? embedder.model : undefined;

  if (process.env.VECFS_FILE) {
    storageFile = process.env.VECFS_FILE;
  }
  if (process.env.VECFS_EMBEDDER) {
    const envProvider = process.env.VECFS_EMBEDDER;
    if (["fastembed", "transformers", "onnx"].includes(envProvider)) {
      embedderProvider = envProvider as EmbedderProvider;
    }
  }
  if (process.env.PORT !== undefined && process.env.PORT !== "") {
    const envPort = parseInt(process.env.PORT, 10);
    if (!Number.isNaN(envPort)) {
      mcpPort = envPort;
    }
  }

  return {
    storage: { file: storageFile },
    mcp: { port: mcpPort },
    embedder: { provider: embedderProvider, model: embedderModel },
  };
}
