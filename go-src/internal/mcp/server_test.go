package mcp

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/WazzaMo/vecfs/internal/config"
	"github.com/WazzaMo/vecfs/internal/embed"
	"github.com/WazzaMo/vecfs/internal/storage"
)

// Tests validate MCP server behaviour matching TS integration expectations.

func TestToolsList(t *testing.T) {
	// Match TS: tools/list returns search, memorize, feedback, delete
	names := make([]string, 0, len(toolDefs))
	for _, td := range toolDefs {
		names = append(names, td.Name)
	}
	want := []string{"search", "memorize", "feedback", "delete"}
	if len(names) != len(want) {
		t.Errorf("tools = %v", names)
	}
	for _, w := range want {
		found := false
		for _, n := range names {
			if n == w {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("missing tool %q", w)
		}
	}
	// Ensure handler returns same shape as TS
	dir := t.TempDir()
	st := storage.New(filepath.Join(dir, "data.jsonl"))
	_ = st.EnsureFile()
	paramsRaw, _ := json.Marshal(map[string]interface{}{})
	resp := handleRequest(st, nil, "tools/list", paramsRaw, 1)
	if resp.Error != nil {
		t.Errorf("tools/list error: %v", resp.Error)
	}
	result, _ := resp.Result.(map[string]interface{})
	if result == nil || result["tools"] == nil {
		t.Error("tools/list result missing tools")
	}
}

func TestCallMemorizeAndSearch(t *testing.T) {
	dir := t.TempDir()
	st := storage.New(filepath.Join(dir, "data.jsonl"))
	_ = st.EnsureFile()
	cfg := &config.Config{}
	emb, err := embed.NewEmbedder(cfg)
	if err != nil {
		t.Fatal(err)
	}

	// Memorize (text-only)
	content, err := CallTool(st, emb, "memorize", map[string]interface{}{
		"id": "go-test-1", "text": "hello", "metadata": map[string]interface{}{"source": "test"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(content) == 0 || content[0]["text"] != "Stored entry: go-test-1" {
		t.Errorf("memorize content = %v", content)
	}

	// Search (query-only)
	content, err = CallTool(st, emb, "search", map[string]interface{}{
		"query": "hello", "limit": float64(1),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(content) == 0 {
		t.Fatal("no search content")
	}
	text, _ := content[0]["text"].(string)
	if text == "" {
		t.Errorf("search text empty")
	}
	var results []map[string]interface{}
	if err := json.Unmarshal([]byte(text), &results); err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0]["id"] != "go-test-1" {
		t.Errorf("results = %v", results)
	}
}

func TestCallFeedbackAndDelete(t *testing.T) {
	dir := t.TempDir()
	st := storage.New(filepath.Join(dir, "data.jsonl"))
	_ = st.EnsureFile()
	cfg := &config.Config{}
	emb, _ := embed.NewEmbedder(cfg)
	_, _ = CallTool(st, emb, "memorize", map[string]interface{}{
		"id": "fb", "text": "feedback entry", "metadata": map[string]interface{}{},
	})

	content, err := CallTool(st, emb, "feedback", map[string]interface{}{
		"id": "fb", "scoreAdjustment": float64(5),
	})
	if err != nil || len(content) == 0 {
		t.Fatal(err, content)
	}
	if content[0]["text"] != "Updated score for entry: fb" {
		t.Errorf("feedback = %v", content[0]["text"])
	}

	content, err = CallTool(st, emb, "delete", map[string]interface{}{"id": "fb"})
	if err != nil || content[0]["text"] != "Deleted entry: fb" {
		t.Errorf("delete = %v", content)
	}

	content, err = CallTool(st, emb, "search", map[string]interface{}{"query": "feedback entry", "limit": float64(5)})
	if err != nil {
		t.Fatal(err)
	}
	text, _ := content[0]["text"].(string)
	var results []map[string]interface{}
	_ = json.Unmarshal([]byte(text), &results)
	if len(results) != 0 {
		t.Errorf("expected 0 results after delete, got %v", results)
	}
}

func TestCallTool_QueryTextWithEmbedder(t *testing.T) {
	dir := t.TempDir()
	st := storage.New(filepath.Join(dir, "data.jsonl"))
	_ = st.EnsureFile()
	cfg := &config.Config{}
	emb, err := embed.NewEmbedder(cfg)
	if err != nil {
		t.Fatal(err)
	}

	// Memorize by text only (no vector)
	content, err := CallTool(st, emb, "memorize", map[string]interface{}{
		"id": "text-entry", "text": "hello world", "metadata": map[string]interface{}{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(content) == 0 || content[0]["text"] != "Stored entry: text-entry" {
		t.Errorf("memorize content = %v", content)
	}

	// Search by query only (no vector)
	content, err = CallTool(st, emb, "search", map[string]interface{}{
		"query": "hello world", "limit": float64(5),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(content) == 0 {
		t.Fatal("no search content")
	}
	text, _ := content[0]["text"].(string)
	var results []map[string]interface{}
	if err := json.Unmarshal([]byte(text), &results); err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0]["id"] != "text-entry" {
		t.Errorf("results = %v", results)
	}
}
