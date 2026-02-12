# Requirements for VecFS MCP Server

VecFS provides a lightweight, local vector storage mechanism designed for AI agent memory. The MCP (Model Context Protocol) server acts as the interface between the agent and the VecFS storage layer.

# Functional Requirements

The MCP server must implement the following core functionalities to enable a seamless context loop for agents.

## Providing Context to an Agent

The MCP server should expose VecFS data as resources or via tools that the agent can query.

1. The server shall provide a `search` tool that allows an agent to query the vector space using natural language or existing vector embeddings.
2. The server shall support "context injection" where relevant snippets from the vector store are automatically suggested or provided based on the current task.
3. Resources should be addressable via URIs that the agent can reference to retrieve specific learned items.

## Storing and Contributing Context

To allow an agent to "learn," it must be able to write back information to VecFS.

1. The server shall provide a `memorize` or `store` tool that accepts text content, generates an embedding (or accepts one), and stores it in the VecFS format.
2. The storage process must adhere to the VecFS principle of "not storing zeros," ensuring that the local file remains compact.
3. The server shall allow updating existing memory entries if the agent learns new information that contradicts or expands upon previous entries.

## Search and Retrieval Mechanism

1. The server must handle the transformation of agent queries into the vector space.
2. Retrieval must be performant enough for real-time interaction on a local machine (e.g., WSL2/Linux/Mac).
3. The server should support filtering based on metadata (e.g., tags, timestamps, or project context).

# Integration Requirements

## Agent Interaction Flow

The success of the system depends on how the agent uses the MCP server.

```mermaid
graph TD
    "Agent" -->|"1. Search Request"| "MCP Server"
    "MCP Server" -->|"2. Query Vector Space"| "VecFS File"
    "VecFS File" -->|"3. Results"| "MCP Server"
    "MCP Server" -->|"4. Context"| "Agent"
    "Agent" -->|"5. Learn/Update"| "MCP Server"
    "MCP Server" -->|"6. Store Sparse Vector"| "VecFS File"
```

1. **Context Acquisition:** When starting a task, the agent proactively searches the MCP server for relevant historical context.
2. **Context Contribution:** After completing a task or learning a new fact, the agent uses the `store` tool to commit this knowledge to long-term memory.

# System Requirements

To be successful, the VecFS MCP implementation must meet these criteria:

1. **Local First:** No dependency on external vector databases; all storage must be in local VecFS files.
2. **Efficiency:** The system must implement the sparse vector storage model described in the goals, minimizing disk I/O and memory usage.
3. **Simplicity:** The server should be easy to install and configure as a standard MCP server (e.g., via `npx` or `pip`).
4. **Reliability:** Data must be stored in a way that is robust against corruption and easy to back up (simple file copy).

# Success Criteria

1. **Recall Accuracy:** The agent can successfully retrieve relevant information from past sessions with high precision.
2. **Storage Footprint:** The VecFS file size should be significantly smaller than a dense vector representation of the same data.
3. **Low Latency:** Context retrieval should add negligible overhead to the agent's response time.
