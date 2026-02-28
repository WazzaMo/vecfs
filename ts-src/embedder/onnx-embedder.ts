import {
  AutoModel,
  AutoTokenizer,
  mean_pooling,
  Tensor,
} from "@huggingface/transformers";
import { toSparse } from "../sparse-vector.js";
import type { Embedder, EmbedderOptions } from "./embedder.js";
import type { SparseVector } from "../types.js";

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Builds an embedder using ONNX models directly via AutoModel and AutoTokenizer.
 * Lower-level than the feature-extraction pipeline; uses mean pooling manually.
 * Returns null if the modules are not available or init fails.
 */
export async function createOnnxEmbedder(
  modelId: string = DEFAULT_MODEL,
): Promise<Embedder | null> {
  try {
    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(modelId),
      AutoModel.from_pretrained(modelId),
    ]);

    return {
      async embedText(
        text: string,
        options: EmbedderOptions = {},
      ): Promise<SparseVector> {
        const threshold = options.threshold ?? 0.01;

        const { input_ids, attention_mask } = await tokenizer(text, {
          padding: true,
          truncation: true,
          return_tensor: true,
        });

        const outputs = await model.forward({
          input_ids,
          attention_mask,
        });

        const lastHiddenState = outputs.last_hidden_state;
        if (!lastHiddenState) {
          throw new Error("Model did not return last_hidden_state");
        }

        const pooled = mean_pooling(
          lastHiddenState as Tensor,
          attention_mask as Tensor,
        );

        const dense = Array.from(pooled.data as Float32Array);
        const norm = Math.sqrt(dense.reduce((s, x) => s + x * x, 0));
        if (norm > 0) {
          for (let i = 0; i < dense.length; i++) {
            dense[i] /= norm;
          }
        }

        return toSparse(dense, threshold, true);
      },
    };
  } catch {
    return null;
  }
}
