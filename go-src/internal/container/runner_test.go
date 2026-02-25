package container

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNewRunner_Supported(t *testing.T) {
	for _, rt := range []string{"docker", "podman"} {
		r, err := NewRunner(rt)
		if err != nil {
			t.Errorf("NewRunner(%q): %v", rt, err)
		}
		if r == nil {
			t.Errorf("NewRunner(%q): nil runner", rt)
		}
	}
}

func TestNewRunner_Unsupported(t *testing.T) {
	_, err := NewRunner("containerd")
	if err == nil {
		t.Error("NewRunner(containerd): expected error")
	}
}

func TestCLIRunner_StartStop_MockExe(t *testing.T) {
	dir := t.TempDir()
	logFile := filepath.Join(dir, "invoked.log")
	mock := filepath.Join(dir, "mock-docker")
	script := "#!/bin/sh\n" +
		"printf '%s\\n' \"$@\" >> \"" + logFile + "\"\n" +
		"case \"$1\" in\n" +
		"  run) exit 0 ;;\n" +
		"  stop) exit 0 ;;\n" +
		"  rm) exit 0 ;;\n" +
		"  *) exit 1 ;;\n" +
		"esac\n"
	if err := os.WriteFile(mock, []byte(script), 0755); err != nil {
		t.Fatal(err)
	}

	r := &cliRunner{exe: mock}
	ctx := context.Background()

	if err := r.Start(ctx, "test-image", "vecfs-embed", 8080); err != nil {
		t.Errorf("Start: %v", err)
	}
	data, _ := os.ReadFile(logFile)
	log := string(data)
	if !strings.Contains(log, "run") || !strings.Contains(log, "vecfs-embed") || !strings.Contains(log, "test-image") || !strings.Contains(log, "8080") {
		t.Errorf("Start should invoke run with name and image and port; got log: %s", log)
	}

	_ = r.Stop(ctx, "vecfs-embed")
	data, _ = os.ReadFile(logFile)
	log = string(data)
	if !strings.Contains(log, "stop") || !strings.Contains(log, "rm") {
		t.Errorf("Stop should invoke stop and rm; got log: %s", log)
	}
}

func TestCLIRunner_Start_EmptyImage(t *testing.T) {
	r := &cliRunner{exe: "docker"}
	ctx := context.Background()
	err := r.Start(ctx, "", "vecfs-embed", 8080)
	if err == nil {
		t.Error("Start with empty image: expected error")
	}
}
