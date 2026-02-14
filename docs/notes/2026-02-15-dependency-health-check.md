# 2026-02-15 Dependency Health Check

An audit of the project's npm dependency tree for deprecated, outdated, or otherwise problematic packages.

# Summary

The project has no formally deprecated packages and no known vulnerabilities. All direct dependencies are at their latest versions. One transitive dependency is an obsolete polyfill, and the runtime Node.js version should be pinned to avoid an engine mismatch with vite.

# Audit Results

## npm audit

Zero vulnerabilities reported.

## npm outdated

No outdated direct or transitive dependencies.

## Deprecated Packages in Lockfile

None. The `package-lock.json` contains no entries flagged as deprecated by the npm registry.

# Findings

## Node.js Engine Mismatch

`vite@7.3.1` requires `^20.19.0 || >=22.12.0`. The workspace previously defaulted to Node v20.14.0, which falls outside both ranges. Node v22.12.0 is available via `fnm` and satisfies the requirement.

### Action

Pin the expected Node version so all contributors and CI use the right runtime. A `.node-version` file at the repository root is the simplest approach, recognised by `fnm`, `nvm`, `asdf`, and most CI providers.

```
22.12.0
```

## object-assign (Transitive)

`cors@2.8.6` depends on `object-assign@4.1.1`, a polyfill for `Object.assign()` that has been a native JavaScript built-in since ES2015. The project targets ES2020, so the polyfill serves no purpose. It is not flagged as deprecated on npm, but the package README itself states it is a "ponyfill" for environments without native support.

### Why It Exists

`cors` is both a direct dependency (used in the HTTP transport) and a transitive dependency (the MCP SDK also depends on `^2.8.5`). The `cors` package has not dropped the `object-assign` dependency because it still supports older runtimes.

### Impact

Minimal. `object-assign` is 834 bytes, has no sub-dependencies, and introduces no security risk. It is dead code in a Node 22 environment.

### Action

No immediate action is needed. If `cors` publishes a future version that removes the polyfill, updating will resolve it automatically. Alternatively, if the project ever replaces `cors` with a lighter middleware or the built-in CORS support in a framework like Hono (which the MCP SDK already depends on), the transitive dependency disappears.

# Dependency Overlap with MCP SDK

The MCP SDK (`@modelcontextprotocol/sdk@1.26.0`) bundles its own dependencies on `cors`, `express`, `hono`, and `zod`. The project also declares `cors`, `express`, and `zod` as direct dependencies. npm deduplicates them to a single copy, but they are worth tracking because a major version bump in the SDK could change the required ranges.

| Package | Project Version | SDK Required Range |
|---------|----------------|--------------------|
| cors    | ^2.8.6         | ^2.8.5             |
| express | ^5.2.1         | ^5.2.1             |
| zod     | ^4.3.6         | ^3.25 or ^4.0      |

All ranges are currently compatible.

### Action

When upgrading the MCP SDK in the future, verify that the direct dependency versions still satisfy the SDK's peer/dependency ranges. If the SDK migrates away from Express (it already ships Hono support), the project could follow and drop `express` and `cors` as direct dependencies.

# Recommended Actions

## Pin Node Version

Create a `.node-version` file containing `22.12.0` at the repository root. This ensures `fnm use` (or equivalent) selects the correct runtime without manual intervention.

## Monitor cors

No action required today. Watch for a future `cors` release that drops the `object-assign` polyfill or consider replacing the middleware if the HTTP transport moves to Hono.

## Track SDK Alignment

When upgrading `@modelcontextprotocol/sdk`, check for changes to its dependency ranges on `cors`, `express`, and `zod` to avoid version conflicts.
