# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 What Claude Code Needs to Know

OATSJS is an **OpenAPI TypeScript Sync** tool that automates the workflow between OpenAPI/Swagger specifications and TypeScript clients. It watches backend API changes and automatically regenerates TypeScript clients in real-time, eliminating the manual 6-step sync process.

**Supported Backends**: Node.js (Express, Fastify, NestJS, etc.) and Python (FastAPI, Flask, Django)

## 📁 Quick File Finder

```
src/
├── bin/oats.ts         → CLI entry point
├── cli/                → Command implementations
│   ├── init.ts        → Interactive config creation
│   ├── start.ts       → Main orchestration command
│   ├── validate.ts    → Config validation
│   └── detect.ts      → Framework detection
├── core/              → Core engine
│   ├── orchestrator.ts → Service orchestration
│   └── sync.ts        → Sync engine with file watching
├── config/            → Configuration handling
│   ├── schema.ts      → Joi validation schemas
│   └── loader.ts      → Config file loading
├── errors/            → Custom error classes
├── types/             → TypeScript type definitions
└── utils/             → Utility functions
```

## 🔧 Common Development Commands

```bash
# Development
yarn dev              # Run with tsx watch mode
yarn build            # Compile TypeScript to dist/
yarn build:watch      # Watch mode compilation

# Testing
yarn test             # Run Jest tests with coverage
yarn test:watch       # Jest watch mode
# Run single test file
yarn test path/to/test.ts

# Code Quality
yarn lint             # ESLint check
yarn lint:fix         # Auto-fix linting issues
yarn format           # Prettier formatting
yarn typecheck        # TypeScript type checking

# Release
yarn release          # Patch release
yarn release:minor    # Minor release  
yarn release:major    # Major release
```

## 🏗️ Architecture & Key Patterns

### ESM Module System
This project uses native ES modules. Always use `.js` extensions in imports:
```typescript
// ✅ Correct
import { Config } from './types/config.js';
import { loadConfig } from './config/loader.js';

// ❌ Wrong - no extension
import { Config } from './types/config';
```

### TypeScript Configuration
- **Strict mode**: All strict checks enabled
- **Target**: ES2022 with ESNext modules
- **Path aliases**: Use `@/` for src/, `@utils/`, `@types/`, etc.
- **No implicit any**: Every type must be explicit

### Service Orchestration Pattern
The orchestrator manages three service types:
1. **Backend Service**: API server with OpenAPI spec
2. **Client Service**: TypeScript client package
3. **Frontend Service**: Application consuming the client

Key orchestration features:
- Port-based service detection (not log parsing)
- Automatic port conflict resolution
- Graceful shutdown with cleanup
- Process lifecycle management

### Sync Engine Architecture
```typescript
// File watching with debouncing
const watcher = chokidar.watch(apiSpecPath, {
  persistent: true,
  ignoreInitial: true
});

// Smart change detection - ignores formatting
const hasRealChanges = this.detectRealChanges(oldSpec, newSpec);

// Operation locking prevents concurrent syncs
if (this.isSyncing) return;
this.isSyncing = true;
```

### Error Handling Pattern
```typescript
// Custom error hierarchy
export class OatsError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'OatsError';
  }
}

export class ServiceStartError extends OatsError {
  constructor(service: string, reason: string) {
    super(`Failed to start ${service}: ${reason}`, 'SERVICE_START_ERROR');
  }
}

// Recovery strategies
try {
  await this.startService();
} catch (error) {
  if (this.isRecoverable(error)) {
    await this.retry();
  } else {
    throw error;
  }
}
```

### Configuration Schema
All configs are validated with Joi:
```typescript
const configSchema = Joi.object({
  services: Joi.object({
    backend: serviceSchema.required(),
    client: clientServiceSchema.required(),
    frontend: serviceSchema.optional()
  }).required(),
  sync: syncConfigSchema.optional()
});
```

## 💡 Key Implementation Details

### 1. Service Detection
Uses port checking instead of log parsing for reliability:
```typescript
const isPortOpen = await detectPort(port) !== port;
```

#### Python Backend Detection
```typescript
// Detect Python projects by files
const pythonFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile'];

// Detect frameworks from dependencies
if (requirements.includes('fastapi')) return 'FastAPI';
if (requirements.includes('flask')) return 'Flask';
if (requirements.includes('django')) return 'Django';

// Handle runtime OpenAPI specs (FastAPI)
if (apiSpec.path.startsWith('runtime:')) {
  // Fetch from running server: http://localhost:8000/openapi.json
}
```

### 2. File System Operations
Always resolve paths relative to config location:
```typescript
const absolutePath = path.resolve(path.dirname(configPath), service.path);
```

### 3. Package Linking
Tracks linked packages for cleanup:
```typescript
this.linkedPackages.add(packageName);
// On shutdown:
for (const pkg of this.linkedPackages) {
  await execa('npm', ['unlink', pkg]);
}
```

### 4. Process Management
Child processes with proper cleanup:
```typescript
const child = execa(command, args, {
  cwd: workingDir,
  env: { ...process.env, FORCE_COLOR: '1' }
});

// Cleanup on exit
process.on('SIGINT', () => {
  child.kill('SIGTERM');
});
```

## 🧪 Testing Guidelines

- **Coverage thresholds**: 65% minimum (statements, branches, functions, lines)
- **Test structure**: `__tests__` directories or `.spec.ts` files
- **Mocking**: Mock external dependencies (execa, fs operations)
- **Test names**: Descriptive `it('should...')` format

Example test pattern:
```typescript
jest.mock('execa');
jest.mock('fs/promises');

describe('SyncEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should detect real changes in API spec', async () => {
    // Test implementation
  });
});
```

## 📝 Code Style & Documentation

### TSDoc for Public APIs
```typescript
/**
 * Starts the orchestration process
 * @param configPath - Path to oats.config.json
 * @throws {ConfigValidationError} If config is invalid
 * @returns Promise that resolves when services are running
 */
export async function start(configPath: string): Promise<void> {
```

### Naming Conventions
- **Files**: kebab-case (`sync-engine.ts`)
- **Classes**: PascalCase (`SyncEngine`)
- **Interfaces**: PascalCase with `I` prefix (`IConfig`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)

### Import Order
1. Node.js built-ins
2. External packages
3. Internal imports (use path aliases)
4. Types/interfaces

## 🚨 Common Pitfalls & Solutions

### 1. ESM Import Issues
Always include `.js` extension in imports, even for TypeScript files.

### 2. Path Resolution
Use `path.resolve()` with config directory as base for all file operations.

### 3. Process Cleanup
Always register cleanup handlers for child processes and resources.

### 4. Async Operations
Use proper async/await patterns, avoid callbacks.

### 5. Type Safety
Never use `any` type. If needed, use `unknown` and type guards.

## 🎯 Focus Areas When Contributing

1. **Maintain strict TypeScript**: No implicit any, proper types everywhere
2. **Test coverage**: Keep above 65% threshold
3. **Error messages**: User-friendly, actionable error messages
4. **Performance**: Debounce file watchers, prevent concurrent operations
5. **Cleanup**: Always clean up resources (processes, watchers, intervals)
6. **Documentation**: Update TSDoc for public APIs