# 2026-02-15 Code Review

A review of the TypeScript source in `ts-src/` and supporting project configuration. Findings are grouped by file and by cross-cutting concern. Each item notes the severity (high, medium, low) and suggests a concrete improvement.

# types.ts

This file is clean and well-documented. One subtlety is worth noting.

## SparseVector Index Signature

Severity: low

The `SparseVector` interface uses a numeric index signature (`[index: number]: number`). JavaScript object keys are always strings at runtime, so `for...in` yields string keys. The code in `sparse-vector.ts` compensates by calling `Number(indexStr)` on every iteration, which works but is a recurring source of indirection. An alternative is to type the interface as `Record<string, number>` to match the runtime reality, or to use a `Map<number, number>` for true numeric keys. Either change would remove the need for repeated string-to-number conversion.

# sparse-vector.ts

## Unused Allocations in dotProduct

Severity: low

```14:14:ts-src/sparse-vector.ts
  const keys2 = Object.keys(v2).map(Number);
```

`keys1` and `keys2` are allocated as arrays, but only their `.length` property is used to decide which vector is smaller. The arrays themselves are discarded. Replacing with `Object.keys(v1).length` and `Object.keys(v2).length` avoids two unnecessary array mappings.

## Iteration Style

Severity: low

Both `dotProduct` and `norm` use `for...in` to iterate over sparse vectors. `for...in` traverses all enumerable properties, including inherited ones. While this is safe today because plain objects are used, switching to `Object.keys(v)` or `Object.entries(v)` makes the intent explicit and guards against future surprises.

## Missing Norm Cache

Severity: low

`cosineSimilarity` computes the norm of the second vector on every call. When a single query vector is compared against many stored vectors (as in `storage.search`), the query norm is recomputed for every entry. Passing a pre-computed query norm or restructuring the similarity function to accept pre-computed norms would eliminate redundant work as the store grows.

# storage.ts

## Race Condition in updateScore

Severity: high

`updateScore` performs a read-modify-write cycle with no file locking. If two calls overlap, the second read may see stale content and the second write silently drops the first update. Similarly, if `store` appends a new entry between the read and write of `updateScore`, the appended entry is lost. This is the most significant correctness issue in the codebase.

Suggested fix: introduce file-level locking (for example via a simple in-process mutex or an advisory lock with `fs.open` flags) so that `store` and `updateScore` cannot interleave.

## Full File Read on Every Search

Severity: medium

`search` reads and parses the entire JSONL file on every call. For a local-first prototype this is acceptable, but it becomes a bottleneck as the store grows. The implementation plan already proposes spatial indexing. A nearer-term improvement would be to add an in-memory cache that is invalidated when `store` or `updateScore` mutates the file.

## ensureFile Called on Every Request

Severity: medium

In `mcp-server.ts`, `storage.ensureFile()` is awaited inside every `tools/call` handler. After the first call the file is guaranteed to exist. Calling it once at server startup (or lazily on the first operation) would avoid repeated `mkdir` and `access` syscalls.

## No Duplicate ID Prevention

Severity: medium

`store` appends unconditionally. Calling `memorize` twice with the same `id` produces two entries. `updateScore` would then update both, but `search` returns both with independent similarity scores. This could confuse agents that expect IDs to be unique. Consider either rejecting duplicate IDs or implementing upsert semantics (replace the existing entry).

## Silent No-Op on Missing ID

Severity: low

`updateScore` silently succeeds when the target `id` does not exist. Returning a boolean or throwing an error would let callers know the feedback had no effect.

## No Delete Operation

Severity: low

There is no way to remove an entry. As the store accumulates stale or incorrect memories, the only option is manual file editing. A `delete` method (and corresponding MCP tool) would support the "audit the archive" behavior described in `docs/skills.md`.

# mcp-server.ts

## No Input Validation

Severity: high

The tool handlers cast arguments to `any` and destructure without validation. If an agent omits the `vector` field, `normalizeVector(undefined)` returns `undefined` and `storage.search` receives a non-object, leading to an opaque runtime error. Similarly, a non-numeric `scoreAdjustment` would corrupt the stored score via `NaN`.

Suggested fix: validate each tool's arguments at the top of its handler branch. The project already depends on `zod` (currently unused), which is well suited for this. Define a schema per tool and parse the arguments before proceeding.

## normalizeVector Accepts any

Severity: medium

```17:22:ts-src/mcp-server.ts
function normalizeVector(input: any): Record<number, number> {
  if (Array.isArray(input)) {
    return toSparse(input);
  }
  return input;
}
```

When `input` is neither an array nor a valid sparse object (for example `null`, a string, or `undefined`), the function returns it as-is, deferring the failure to a later point. Adding an explicit type guard or throwing early would surface the problem closer to its source.

## Multiple Responsibilities

Severity: medium

