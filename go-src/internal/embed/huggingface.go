package embed

import (
	"context"
	"strings"

	"github.com/WazzaMo/vecfs/internal/config"
	"github.com/WazzaMo/vecfs/internal/sparse"
	"github.com/hupe1980/go-huggingface"
)

type huggingFaceEmbedder struct {
	client    *huggingface.InferenceClient
	model     string
	threshold float64
}

func newHuggingFaceEmbedder(cfg *config.Config) (Embedder, error) {
	token := strings.TrimSpace(cfg.Embed.HFToken)
	opts := []func(*huggingface.InferenceClientOptions){
		func(o *huggingface.InferenceClientOptions) {
			if cfg.Embed.HFEndpoint != "" {
				o.InferenceEndpoint = strings.TrimSuffix(cfg.Embed.HFEndpoint, "/")
			}
		},
	}
	client := huggingface.NewInferenceClient(token, opts...)
	model := cfg.Embed.Model
	if model == "" {
		model = config.DefaultEmbedModel
	}
	threshold := cfg.Embed.Threshold
	if threshold <= 0 {
		threshold = config.DefaultEmbedThreshold
	}
	return &huggingFaceEmbedder{
		client:    client,
		model:     model,
		threshold: threshold,
	}, nil
}

func (h *huggingFaceEmbedder) Embed(text string) (sparse.Vector, error) {
	vecs, err := h.EmbedBatch([]string{text})
	if err != nil {
		return nil, err
	}
	return vecs[0], nil
}

func (h *huggingFaceEmbedder) EmbedBatch(texts []string) ([]sparse.Vector, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	ctx := context.Background()
	req := &huggingface.FeatureExtractionRequest{
		Inputs: texts,
		Model:  h.model,
	}
	resp, err := h.client.FeatureExtractionWithAutomaticReduction(ctx, req)
	if err != nil {
		return nil, err
	}
	out := make([]sparse.Vector, len(resp))
	for i, row := range resp {
		dense := make([]float64, len(row))
		for j, v := range row {
			dense[j] = float64(v)
		}
		s := sparse.ToSparse(dense, h.threshold)
		out[i] = normalizeL2(s)
	}
	return out, nil
}

func (h *huggingFaceEmbedder) Provider() string {
	return ProviderHuggingFace
}

// normalizeL2 scales the sparse vector so its L2 norm is 1 (or returns v unchanged if norm is 0).
func normalizeL2(v sparse.Vector) sparse.Vector {
	n := sparse.Norm(v)
	if n <= 0 {
		return v
	}
	out := make(sparse.Vector, len(v))
	for k, x := range v {
		out[k] = x / n
	}
	return out
}
