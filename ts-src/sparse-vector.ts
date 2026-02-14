import { SparseVector } from "./types.js";

export function dotProduct(v1: SparseVector, v2: SparseVector): number {
  let dot = 0;
  const keys1 = Object.keys(v1).map(Number);
  const keys2 = Object.keys(v2).map(Number);
  
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

export function cosineSimilarity(v1: SparseVector, v2: SparseVector): number {
  const n1 = norm(v1);
  const n2 = norm(v2);
  if (n1 === 0 || n2 === 0) return 0;
  return dotProduct(v1, v2) / (n1 * n2);
}

export function toSparse(dense: number[], threshold: number = 0): SparseVector {
  const sparse: SparseVector = {};
  for (let i = 0; i < dense.length; i++) {
    if (Math.abs(dense[i]) > threshold) {
      sparse[i] = dense[i];
    }
  }
  return sparse;
}
