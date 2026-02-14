import * as fs from "fs/promises";
import * as path from "path";
import { VecFSEntry, SparseVector, SearchResult } from "./types.js";
import { cosineSimilarity } from "./sparse-vector.js";

/**
 * Manages the storage and retrieval of vector entries from a local file.
 * The data is stored in a JSON Lines (JSONL) format, where each line is a valid JSON object.
 */
export class VecFSStorage {
  private filePath: string;

  /**
   * Creates a new instance of VecFSStorage.
   * 
   * @param filePath - The absolute or relative path to the local storage file.
   */
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Ensures that the storage file and its parent directory exist.
   * If the file does not exist, it is created with empty content.
   * 
   * @throws {Error} If the directory cannot be created or the file cannot be written to.
   */
  async ensureFile(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "");
    }
  }

  /**
   * Stores a new entry in the local vector file.
   * The entry is appended to the file as a JSON string on a new line.
   * 
   * @param entry - The entry data to store (excluding the timestamp, which is auto-generated).
   * @throws {Error} If the file write operation fails.
   */
  async store(entry: Omit<VecFSEntry, "timestamp">): Promise<void> {
    const fullEntry: VecFSEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    await fs.appendFile(this.filePath, JSON.stringify(fullEntry) + "\n");
  }

  /**
   * Searches the vector store for entries similar to the query vector.
   * The search is performed by calculating the cosine similarity between the query vector and all stored vectors.
   * 
   * @param queryVector - The sparse vector to search for.
   * @param limit - The maximum number of results to return. Defaults to 5.
   * @returns An array of SearchResult objects, sorted by similarity in descending order.
   * @throws {Error} If the file read operation fails or the file content is invalid JSON.
   */
  async search(queryVector: SparseVector, limit: number = 5): Promise<SearchResult[]> {
    const content = await fs.readFile(this.filePath, "utf-8");
    const lines = content.trim().split("\n");
    const results: SearchResult[] = [];

    for (const line of lines) {
      if (!line) continue;
      try {
        const entry: VecFSEntry = JSON.parse(line);
        const similarity = cosineSimilarity(queryVector, entry.vector);
        results.push({ ...entry, similarity });
      } catch (e) {
        // Skip malformed lines gracefully
        console.warn(`Skipping malformed line in ${this.filePath}`);
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Updates the reinforcement score of a specific entry.
   * This method rewrites the entire file, which may be slow for very large datasets.
   * 
   * @param id - The unique identifier of the entry to update.
   * @param scoreAdjustment - The amount to add to the current score (can be negative).
   * @throws {Error} If the file read/write operation fails.
   */
  async updateScore(id: string, scoreAdjustment: number): Promise<void> {
    const content = await fs.readFile(this.filePath, "utf-8");
    const lines = content.trim().split("\n");
    const updatedLines = lines.map((line: string) => {
      if (!line) return line;
      try {
        const entry: VecFSEntry = JSON.parse(line);
        if (entry.id === id) {
          entry.score += scoreAdjustment;
        }
        return JSON.stringify(entry);
      } catch (e) {
         return line; // Preserve malformed lines as-is during rewrite
      }
    });

    await fs.writeFile(this.filePath, updatedLines.join("\n") + "\n");
  }
}
