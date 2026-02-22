// Package sparse provides sparse vector math: dot product, norm, cosine similarity,
// and dense-to-sparse conversion. Matches ts-src/sparse-vector.ts behaviour.
package sparse

import (
	"math"
	"strconv"
)

// Vector is a sparse vector: key = dimension index (string for JSON), value = magnitude.
type Vector map[string]float64

// DotProduct computes the dot product of two sparse vectors.
// Iterates over the smaller vector for efficiency (matches TS).
func DotProduct(v1, v2 Vector) float64 {
	if len(v1) > len(v2) {
		v1, v2 = v2, v1
	}
	var dot float64
	for k, s := range v1 {
		if l, ok := v2[k]; ok {
			dot += s * l
		}
	}
	return dot
}

// Norm returns the Euclidean norm (L2 magnitude) of the sparse vector.
func Norm(v Vector) float64 {
	var sumSq float64
	for _, x := range v {
		sumSq += x * x
	}
	return math.Sqrt(sumSq)
}

// CosineSimilarity returns the cosine similarity between two vectors (0 to 1).
// If v1Norm >= 0 it is used as the pre-computed norm of v1 to avoid recomputation.
// Pass -1 to compute it.
func CosineSimilarity(v1, v2 Vector, v1Norm float64) float64 {
	if v1Norm < 0 {
		v1Norm = Norm(v1)
	}
	n2 := Norm(v2)
	if v1Norm == 0 || n2 == 0 {
		return 0
	}
	return DotProduct(v1, v2) / (v1Norm * n2)
}

// ToSparse converts a dense slice to a sparse vector.
// Only values with absolute value > threshold are kept (matches TS toSparse).
func ToSparse(dense []float64, threshold float64) Vector {
	out := make(Vector)
	for i, x := range dense {
		if math.Abs(x) > threshold {
			out[intKey(i)] = x
		}
	}
	return out
}

func intKey(i int) string {
	return strconv.Itoa(i)
}
