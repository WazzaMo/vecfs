import type { Embedder } from "./embedder.js";
import type { EmbedderProvider } from "../config.js";
import { createFastEmbedEmbedder } from "./embedder.js";
import { createTransformersJsEmbedder } from "./transformers-embedder.js";
import { createOnnxEmbedder } from "./onnx-embedder.js";

/**
 * Creates an embedder based on the configured provider.
 * Returns a getter so the embedder is lazily initialised on first use.
 */
export function createEmbedderGetter(
  provider: EmbedderProvider,
  modelId?: string,
): () => Promise<Embedder | null> {
  return async (): Promise<Embedder | null> => {
    switch (provider) {
      case "transformers":
        return createTransformersJsEmbedder(modelId);
      case "onnx":
        return createOnnxEmbedder(modelId);
      case "fastembed":
      default:
        return createFastEmbedEmbedder();
    }
  };
}
