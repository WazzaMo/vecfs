# Vector Encoding

How text is converted to sparse vectors for VecFS storage and retrieval.

# Overview

VecFS stores vectors in a sparse format where only non-zero dimensions are recorded. This follows the fundamental principle: you don't need to store zeros.

A dense embedding vector from any model is converted to this sparse format through a pipeline of normalisation and thresholding.

# Pipeline

```
Text → Embedding Model → Dense Vector → L2 Normalise → Threshold → Sparse Vector
```

## Stage 1: Text to Dense Vector

An embedding model (e.g., Sentence Transformers, OpenAI, Cohere) converts text into a fixed-length array of floating-point numbers. The length depends on the model.

| Model                                   | Dimensions |
|-----------------------------------------|------------|
| sentence-transformers:all-MiniLM-L6-v2  | 384        |
| openai:text-embedding-3-small           | 1536       |
| cohere:embed-v4.0                       | 1024       |

## Stage 2: L2 Normalisation

The dense vector is normalised to unit length so that all components are on a consistent scale regardless of input text length. This ensures the sparsification threshold behaves predictably.

```
normalised[i] = dense[i] / sqrt(sum(dense[j]^2 for all j))
```

## Stage 3: Thresholding

Components whose absolute value falls below a threshold are dropped. The remaining components form the sparse vector.

```
sparse = {i: v for i, v in enumerate(normalised) if abs(v) > threshold}
```

The default threshold is `0.01`. Higher thresholds produce smaller vectors (more compression) at the cost of some retrieval precision.

# Choosing a Threshold

Use the embedding script's `--calibrate` mode to find the right threshold for your model and domain:

```bash
cat your-documents.txt | python -m vecfs_embed --calibrate
```

This reports the distribution of component magnitudes and the percentage of dimensions retained at various thresholds.

## Typical Compression

| Threshold | Dimensions Retained | Use Case                    |
|-----------|--------------------|-----------------------------|
| 0.001     | ~95%               | Maximum fidelity            |
| 0.01      | ~60-80%            | Good default                |
| 0.05      | ~20-40%            | Aggressive compression      |

# Cosine Similarity

Search results are ranked by cosine similarity between the query vector and each stored vector:

```
similarity = dot(query, entry) / (norm(query) * norm(entry))
```

Because sparse vectors only store non-zero dimensions, the dot product computation only iterates over dimensions present in both vectors. This makes search efficient even with high-dimensional embeddings.

# Query vs Document Mode

Some embedding models produce different vectors depending on whether the input is a search query or a document being indexed. The embedding script supports both:

- Use `--mode query` when generating vectors for the `search` tool.
- Use `--mode document` when generating vectors for the `memorize` tool.

Consistent use of modes improves retrieval quality.
