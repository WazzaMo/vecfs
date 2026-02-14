# 2026-02-14 VecFS TypeScript Implementation Plan

This document outlines the architecture and implementation strategy for the VecFS MCP server and its associated agent skills using TypeScript, incorporating spatial decomposition for optimization and inspection.

# Core Objective

Implement a lightweight, "local-first" vector storage system that uses sparse representations to minimize disk footprint, integrated via the Model Context Protocol (MCP).

# Architecture Overview

The system will be divided into four primary layers.

# Storage Layer (VecFS Core)

This layer handles the reading and writing of the sparse vector file format.

## Sparse Vector Representation

Instead of storing a full dense array (e.g., 1536 dimensions for OpenAI embeddings), the system will store a map of index-to-value for non-zero entries.

## File Format

A simple JSON-line (JSONL) or binary format where each entry includes:
- Metadata (tags, timestamp, source URI).
- Sparse Vector (indices and values).
- Reinforcement Score.

# Algorithmic Optimization: Spatial Decomposition

To maintain performance as the store grows, VecFS will use spatial decomposition techniques adapted from 3D algorithms to index sparse high-dimensional space.

## Space Partitioning Strategies

While Octrees are standard for 3D, high-dimensional sparse vectors benefit from:
- **KD-Trees (K-Dimensional Trees):** Recursively partitioning the space along dimensions with the highest variance.
- **Binary Space Partitioning (BSP):** Using hyperplanes to divide the vector space into searchable regions, significantly reducing the number of cosine similarity calculations required per query.

## Sparse-Aware Indexing

By only indexing non-zero dimensions, the spatial decomposition avoids partitioning "empty" space, adhering to the fundamental VecFS principle.

# Interface Layer (MCP Server)

The MCP server acts as the bridge between the AI Agent and the Storage Layer.

## Core Search & Storage Tools

1. `search`: Performs similarity queries using spatial indices to accelerate recall.
2. `memorize`: Commits text and its sparse embedding to the store.
3. `feedback`: Updates reinforcement scores.

## Inspection and Transparency Tools

Both agents and humans require tools to inspect the "memory" state:
1. `inspect_store`: Returns a summary of the store, including sparsity density, total entries, and a "spatial map" of clusters.
2. `explain_recall`: Provides details on why a specific result was returned, highlighting the spatial proximity and the dimensions that triggered the match.
3. `visualize_space`: (Human-focused) Exports a 2D/3D projection (e.g., via t-SNE or UMAP) of the high-dimensional spatial decomposition for visual audit.

# Agent Skill Layer

The behavioral logic provided to the agent to ensure it uses the server effectively.

## Proactive Search

System instructions directing the agent to call `search` at the start of complex tasks.

## Self-Audit Behavior

The agent should periodically use `inspect_store` to identify conflicting or redundant memories and suggest consolidations.

# Technical Stack & References

1. **Language:** TypeScript.
2. **Runtime:** Node.js or Bun.
3. **Mathematical References:**
    - [Space Decomposition in 3D Algorithms (Google Scholar)](https://scholar.google.com.au/scholar?q=Space+Decomposition+in+3D+algorithms)
    - [KD-Trees for High-Dimensional Indexing](https://en.wikipedia.org/wiki/K-d_tree)
    - [Binary Space Partitioning (BSP) Concepts](https://en.wikipedia.org/wiki/Binary_space_partitioning)

# Implementation Steps

## Phase 1: Sparse Engine & Spatial Indexing

Develop the core similarity logic alongside a KD-tree or BSP implementation tailored for sparse inputs.

## Phase 2: Inspection Toolset

Develop the `inspect_store` and `explain_recall` tools to ensure the system is not a "black box" for the agent or the user.

## Phase 3: MCP Server & Skill Integration

Finalize the MCP interface and the system prompt engineering for the Agent Skill.
