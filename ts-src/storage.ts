import * as fs from "fs/promises";
import * as path from "path";
import { VecFSEntry, SparseVector, SearchResult } from "./types.js";
import { cosineSimilarity } from "./sparse-vector.js";

export class VecFSStorage {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async ensureFile(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, "");
    }
  }

  async store(entry: Omit<VecFSEntry, "timestamp">): Promise<void> {
    const fullEntry: VecFSEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    await fs.appendFile(this.filePath, JSON.stringify(fullEntry) + "\n");
  }

  async search(queryVector: SparseVector, limit: number = 5): Promise<SearchResult[]> {
    const content = await fs.readFile(this.filePath, "utf-8");
    const lines = content.trim().split("\n");
    const results: SearchResult[] = [];

    for (const line of lines) {
      if (!line) continue;
      const entry: VecFSEntry = JSON.parse(line);
      const similarity = cosineSimilarity(queryVector, entry.vector);
      results.push({ ...entry, similarity });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async updateScore(id: string, scoreAdjustment: number): Promise<void> {
    const content = await fs.readFile(this.filePath, "utf-8");
    const lines = content.trim().split("\n");
    const updatedLines = lines.map((line: string) => {
      if (!line) return line;
      const entry: VecFSEntry = JSON.parse(line);
      if (entry.id === id) {
        entry.score += scoreAdjustment;
      }
      return JSON.stringify(entry);
    });

    await fs.writeFile(this.filePath, updatedLines.join("\n") + "\n");
  }
}
