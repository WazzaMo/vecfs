# vecfs-embed

Model-agnostic text-to-sparse-vector conversion for [VecFS](https://github.com/WazzaMo/vecfs).

Converts text into sparse vectors that the VecFS MCP server can store and search. Uses [Pydantic AI](https://ai.pydantic.dev/) for embedding, supporting local models (Sentence Transformers) and cloud providers (OpenAI, Google, Cohere, VoyageAI).

## Install

```bash
pip install vecfs-embed
```

Or with a cloud provider:

```bash
pip install vecfs-embed[openai]
```

## Usage

```bash
# Embed a query for searching
vecfs-embed --mode query "sparse vector storage"

# Embed a document for memorisation
vecfs-embed --mode document "key lesson to remember"

# Batch embed (one text per line on stdin)
cat texts.txt | vecfs-embed --batch --mode document

# Calibrate threshold for your model and domain
cat sample.txt | vecfs-embed --calibrate
```

## Configuration

| Environment Variable     | CLI Flag      | Default                                  |
|--------------------------|---------------|------------------------------------------|
| `VECFS_EMBED_MODEL`     | `--model`     | `sentence-transformers:all-MiniLM-L6-v2` |
| `VECFS_EMBED_DIMS`      | `--dims`      | (model default)                          |
| `VECFS_EMBED_THRESHOLD` | `--threshold` | `0.01`                                   |

## License

Apache-2.0
