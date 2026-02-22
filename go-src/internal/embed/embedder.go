// Package embed provides text-to-sparse-vector embedding via pluggable providers.
package embed

import (
	"fmt"
	"strings"

	"github.com/WazzaMo/vecfs/internal/config"
	"github.com/WazzaMo/vecfs/internal/sparse"
)

const (
	ProviderMock        = "mock"
	ProviderHuggingFace = "huggingface"
	ProviderLocal       = "local"
)

// Embedder converts text to sparse vectors. Implementations may call remote or local inference.
type Embedder interface {
	// Embed returns a sparse vector for a single text. Caller may use sparse.CosineSimilarity for ranking.
	Embed(text string) (sparse.Vector, error)
	// EmbedBatch returns one sparse vector per input text. Default implementation calls Embed in a loop.
	EmbedBatch(texts []string) ([]sparse.Vector, error)
	// Provider returns the provider name (mock, huggingface, local) for logging and comparison.
	Provider() string
}

// NewEmbedder builds an Embedder from config. Use ProviderMock, ProviderHuggingFace, or ProviderLocal.
func NewEmbedder(cfg *config.Config) (Embedder, error) {
	p := strings.TrimSpace(strings.ToLower(cfg.Embed.Provider))
	if p == "" {
		p = ProviderMock
	}
	switch p {
	case ProviderMock:
		return &mockEmbedder{}, nil
	case ProviderHuggingFace:
		return newHuggingFaceEmbedder(cfg)
	case ProviderLocal:
		return newLocalEmbedder(cfg)
	default:
		return nil, fmt.Errorf("embed: unknown provider %q (use mock, huggingface, or local)", cfg.Embed.Provider)
	}
}

// defaultEmbedBatch implements EmbedBatch by calling Embed for each text.
func defaultEmbedBatch(e Embedder, texts []string) ([]sparse.Vector, error) {
	out := make([]sparse.Vector, len(texts))
	for i, t := range texts {
		v, err := e.Embed(t)
		if err != nil {
			return nil, err
		}
		out[i] = v
	}
	return out, nil
}
