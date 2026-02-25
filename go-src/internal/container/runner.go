// Package container provides a way to start and stop embedding model containers
// using docker or podman (CLI). Used by vecfs-go to ensure the embedding service
// is running when needed; user can run "vecfs container stop" for cleanup.
package container

import (
	"context"
	"fmt"
)

// Runner starts and stops a container by name. Docker and podman are treated
// as equivalent (same CLI shape: run, stop, rm).
type Runner interface {
	// Start runs the image as a detached container with the given name,
	// publishing hostPort to the container's same port. Idempotent: if a
	// container with name already exists and is running, no-op; if it exists
	// but stopped, remove then start.
	Start(ctx context.Context, image, name string, hostPort int) error
	// Stop stops and removes the container with the given name. No-op if
	// no such container exists.
	Stop(ctx context.Context, name string) error
}

// NewRunner returns a Runner for the given runtime ("docker" or "podman").
// The executable must be on PATH. Returns error if runtime is not supported.
func NewRunner(runtime string) (Runner, error) {
	switch runtime {
	case "docker":
		return &cliRunner{exe: "docker"}, nil
	case "podman":
		return &cliRunner{exe: "podman"}, nil
	default:
		return nil, fmt.Errorf("container: unsupported runtime %q (use docker or podman)", runtime)
	}
}
