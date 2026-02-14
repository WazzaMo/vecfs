import { z } from "zod";
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

// ---------------------------------------------------------------------------
// Argument schemas (zod)
// ---------------------------------------------------------------------------

const vectorSchema = z.union([
  z.record(z.string(), z.number()),
  z.array(z.number()),
]);

const searchArgsSchema = z.object({
  vector: vectorSchema,
  limit: z.number().optional(),
});

const memorizeArgsSchema = z.object({
  id: z.string(),
  text: z.string().optional(),
  vector: vectorSchema,
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
// Handler factory
// ---------------------------------------------------------------------------

/**
 * Creates the tool handler map bound to the given storage instance.
 */
export function createToolHandlers(storage: VecFSStorage): ToolHandlerMap {
  return {
    async search(args: unknown): Promise<ToolResult> {
      const { vector, limit } = validateArgs(
        searchArgsSchema,
        args,
        "search",
      );
      const sparseVector = normalizeVector(vector);
      const results = await storage.search(sparseVector, limit);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },

    async memorize(args: unknown): Promise<ToolResult> {
      const { id, text, vector, metadata } = validateArgs(
        memorizeArgsSchema,
        args,
        "memorize",
      );
      const sparseVector = normalizeVector(vector);
      await storage.store({
        id,
        vector: sparseVector,
        metadata: { ...metadata, text },
        score: 0,
      });
      return {
        content: [{ type: "text", text: `Stored entry: ${id}` }],
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
