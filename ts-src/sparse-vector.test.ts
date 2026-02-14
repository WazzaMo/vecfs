import { describe, it, expect } from "vitest";
import { dotProduct, norm, cosineSimilarity, toSparse } from "./sparse-vector.js";

describe("sparse-vector", () => {
  describe("dotProduct", () => {
    it("should calculate dot product for identical sparse vectors", () => {
      const v = { 0: 1, 10: 2 };
      expect(dotProduct(v, v)).toBe(5);
    });

    it("should calculate dot product for partially overlapping vectors", () => {
      const v1 = { 0: 1, 1: 2 };
      const v2 = { 1: 3, 2: 4 };
      expect(dotProduct(v1, v2)).toBe(6);
    });

    it("should return 0 for non-overlapping vectors", () => {
      const v1 = { 0: 1 };
      const v2 = { 1: 1 };
      expect(dotProduct(v1, v2)).toBe(0);
    });
  });

  describe("norm", () => {
    it("should calculate norm correctly", () => {
      const v = { 0: 3, 1: 4 };
      expect(norm(v)).toBe(5);
    });

    it("should return 0 for empty vector", () => {
      expect(norm({})).toBe(0);
    });
  });

  describe("cosineSimilarity", () => {
    it("should return 1 for identical vectors", () => {
      const v = { 0: 1, 1: 1 };
      expect(cosineSimilarity(v, v)).toBeCloseTo(1);
    });

    it("should return 0 for orthogonal vectors", () => {
      const v1 = { 0: 1 };
      const v2 = { 1: 1 };
      expect(cosineSimilarity(v1, v2)).toBe(0);
    });

    it("should handle empty vectors", () => {
      expect(cosineSimilarity({}, { 0: 1 })).toBe(0);
    });
  });

  describe("toSparse", () => {
    it("should convert dense to sparse", () => {
      const dense = [0, 1, 0, 2];
      expect(toSparse(dense)).toEqual({ 1: 1, 3: 2 });
    });

    it("should respect threshold", () => {
      const dense = [0.1, 1, 0.05, 2];
      expect(toSparse(dense, 0.2)).toEqual({ 1: 1, 3: 2 });
    });
  });
});
