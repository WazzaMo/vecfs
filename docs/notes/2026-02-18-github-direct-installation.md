# GitHub Direct Installation Plan

This note explores what is needed to make VecFS installable directly from GitHub without requiring npm or pip package managers.

# Current State

VecFS currently has two installation paths:

## Package Manager Installation

- **MCP Server**: Installed via `npm install -g vecfs` or `npx vecfs`
- **Embedding Script**: Installed via `pip install vecfs-embed` or `uv tool install vecfs-embed`

## Tarball Installation

The `scripts/package.sh` script creates a distributable tarball (`vecfs-<version>.tar.gz`) that includes:
- Pre-built `mcp-server.js` bundle (single file, no node_modules)
- Python wheel (`vecfs-embed.whl`)
- Agent skill directory
- `install.sh` script that uses npm and pip/uv

# Goal

Enable installation directly from GitHub repository without requiring npm or pip, allowing users to:
1. Clone or download from GitHub
2. Install both components using only system tools (Node.js runtime, Python runtime)
3. Avoid package manager dependencies

# Requirements

## Prerequisites

Users will still need:
- **Node.js runtime** (to execute the MCP server JavaScript)
- **Python runtime** (to execute the embedding script)
- **Git** (to clone the repository, or ability to download releases)

## What Needs to Change

### MCP Server Installation

Currently requires npm to install globally. To avoid npm:

#### Option 1: Standalone Binary Script

Create a wrapper script that:
- Checks for Node.js availability
- Creates a symlink or wrapper script in a user PATH directory (e.g., `~/.local/bin/`)
- Points to the bundled `mcp-server.js` from the repository

**Requirements:**
- Detect user's PATH directories (`~/.local/bin/`, `/usr/local/bin/`, etc.)
- Create executable wrapper script or symlink
- Handle permissions gracefully

#### Option 2: Manual PATH Setup Instructions

Provide clear instructions for users to:
- Clone/download repository
- Add repository `dist/` directory to PATH
- Or create manual symlinks

**Limitation:** Less automated, requires user configuration

#### Option 3: GitHub Actions Binary Release

Build platform-specific binaries using:
- `pkg` or `nexe` for Node.js bundling (creates standalone executables)
- Or use GitHub Actions to build binaries for Linux/macOS/Windows

**Requirements:**
- GitHub Actions workflow for building binaries
- Binary distribution via GitHub Releases
- Platform detection in installer

### Python Embedding Script Installation

Currently requires pip/uv to install the wheel. To avoid pip:

#### Option 1: Direct Python Module Installation

Install the Python package directly without pip:
- Copy `py-src/vecfs_embed/` to a Python path location
- Create entry point script manually
- Handle dependencies manually (or bundle them)

**Requirements:**
- Detect Python installation and site-packages/user site-packages
- Copy module files to appropriate location
- Create `vecfs-embed` executable script
- Handle Python dependencies (could bundle or require manual install)

#### Option 2: Standalone Python Executable

Use tools like:
- `PyInstaller` or `cx_Freeze` to create standalone executables
- `shiv` to create self-contained Python applications

**Requirements:**
- Build process for creating standalone executables
- Platform-specific builds (Linux/macOS/Windows)
- Larger distribution size

#### Option 3: Direct Script Execution

Provide `vecfs-embed` as a Python script that can be:
- Executed directly with `python vecfs-embed.py`
- Or symlinked to PATH

**Requirements:**
- Handle Python dependencies (user must install manually or use venv)
- Less "installed" feel, more "run from directory"

# Recommended Approach

## Hybrid Solution

Combine multiple approaches to maximize compatibility:

### For MCP Server

1. **Primary**: Provide standalone Node.js script that can be symlinked
   - Bundle all dependencies in `mcp-server.js` (already done via esbuild)
   - Create installer script that symlinks to `~/.local/bin/vecfs` or similar
   - Works on Linux/macOS/WSL2

2. **Alternative**: GitHub Releases with pre-built binaries
   - Use `pkg` to create platform-specific binaries
   - Users download and extract to PATH directory
   - Works everywhere but larger distribution

### For Python Script

1. **Primary**: Direct module installation script
   - Detect Python and site-packages location
   - Copy `vecfs_embed` module to site-packages
   - Create `vecfs-embed` entry script in PATH
   - Handle dependencies via `pip install -r requirements.txt` (minimal, only if needed)

