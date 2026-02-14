# MCP Server Connection Guide

VecFS supports multiple transport protocols for connecting AI agents to the MCP server.

# Transport Modes

## Stdio (Default)

The standard mode for local integration. The server communicates via standard input/output streams.

### Usage
```bash
npm start
```

### When to use
- Running locally with Cursor, Claude Desktop, or other CLI-based agents.
- Simple, secure (no network ports exposed).

## HTTP / SSE

Runs the server as a web service using Server-Sent Events (SSE) for server-to-client updates and HTTP POST for client-to-server requests.

### Usage
```bash
npm start -- --http
# OR with custom port
PORT=8080 npm start -- --http
```

### Endpoints
- **SSE Stream:** `GET /sse`
- **Message Post:** `POST /messages`

### When to use
- Connecting remote agents.
- Debugging with tools like Postman or web inspectors.
- Hosting VecFS in a containerized environment where stdio piping is difficult.

# Configuration

| Environment Variable | Description | Default |
|----------------------|-------------|---------|
| `VECFS_FILE`         | Path to the vector storage file. | `./vecfs-data.jsonl` |
| `PORT`               | Port for HTTP server (HTTP mode only). | `3000` |

# Troubleshooting

## Connection Refused (HTTP)
Ensure no other service is running on port 3000. Try setting a different port:
```bash
PORT=3001 npm start -- --http
```

## "SSE connection not established"
The HTTP server implementation in this MVP supports **single-client** connections. Ensure only one agent is connected to the `/sse` endpoint at a time.
