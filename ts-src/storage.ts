import * as fs from "fs/promises";
import * as path from "path";
import { VecFSEntry, SparseVector, SearchResult } from "./types.js";
import { cosineSimilarity, norm } from "./sparse-vector.js";
import { Mutex } from "./file-mutex.js";

/**
 * Manages the storage and retrieval of vector entries from a local JSONL file.
 *
 * Entries are cached in memory after the first read. All mutations update
 * the cache synchronously and then persist to disk under a mutex so that
 * concurrent operations cannot interleave file writes.
 */
export class VecFSStorage {
  private filePath: string;
  private entries: VecFSEntry[] | null = null;
  private initialized = false;
  private mutex = new Mutex();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Ensures the storage file and its parent directory exist.
   * Safe to call multiple times; only performs I/O on the first invocation.
   */
  async ensureFile(): Promise<void> {
    if (this.initialized) return;
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "");
    }
    this.initialized = true;
  }

  /**
   * Lazily loads all entries from the file into the in-memory cache.
   * Subsequent calls return the cached array without re-reading the file.
   */
  private async loadEntries(): Promise<VecFSEntry[]> {
    if (this.entries !== null) return this.entries;
    await this.ensureFile();
    const content = await fs.readFile(this.filePath, "utf-8");
    const lines = content.trim().split("\n");
    this.entries = [];
    for (const line of lines) {
      if (!line) continue;
      try {
        this.entries.push(JSON.parse(line));
      } catch {
        console.warn(`Skipping malformed line in ${this.filePath}`);
      }
    }
    return this.entries;
  }

  /** Rewrites the entire file from the in-memory cache. */
  private async persistAll(): Promise<void> {
    if (!this.entries) return;
    const content =
      this.entries.length > 0
        ? this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n"
        : "";
    await fs.writeFile(this.filePath, content);
  }

  /** Appends a single entry to the end of the file. */
  private async persistAppend(entry: VecFSEntry): Promise<void> {
    await fs.appendFile(this.filePath, JSON.stringify(entry) + "\n");
  }

  /**
   * Stores an entry. If an entry with the same ID already exists it is
   * replaced (upsert semantics), otherwise the entry is appended.
   *
   * @returns true if a new entry was created, false if an existing entry was updated.
   */
  async store(entry: Omit<VecFSEntry, "timestamp">): Promise<boolean> {
    const release = await this.mutex.acquire();
    try {
      const entries = await this.loadEntries();
      const fullEntry: VecFSEntry = { ...entry, timestamp: Date.now() };
      const existingIndex = entries.findIndex((e) => e.id === entry.id);
      if (existingIndex >= 0) {
        entries[existingIndex] = fullEntry;
        await this.persistAll();
        return false;
      }
      entries.push(fullEntry);
      await this.persistAppend(fullEntry);
      return true;
    } finally {
      release();
    }
  }

  /**
   * Searches the store for entries most similar to the query vector.
   * Pre-computes the query norm once to avoid redundant calculations.
   *
   * @param queryVector - The sparse vector to search for.
   * @param limit - Maximum number of results. Defaults to 5.
   * @returns Search results sorted by descending cosine similarity.
   */
  async search(
    queryVector: SparseVector,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    const entries = await this.loadEntries();
    const queryNorm = norm(queryVector);

    const results: SearchResult[] = entries.map((entry) => ({
      ...entry,
      similarity: cosineSimilarity(queryVector, entry.vector, queryNorm),
    }));

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Adjusts the reinforcement score of an entry.
   *
   * @returns true if the entry was found and updated, false otherwise.
   */
  async updateScore(id: string, scoreAdjustment: number): Promise<boolean> {
    const release = await this.mutex.acquire();
    try {
      const entries = await this.loadEntries();
      const entry = entries.find((e) => e.id === id);
      if (!entry) return false;
      entry.score += scoreAdjustment;
      await this.persistAll();
      return true;
    } finally {
      release();
    }
  }

  /**
   * Removes an entry by ID.
   *
   * @returns true if the entry was found and deleted, false otherwise.
   */
  async delete(id: string): Promise<boolean> {
    const release = await this.mutex.acquire();
    try {
      const entries = await this.loadEntries();
      const index = entries.findIndex((e) => e.id === id);
      if (index < 0) return false;
      entries.splice(index, 1);
      await this.persistAll();
      return true;
    } finally {
      release();
    }
  }
}
