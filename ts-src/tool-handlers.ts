import { z } from "zod";
import type { Embedder } from "./embedder/index.js";
import { VecFSStorage } from "./storage.js";
import { toSparse } from "./sparse-vector.js";
import { SparseVector } from "./types.js";

/**
 * The shape returned by every tool handler, compatible with the MCP SDK's
 * expected CallToolResult format.
 */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: string; text: string }[];
}

/**
 * A map of tool-name to handler function.
 */
export type ToolHandlerMap = Record<
  string,
  (args: unknown) => Promise<ToolResult>
>;

/** Either an embedder instance or a function that returns one (for lazy init). */
export type EmbedderOrGetter = Embedder | null | (() => Promise<Embedder | null>);

// ---------------------------------------------------------------------------
// Argument schemas (zod)
// ---------------------------------------------------------------------------

const vectorShapeSchema = z.union([
  z.record(z.string(), z.number()),
  z.array(z.number()),
]);

/**
 * If args is an object with a string `vector` property, parses it as JSON
 * so the vector is sent as object/array. MCP clients may send vector as a
 * JSON string; this ensures we accept both.
 */
function ensureVectorIsObjectOrArray(
  args: unknown,
): unknown {
  if (args === null || typeof args !== "object" || !("vector" in args))
    return args;
  const v = (args as Record<string, unknown>).vector;
  if (typeof v !== "string") return args;
  try {
    return { ...(args as Record<string, unknown>), vector: JSON.parse(v) };
  } catch {
    throw new Error(
      "Vector must be a JSON object (sparse) or array of numbers (dense).",
    );
  }
}

const searchArgsSchema = z.object({
  vector: vectorShapeSchema.optional(),
  query: z.string().optional(),
  limit: z.number().optional(),
});

const memorizeArgsSchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  vector: vectorShapeSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const feedbackArgsSchema = z.object({
  id: z.string(),
  scoreAdjustment: z.number(),
});

const deleteArgsSchema = z.object({
  id: z.string(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parses and validates tool arguments with a zod schema.
 * Throws a descriptive Error on validation failure.
 */
function validateArgs<T>(
  schema: { parse: (data: unknown) => T },
  args: unknown,
  toolName: string,
): T {
  try {
    return schema.parse(args ?? {});
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid arguments for '${toolName}': ${message}`);
  }
}

/**
 * Normalises a vector input (dense array or sparse object) into a SparseVector.
 */
function normalizeVector(
  input: Record<string, number> | number[],
): SparseVector {
  if (Array.isArray(input)) {
    return toSparse(input);
  }
  const sparse: SparseVector = {};
  for (const [key, value] of Object.entries(input)) {
    sparse[Number(key)] = value;
  }
  return sparse;
}

// ---------------------------------------------------------------------------
// Embedder resolution (cache so model is loaded once and reused)
// ---------------------------------------------------------------------------

let cachedEmbedderPromise: Promise<Embedder | null> | null = null;

/**
 * Resolves the embedder: returns the instance directly, or calls the getter once
 * and caches the result so subsequent vectorisation reuses the same in-process model.
 */
async function getEmbedder(embedderOrGetter: EmbedderOrGetter): Promise<Embedder | null> {
  if (embedderOrGetter === null || typeof embedderOrGetter !== "function") {
    return embedderOrGetter;
  }
  if (cachedEmbedderPromise === null) {
    cachedEmbedderPromise = embedderOrGetter();
  }
  return cachedEmbedderPromise;
}

/**
 * Resolves the search vector from parsed args: either from vector, or by embedding query when embedder is present.
 */
async function resolveSearchVector(
  parsed: {
    vector?: Record<string, number> | number[];
    query?: string;
    limit?: number;
  },
  embedderOrGetter: EmbedderOrGetter,
): Promise<SparseVector> {
  if (parsed.vector !== undefined) {
    return normalizeVector(parsed.vector);
  }
  if (parsed.query !== undefined) {
    const embedder = await getEmbedder(embedderOrGetter);
    if (embedder) {
      return embedder.embedText(parsed.query, { mode: "query" });
    }
  }
  throw new Error(
    "search requires either 'vector' or 'query' (query requires embedder to be enabled).",
  );
}

/**
 * Resolves the memorize vector from parsed args: either from vector, or by embedding text when embedder is present.
 */
async function resolveMemorizeVector(
  parsed: {
    id: string;
    text?: string;
    vector?: Record<string, number> | number[];
    metadata?: Record<string, unknown>;
  },
  embedderOrGetter: EmbedderOrGetter,
): Promise<SparseVector> {
  if (parsed.vector !== undefined) {
    return normalizeVector(parsed.vector);
  }
  if (parsed.text !== undefined) {
    const embedder = await getEmbedder(embedderOrGetter);
    if (embedder) {
      return embedder.embedText(parsed.text, { mode: "document" });
    }
  }
  throw new Error(
    "memorize requires either 'vector' or 'text' (text requires embedder to be enabled).",
  );
}

/**
 * Creates the tool handler map bound to the given storage instance.
 * When embedder (or a getter returning one) is provided, search accepts "query" (string) and memorize accepts "text" without a vector.
 * Pass a getter (e.g. () => createFastEmbedEmbedder()) for lazy init so server startup is not blocked by model loading.
 */
export function createToolHandlers(
  storage: VecFSStorage,
  embedderOrGetter: EmbedderOrGetter = null,
): ToolHandlerMap {
  return {
    async search(args: unknown): Promise<ToolResult> {
      const parsed = validateArgs(
        searchArgsSchema,
        ensureVectorIsObjectOrArray(args),
        "search",
      );
      const sparseVector = await resolveSearchVector(parsed, embedderOrGetter);
      const limit = parsed.limit;
      const results = await storage.search(sparseVector, limit);
      const textOut = results.map(({ id, metadata, score, timestamp, similarity }) => ({
        id,
        metadata,
        score,
        timestamp,
        similarity,
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(textOut, null, 2) }],
      };
    },

    async memorize(args: unknown): Promise<ToolResult> {
      const parsed = validateArgs(
        memorizeArgsSchema,
        ensureVectorIsObjectOrArray(args),
        "memorize",
      );
      const sparseVector = await resolveMemorizeVector(parsed, embedderOrGetter);
      await storage.store({
        id: parsed.id,
        vector: sparseVector,
        metadata: { ...parsed.metadata, text: parsed.text },
        score: 0,
      });
      return {
        content: [{ type: "text", text: `Stored entry: ${parsed.id}` }],
      };
    },

    async feedback(args: unknown): Promise<ToolResult> {
      const { id, scoreAdjustment } = validateArgs(
        feedbackArgsSchema,
        args,
        "feedback",
      );
      const found = await storage.updateScore(id, scoreAdjustment);
      if (!found) {
        return {
          content: [{ type: "text", text: `Entry not found: ${id}` }],
        };
      }
      return {
        content: [{ type: "text", text: `Updated score for entry: ${id}` }],
      };
    },

    async delete(args: unknown): Promise<ToolResult> {
      const { id } = validateArgs(deleteArgsSchema, args, "delete");
      const found = await storage.delete(id);
      if (!found) {
        return {
          content: [{ type: "text", text: `Entry not found: ${id}` }],
        };
      }
      return {
        content: [{ type: "text", text: `Deleted entry: ${id}` }],
      };
    },
  };
}