`mcp-server.ts` handles server construction, transport selection, tool schema declaration, tool dispatch, argument normalization, and the HTTP/Express setup. At 223 lines it is within the project's file-length guideline, but the responsibilities could be separated for clarity and testability.

Suggested split:

- `tool-schemas.ts` -- exports the tool definition array (reuses the vector schema instead of duplicating it).
- `tool-handlers.ts` -- exports a dispatch function mapping tool names to validated, typed handler functions.
- `mcp-server.ts` -- wires schemas, handlers, transport, and startup.

This would also make it possible to unit-test the handler logic without spawning a child process.

## Duplicated Vector Schema

Severity: low

The `oneOf` block describing sparse-or-dense vectors appears identically in both the `search` and `memorize` tool schemas. Extracting it into a shared constant eliminates the duplication and ensures both schemas stay in sync.

## Single-Client SSE Limitation

Severity: low

The HTTP mode stores a single `transport` variable. A second SSE client overwrites the first, leaving the first client's connection orphaned. The inline comment acknowledges this. If multi-client support is planned, a `Map<string, SSEServerTransport>` keyed by session ID is needed.

# package.json

## Unused Dependencies

Severity: medium

`mathjs` and `zod` are listed in `dependencies` but are not imported anywhere in the source. They inflate `node_modules` and the install footprint. Remove them, or (in the case of `zod`) begin using them for input validation as suggested above.

## Type Packages in dependencies

Severity: low

`@types/cors` and `@types/express` are type-only packages used at compile time. They belong in `devDependencies`, not `dependencies`. Moving them avoids shipping unnecessary packages to production consumers.

## Incorrect main Entry Point

Severity: low

`"main": "index.js"` does not exist. The actual entry point is `dist/mcp-server.js`. This would cause failures for anyone importing the package programmatically. Updating `main` (or adding `"bin"` for CLI usage) would fix this.

# tsconfig.json

## Module Resolution Mismatch

Severity: low

The project uses `"module": "ESNext"` with `"moduleResolution": "node"`. The `"node"` resolution strategy is designed for CommonJS. For ESM with Node.js, `"moduleResolution": "NodeNext"` (paired with `"module": "NodeNext"`) is the recommended setting and aligns with the `.js` extension imports already used throughout the source.

# Tests

## Integration Tests Use Sleep-Based Startup

Severity: medium

Both `integration.test.ts` and `http-integration.test.ts` wait a fixed duration (1-2 seconds) for the server to start. This is fragile: too short on a slow machine, wastefully long on a fast one. Polling the server (for example, retrying a lightweight request until it succeeds) would be more reliable.

## No Timeout on sendRequest

Severity: medium

The `sendRequest` helper in `integration.test.ts` returns a promise that resolves when the matching response arrives but has no timeout. If the server never responds (crash, hang), the test hangs indefinitely rather than failing with a clear message. Wrapping the promise with `Promise.race` and a timeout would improve debuggability.

## Request ID Collisions

Severity: low

`sendRequest` uses `Date.now()` as the request ID. Two requests dispatched in the same millisecond would share an ID, causing the second response to be swallowed. A simple incrementing counter would be safer.

## test-vecfs.ts Leaves Artifacts

Severity: low

The manual test script writes to `./test-data.jsonl` and does not clean up. It is largely superseded by the vitest suites. Consider removing it or adding it to `.gitignore`.

## Missing Unit Test Scenarios

Severity: low

- Searching an empty store (no entries, empty file).
- Storing and retrieving an entry with duplicate ID.
- `updateScore` with a nonexistent ID.
- Vectors containing negative values.
- `toSparse` with an empty array.

# Summary of Recommended Actions

## Immediate (Correctness)

1. Add file locking or an in-process mutex to prevent race conditions between `store` and `updateScore`.
2. Validate tool arguments in `mcp-server.ts` before passing them to storage (use `zod` or manual checks).

## Short Term (Quality)

3. Remove unused `mathjs` dependency. Either remove or start using `zod`.
4. Move `@types/cors` and `@types/express` to `devDependencies`.
5. Extract tool schemas and handlers into separate files to reduce `mcp-server.ts` responsibilities.
6. Call `ensureFile` once at startup rather than on every request.
7. Replace sleep-based server startup in tests with polling.

## Medium Term (Features)

8. Add duplicate-ID detection or upsert semantics to `store`.
9. Add a `delete` method and corresponding MCP tool.
10. Cache parsed entries in memory to avoid re-reading the file on every search.
11. Pre-compute and pass the query vector norm to `cosineSimilarity` to avoid redundant calculations.

## Housekeeping

12. Fix `"main"` in `package.json` to point to `dist/mcp-server.js`.
13. Update `tsconfig.json` to use `"moduleResolution": "NodeNext"`.
14. Remove or `.gitignore` the manual `test-vecfs.ts` test script.
15. Add missing unit test edge cases.
