package embed

import (
	"testing"

	"github.com/WazzaMo/vecfs/internal/config"
)

func TestNewEmbedder_DefaultIsMock(t *testing.T) {
	cfg := &config.Config{}
	cfg.Embed.Provider = ""
	emb, err := NewEmbedder(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if emb.Provider() != ProviderMock {
		t.Errorf("provider = %q, want mock", emb.Provider())
	}
	v, err := emb.Embed("hello world")
	if err != nil {
		t.Fatal(err)
	}
	if len(v) == 0 {
		t.Error("mock should return non-empty vector for normal text")
	}
}

func TestNewEmbedder_ExplicitMock(t *testing.T) {
	cfg := &config.Config{}
	cfg.Embed.Provider = ProviderMock
	emb, err := NewEmbedder(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if emb.Provider() != ProviderMock {
		t.Errorf("provider = %q", emb.Provider())
	}
}

func TestNewEmbedder_UnknownProvider(t *testing.T) {
	cfg := &config.Config{}
	cfg.Embed.Provider = "unknown"
	_, err := NewEmbedder(cfg)
	if err == nil {
		t.Error("expected error for unknown provider")
	}
}

func TestNewEmbedder_LocalConstructs(t *testing.T) {
	cfg := &config.Config{}
	cfg.Embed.Provider = ProviderLocal
	cfg.Embed.LocalURL = "http://localhost:9999"
	cfg.Embed.Threshold = 0.02
	emb, err := NewEmbedder(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if emb.Provider() != ProviderLocal {
		t.Errorf("provider = %q", emb.Provider())
	}
	// Embed will fail without a real server; we only check construction
}

func TestNewEmbedder_HuggingFaceConstructs(t *testing.T) {
	cfg := &config.Config{}
	cfg.Embed.Provider = ProviderHuggingFace
	cfg.Embed.Model = "sentence-transformers/all-MiniLM-L6-v2"
	cfg.Embed.Threshold = 0.01
	emb, err := NewEmbedder(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if emb.Provider() != ProviderHuggingFace {
		t.Errorf("provider = %q", emb.Provider())
	}
}

func TestMockEmbedder_EmbedBatch(t *testing.T) {
	emb := &mockEmbedder{}
	vecs, err := emb.EmbedBatch([]string{"one", "two three"})
	if err != nil {
		t.Fatal(err)
	}
	if len(vecs) != 2 {
		t.Fatalf("len(vecs) = %d, want 2", len(vecs))
	}
	if len(vecs[0]) == 0 && len(vecs[1]) == 0 {
		t.Error("expected at least one non-empty vector")
	}
}
