package container

import (
	"context"
	"fmt"
	"os/exec"
	"strings"
)

type cliRunner struct {
	exe string
}

func (r *cliRunner) Start(ctx context.Context, image, name string, hostPort int) error {
	if image == "" {
		return fmt.Errorf("container: image is required")
	}
	// Remove existing container if present (idempotent start)
	_ = r.Stop(ctx, name)

	// docker run -d --name <name> -p <hostPort>:<hostPort> <image>
	// Assume container exposes same port as host for simplicity.
	cmd := exec.CommandContext(ctx, r.exe, "run", "-d", "--name", name,
		fmt.Sprintf("-p%d:%d", hostPort, hostPort), image)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("container: %s run: %w: %s", r.exe, err, strings.TrimSpace(string(out)))
	}
	return nil
}

func (r *cliRunner) Stop(ctx context.Context, name string) error {
	// docker stop <name>; docker rm <name>
	stopCmd := exec.CommandContext(ctx, r.exe, "stop", name)
	_ = stopCmd.Run() // ignore error (container may not exist or already stopped)

	rmCmd := exec.CommandContext(ctx, r.exe, "rm", name)
	out, err := rmCmd.CombinedOutput()
	if err != nil {
		// "no such container" is acceptable
		if strings.Contains(string(out), "No such container") || strings.Contains(string(out), "no such container") {
			return nil
		}
		return fmt.Errorf("container: %s rm: %w: %s", r.exe, err, strings.TrimSpace(string(out)))
	}
	return nil
}
