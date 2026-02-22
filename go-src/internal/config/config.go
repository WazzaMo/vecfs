// Package config loads VecFS common configuration from vecfs.yaml.
// Lookup order: VECFS_CONFIG env, --config in argv, then ./vecfs.yaml,
// ./.vecfs.yaml, ~/.config/vecfs/vecfs.yaml. Environment overrides file values.
package config

import (
	"os"
	"path/filepath"
	"strconv"

	"gopkg.in/yaml.v3"
)

const (
	DefaultStorageFile = "./vecfs-data.jsonl"
	DefaultMCPPort     = 3000
)

// Config holds resolved VecFS configuration (matches TS VecFSConfig).
type Config struct {
	Storage struct {
		File string `yaml:"file"`
	} `yaml:"storage"`
	MCP struct {
		Port int `yaml:"port"`
	} `yaml:"mcp"`
	Embed struct {
		Provider   string  `yaml:"provider"`
		Model      string  `yaml:"model"`
		Dims       *int    `yaml:"dims"`
		Threshold  float64 `yaml:"threshold"`
		LocalURL   string  `yaml:"local_base_url"`
		HFEndpoint string  `yaml:"huggingface_endpoint"`
		HFToken    string  `yaml:"huggingface_token"`
	} `yaml:"embed"`
}

const (
	DefaultEmbedModel       = "sentence-transformers:all-MiniLM-L6-v2"
	DefaultEmbedThreshold   = 0.01
	DefaultEmbedLocalURL    = "http://localhost:8080"
	DefaultEmbedHFEndpoint  = "https://api-inference.huggingface.co"
)

// GetConfigPath returns the first path that exists in lookup order, or empty string.
func GetConfigPath(argv []string) string {
	if argv == nil {
		argv = os.Args
	}
	if p := os.Getenv("VECFS_CONFIG"); p != "" {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	for i, arg := range argv {
		if arg == "--config" && i+1 < len(argv) {
			path := filepath.Clean(argv[i+1])
			if ab, err := filepath.Abs(path); err == nil {
				path = ab
			}
			if _, err := os.Stat(path); err == nil {
				return path
			}
			break
		}
	}
	cwd, _ := os.Getwd()
	candidates := []string{
		filepath.Join(cwd, "vecfs.yaml"),
		filepath.Join(cwd, ".vecfs.yaml"),
	}
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates, filepath.Join(home, ".config", "vecfs", "vecfs.yaml"))
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return ""
}

// LoadConfig reads the first found config file and applies env overrides.
func LoadConfig(argv []string) (*Config, error) {
	if argv == nil {
		argv = os.Args
	}
	cfg := &Config{}
	cfg.Storage.File = DefaultStorageFile
	cfg.MCP.Port = DefaultMCPPort

	cfg.Embed.Model = DefaultEmbedModel
	cfg.Embed.Threshold = DefaultEmbedThreshold

	path := GetConfigPath(argv)
	if path != "" {
		data, err := os.ReadFile(path)
		if err == nil {
			var raw struct {
				Storage struct {
					File string `yaml:"file"`
				} `yaml:"storage"`
				MCP struct {
					Port interface{} `yaml:"port"`
				} `yaml:"mcp"`
				Embed struct {
					Provider   string      `yaml:"provider"`
					Model      string      `yaml:"model"`
					Dims       interface{} `yaml:"dims"`
					Threshold  interface{} `yaml:"threshold"`
					LocalURL   string      `yaml:"local_base_url"`
					HFEndpoint string      `yaml:"huggingface_endpoint"`
					HFToken    string      `yaml:"huggingface_token"`
				} `yaml:"embed"`
			}
			if err := yaml.Unmarshal(data, &raw); err == nil {
				if raw.Storage.File != "" {
					cfg.Storage.File = raw.Storage.File
				}
				switch v := raw.MCP.Port.(type) {
				case int:
					cfg.MCP.Port = v
				case string:
					if p, err := strconv.Atoi(v); err == nil {
						cfg.MCP.Port = p
					}
				}
				if raw.Embed.Provider != "" {
					cfg.Embed.Provider = raw.Embed.Provider
				}
				if raw.Embed.Model != "" {
					cfg.Embed.Model = raw.Embed.Model
				}
				if raw.Embed.LocalURL != "" {
					cfg.Embed.LocalURL = raw.Embed.LocalURL
				}
				if raw.Embed.HFEndpoint != "" {
					cfg.Embed.HFEndpoint = raw.Embed.HFEndpoint
				}
				if raw.Embed.HFToken != "" {
					cfg.Embed.HFToken = raw.Embed.HFToken
				}
				if raw.Embed.Dims != nil {
					switch v := raw.Embed.Dims.(type) {
					case int:
						p := v
						cfg.Embed.Dims = &p
					case string:
						if p, err := strconv.Atoi(v); err == nil {
							cfg.Embed.Dims = &p
						}
					}
				}
				if raw.Embed.Threshold != nil {
					if f, ok := toFloat64Embed(raw.Embed.Threshold); ok {
						cfg.Embed.Threshold = f
					}
				}
			}
		}
	}
	if v := os.Getenv("VECFS_FILE"); v != "" {
		cfg.Storage.File = v
	}
	if v := os.Getenv("PORT"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			cfg.MCP.Port = p
		}
	}
	if v := os.Getenv("VECFS_EMBED_PROVIDER"); v != "" {
		cfg.Embed.Provider = v
	}
	if v := os.Getenv("VECFS_EMBED_MODEL"); v != "" {
		cfg.Embed.Model = v
	}
	if v := os.Getenv("VECFS_EMBED_LOCAL_URL"); v != "" {
		cfg.Embed.LocalURL = v
	}
	if v := os.Getenv("VECFS_EMBED_HF_ENDPOINT"); v != "" {
		cfg.Embed.HFEndpoint = v
	}
	if v := os.Getenv("VECFS_EMBED_HF_TOKEN"); v != "" {
		cfg.Embed.HFToken = v
	} else if v := os.Getenv("HUGGINGFACEHUB_API_TOKEN"); v != "" {
		cfg.Embed.HFToken = v
	} else if v := os.Getenv("HF_TOKEN"); v != "" {
		cfg.Embed.HFToken = v
	}
	if v := os.Getenv("VECFS_EMBED_DIMS"); v != "" {
		if p, err := strconv.Atoi(v); err == nil {
			cfg.Embed.Dims = &p
		}
	}
	if v := os.Getenv("VECFS_EMBED_THRESHOLD"); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			cfg.Embed.Threshold = f
		}
	}
	return cfg, nil
}

func toFloat64Embed(x interface{}) (float64, bool) {
	switch v := x.(type) {
	case float64:
		return v, true
	case int:
		return float64(v), true
	case string:
		f, err := strconv.ParseFloat(v, 64)
		return f, err == nil
	default:
		return 0, false
	}
}
