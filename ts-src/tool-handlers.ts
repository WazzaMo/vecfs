import { z } from "zod";
import type { Embedder } from "./embedder/index.js";
import { VecFSStorage } from "./storage.js";
import type { SparseVector } from "./types.js";

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

const searchArgsSchema = z.object({
  query: z.string(),
  limit: z.number().optional(),
});

const memorizeArgsSchema = z.object({
  id: z.string(),
  text: z.string(),
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
 * Resolves the search vector by embedding the query. Embedder is required (text-only API).
 */
async function resolveSearchVector(
  query: string,
  embedderOrGetter: EmbedderOrGetter,
): Promise<SparseVector> {
  const embedder = await getEmbedder(embedderOrGetter);
  if (!embedder) {
    throw new Error("search requires embedder to be enabled (text-only API).");
  }
  return embedder.embedText(query, { mode: "query" });
}

/**
 * Resolves the memorize vector by embedding the text. Embedder is required (text-only API).
 */
async function resolveMemorizeVector(
  text: string,
  embedderOrGetter: EmbedderOrGetter,
): Promise<SparseVector> {
  const embedder = await getEmbedder(embedderOrGetter);
  if (!embedder) {
    throw new Error("memorize requires embedder to be enabled (text-only API).");
  }
  return embedder.embedText(text, { mode: "document" });
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
      const parsed = validateArgs(searchArgsSchema, args, "search");
      const sparseVector = await resolveSearchVector(
        parsed.query,
        embedderOrGetter,
      );
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
      const parsed = validateArgs(memorizeArgsSchema, args, "memorize");
      const sparseVector = await resolveMemorizeVector(
        parsed.text,
        embedderOrGetter,
      );
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
