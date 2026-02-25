// Package mcp implements the MCP server tools (search, memorize, feedback, delete).
// When an embedder is provided, search accepts optional "query" (text) and memorize accepts optional "text";
// the embedder converts them to vectors so callers can use text-only semantics.
package mcp

import (
	"encoding/json"
	"fmt"

	"github.com/WazzaMo/vecfs/internal/embed"
	"github.com/WazzaMo/vecfs/internal/sparse"
	"github.com/WazzaMo/vecfs/internal/storage"
)

// ToolDef matches MCP tool definition (name, description, inputSchema).
type ToolDef struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"inputSchema"`
}

var toolDefs = []ToolDef{
	{
		Name:        "search",
		Description: "Semantic search: find entries with similar meaning to the query text. Vectorisation happens inside VecFS.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query": map[string]any{"type": "string", "description": "Search by text (semantic)"},
				"limit": map[string]any{"type": "number", "default": 5},
			},
			"required": []any{"query"},
		},
	},
	{
		Name:        "memorize",
		Description: "Store a new entry by text. Vectorisation happens inside VecFS. Updates if ID exists.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":       map[string]any{"type": "string"},
				"text":    map[string]any{"type": "string"},
				"metadata": map[string]any{"type": "object"},
			},
			"required": []any{"id", "text"},
		},
	},
	{
		Name:        "feedback",
		Description: "Record feedback for a specific memory entry.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id":             map[string]any{"type": "string"},
				"scoreAdjustment": map[string]any{"type": "number"},
			},
			"required": []any{"id", "scoreAdjustment"},
		},
	},
	{
		Name:        "delete",
		Description: "Delete an entry from the vector space by its unique ID.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"id": map[string]any{"type": "string"},
			},
			"required": []any{"id"},
		},
	},
}

// NormalizeVector converts JSON vector (sparse map or dense slice) to sparse.Vector.
func NormalizeVector(raw interface{}) (sparse.Vector, error) {
	switch v := raw.(type) {
	case map[string]interface{}:
		out := make(sparse.Vector)
		for k, val := range v {
			if f, ok := toFloat64(val); ok {
				out[k] = f
			}
		}
		return out, nil
	case sparse.Vector:
		return v, nil
	case []interface{}:
		dense := make([]float64, 0, len(v))
		for _, x := range v {
			if f, ok := toFloat64(x); ok {
				dense = append(dense, f)
			}
		}
		return sparse.ToSparse(dense, 0), nil
	default:
		return nil, fmt.Errorf("vector must be object or array")
	}
}

func toFloat64(x interface{}) (float64, bool) {
	switch v := x.(type) {
	case float64:
		return v, true
	case int:
		return float64(v), true
	case int64:
		return float64(v), true
	default:
		return 0, false
	}
}

// CallTool runs the named tool with the given arguments and returns MCP content.
// emb must be non-nil: search and memorize are text-only and use emb to embed query/text.
func CallTool(st *storage.Storage, emb embed.Embedder, name string, args map[string]interface{}) ([]map[string]interface{}, error) {
	switch name {
	case "search":
		return toolSearch(st, emb, args)
	case "memorize":
		return toolMemorize(st, emb, args)
	case "feedback":
		return toolFeedback(st, args)
	case "delete":
		return toolDelete(st, args)
	default:
		return nil, fmt.Errorf("unknown tool: %s", name)
	}
}

func toolSearch(st *storage.Storage, emb embed.Embedder, args map[string]interface{}) ([]map[string]interface{}, error) {
	if emb == nil {
		return nil, fmt.Errorf("search requires embedder")
	}
	q, ok := args["query"].(string)
	if !ok || q == "" {
		return nil, fmt.Errorf("missing query")
	}
	vec, err := emb.Embed(q)
	if err != nil {
		return nil, fmt.Errorf("embed query: %w", err)
	}
	limit := 5
	if l, ok := toFloat64(args["limit"]); ok && l > 0 {
		limit = int(l)
	}
	results, err := st.Search(vec, limit)
	if err != nil {
		return nil, err
	}
	out := make([]map[string]interface{}, 0, len(results))
	for _, r := range results {
		out = append(out, map[string]interface{}{
			"id":         r.ID,
			"metadata":   r.Metadata,
			"vector":     r.Vector,
			"score":      r.Score,
			"timestamp":  r.Timestamp,
			"similarity": r.Similarity,
		})
	}
	text, _ := json.MarshalIndent(out, "", "  ")
	return []map[string]interface{}{{"type": "text", "text": string(text)}}, nil
}

func toolMemorize(st *storage.Storage, emb embed.Embedder, args map[string]interface{}) ([]map[string]interface{}, error) {
	if emb == nil {
		return nil, fmt.Errorf("memorize requires embedder")
	}
	id, _ := args["id"].(string)
	if id == "" {
		return nil, fmt.Errorf("missing id")
	}
	t, ok := args["text"].(string)
	if !ok || t == "" {
		return nil, fmt.Errorf("missing text")
	}
	vec, err := emb.Embed(t)
	if err != nil {
		return nil, fmt.Errorf("embed text: %w", err)
	}
	meta := make(map[string]any)
	if m, ok := args["metadata"].(map[string]interface{}); ok {
		for k, v := range m {
			meta[k] = v
		}
	}
	if t, ok := args["text"].(string); ok {
		meta["text"] = t
	}
	entry := &storage.VecFSEntry{
		ID:       id,
		Vector:   vec,
		Metadata: meta,
		Score:    0,
	}
	if _, err := st.Store(entry); err != nil {
		return nil, err
	}
	return []map[string]interface{}{{"type": "text", "text": "Stored entry: " + id}}, nil
}

func toolFeedback(st *storage.Storage, args map[string]interface{}) ([]map[string]interface{}, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return nil, fmt.Errorf("missing id")
	}
	adj, ok := toFloat64(args["scoreAdjustment"])
	if !ok {
		return nil, fmt.Errorf("missing scoreAdjustment")
	}
	found, err := st.UpdateScore(id, adj)
	if err != nil {
		return nil, err
	}
	msg := "Entry not found: " + id
	if found {
		msg = "Updated score for entry: " + id
	}
	return []map[string]interface{}{{"type": "text", "text": msg}}, nil
}

func toolDelete(st *storage.Storage, args map[string]interface{}) ([]map[string]interface{}, error) {
	id, _ := args["id"].(string)
	if id == "" {
		return nil, fmt.Errorf("missing id")
	}
	found, err := st.Delete(id)
	if err != nil {
		return nil, err
	}
	msg := "Entry not found: " + id
	if found {
		msg = "Deleted entry: " + id
	}
	return []map[string]interface{}{{"type": "text", "text": msg}}, nil
}
