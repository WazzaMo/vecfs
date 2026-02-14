# 2026-02-14 Integration Testing Strategies for VecFS

Integration tests for VecFS should focus on the interaction between the MCP server, the storage layer, and potential embedding providers.

# Testing Environments

## Local Process Integration

Running the MCP server as a subprocess and communicating via Stdio. This is the most direct way to test the production communication channel.

### Mock Embedding Providers

Integration tests should use mock embedding services (local HTTP servers) instead of real APIs (like OpenAI) to ensure tests are fast, deterministic, and free.

## Docker-Based Environments

Docker can be highly effective for creating repeatable, isolated integration test environments.

### MCP Client-Server Container

A container can house both a test client (simulating an AI agent) and the VecFS server. This ensures that environment variables, file permissions, and Node.js versions are consistent across CI/CD and developer machines.

### Sidecar Services

If VecFS ever expands to support external databases or complex caching (e.g., Redis), these can be run as sidecar containers in a Docker Compose setup.

# Integration Test Scenarios

## End-to-End Search Flow

1. Client sends `memorize` request with text and a vector.
2. Server confirms storage.
3. Client sends `search` request with a similar vector.
4. Server returns the previously stored entry.

## Conflict and Concurrency

Tests should simulate multiple clients writing to the same `vecfs-data.jsonl` file simultaneously to ensure file locking and atomic writes are working as expected.

## Error Handling

Simulating corrupted JSONL files or disk-full scenarios to verify the MCP server returns appropriate error codes to the agent.

# Recommended Tools

1. **Docker Compose:** To orchestrate the MCP server and mock embedding services.
2. **Supertest (or similar):** If an HTTP transport for MCP is ever added.
3. **Vitest Subprocess:** To spawn and manage the server lifecycle during testing.
