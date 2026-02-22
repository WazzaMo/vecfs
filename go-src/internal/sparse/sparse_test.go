package sparse

import (
	"math"
	"strconv"
	"testing"
)

// Tests match ts-src/sparse-vector.test.ts and py-src/tests/test_sparsify.py behaviour.

func TestDotProduct(t *testing.T) {
	t.Run("identical sparse vectors", func(t *testing.T) {
		v := Vector{"0": 1, "10": 2}
		got := DotProduct(v, v)
		if got != 5 {
			t.Errorf("DotProduct(v,v) = %v, want 5", got)
		}
	})
	t.Run("partially overlapping vectors", func(t *testing.T) {
		v1 := Vector{"0": 1, "1": 2}
		v2 := Vector{"1": 3, "2": 4}
		got := DotProduct(v1, v2)
		if got != 6 {
			t.Errorf("DotProduct = %v, want 6", got)
		}
	})
	t.Run("non-overlapping vectors", func(t *testing.T) {
		v1 := Vector{"0": 1}
		v2 := Vector{"1": 1}
		got := DotProduct(v1, v2)
		if got != 0 {
			t.Errorf("DotProduct = %v, want 0", got)
		}
	})
	t.Run("negative values", func(t *testing.T) {
		v1 := Vector{"0": -1, "1": 2}
		v2 := Vector{"0": 1, "1": -2}
		got := DotProduct(v1, v2)
		if got != -5 {
			t.Errorf("DotProduct = %v, want -5", got)
		}
	})
	t.Run("single dimension", func(t *testing.T) {
		v1 := Vector{"42": 3}
		v2 := Vector{"42": 4}
		got := DotProduct(v1, v2)
		if got != 12 {
			t.Errorf("DotProduct = %v, want 12", got)
		}
	})
}

func TestNorm(t *testing.T) {
	t.Run("correct norm", func(t *testing.T) {
		v := Vector{"0": 3, "1": 4}
		got := Norm(v)
		if got != 5 {
			t.Errorf("Norm = %v, want 5", got)
		}
	})
	t.Run("empty vector", func(t *testing.T) {
		got := Norm(Vector{})
		if got != 0 {
			t.Errorf("Norm(empty) = %v, want 0", got)
		}
	})
	t.Run("large sparse", func(t *testing.T) {
		v := make(Vector)
		for i := 0; i < 1000; i += 10 {
			v[strconv.Itoa(i)] = 1
		}
		got := Norm(v)
		if math.Abs(got-10) > 1e-9 {
			t.Errorf("Norm = %v, want 10", got)
		}
	})
	t.Run("negative values", func(t *testing.T) {
		v := Vector{"0": -3, "1": -4}
		got := Norm(v)
		if got != 5 {
			t.Errorf("Norm = %v, want 5", got)
		}
	})
}

func TestCosineSimilarity(t *testing.T) {
	t.Run("identical vectors", func(t *testing.T) {
		v := Vector{"0": 1, "1": 1}
		got := CosineSimilarity(v, v, -1)
		if math.Abs(got-1) > 1e-9 {
			t.Errorf("CosineSimilarity = %v, want 1", got)
		}
	})
	t.Run("orthogonal", func(t *testing.T) {
		v1 := Vector{"0": 1}
		v2 := Vector{"1": 1}
		got := CosineSimilarity(v1, v2, -1)
		if got != 0 {
			t.Errorf("CosineSimilarity = %v, want 0", got)
		}
	})
	t.Run("empty vector", func(t *testing.T) {
		got := CosineSimilarity(Vector{}, Vector{"0": 1}, -1)
		if got != 0 {
			t.Errorf("CosineSimilarity(empty,v) = %v, want 0", got)
		}
	})
	t.Run("single dimension", func(t *testing.T) {
		v1 := Vector{"42": 3}
		v2 := Vector{"42": 7}
		got := CosineSimilarity(v1, v2, -1)
		if math.Abs(got-1) > 1e-9 {
			t.Errorf("CosineSimilarity = %v, want 1", got)
		}
	})
	t.Run("pre-computed v1 norm", func(t *testing.T) {
		v1 := Vector{"0": 3, "1": 4}
		v2 := Vector{"0": 3, "1": 4}
		preNorm := Norm(v1)
		got := CosineSimilarity(v1, v2, preNorm)
		if math.Abs(got-1) > 1e-9 {
			t.Errorf("CosineSimilarity = %v, want 1", got)
		}
	})
	t.Run("same with and without pre-computed norm", func(t *testing.T) {
		v1 := Vector{"0": 1, "5": 0.5, "10": 2}
		v2 := Vector{"0": 0.3, "5": 1, "20": 0.7}
		without := CosineSimilarity(v1, v2, -1)
		with := CosineSimilarity(v1, v2, Norm(v1))
		if math.Abs(with-without) > 1e-9 {
			t.Errorf("with=%v without=%v", with, without)
		}
	})
}

func TestToSparse(t *testing.T) {
	t.Run("dense to sparse", func(t *testing.T) {
		dense := []float64{0, 1, 0, 2}
		got := ToSparse(dense, 0)
		want := Vector{"1": 1, "3": 2}
		for k, v := range want {
			if g, ok := got[k]; !ok || g != v {
				t.Errorf("ToSparse: key %s got %v want %v", k, got[k], v)
			}
		}
		for k, v := range got {
			if w, ok := want[k]; !ok || w != v {
				t.Errorf("ToSparse: key %s got %v want %v", k, v, want[k])
			}
		}
	})
	t.Run("respect threshold", func(t *testing.T) {
		dense := []float64{0.1, 1, 0.05, 2}
		got := ToSparse(dense, 0.2)
		if got["1"] != 1 || got["3"] != 2 || len(got) != 2 {
			t.Errorf("ToSparse(0.2) = %v, want {1:1, 3:2}", got)
		}
	})
	t.Run("empty array", func(t *testing.T) {
		got := ToSparse([]float64{}, 0)
		if len(got) != 0 {
			t.Errorf("ToSparse([]) = %v", got)
		}
	})
	t.Run("all zero", func(t *testing.T) {
		got := ToSparse([]float64{0, 0, 0}, 0)
		if len(got) != 0 {
			t.Errorf("ToSparse([0,0,0]) = %v", got)
		}
	})
	t.Run("negative values", func(t *testing.T) {
		dense := []float64{-1, 0, 2}
		got := ToSparse(dense, 0)
		if got["0"] != -1 || got["2"] != 2 || len(got) != 2 {
			t.Errorf("ToSparse = %v", got)
		}
	})
}
