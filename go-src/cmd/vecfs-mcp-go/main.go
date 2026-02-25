// vecfs-mcp-go is the VecFS MCP server (Go port). Serves vector storage tools over stdio.
// When config provides an embedder (mock, huggingface, or local), search and memorize accept query/text.
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/WazzaMo/vecfs/internal/config"
	"github.com/WazzaMo/vecfs/internal/embed"
	"github.com/WazzaMo/vecfs/internal/mcp"
	"github.com/WazzaMo/vecfs/internal/storage"
)

func main() {
	cfg, err := config.LoadConfig(os.Args)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	st := storage.New(cfg.Storage.File)
	if err := st.EnsureFile(); err != nil {
		log.Fatalf("storage: %v", err)
	}
	emb, err := embed.NewEmbedder(cfg)
	if err != nil {
		log.Fatalf("embedder required (text-only API): %v", err)
	}
	fmt.Fprintf(os.Stderr, "VecFS MCP Server running on stdio (embedder: %s)\n", emb.Provider())
	if err := mcp.RunStdio(st, emb); err != nil {
		log.Fatalf("stdio: %v", err)
	}
}
