/**
 * Represents a sparse vector where only non-zero elements are stored.
 * The key is the dimension index (number), and the value is the magnitude.
 */
export interface SparseVector {
  [index: number]: number;
}

/**
 * Represents a single entry in the VecFS storage system.
 */
export interface VecFSEntry {
  /** Unique identifier for the entry. */
  id: string;
  /** Arbitrary metadata associated with the vector (e.g., text content, tags). */
  metadata: Record<string, any>;
  /** The sparse vector representation of the content. */
  vector: SparseVector;
  /** Reinforcement learning score, used to rank search results. */
  score: number;
  /** Timestamp when the entry was created or last modified (milliseconds since epoch). */
  timestamp: number;
}

/**
 * Represents a search result returned by the query engine.
 * Extends the standard entry with a similarity score.
 */
export interface SearchResult extends VecFSEntry {
  /** Cosine similarity score between the query vector and this entry (0 to 1). */
  similarity: number;
}
