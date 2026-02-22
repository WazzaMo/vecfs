package mcp

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/WazzaMo/vecfs/internal/storage"
)

// JSON-RPC request (we only care about method and params).
type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type jsonRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   interface{} `json:"error,omitempty"`
}

// RunStdio runs the MCP server over stdio: read JSON-RPC requests from stdin, write responses to stdout.
func RunStdio(st *storage.Storage) error {
	scanner := bufio.NewScanner(os.Stdin)
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var req jsonRPCRequest
		if err := json.Unmarshal(line, &req); err != nil {
			_ = enc.Encode(jsonRPCResponse{JSONRPC: "2.0", ID: nil, Error: map[string]string{"message": err.Error()}})
			continue
		}
		resp := handleRequest(st, req.Method, req.Params, req.ID)
		if err := enc.Encode(resp); err != nil {
			fmt.Fprintf(os.Stderr, "encode: %v\n", err)
		}
	}
	return scanner.Err()
}

func handleRequest(st *storage.Storage, method string, paramsRaw json.RawMessage, id interface{}) jsonRPCResponse {
	switch method {
	case "tools/list":
		tools := make([]map[string]interface{}, 0, len(toolDefs))
		for _, t := range toolDefs {
			tools = append(tools, map[string]interface{}{
				"name":        t.Name,
				"description": t.Description,
				"inputSchema": t.InputSchema,
			})
		}
		return jsonRPCResponse{JSONRPC: "2.0", ID: id, Result: map[string]interface{}{"tools": tools}}
	case "tools/call":
		var body struct {
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
		}
		if err := json.Unmarshal(paramsRaw, &body); err != nil {
			return jsonRPCResponse{JSONRPC: "2.0", ID: id, Error: map[string]string{"message": err.Error()}}
		}
		content, err := CallTool(st, body.Name, body.Arguments)
		if err != nil {
			return jsonRPCResponse{JSONRPC: "2.0", ID: id, Error: map[string]string{"message": err.Error()}}
		}
		return jsonRPCResponse{JSONRPC: "2.0", ID: id, Result: map[string]interface{}{"content": content}}
	default:
		return jsonRPCResponse{JSONRPC: "2.0", ID: id, Error: map[string]string{"message": "method not found: " + method}}
	}
}

// RunStdioFromReaderWriter is for tests: use custom in/out instead of os.Stdin/Stdout.
func RunStdioFromReaderWriter(st *storage.Storage, in io.Reader, out io.Writer) error {
	scanner := bufio.NewScanner(in)
	enc := json.NewEncoder(out)
	enc.SetEscapeHTML(false)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var req jsonRPCRequest
		if err := json.Unmarshal(line, &req); err != nil {
			_ = enc.Encode(jsonRPCResponse{JSONRPC: "2.0", ID: nil, Error: map[string]string{"message": err.Error()}})
			continue
		}
		resp := handleRequest(st, req.Method, req.Params, req.ID)
		_ = enc.Encode(resp)
	}
	return scanner.Err()
}
