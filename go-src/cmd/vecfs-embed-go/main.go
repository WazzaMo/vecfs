// vecfs-embed-go is a Go CLI for text-to-sparse-vector conversion.
// It supports pluggable embedders: mock (default), huggingface, or local (e.g. TEI).
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/WazzaMo/vecfs/internal/config"
	"github.com/WazzaMo/vecfs/internal/embed"
)

// version is set at build time via -ldflags "-X main.version=..." from VERSION.txt.
var version = "dev"

func main() {
	configPath := flag.String("config", "", "Path to vecfs.yaml")
	mode := flag.String("mode", "query", "query or document")
	batch := flag.Bool("batch", false, "Batch mode: one text per line from stdin")
	threshold := flag.Float64("threshold", 0.01, "Sparsification threshold")
	model := flag.String("model", "", "Embedding model")
	dims := flag.Int("dims", 0, "Dimensions (optional)")
	provider := flag.String("provider", "", "Embedder provider: mock, huggingface, or local")
	showVersion := flag.Bool("version", false, "Print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Fprintf(os.Stderr, "vecfs-embed-go %s\n", version)
		os.Exit(0)
	}

	cfg, err := config.LoadConfig(os.Args)
	if err != nil {
		fmt.Fprintln(os.Stderr, "config:", err)
		os.Exit(1)
	}
	_ = configPath
	if *provider != "" {
		cfg.Embed.Provider = *provider
	}
	if *model != "" {
		cfg.Embed.Model = *model
	}
	if *threshold > 0 {
		cfg.Embed.Threshold = *threshold
	}
	if *dims != 0 {
		cfg.Embed.Dims = dims
	} else if cfg.Embed.Dims != nil {
		dims = cfg.Embed.Dims
	}

	emb, err := embed.NewEmbedder(cfg)
	if err != nil {
		fmt.Fprintln(os.Stderr, "embed:", err)
		os.Exit(1)
	}

	if *batch {
		scanner := bufio.NewScanner(os.Stdin)
		var texts []string
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" {
				texts = append(texts, line)
			}
		}
		if len(texts) == 0 {
			fmt.Fprintln(os.Stderr, "Error: --batch requires input on stdin (one text per line).")
			os.Exit(1)
		}
		vecs, err := emb.EmbedBatch(texts)
		if err != nil {
			fmt.Fprintln(os.Stderr, "embed batch:", err)
			os.Exit(1)
		}
		results := make([]map[string]interface{}, 0, len(vecs))
		for _, v := range vecs {
			results = append(results, map[string]interface{}{
				"vector":            v,
				"model":             cfg.Embed.Model,
				"dense_dimensions":  dimsValue(cfg.Embed.Dims),
				"non_zero_count":    len(v),
				"threshold":         cfg.Embed.Threshold,
				"provider":          emb.Provider(),
			})
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(results)
		return
	}

	args := flag.Args()
	var text string
	if len(args) > 0 {
		text = strings.Join(args, " ")
	} else {
		scanner := bufio.NewScanner(os.Stdin)
		for scanner.Scan() {
			text += scanner.Text() + "\n"
		}
		text = strings.TrimSpace(text)
	}
	if text == "" {
		fmt.Fprintln(os.Stderr, "Error: no input text provided.")
		os.Exit(1)
	}

	v, err := emb.Embed(text)
	if err != nil {
		fmt.Fprintln(os.Stderr, "embed:", err)
		os.Exit(1)
	}
	out := map[string]interface{}{
		"vector":           v,
		"model":            cfg.Embed.Model,
		"dense_dimensions": dimsValue(cfg.Embed.Dims),
		"non_zero_count":   len(v),
		"threshold":        cfg.Embed.Threshold,
		"mode":             *mode,
		"provider":         emb.Provider(),
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(out)
}

func dimsValue(d *int) int {
	if d != nil {
		return *d
	}
	return 0
}
