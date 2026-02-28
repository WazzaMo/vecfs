import { pipeline } from "@huggingface/transformers";
import { toSparse } from "../sparse-vector.js";
import type { Embedder, EmbedderOptions } from "./embedder.js";
import type { SparseVector } from "../types.js";

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Builds an embedder using Transformers.js (feature-extraction pipeline).
 * Returns null if the module is not available or init fails.
 */
export async function createTransformersJsEmbedder(
  modelId: string = DEFAULT_MODEL,
): Promise<Embedder | null> {
  try {
    const extractor = await pipeline("feature-extraction", modelId);

    return {
      async embedText(
        text: string,
        options: EmbedderOptions = {},
      ): Promise<SparseVector> {
        const threshold = options.threshold ?? 0.01;

        const output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });

        const dense = Array.from(output.data as Float32Array);
        return toSparse(dense, threshold, true);
      },
    };
  } catch {
    return null;
  }
}
