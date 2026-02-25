// container start/stop subcommands: run embedding model containers via docker or podman.
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/WazzaMo/vecfs/internal/config"
	"github.com/WazzaMo/vecfs/internal/container"
)

func runContainerStart() int {
	cfg, err := config.LoadConfig(os.Args)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: config: %v\n", err)
		return 1
	}
	if cfg.Container.Image == "" {
		fmt.Fprintf(os.Stderr, "vecfs: container image not set. Set VECFS_EMBED_IMAGE or config container.image.\n")
		return 1
	}
	runner, err := container.NewRunner(cfg.Container.Runtime)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: %v\n", err)
		return 1
	}
	ctx := context.Background()
	if err := runner.Start(ctx, cfg.Container.Image, cfg.Container.Name, cfg.Container.Port); err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: %v\n", err)
		return 1
	}
	fmt.Fprintf(os.Stderr, "vecfs: started container %q (image %s, port %d). Use \"vecfs container stop\" to stop and remove.\n",
		cfg.Container.Name, cfg.Container.Image, cfg.Container.Port)
	return 0
}

func runContainerStop() int {
	cfg, err := config.LoadConfig(os.Args)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: config: %v\n", err)
		return 1
	}
	runner, err := container.NewRunner(cfg.Container.Runtime)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: %v\n", err)
		return 1
	}
	ctx := context.Background()
	if err := runner.Stop(ctx, cfg.Container.Name); err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: %v\n", err)
		return 1
	}
	fmt.Fprintf(os.Stderr, "vecfs: stopped and removed container %q.\n", cfg.Container.Name)
	return 0
}
