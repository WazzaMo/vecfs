// vecfs-mcp-go is the VecFS MCP server (Go port). Serves vector storage tools over stdio.
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/WazzaMo/vecfs/internal/config"
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
	fmt.Fprintln(os.Stderr, "VecFS MCP Server running on stdio")
	if err := mcp.RunStdio(st); err != nil {
		log.Fatalf("stdio: %v", err)
	}
}
