export {
  createFastEmbedEmbedder,
  type Embedder,
  type EmbedderOptions,
} from "./embedder.js";
export { createTransformersJsEmbedder } from "./transformers-embedder.js";
export { createOnnxEmbedder } from "./onnx-embedder.js";
export { createEmbedderGetter } from "./embedder-factory.js";
