package config

import (
	"os"
	"path/filepath"
	"testing"
)

// Tests match ts-src/config.test.ts and py-src/tests/test_config.py cases.

func TestGetConfigPath_ReturnsPathWhenVecfsYamlInCwd(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	if err := os.WriteFile(cfgPath, []byte("storage:\n  file: test.jsonl\n"), 0644); err != nil {
		t.Fatal(err)
	}
	argv := []string{"vecfs-mcp", "--config", cfgPath}
	got := GetConfigPath(argv)
	if got != cfgPath && filepath.Clean(got) != filepath.Clean(cfgPath) {
		t.Errorf("GetConfigPath = %q, want %q", got, cfgPath)
	}
}

func TestGetConfigPath_VECFS_CONFIG(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "custom.yaml")
	if err := os.WriteFile(cfgPath, []byte("mcp:\n  port: 4000\n"), 0644); err != nil {
		t.Fatal(err)
	}
	os.Setenv("VECFS_CONFIG", cfgPath)
	defer os.Unsetenv("VECFS_CONFIG")
	got := GetConfigPath([]string{"vecfs-mcp"})
	if got != cfgPath {
		t.Errorf("GetConfigPath = %q, want %q", got, cfgPath)
	}
}

func TestGetConfigPath_ConfigArg(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "explicit.yaml")
	if err := os.WriteFile(cfgPath, []byte("storage:\n  file: explicit.jsonl\n"), 0644); err != nil {
		t.Fatal(err)
	}
	got := GetConfigPath([]string{"vecfs-mcp", "--config", cfgPath})
	if got != cfgPath && filepath.Clean(got) != filepath.Clean(cfgPath) {
		t.Errorf("GetConfigPath = %q", got)
	}
}

func TestLoadConfig_DefaultsWhenNoFile(t *testing.T) {
	os.Unsetenv("VECFS_CONFIG")
	os.Unsetenv("VECFS_FILE")
	os.Unsetenv("PORT")
	os.Unsetenv("VECFS_CONTAINER_RUNTIME")
	os.Unsetenv("VECFS_CONTAINER_NAME")
	cfg, err := LoadConfig([]string{"vecfs-mcp", "--config", "/nonexistent/vecfs.yaml"})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Storage.File != DefaultStorageFile || cfg.MCP.Port != DefaultMCPPort {
		t.Errorf("cfg = %+v", cfg)
	}
	if cfg.Container.Runtime != DefaultContainerRuntime || cfg.Container.Name != DefaultContainerName {
		t.Errorf("container defaults: runtime=%q name=%q", cfg.Container.Runtime, cfg.Container.Name)
	}
	if cfg.Container.Port != DefaultContainerPort {
		t.Errorf("container port = %d, want %d", cfg.Container.Port, DefaultContainerPort)
	}
}

func TestLoadConfig_EnvOverridesStorage(t *testing.T) {
	os.Setenv("VECFS_FILE", "/tmp/env-storage.jsonl")
	defer os.Unsetenv("VECFS_FILE")
	cfg, _ := LoadConfig([]string{"vecfs-mcp"})
	if cfg.Storage.File != "/tmp/env-storage.jsonl" {
		t.Errorf("Storage.File = %q", cfg.Storage.File)
	}
}

func TestLoadConfig_EnvOverridesPort(t *testing.T) {
	os.Setenv("PORT", "9999")
	defer os.Unsetenv("PORT")
	cfg, _ := LoadConfig([]string{"vecfs-mcp"})
	if cfg.MCP.Port != 9999 {
		t.Errorf("MCP.Port = %v", cfg.MCP.Port)
	}
}

func TestLoadConfig_ValuesFromFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	content := "storage:\n  file: from-yaml.jsonl\nmcp:\n  port: 4000\n"
	if err := os.WriteFile(cfgPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	os.Unsetenv("VECFS_FILE")
	os.Unsetenv("PORT")
	cfg, err := LoadConfig([]string{"vecfs-mcp", "--config", cfgPath})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Storage.File != "from-yaml.jsonl" || cfg.MCP.Port != 4000 {
		t.Errorf("cfg = %+v", cfg)
	}
}

func TestLoadConfig_EnvOverridesFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	if err := os.WriteFile(cfgPath, []byte("storage:\n  file: from-yaml.jsonl\nmcp:\n  port: 4000\n"), 0644); err != nil {
		t.Fatal(err)
	}
	os.Setenv("VECFS_FILE", "/override/file.jsonl")
	os.Setenv("PORT", "5000")
	defer func() { os.Unsetenv("VECFS_FILE"); os.Unsetenv("PORT") }()
	cfg, _ := LoadConfig([]string{"vecfs-mcp", "--config", cfgPath})
	if cfg.Storage.File != "/override/file.jsonl" || cfg.MCP.Port != 5000 {
		t.Errorf("cfg = %+v", cfg)
	}
}

