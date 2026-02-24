import { SparseVector } from "./types.js";

/**
 * Calculates the dot product of two sparse vectors.
 * Iterates over the smaller vector for efficiency.
 *
 * @param v1 - The first sparse vector.
 * @param v2 - The second sparse vector.
 * @returns The dot product (scalar) of the two vectors.
 */
export function dotProduct(v1: SparseVector, v2: SparseVector): number {
  let dot = 0;

  const [smaller, larger] =
    Object.keys(v1).length <= Object.keys(v2).length ? [v1, v2] : [v2, v1];

  for (const key of Object.keys(smaller)) {
    const index = Number(key);
    const valS = smaller[index];
    const valL = larger[index];
    if (valL !== undefined && valS !== undefined) {
      dot += valS * valL;
    }
  }
  return dot;
}

/**
 * Calculates the Euclidean norm (magnitude) of a sparse vector.
 *
 * @param v - The sparse vector.
 * @returns The Euclidean norm of the vector.
 */
export function norm(v: SparseVector): number {
  let sumSq = 0;
  for (const val of Object.values(v)) {
    sumSq += val * val;
  }
  return Math.sqrt(sumSq);
}

/**
 * Calculates the cosine similarity between two sparse vectors.
 *
 * An optional pre-computed norm for v1 can be supplied to avoid
 * recalculating it when the same query vector is compared against
 * many document vectors (as in a search loop).
 *
 * @param v1 - The first sparse vector (e.g., query vector).
 * @param v2 - The second sparse vector (e.g., document vector).
 * @param v1Norm - Optional pre-computed norm of v1.
 * @returns A value between 0 and 1 representing similarity.
 *          Returns 0 if either vector has a norm of 0.
 */
export function cosineSimilarity(
  v1: SparseVector,
  v2: SparseVector,
  v1Norm?: number,
): number {
  const n1 = v1Norm ?? norm(v1);
  const n2 = norm(v2);
  if (n1 === 0 || n2 === 0) return 0;
  return dotProduct(v1, v2) / (n1 * n2);
}

/**
 * Euclidean norm of a dense vector (used for L2 normalisation before sparsifying).
 */
export function denseNorm(dense: number[]): number {
  let sumSq = 0;
  for (let i = 0; i < dense.length; i++) {
    const v = dense[i];
    sumSq += v * v;
  }
  return Math.sqrt(sumSq);
}

/**
 * Converts a dense array representation into a sparse vector.
 * Only values with an absolute magnitude greater than the threshold are stored.
 * When normalise is true, the dense vector is L2-normalised before thresholding
 * (aligns with Python vecfs_embed behaviour).
 *
 * @param dense - An array of numbers representing the dense vector.
 * @param threshold - Minimum absolute value to include. Defaults to 0.
 * @param normalise - If true, L2-normalise the dense vector before applying threshold. Defaults to false.
 * @returns A SparseVector containing only the significant components.
 */
export function toSparse(
  dense: number[],
  threshold: number = 0,
  normalise: boolean = false,
): SparseVector {
  let work = dense;
  if (normalise && dense.length > 0) {
    const n = denseNorm(dense);
    if (n > 0) {
      work = dense.map((v) => v / n);
    }
  }
  const sparse: SparseVector = {};
  for (let i = 0; i < work.length; i++) {
    if (Math.abs(work[i]) > threshold) {
      sparse[i] = work[i];
    }
  }
  return sparse;
}
