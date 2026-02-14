import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { VecFSStorage } from "./storage.js";
import * as fs from "fs/promises";

describe("VecFSStorage", () => {
  const testFilePath = "./test-storage.jsonl";

  beforeEach(async () => {
    try {
      await fs.unlink(testFilePath);
    } catch {}
  });

  afterEach(async () => {
    try {
      await fs.unlink(testFilePath);
    } catch {}
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
      score: 0,
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
      score: 10,
    });

    const found = await storage.updateScore("1", 5);
    expect(found).toBe(true);

    const results = await storage.search({ 0: 1 });
    expect(results[0].score).toBe(15);
  });

  it("should sort search results by similarity", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    await storage.store({ id: "1", vector: { 0: 1 }, metadata: {}, score: 0 });
    await storage.store({
      id: "2",
      vector: { 0: 0.5 },
      metadata: {},
      score: 0,
    });

    const results = await storage.search({ 0: 1 });
    expect(results[0].id).toBe("1");
    expect(results[1].id).toBe("2");
  });

  it("should return empty results for empty store", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    const results = await storage.search({ 0: 1 });
    expect(results).toHaveLength(0);
  });

  it("should upsert when storing with duplicate ID", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    const isNew1 = await storage.store({
      id: "dup",
      vector: { 0: 1 },
      metadata: { version: "first" },
      score: 0,
    });
    expect(isNew1).toBe(true);

    const isNew2 = await storage.store({
      id: "dup",
      vector: { 0: 1 },
      metadata: { version: "second" },
      score: 5,
    });
    expect(isNew2).toBe(false);

    const results = await storage.search({ 0: 1 });
    const dupes = results.filter((r) => r.id === "dup");
    expect(dupes).toHaveLength(1);
    expect(dupes[0].metadata.version).toBe("second");
    expect(dupes[0].score).toBe(5);
  });

  it("should return false when updating score for nonexistent ID", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    const found = await storage.updateScore("nonexistent", 5);
    expect(found).toBe(false);
  });

  it("should delete an existing entry", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    await storage.store({
      id: "to-delete",
      vector: { 0: 1 },
      metadata: {},
      score: 0,
    });

    const deleted = await storage.delete("to-delete");
    expect(deleted).toBe(true);

    const results = await storage.search({ 0: 1 });
    expect(results.find((r) => r.id === "to-delete")).toBeUndefined();
  });

  it("should return false when deleting nonexistent entry", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    const deleted = await storage.delete("nonexistent");
    expect(deleted).toBe(false);
  });

  it("should handle concurrent updateScore calls safely", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    await storage.store({
      id: "concurrent",
      vector: { 0: 1 },
      metadata: {},
      score: 0,
    });

    const promises = Array.from({ length: 10 }, () =>
      storage.updateScore("concurrent", 1),
    );
    await Promise.all(promises);

    const results = await storage.search({ 0: 1 });
    const entry = results.find((r) => r.id === "concurrent");
    expect(entry).toBeDefined();
    expect(entry!.score).toBe(10);
  });

  it("should persist data correctly after delete", async () => {
    const storage = new VecFSStorage(testFilePath);
    await storage.ensureFile();

    await storage.store({
      id: "keep",
      vector: { 0: 1 },
      metadata: {},
      score: 0,
    });
    await storage.store({
      id: "remove",
      vector: { 1: 1 },
      metadata: {},
      score: 0,
    });
    await storage.delete("remove");

    // Read from a fresh instance to verify file persistence
    const storage2 = new VecFSStorage(testFilePath);
    const results = await storage2.search({ 0: 1 }, 10);

    expect(results.find((r) => r.id === "keep")).toBeDefined();
    expect(results.find((r) => r.id === "remove")).toBeUndefined();
  });
});
