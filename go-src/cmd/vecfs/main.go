// vecfs is the main VecFS CLI: configuration, version, container lifecycle, and starting MCP or embed components.
// Container commands use docker or podman (configurable) to run the embedding model when needed.
package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}
	switch os.Args[1] {
	case "container":
		if len(os.Args) < 3 {
			printContainerUsage()
			os.Exit(1)
		}
		switch os.Args[2] {
		case "start":
			os.Exit(runContainerStart())
		case "stop":
			os.Exit(runContainerStop())
		default:
			printContainerUsage()
			os.Exit(1)
		}
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Fprintf(os.Stderr, "Usage: vecfs <command> [options]\n\n")
	fmt.Fprintf(os.Stderr, "Commands:\n")
	fmt.Fprintf(os.Stderr, "  container start  Start embedding model container (docker/podman)\n")
	fmt.Fprintf(os.Stderr, "  container stop   Stop and remove embedding container (cleanup)\n")
	fmt.Fprintf(os.Stderr, "\n")
}

func printContainerUsage() {
	fmt.Fprintf(os.Stderr, "Usage: vecfs container <command>\n\n")
	fmt.Fprintf(os.Stderr, "Commands:\n")
	fmt.Fprintf(os.Stderr, "  start  Start the embedding model container; use config or VECFS_EMBED_IMAGE\n")
	fmt.Fprintf(os.Stderr, "  stop   Stop and remove the container (user cleanup)\n")
	fmt.Fprintf(os.Stderr, "\n")
}