2. **Alternative**: Standalone executable via PyInstaller
   - Create platform-specific binaries
   - No Python installation needed (but larger size)

# Implementation Plan

## New Installer Script

Create `install-from-github.sh` that:

1. **Detects environment:**
   - Checks for Node.js (`node --version`)
   - Checks for Python (`python3 --version`)
   - Detects available PATH directories

2. **Installs MCP Server:**
   - Ensures `dist/mcp-server.js` exists (or builds it)
   - Creates symlink or wrapper script in `~/.local/bin/vecfs`
   - Makes it executable

3. **Installs Python Script:**
   - Option A: Copies module to Python site-packages and creates entry script
   - Option B: Creates standalone executable if PyInstaller available
   - Option C: Creates symlink to `py-src/vecfs_embed/cli.py` with proper shebang

4. **Handles dependencies:**
   - For Node.js: Already bundled, no action needed
   - For Python: Optionally installs dependencies if user agrees, or provides instructions

## GitHub Releases Strategy

1. **Create GitHub Actions workflow** that:
   - Builds MCP server bundle
   - Creates Python wheel
   - Optionally creates standalone binaries (pkg, PyInstaller)
   - Packages everything into release assets

2. **Release assets include:**
   - `vecfs-<version>.tar.gz` (current format)
   - `vecfs-<version>-linux-x64.tar.gz` (with binaries)
   - `vecfs-<version>-macos-x64.tar.gz`
   - `vecfs-<version>-windows-x64.zip`
   - `install-from-github.sh` (universal installer)

## Documentation Updates

Update `README.md` with new installation section:

```markdown
# Installation from GitHub

## Quick Install

```bash
git clone https://github.com/WazzaMo/vecfs.git
cd vecfs
./install-from-github.sh
```

## Manual Install

See [INSTALL.md](INSTALL.md) for manual installation steps.
```

# Challenges

## Dependency Management

- **Node.js dependencies**: Already solved via esbuild bundling
- **Python dependencies**: Still need pydantic-ai-slim and sentence-transformers
  - Could bundle via PyInstaller
  - Or require user to install manually
  - Or provide minimal installer that uses pip once (acceptable?)

## Cross-Platform Compatibility

- PATH detection differs on Linux/macOS/Windows
- Symlink creation requires appropriate permissions
- Windows requires `.cmd` or `.bat` wrappers instead of symlinks

## Version Management

- Without package managers, harder to update
- Users must manually pull/clone new versions
- Could provide `vecfs-update` script that pulls from GitHub

# Success Criteria

1. User can install VecFS with only:
   - Git (or download capability)
   - Node.js runtime
   - Python runtime
   - No npm or pip required

2. Installation is automated via single script

3. Both `vecfs` and `vecfs-embed` commands work after installation

4. Installation works on Linux, macOS, and WSL2 (Windows support optional)

# Implementation (2026-02-18)

The `install-from-github.sh` script has been added at the repository root.

## What It Does

- **MCP server:** Copies `dist/mcp-server.js` into `PREFIX/lib/vecfs/` and creates a symlink `PREFIX/bin/vecfs`. If `dist/` is missing, runs `npm run build` (requires npm once for that build).
- **vecfs-embed:** Copies `py-src/vecfs_embed` and `pyproject.toml` into `PREFIX/lib/vecfs/embed/`, and creates a wrapper script at `PREFIX/bin/vecfs-embed` that sets `PYTHONPATH` and runs `python3 -m vecfs_embed.cli`. No pip required for the install; user is told to run `pip install PREFIX/lib/vecfs/embed` (or `uv pip install`) to install Python dependencies.
- **Options:** `--server`, `--embed`, `--prefix DIR`, `--install-python-deps`, `--help`. Default prefix is `~/.local`. Environment override: `VECFS_INSTALL_PREFIX`.

## Status

- Script implemented and tested (install to temp prefix, both components installed).
- README updated with "Install from GitHub" section.
- Remaining: test on macOS, add `INSTALL.md` if desired, optional `vecfs-update` script.

# Next Steps

1. ~~Create `install-from-github.sh` script~~ Done
2. Test installation on clean systems (e.g. macOS)
3. Create GitHub Actions workflow for binary builds (optional)
4. ~~Update documentation~~ README section added
5. Add `INSTALL.md` with detailed manual instructions (optional)
6. Consider creating `vecfs-update` script for version management
