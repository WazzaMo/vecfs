# VecFS

VecFS (Vector File System) is a lightweight, local-first vector storage specification and implementation designed for AI agent long-term memory.

## Copyright

(c) Copyright 2026 Warwick Molloy.
Contribution to this project is supported and contributors will be recognised.
Created by Warwick Molloy Feb 2026.

## Overview

VecFS aims to provide AI agents with a simple and efficient way to store and retrieve context locally. By leveraging the Model Context Protocol (MCP), agents can "learn" from their interactions and recall relevant information in future sessions without the complexity of a full-scale vector database.

## Key Features

- **Sparse Vector Storage:** Follows the principle of "not storing zeros" to achieve natural data compression and minimal disk footprint.
- **Local-First:** Designed to run on a laptop (WSL2, Linux, macOS) with simple file-based storage.
- **MCP Integration:** Acts as an MCP server, providing tools for agents to `search` and `memorize` context seamlessly.
- **Simplicity:** Easy to operate, back up, and maintain.

## Documentation

- [Goals](docs/goals.md) - The vision and core principles of VecFS.
- [Requirements](docs/requirements.md) - Technical requirements for the MCP server and storage layer.
- [Doc Guide](docs/doc-guide.md) - Guidelines for contributing to the documentation.

## License

This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details (if available) or visit [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0).
