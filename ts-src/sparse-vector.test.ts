import { describe, it, expect } from "vitest";
import {
  dotProduct,
  norm,
  cosineSimilarity,
  toSparse,
} from "./sparse-vector.js";

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

    it("should handle vectors with negative values", () => {
      const v1 = { 0: -1, 1: 2 };
      const v2 = { 0: 1, 1: -2 };
      // (-1 * 1) + (2 * -2) = -5
      expect(dotProduct(v1, v2)).toBe(-5);
    });

    it("should handle single dimension vectors", () => {
      const v1 = { 42: 3 };
      const v2 = { 42: 4 };
      expect(dotProduct(v1, v2)).toBe(12);
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

    it("should handle large sparse vectors", () => {
      const v: Record<number, number> = {};
      for (let i = 0; i < 1000; i += 10) {
        v[i] = 1;
      }
      // 100 entries each with value 1 → norm = sqrt(100) = 10
      expect(norm(v)).toBe(10);
    });

    it("should handle vectors with negative values", () => {
      const v = { 0: -3, 1: -4 };
      expect(norm(v)).toBe(5);
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

    it("should handle single dimension vectors", () => {
      const v1 = { 42: 3 };
      const v2 = { 42: 7 };
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(1);
    });

    it("should accept pre-computed v1 norm", () => {
      const v1 = { 0: 3, 1: 4 };
      const v2 = { 0: 3, 1: 4 };
      const preNorm = norm(v1);
      expect(cosineSimilarity(v1, v2, preNorm)).toBeCloseTo(1);
    });

    it("should produce same result with and without pre-computed norm", () => {
      const v1 = { 0: 1, 5: 0.5, 10: 2 };
      const v2 = { 0: 0.3, 5: 1, 20: 0.7 };
      const withoutPreNorm = cosineSimilarity(v1, v2);
      const withPreNorm = cosineSimilarity(v1, v2, norm(v1));
      expect(withPreNorm).toBeCloseTo(withoutPreNorm);
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

    it("should return empty object for empty array", () => {
      expect(toSparse([])).toEqual({});
    });

    it("should return empty object for all-zero array", () => {
      expect(toSparse([0, 0, 0])).toEqual({});
    });

    it("should handle negative values", () => {
      const dense = [-1, 0, 2];
      expect(toSparse(dense)).toEqual({ 0: -1, 2: 2 });
    });
  });
});
