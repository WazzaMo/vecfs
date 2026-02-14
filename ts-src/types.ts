export interface SparseVector {
  [index: number]: number;
}

export interface VecFSEntry {
  id: string;
  metadata: Record<string, any>;
  vector: SparseVector;
  score: number;
  timestamp: number;
}

export interface SearchResult extends VecFSEntry {
  similarity: number;
}
