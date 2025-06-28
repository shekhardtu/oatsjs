# 🌾 OATSJS - OpenAPI TypeScript Sync

> Stop manually syncing your OpenAPI specs with TypeScript clients. OATS watches your backend API changes and automatically regenerates TypeScript clients in real-time.

[![npm version](https://img.shields.io/npm/v/oatsjs.svg)](https://www.npmjs.com/package/oatsjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/oatsjs.svg)](https://nodejs.org)

## 🎯 The Problem

You're building a TypeScript full-stack app with:
- A backend that generates OpenAPI/Swagger specs
- A TypeScript client generated from those specs
- A frontend that uses the TypeScript client

Every time you change your backend API, you need to:
1. Wait for the backend to regenerate the OpenAPI spec
2. Manually copy it to your client generator
3. Run the generator
4. Build the client
5. Link it to your frontend
6. Restart your frontend

**That's 6 manual steps for every API change!** 😱

## ✨ The Solution: OATS

OATS automates this entire workflow. Just run:

```bash
npx oatsjs start
```

Now when you change your backend API, OATS automatically:
- ✅ Detects the OpenAPI spec change
- ✅ Copies it to your client project
- ✅ Runs your generator
- ✅ Builds the client
- ✅ Links it to your frontend
- ✅ Your frontend hot-reloads with the new types!

## 🚀 Quick Start

### 1. Install OATSJS

```bash
# In your frontend project (or monorepo root)
npm install --save-dev oatsjs
# or
yarn add -D oatsjs
```

### 2. Create Configuration

Create `oats.config.json` in your project root:

```json
{
  "services": {
    "backend": {
      "path": "../my-backend",        // Path to your backend
      "port": 4000,                   // Backend port (optional)
      "startCommand": "yarn dev",     // Command to start backend
      "apiSpec": {
        "path": "src/swagger.json"    // Path to OpenAPI spec (relative to backend)
      }
    },
    "client": {
      "path": "../my-api-client",     // Path to TypeScript client
      "packageName": "@myorg/api-client",
      "generator": "custom",          // Use your existing generator
      "generateCommand": "yarn generate",
      "buildCommand": "yarn build",
      "linkCommand": "yarn link"
    }
  }
}
```

**Note:** Frontend configuration is optional! If you're running oatsjs from your frontend project, it will just sync the backend and client without starting another frontend server.

### 3. Add Script to package.json

```json
{
  "scripts": {
    "dev": "vite",
    "dev:oats": "oatsjs start"    // Add this
  }
}
```

### 4. Start Development

```bash
yarn dev:oats
```

That's it! Your entire stack is now running with automatic API synchronization.

## 📦 Installation

```bash
# npm
npm install --save-dev oatsjs

# yarn
yarn add -D oatsjs

# pnpm
pnpm add -D oatsjs
```

## 🎨 Features

### 🧠 Smart Change Detection
OATS uses intelligent comparison algorithms to detect meaningful changes in your OpenAPI specs:
- ✅ New endpoints or schemas
- ✅ Modified request/response types
- ✅ Changed authentication requirements
- ❌ Ignores formatting or property reordering

### 🔄 Complete Automation
1. **Watches** your OpenAPI/Swagger files
2. **Detects** meaningful changes
3. **Generates** TypeScript clients
4. **Links** to your frontend projects
5. **Hot-reloads** for instant feedback

### 🎯 Developer Experience
- **Colored logs** for easy tracking
- **Clear change reporting** - know exactly what changed
- **Error recovery** - automatic restart on failures
- **Desktop notifications** (optional)

### 🔧 Flexible Configuration
Works with any OpenAPI client generator:
- `@hey-api/openapi-ts`
- `swagger-typescript-api`
- `openapi-generator-cli`
- Custom generators

## 📋 Configuration

### Complete Configuration Reference

```json
{
  "services": {
    "backend": {
      "path": "../backend",           // Path to backend (relative or absolute)
      "port": 4000,                   // Backend dev server port (optional)
      "startCommand": "yarn dev",     // Command to start backend
      "apiSpec": {
        "path": "src/swagger.json"    // Path to OpenAPI spec (relative to backend)
      }
    },
    "client": {
      "path": "../api-client",        // Path to TypeScript client project
      "packageName": "@myorg/api",    // NPM package name of the client
      "generator": "custom",           // Generator type (see below)
      "generateCommand": "yarn generate",  // Command to generate client
      "buildCommand": "yarn build",        // Command to build client
      "linkCommand": "yarn link"           // Command to link for local dev
    },
    "frontend": {                      // OPTIONAL - only if you want oatsjs to start it
      "path": ".",                    // Path to frontend (usually current dir)
      "port": 5173,                   // Frontend dev server port
      "startCommand": "yarn dev",     // Command to start frontend
      "packageLinkCommand": "yarn link"  // Command to link packages
    }
  },
  "sync": {                           // OPTIONAL - defaults shown below
    "debounceMs": 1000,              // Wait time before regenerating (ms)
    "retryAttempts": 3,              // Retry failed operations
    "retryDelayMs": 2000             // Delay between retries (ms)
  }
}
```

### Minimal Configuration

If you're running oatsjs from your frontend project, here's the minimal config:

```json
{
  "services": {
    "backend": {
      "path": "../backend",
      "startCommand": "yarn dev",
      "apiSpec": {
        "path": "src/swagger.json"
      }
    },
    "client": {
      "path": "../api-client",
      "packageName": "@myorg/api-client",
      "generator": "custom",
      "generateCommand": "yarn generate",
      "buildCommand": "yarn build"
    }
  }
}
```

### Generator Types

#### Using Custom Commands (Recommended)
```json
{
  "client": {
    "generator": "custom",
    "generateCommand": "yarn generate",  // Your existing generate command
    "buildCommand": "yarn build"
  }
}
```

#### Using @hey-api/openapi-ts
```json
{
  "client": {
    "generator": "@hey-api/openapi-ts",
    "generatorConfig": {
      "input": "./swagger.json",
      "output": "./src",
      "client": "axios"
    }
  }
}
```

## 🛠️ CLI Commands

### `oatsjs start`
Start all services with automatic synchronization.

```bash
oatsjs start [options]

Options:
  --init-gen        Run initial client generation on startup
  -c, --config      Path to config file (default: oats.config.json)
```

**Examples:**
```bash
# Start with default config
oatsjs start

# Generate client before starting (useful for first run)
oatsjs start --init-gen

# Use custom config file
oatsjs start --config my-oats.config.json
```

### `oatsjs init`
Interactively create a configuration file.

```bash
oatsjs init [options]

Options:
  -f, --force       Overwrite existing configuration
  -y, --yes         Use defaults without prompting
```

### `oatsjs validate`
Check if your configuration is valid.

```bash
oatsjs validate [options]

Options:
  -c, --config      Path to config file
```

### `oatsjs detect`
Auto-detect your project structure and create config.

```bash
oatsjs detect
```

**Note:** This will scan your project and try to find:
- Backend with OpenAPI/Swagger specs
- TypeScript client projects
- Frontend applications

## 📚 Real-World Examples

### Example 1: Express + React + @hey-api/openapi-ts

**Project Structure:**
```
my-project/
├── backend/          # Express API
├── api-client/       # Generated TypeScript client
└── frontend/         # React app
```

**oats.config.json:**
```json
{
  "services": {
    "backend": {
      "path": "../backend",
      "port": 4000,
      "startCommand": "npm run dev",
      "apiSpec": {
        "path": "src/swagger.json"
      }
    },
    "client": {
      "path": "../api-client",
      "packageName": "@myapp/api-client",
      "generator": "custom",
      "generateCommand": "npm run generate",
      "buildCommand": "npm run build",
      "linkCommand": "npm link"
    },
    "frontend": {
      "path": ".",
      "port": 3000,
      "startCommand": "npm start",
      "packageLinkCommand": "npm link"
    }
  }
}
```

### Example 2: NestJS + Next.js + Monorepo

**Project Structure:**
```
my-monorepo/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
└── packages/
    └── api-client/   # Generated client
```

**oats.config.json:**
```json
{
  "services": {
    "backend": {
      "path": "./apps/api",
      "port": 3333,
      "startCommand": "nx serve api",
      "apiSpec": {
        "path": "swagger.json"
      }
    },
    "client": {
      "path": "./packages/api-client",
      "packageName": "@myapp/api-client",
      "generator": "custom",
      "generateCommand": "yarn openapi-ts",
      "buildCommand": "yarn build"
    },
    "frontend": {
      "path": "./apps/web",
      "port": 4200,
      "startCommand": "nx serve web"
    }
  }
}
```

### Example 3: Microservices with Multiple APIs

```json
{
  "services": {
    "backend": {
      "path": "../services/main-api",
      "port": 4000,
      "startCommand": "docker-compose up api",
      "apiSpec": {
        "path": "docs/openapi.yaml"
      }
    },
    "client": {
      "path": "../packages/main-api-client",
      "packageName": "@company/main-api",
      "generator": "custom",
      "generateCommand": "yarn codegen",
      "buildCommand": "yarn tsc"
    },
    "frontend": {
      "path": "../apps/dashboard",
      "port": 8080,
      "startCommand": "yarn serve"
    }
  },
  "sync": {
    "debounceMs": 2000,  // Longer debounce for larger APIs
    "retryAttempts": 5
  }
}
```

## 🤔 Common Issues & Solutions

### Issue: "Port already in use"
**Solution:** Make sure the ports in your config aren't already taken:
```json
{
  "services": {
    "backend": { "port": 4001 },    // Change to available port
    "frontend": { "port": 5174 }    // Change to available port
  }
}
```

### Issue: "Client not updating"
**Solution:** Check that:
1. Your OpenAPI spec path is correct
2. The generator command works when run manually
3. The package is properly linked (`yarn link` or `npm link`)

### Issue: "Command not found: oatsjs"
**Solution:** Use npx or add to package.json scripts:
```bash
# Direct usage
npx oatsjs start

# Or add to package.json
"scripts": {
  "dev:sync": "oatsjs start"
}
```

## 🤝 How OATS Works

```
1. Start: OATS starts your backend, frontend, and watches for changes
   ↓
2. Watch: File watcher monitors your OpenAPI spec file
   ↓
3. Detect: When spec changes, OATS compares with previous version
   ↓
4. Generate: If changes detected, run your generator command
   ↓
5. Build: Build the TypeScript client package
   ↓
6. Link: Ensure client is linked to frontend (yarn/npm link)
   ↓
7. Reload: Frontend hot-reloads with new types
```

**Smart Detection:** OATS uses intelligent comparison to avoid unnecessary regeneration:
- ✅ Detects real API changes (new endpoints, changed types)
- ❌ Ignores formatting changes or timestamp updates
- ✅ Uses file hashing for quick comparison

## 🌟 Why OATS?

### Without OATS 😫
```bash
# Make API change
# Wait...
# Manually copy swagger.json
cp ../backend/swagger.json ../client/

# Generate client
cd ../client && yarn generate

# Build client
yarn build

# Link to frontend
yarn link
cd ../frontend && yarn link "@myorg/api-client"

# Restart frontend
# Repeat for every API change... 🔄
```

### With OATS 🚀
```bash
# Just run once
yarn dev:oats

# Make API changes
# Everything syncs automatically! ✨
```

### Feature Comparison

| Feature | Manual Process | Build Scripts | OATS |
|---------|---------------|---------------|------|
| Automatic sync | ❌ | ❌ | ✅ |
| Smart detection | ❌ | ❌ | ✅ |
| Zero config | ❌ | ❌ | ✅ |
| Hot reload | ❌ | Partial | ✅ |
| Error recovery | ❌ | ❌ | ✅ |
| Multi-service | ❌ | Complex | ✅ |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repository
git clone https://github.com/shekhardtu/oatsjs.git

# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

## 📄 License

MIT © [Hari Shekhar](https://github.com/shekhardtu)

## 🙏 Acknowledgments

OATS is inspired by the challenges faced by developers working with OpenAPI specifications and TypeScript in modern microservices architectures. Special thanks to:

- The OpenAPI community
- TypeScript ecosystem contributors
- Developers who value their time and sanity

---

<p align="center">
  Made with ❤️ and 🌾 for developers who deserve better tooling
</p>

<p align="center">
  <a href="https://github.com/shekhardtu/oatsjs">GitHub</a> •
  <a href="https://www.npmjs.com/package/oatsjs">npm</a> •
  <a href="https://github.com/shekhardtu/oatsjs/issues">Issues</a> •
  <a href="https://github.com/shekhardtu/oatsjs/discussions">Discussions</a>
</p>