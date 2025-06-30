# Performance Optimizations in OATSJS

This document describes the performance optimizations implemented in OATSJS v2.2.0 and how to leverage them for the best development experience.

## Overview

OATSJS v2.2.0 introduces significant performance improvements that reduce sync time by up to 45% and eliminate common issues like excessive file watching. The optimizations focus on:

1. **Intelligent polling for runtime API specs**
2. **Hash-based change detection**
3. **Incremental compilation**
4. **Smart caching mechanisms**

## Key Performance Improvements

### 1. Polling-Based Sync for Runtime Specs

**Problem**: Previously, OATSJS watched entire backend directories for Python projects, causing "too many open files" errors and unnecessary syncs.

**Solution**: For runtime-generated API specs (like FastAPI's `/openapi.json`), OATSJS now uses intelligent polling:

```json
{
  "services": {
    "backend": {
      "apiSpec": {
        "path": "/openapi.json"  // Runtime endpoint
      }
    }
  },
  "sync": {
    "pollingInterval": 3000  // Check every 3 seconds (default: 5000ms)
  }
}
```

**Benefits**:
- No more file watching errors
- Reduced CPU usage
- Only checks the actual API spec, not source files

### 2. Smart Hash Comparison

OATSJS uses SHA-256 hashing to detect meaningful changes in API specs:

- Ignores formatting changes
- Filters out non-significant modifications
- Stores hash between syncs to avoid redundant generation

**Result**: Near-instant sync when no actual API changes occurred.

### 3. Incremental TypeScript Compilation

The generated TypeScript client now uses incremental compilation:

```json
// tsconfig.json in your client package
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo"
  }
}
```

**Benefits**:
- 64% faster build times on subsequent compilations
- TypeScript reuses previous compilation information

### 4. Spec-Based Caching

OATSJS stores the OpenAPI spec hash in `.openapi-hash` file to:
- Skip regeneration when spec hasn't changed
- Persist cache across restarts
- Enable faster startup times

## Performance Metrics

Based on real-world testing:

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Full sync (with changes) | ~3.4s | ~1.8s | 47% faster |
| No-change sync | ~3.4s | ~40ms | 98% faster |
| TypeScript build | ~1.6s | ~0.6s | 64% faster |
| Change detection | N/A | ~40-60ms | - |

## Configuration Options

### Enable Performance Tracking

To see detailed timing for each sync step:

```json
{
  "sync": {
    "showStepDurations": true
  }
}
```

Output example:
```
🔄 Synchronizing API changes...
  ⏱️  Change detection: 43ms
🏗️  Generating TypeScript client...
  ⏱️  Client generation: 950ms
🔨 Building client package...
  ⏱️  Client build: 640ms
🔗 Linking packages...
  ⏱️  Package linking: 228ms
✅ Synchronization completed successfully (1861ms total)
```

### Optimize Polling Interval

For runtime API specs, adjust the polling frequency based on your needs:

```json
{
  "sync": {
    "pollingInterval": 2000  // More responsive (2 seconds)
  }
}
```

- **Lower values** (1000-3000ms): More responsive, slightly higher CPU usage
- **Higher values** (5000-10000ms): Less CPU usage, slightly delayed sync
- **Default**: 5000ms (good balance)

## Best Practices

### 1. Use Runtime Endpoints for Dynamic Specs

Instead of watching file paths, use runtime endpoints:

```json
// ✅ Recommended
{
  "apiSpec": {
    "path": "/openapi.json"  // or "/docs/openapi.json"
  }
}

// ❌ Avoid for runtime-generated specs
{
  "apiSpec": {
    "path": "src/generated/swagger.json"
  }
}
```

### 2. Enable Incremental Builds

Ensure your TypeScript client package has incremental compilation:

1. Check `tsconfig.json` in your client package
2. Add `"incremental": true` if missing
3. OATSJS will automatically use faster builds

### 3. Monitor Performance

During development, enable timing to identify bottlenecks:

```json
{
  "sync": {
    "showStepDurations": true
  }
}
```

### 4. Optimize Client Generation

If using custom generators, ensure they:
- Support incremental generation
- Clean output before regenerating
- Use efficient file operations

## Troubleshooting

### High CPU Usage

If you notice high CPU usage:
1. Increase `pollingInterval` to 10000ms
2. Check if file watching is being used instead of polling
3. Ensure you're using runtime endpoints for dynamic specs

### Sync Not Detecting Changes

If changes aren't being detected:
1. Check that the API spec endpoint is accessible
2. Verify the backend is properly exposing the OpenAPI spec
3. Look for timeout errors in the console
4. Try manually accessing the spec URL in your browser

### Build Times Still Slow

If builds are still slow:
1. Verify incremental compilation is enabled
2. Check for `.tsbuildinfo` file in client directory
3. Consider using `esbuild` or `swc` for faster builds
4. Ensure generated files are being cleaned before regeneration

## Future Optimizations

We're continuously working on performance improvements. Upcoming optimizations include:

- Parallel processing for multi-client setups
- Differential API spec updates
- WebSocket-based change notifications
- Built-in esbuild support for client packages