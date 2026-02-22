package mcp

import (
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/WazzaMo/vecfs/internal/sparse"
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
	resp := handleRequest(st, "tools/list", paramsRaw, 1)
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

	// Memorize
	content, err := CallTool(st, "memorize", map[string]interface{}{
		"id":     "go-test-1",
		"text":   "hello",
		"vector": sparse.Vector{"0": 1, "1": 0.5},
		"metadata": map[string]interface{}{"source": "test"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(content) == 0 || content[0]["text"] != "Stored entry: go-test-1" {
		t.Errorf("memorize content = %v", content)
	}

	// Search
	content, err = CallTool(st, "search", map[string]interface{}{
		"vector": sparse.Vector{"0": 1, "1": 0.5},
		"limit":  float64(1),
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
	_, _ = CallTool(st, "memorize", map[string]interface{}{
		"id": "fb", "vector": sparse.Vector{"0": 1}, "metadata": map[string]interface{}{},
	})

	content, err := CallTool(st, "feedback", map[string]interface{}{
		"id": "fb", "scoreAdjustment": float64(5),
	})
	if err != nil || len(content) == 0 {
		t.Fatal(err, content)
	}
	if content[0]["text"] != "Updated score for entry: fb" {
		t.Errorf("feedback = %v", content[0]["text"])
	}

	content, err = CallTool(st, "delete", map[string]interface{}{"id": "fb"})
	if err != nil || content[0]["text"] != "Deleted entry: fb" {
		t.Errorf("delete = %v", content)
	}

	content, err = CallTool(st, "search", map[string]interface{}{"vector": sparse.Vector{"0": 1}, "limit": float64(5)})
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
