import { SparseVector } from "./types.js";

/**
 * Calculates the dot product of two sparse vectors.
 * The dot product is the sum of the products of the corresponding entries of the two sequences of numbers.
 * 
 * @param v1 - The first sparse vector.
 * @param v2 - The second sparse vector.
 * @returns The dot product (scalar) of the two vectors.
 */
export function dotProduct(v1: SparseVector, v2: SparseVector): number {
  let dot = 0;
  const keys1 = Object.keys(v1).map(Number);
  const keys2 = Object.keys(v2).map(Number);
  
  // Iterate over the smaller vector to optimize performance
  const [smaller, larger] = keys1.length < keys2.length ? [v1, v2] : [v2, v1];
  
  for (const indexStr in smaller) {
    const index = Number(indexStr);
    const valL = larger[index];
    const valS = smaller[index];
    if (valL !== undefined && valS !== undefined) {
      dot += valS * valL;
    }
  }
  return dot;
}

/**
 * Calculates the Euclidean norm (magnitude) of a sparse vector.
 * The norm is the square root of the sum of the squares of the vector components.
 * 
 * @param v - The sparse vector.
 * @returns The Euclidean norm (magnitude) of the vector.
 */
export function norm(v: SparseVector): number {
  let sumSq = 0;
  for (const indexStr in v) {
    const index = Number(indexStr);
    const val = v[index];
    if (val !== undefined) {
      sumSq += val * val;
    }
  }
  return Math.sqrt(sumSq);
}

/**
 * Calculates the cosine similarity between two sparse vectors.
 * Cosine similarity is a measure of similarity between two non-zero vectors of an inner product space.
 * It is defined as the cosine of the angle between the two vectors.
 * 
 * @param v1 - The first sparse vector (e.g., query vector).
 * @param v2 - The second sparse vector (e.g., document vector).
 * @returns A value between 0 (orthogonal) and 1 (identical), representing the similarity. 
 *          Returns 0 if either vector has a norm of 0.
 */
export function cosineSimilarity(v1: SparseVector, v2: SparseVector): number {
  const n1 = norm(v1);
  const n2 = norm(v2);
  if (n1 === 0 || n2 === 0) return 0;
  return dotProduct(v1, v2) / (n1 * n2);
}

/**
 * Converts a dense array representation of a vector into a sparse vector object.
 * Only values with an absolute magnitude greater than the threshold are stored.
 * 
 * @param dense - An array of numbers representing the dense vector.
 * @param threshold - The minimum absolute value required for a component to be included in the sparse vector. Defaults to 0.
 * @returns A SparseVector object containing only the significant components.
 */
export function toSparse(dense: number[], threshold: number = 0): SparseVector {
  const sparse: SparseVector = {};
  for (let i = 0; i < dense.length; i++) {
    if (Math.abs(dense[i]) > threshold) {
      sparse[i] = dense[i];
    }
  }
  return sparse;
}
