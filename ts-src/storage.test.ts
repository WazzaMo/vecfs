import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VecFSStorage } from "./storage.js";
import * as fs from "fs/promises";
import * as path from "path";

describe("VecFSStorage", () => {
  const testFilePath = "./test-storage.jsonl";

  beforeEach(async () => {
    try {
      await fs.unlink(testFilePath);
    } catch (e) {}
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFilePath);
    } catch (e) {}
  });

  it("should ensure file exists", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();
    await expect(fs.access(testFilePath)).resolves.toBeUndefined();
  });

  it("should store and search entries", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    const entry = {
      id: "1",
      vector: { 0: 1 },
      metadata: { text: "test" },
      score: 0
    };

    await storage.store(entry);
    const results = await storage.search({ 0: 1 });
    
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("1");
    expect(results[0].similarity).toBe(1);
  });

  it("should update scores", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    await storage.store({
      id: "1",
      vector: { 0: 1 },
      metadata: { text: "test" },
      score: 10
    });

    await storage.updateScore("1", 5);
    const results = await storage.search({ 0: 1 });
    
    expect(results[0].score).toBe(15);
  });

  it("should sort search results by similarity", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    await storage.store({ id: "1", vector: { 0: 1 }, metadata: {}, score: 0 });
    await storage.store({ id: "2", vector: { 0: 0.5 }, metadata: {}, score: 0 });

    const results = await storage.search({ 0: 1 });
    expect(results[0].id).toBe("1");
    expect(results[1].id).toBe("2");
  });
});
