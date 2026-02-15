# Contributing to VecFS

Thank you for your interest in contributing to VecFS. This guide covers everything you need to get started, from setting up your environment to submitting a pull request.

# How to Contribute

VecFS uses the fork and pull request workflow. You do not need write access to the repository to contribute.

## Step 1: Fork the Repository

1. Navigate to [https://github.com/WazzaMo/vecfs](https://github.com/WazzaMo/vecfs).
2. Click the **Fork** button in the top-right corner.
3. Select **Copy the default branch only** (recommended for most contributions).
4. GitHub creates your own copy of the repository under your account.

## Step 2: Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/vecfs.git
cd vecfs
```

## Step 3: Create a Branch

Create a branch for your change. Use a descriptive name that reflects the work.

```bash
git checkout -b fix-search-limit
```

## Step 4: Make Your Changes

Follow the coding standards and environment setup described below. Commit your work with clear, concise messages.

```bash
git add .
git commit -m "Fix search tool ignoring limit parameter"
```

## Step 5: Push and Open a Pull Request

Push your branch to your fork:

```bash
git push -u origin fix-search-limit
```

Then open a pull request from your fork on GitHub. In the pull request description:

- Summarise what you changed and why.
- Reference any related issues (e.g., "Fixes #12").
- Describe how to test the change.

A maintainer will review your pull request and may request changes before merging.

# Environment Setup

VecFS has two source trees: TypeScript (`ts-src/`) and Python (`py-src/`). You may only need one depending on what you are working on.

## Node.js (MCP Server)

The project uses [fnm](https://github.com/Schniz/fnm) (Fast Node Manager) to manage Node.js versions. The required version is pinned in `.node-version`.

### Install fnm

If you do not have fnm installed:

```bash
curl -fsSL https://fnm.vercel.app/install | bash
```

Restart your shell or run the output `eval` command, then:

```bash
fnm install
fnm use
```

This reads `.node-version` and activates Node.js 22.12.0 (or whichever version is pinned).

### Install Dependencies and Build

```bash
npm install
npm run build
```

### Run Tests

```bash
# All TypeScript tests (unit + stdio integration)
npm test

# Stdio MCP server integration tests only
npm run test:integration

# HTTP/SSE MCP server integration tests (builds first)
npm run test:http
```

## Python (Embedding Script)

The embedding script uses [uv](https://docs.astral.sh/uv/) for dependency management and virtual environments.

### Install uv

If you do not have uv installed:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Install Dependencies

```bash
cd py-src
uv sync --extra dev
```

This creates a `.venv/` in `py-src/` and installs all dependencies including test tools.

### Run Tests

```bash
cd py-src

# Unit tests (pure Python, no model needed, fast)
uv run pytest tests/test_sparsify.py -v

# Integration tests (loads embedding model, uses docs/ as input)
uv run pytest tests/test_integration.py -v

# All tests
uv run pytest tests/ -v
```

# Code Standards

## TypeScript

- Source files go in `ts-src/`.
- Follow SOLID principles. Prefer small, focused files (50-300 lines).
- Use clear, descriptive names for files, functions, and variables.
- The project uses strict TypeScript with `NodeNext` module resolution.
- Input validation uses Zod schemas (see `ts-src/tool-handlers.ts`).

## Python

- Source files go in `py-src/vecfs_embed/`.
- Use type hints on all public functions.
- Keep pure logic (like `sparsify.py`) separate from I/O (like `cli.py`).

## General

- Do not commit secrets, API keys, or `.env` files.
- Do not commit generated files (`dist/`, `.venv/`, `node_modules/`).
- Run the relevant test suite before submitting a pull request.

# Documentation

Documentation is a first-class citizen in VecFS. All Markdown files should follow the formatting rules in [docs/doc-guide.md](docs/doc-guide.md):

- Use `#` (level 1 headings) for new sections, not only the title.
- Place an empty line after every heading.
- Use headings instead of bold text for labels.
- Keep table rows under 60 characters; use headings and paragraphs for longer descriptions.
- Use Mermaid for diagrams, with all text labels quoted.

## Notes

If your contribution involves a new feature or architectural change, create an implementation plan in `docs/notes/` prefixed with the date (e.g., `2026-02-15-my-feature.md`). Review it against the project goals in [docs/goals.md](docs/goals.md) and requirements in [docs/requirements.md](docs/requirements.md).

# What to Contribute

Contributions of all kinds are welcome:

- Bug fixes
- New features or tool improvements
- Test coverage improvements
- Documentation updates and corrections
- Performance optimisations
- Support for additional embedding providers in the Python script

If you are unsure whether a change is in scope, open an issue first to discuss it.

# Reporting Issues

Open an issue at [https://github.com/WazzaMo/vecfs/issues](https://github.com/WazzaMo/vecfs/issues) with:

- A clear description of the problem or suggestion.
- Steps to reproduce (for bugs).
- Your environment (OS, Node.js version, Python version).

# License

By contributing to VecFS, you agree that your contributions will be licensed under the Apache License, Version 2.0, the same license as the project.
