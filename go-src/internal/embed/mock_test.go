package embed

import (
	"testing"
)

// Tests match expectations from ts-src integration mock and py-src output shape.

func TestMockEmbed_EmptyText(t *testing.T) {
	v := MockEmbed("")
	if len(v) != 0 {
		t.Errorf("empty text should give empty vector, got %d keys", len(v))
	}
}

func TestMockEmbed_ShortWordsIgnored(t *testing.T) {
	v := MockEmbed("a b c")
	if len(v) != 0 {
		t.Errorf("words len<=2 ignored, got %d keys", len(v))
	}
}

func TestMockEmbed_ProducesSparseVector(t *testing.T) {
	v := MockEmbed("hello world test")
	if len(v) == 0 {
		t.Error("expected non-empty vector for normal text")
	}
	for k, x := range v {
		if k == "" || x == 0 {
			t.Errorf("invalid entry %q: %v", k, x)
		}
	}
}

func TestMockEmbed_L2Normalised(t *testing.T) {
	v := MockEmbed("sparse vector storage efficiency")
	if len(v) == 0 {
		t.Skip("mock produced no dimensions")
	}
	var sumSq float64
	for _, x := range v {
		sumSq += x * x
	}
	if sumSq < 0.99 || sumSq > 1.01 {
		t.Errorf("expected L2 norm 1, got sumSq=%f", sumSq)
	}
}
