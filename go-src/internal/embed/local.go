package embed

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/WazzaMo/vecfs/internal/config"
	"github.com/WazzaMo/vecfs/internal/sparse"
)

const localEmbedPath = "/embed"

type localEmbedder struct {
	baseURL   string
	threshold float64
	client    *http.Client
}

func newLocalEmbedder(cfg *config.Config) (Embedder, error) {
	baseURL := strings.TrimSpace(cfg.Embed.LocalURL)
	if baseURL == "" {
		baseURL = config.DefaultEmbedLocalURL
	}
	baseURL = strings.TrimSuffix(baseURL, "/")
	threshold := cfg.Embed.Threshold
	if threshold <= 0 {
		threshold = config.DefaultEmbedThreshold
	}
	return &localEmbedder{
		baseURL:   baseURL,
		threshold: threshold,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}, nil
}

// teiEmbedRequest matches Text Embeddings Inference POST /embed body.
type teiEmbedRequest struct {
	Inputs interface{} `json:"inputs"` // string or []string
}

// teiEmbedResponse is TEI response: array of embedding vectors.
type teiEmbedResponse []teiEmbedRow

type teiEmbedRow []float64

func (h *localEmbedder) Embed(text string) (sparse.Vector, error) {
	vecs, err := h.EmbedBatch([]string{text})
	if err != nil {
		return nil, err
	}
	return vecs[0], nil
}

func (h *localEmbedder) EmbedBatch(texts []string) ([]sparse.Vector, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	var payload teiEmbedRequest
	if len(texts) == 1 {
		payload.Inputs = texts[0]
	} else {
		payload.Inputs = texts
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	url := h.baseURL + localEmbedPath
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := h.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("local embed request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("local embed: HTTP %d", resp.StatusCode)
	}
	var raw teiEmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("local embed decode: %w", err)
	}
	out := make([]sparse.Vector, 0, len(raw))
	for _, row := range raw {
		s := sparse.ToSparse([]float64(row), h.threshold)
		out = append(out, normalizeL2(s))
	}
	return out, nil
}

func (h *localEmbedder) Provider() string {
	return ProviderLocal
}
