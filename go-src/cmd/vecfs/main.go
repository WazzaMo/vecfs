// vecfs is the main VecFS CLI: configuration, version, and starting MCP or embed components.
// This initial implementation proves we can start and stop containers via containerd with
// the "container demo" subcommand.
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
		case "demo":
			os.Exit(runContainerDemo())
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
	fmt.Fprintf(os.Stderr, "  container demo   Prove start/stop of a container via containerd (test)\n")
	fmt.Fprintf(os.Stderr, "\n")
}

func printContainerUsage() {
	fmt.Fprintf(os.Stderr, "Usage: vecfs container <command>\n\n")
	fmt.Fprintf(os.Stderr, "Commands:\n")
	fmt.Fprintf(os.Stderr, "  demo   Run a minimal container via containerd, then stop and delete it\n")
	fmt.Fprintf(os.Stderr, "\n")
}
