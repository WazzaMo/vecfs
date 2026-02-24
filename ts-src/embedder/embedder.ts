import { toSparse } from "../sparse-vector.js";
import { SparseVector } from "../types.js";

/**
 * Options for embedding text and converting to a sparse vector.
 */
export interface EmbedderOptions {
  /** Use "document" for passages to store; "query" for search queries. */
  mode?: "document" | "query";
  /** Minimum absolute value to keep when sparsifying. Default 0.01. */
  threshold?: number;
}

/**
 * Embeds text and returns a VecFS-compatible sparse vector.
 * Implementations may use fastembed-js, Transformers.js, or other backends.
 */
export interface Embedder {
  /**
   * Embeds a single text and returns a sparse vector (L2-normalised, then thresholded).
   */
  embedText(text: string, options?: EmbedderOptions): Promise<SparseVector>;
}

/**
 * Builds an embedder that uses fastembed-js (FlagEmbedding).
 * Returns null if the fastembed module is not available or init fails.
 */
export async function createFastEmbedEmbedder(): Promise<Embedder | null> {
  try {
    const { FlagEmbedding, EmbeddingModel } = await import("fastembed");
    const model = await FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
    });

    return {
      async embedText(
        text: string,
        options: EmbedderOptions = {},
      ): Promise<SparseVector> {
        const mode = options.mode ?? "document";
        const threshold = options.threshold ?? 0.01;

        let dense: number[];
        if (mode === "query") {
          dense = await model.queryEmbed(text);
        } else {
          dense = [];
          for await (const batch of model.passageEmbed([text], 1)) {
            if (batch[0]) dense = batch[0] as number[];
            break;
          }
        }

        return toSparse(dense, threshold, true);
      },
    };
  } catch {
    return null;
  }
}
