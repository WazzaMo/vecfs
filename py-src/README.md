# vecfs-embed (Python)

Model-agnostic text-to-sparse-vector conversion and VecFS MCP server for [VecFS](https://github.com/WazzaMo/vecfs).

Converts text into sparse vectors that the VecFS MCP server can store and search. Uses [Pydantic AI](https://ai.pydantic.dev/) for embedding, supporting local models (Sentence Transformers) and cloud providers (OpenAI, Google, Cohere, VoyageAI). The same package provides the embedding CLI (`vecfs-embed`) and the Python MCP server CLI (`vecfs-py`).

# Build

The project version is read at build time from the repo root file `VERSION.txt`. Build from the repo root or from `py-src/`.

## Editable install (development)

From the repo root:

```bash
pip install -e py-src
```

Or from `py-src/`:

```bash
pip install -e .
```

This installs the `vecfs-embed`, `vecfs-embed-py`, and `vecfs-py` entry points and uses the version in `VERSION.txt`.

## Wheel and sdist

From the repo root (so `../VERSION.txt` exists relative to `py-src/`):

```bash
cd py-src
pip install build
python -m build
```

Artifacts appear in `py-src/dist/`. The version baked into the wheel is taken from `VERSION.txt` at build time.

# Test

Run tests with pytest from `py-src/`:

```bash
cd py-src
pytest
```

Run with verbose output:

```bash
pytest -v
```

Tests cover config loading, sparse vector behaviour, storage, and integration. Async tests use `pytest-asyncio` (configured in `pyproject.toml`).

# Run

After installing (editable or from a wheel), use the installed commands.

## Embedding CLI (vecfs-embed)

```bash
# Embed a query for searching
vecfs-embed --mode query "sparse vector storage"

# Embed a document for memorisation
vecfs-embed --mode document "key lesson to remember"

# Batch embed (one text per line on stdin)
cat texts.txt | vecfs-embed --batch --mode document

# Calibrate threshold for your model and domain
cat sample.txt | vecfs-embed --calibrate

# Print version (from VERSION.txt at build time)
vecfs-embed --version
```

## MCP server CLI (vecfs-py)

```bash
# Run MCP server on stdio (for agents)
vecfs-py mcp

# Run MCP server on HTTP
vecfs-py mcp --http

# Print version
vecfs-py version
```

Configuration for both is via `vecfs.yaml` (or `.vecfs.yaml`), `VECFS_CONFIG`, or `--config`. Env vars such as `VECFS_FILE`, `VECFS_EMBED_MODEL`, and `PORT` override config.

# Install (published package)

To install the published package from PyPI instead of building from source:

```bash
pip install vecfs-embed
```

With a cloud provider:

```bash
pip install vecfs-embed[openai]
```

# Configuration

| Environment Variable     | CLI Flag      | Default                                  |
|--------------------------|---------------|------------------------------------------|
| `VECFS_EMBED_MODEL`     | `--model`     | `sentence-transformers:all-MiniLM-L6-v2` |
| `VECFS_EMBED_DIMS`      | `--dims`      | (model default)                          |
| `VECFS_EMBED_THRESHOLD` | `--threshold` | `0.01`                                   |

# License

Apache-2.0
