package embed

import (
	"github.com/WazzaMo/vecfs/internal/sparse"
)

// mockEmbedder uses the hash-based mock for testing and offline use.
type mockEmbedder struct{}

func (m *mockEmbedder) Embed(text string) (sparse.Vector, error) {
	return MockEmbed(text), nil
}

func (m *mockEmbedder) EmbedBatch(texts []string) ([]sparse.Vector, error) {
	return defaultEmbedBatch(m, texts)
}

func (m *mockEmbedder) Provider() string {
	return ProviderMock
}
