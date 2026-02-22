// container_demo proves we can start and stop containers directly with containerd:
// connect, pull image, create container, start task, stop (kill + delete task), delete container.
package main

import (
	"context"
	"fmt"
	"os"
	"syscall"
	"time"

	containerd "github.com/containerd/containerd"
	"github.com/containerd/containerd/cio"
	"github.com/containerd/containerd/namespaces"
	"github.com/containerd/containerd/oci"
)

const (
	demoNamespace = "vecfs"
	demoImage     = "docker.io/library/busybox:latest"
	demoContainerID = "vecfs-demo-container"
	demoSnapshotID  = "vecfs-demo-snapshot"
)

func runContainerDemo() int {
	ctx := context.Background()

	// 1. Connect to containerd (default socket)
	address := "/run/containerd/containerd.sock"
	if a := os.Getenv("CONTAINERD_ADDRESS"); a != "" {
		address = a
	}
	client, err := containerd.New(address)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: could not connect to containerd at %s: %v\n", address, err)
		fmt.Fprintf(os.Stderr, "If containerd is installed but not running, start it with: sudo systemctl start containerd (Linux).\n")
		fmt.Fprintf(os.Stderr, "Otherwise install containerd or set CONTAINERD_ADDRESS. For embedding without containers, use the Python embedder (vecfs_embed).\n")
		return 1
	}
	defer client.Close()

	ctx = namespaces.WithNamespace(ctx, demoNamespace)

	// 2. Pull image
	fmt.Fprintf(os.Stderr, "Pulling %s ...\n", demoImage)
	image, err := client.Pull(ctx, demoImage)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: pull: %v\n", err)
		return 1
	}

	// 3. Create container
	fmt.Fprintf(os.Stderr, "Creating container %s ...\n", demoContainerID)
	container, err := client.NewContainer(ctx, demoContainerID,
		containerd.WithImage(image),
		containerd.WithNewSnapshot(demoSnapshotID, image),
		containerd.WithNewSpec(oci.WithImageConfig(image), oci.WithProcessArgs("sleep", "10")),
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: new container: %v\n", err)
		return 1
	}
	defer func() {
		if container != nil {
			_ = container.Delete(ctx, containerd.WithSnapshotCleanup)
		}
	}()

	// 4. Create task (detached)
	task, err := container.NewTask(ctx, cio.NullIO)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: new task: %v\n", err)
		return 1
	}
	defer func() {
		if task != nil {
			_, _ = task.Delete(ctx)
		}
	}()

	// 5. Start
	fmt.Fprintf(os.Stderr, "Starting task (PID %d) ...\n", task.Pid())
	if err := task.Start(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: task start: %v\n", err)
		return 1
	}

	// 6. Let it run briefly
	time.Sleep(2 * time.Second)

	// 7. Stop: Kill then delete task
	fmt.Fprintf(os.Stderr, "Stopping task (SIGTERM) ...\n")
	if err := task.Kill(ctx, syscall.SIGTERM); err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: task kill: %v\n", err)
		return 1
	}
	status, err := task.Wait(ctx)
	if err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: task wait: %v\n", err)
		return 1
	}
	<-status
	if _, err := task.Delete(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: task delete: %v\n", err)
		return 1
	}
	task = nil

	// 8. Delete container
	fmt.Fprintf(os.Stderr, "Deleting container ...\n")
	if err := container.Delete(ctx, containerd.WithSnapshotCleanup); err != nil {
		fmt.Fprintf(os.Stderr, "vecfs: container delete: %v\n", err)
		return 1
	}
	container = nil

	fmt.Fprintf(os.Stderr, "Done. Start and stop via containerd succeeded.\n")
	return 0
}