func TestLoadConfig_EmbedFromFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	content := "embed:\n  model: custom-model\n  threshold: 0.05\n  dims: 256\n"
	if err := os.WriteFile(cfgPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	os.Unsetenv("VECFS_EMBED_MODEL")
	os.Unsetenv("VECFS_EMBED_THRESHOLD")
	os.Unsetenv("VECFS_EMBED_DIMS")
	cfg, err := LoadConfig([]string{"vecfs-embed", "--config", cfgPath})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Embed.Model != "custom-model" || cfg.Embed.Threshold != 0.05 {
		t.Errorf("embed = %+v", cfg.Embed)
	}
	if cfg.Embed.Dims == nil || *cfg.Embed.Dims != 256 {
		t.Errorf("embed.Dims = %v", cfg.Embed.Dims)
	}
}

func TestLoadConfig_EmbedHFTokenFromFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	content := "embed:\n  provider: huggingface\n  huggingface_token: yaml-token\n"
	if err := os.WriteFile(cfgPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	os.Unsetenv("VECFS_EMBED_HF_TOKEN")
	os.Unsetenv("HUGGINGFACEHUB_API_TOKEN")
	os.Unsetenv("HF_TOKEN")
	cfg, err := LoadConfig([]string{"vecfs-embed", "--config", cfgPath})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Embed.HFToken != "yaml-token" {
		t.Errorf("embed.HFToken = %q, want yaml-token", cfg.Embed.HFToken)
	}
}

func TestLoadConfig_EmbedHFTokenEnvOverride(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	content := "embed:\n  huggingface_token: from-yaml\n"
	if err := os.WriteFile(cfgPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	os.Setenv("VECFS_EMBED_HF_TOKEN", "env-token")
	defer os.Unsetenv("VECFS_EMBED_HF_TOKEN")
	os.Unsetenv("HUGGINGFACEHUB_API_TOKEN")
	os.Unsetenv("HF_TOKEN")
	cfg, _ := LoadConfig([]string{"vecfs-embed", "--config", cfgPath})
	if cfg.Embed.HFToken != "env-token" {
		t.Errorf("embed.HFToken = %q, want env-token (env should override YAML)", cfg.Embed.HFToken)
	}
}

func TestLoadConfig_PortAsStringInYAML(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	if err := os.WriteFile(cfgPath, []byte("mcp:\n  port: \"7000\"\n"), 0644); err != nil {
		t.Fatal(err)
	}
	cfg, _ := LoadConfig([]string{"vecfs-mcp", "--config", cfgPath})
	if cfg.MCP.Port != 7000 {
		t.Errorf("MCP.Port = %v", cfg.MCP.Port)
	}
}

func TestLoadConfig_ContainerFromFile(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "vecfs.yaml")
	content := "container:\n  runtime: podman\n  image: my-embed:latest\n  name: my-vecfs\n  port: 9000\n"
	if err := os.WriteFile(cfgPath, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	os.Unsetenv("VECFS_CONTAINER_RUNTIME")
	os.Unsetenv("VECFS_EMBED_IMAGE")
	os.Unsetenv("VECFS_CONTAINER_NAME")
	os.Unsetenv("VECFS_CONTAINER_PORT")
	cfg, err := LoadConfig([]string{"vecfs", "--config", cfgPath})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Container.Runtime != "podman" || cfg.Container.Image != "my-embed:latest" || cfg.Container.Name != "my-vecfs" || cfg.Container.Port != 9000 {
		t.Errorf("container = %+v", cfg.Container)
	}
}

func TestLoadConfig_ContainerEnvOverride(t *testing.T) {
	os.Setenv("VECFS_CONTAINER_RUNTIME", "podman")
	os.Setenv("VECFS_EMBED_IMAGE", "env-image")
	os.Setenv("VECFS_CONTAINER_NAME", "env-name")
	os.Setenv("VECFS_CONTAINER_PORT", "8888")
	defer func() {
		os.Unsetenv("VECFS_CONTAINER_RUNTIME")
		os.Unsetenv("VECFS_EMBED_IMAGE")
		os.Unsetenv("VECFS_CONTAINER_NAME")
		os.Unsetenv("VECFS_CONTAINER_PORT")
	}()
	cfg, _ := LoadConfig([]string{"vecfs"})
	if cfg.Container.Runtime != "podman" || cfg.Container.Image != "env-image" || cfg.Container.Name != "env-name" || cfg.Container.Port != 8888 {
		t.Errorf("container = %+v", cfg.Container)
	}
}
