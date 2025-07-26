# T1: Project Setup - Bun + TypeScript Foundation

## Overview

This document provides a comprehensive guide for setting up the qi-v2 agent project using Bun runtime with native TypeScript support. Based on Phase 1 analysis and 2025 toolchain research, this setup eliminates traditional Node.js complexity while providing superior performance.

## Bun Installation & Setup

### Installing Bun (2025)

```bash
# Install Bun (latest stable)
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version  # Should show v1.1.38 or higher

# Update to latest
bun upgrade
```

**Key Features Leveraged:**
- **Native TypeScript**: Direct `.ts` execution without transpilation
- **4x Faster Startup**: Zig-based runtime with JavaScriptCore
- **Built-in Package Manager**: Faster than npm/yarn with `bun.lockb`
- **All-in-One Toolchain**: Runtime, bundler, test runner integrated

## Project Initialization

### Creating the Project Structure

```bash
# Create project directory
mkdir qi-v2-agent
cd qi-v2-agent

# Initialize with Bun
bun init -y

# Create TypeScript project structure
mkdir -p src/{agent,mcp,ui,config,utils}
mkdir -p test/{unit,integration}
mkdir -p docs
```

### TypeScript Configuration

**`tsconfig.json`** - Optimized for Bun runtime:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/agent/*": ["./src/agent/*"],
      "@/mcp/*": ["./src/mcp/*"],
      "@/ui/*": ["./src/ui/*"],
      "@/config/*": ["./src/config/*"],
      "@/utils/*": ["./src/utils/*"]
    },
    "types": ["bun-types"]
  },
  "include": [
    "src/**/*",
    "test/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

**Key Configuration Choices:**
- **`"module": "ESNext"`**: Native ES modules support with Bun
- **`"moduleResolution": "bundler"`**: Optimized for Bun's bundler
- **Path mapping**: Clean imports using `@/` prefix
- **`"types": ["bun-types"]`**: Bun-specific type definitions

## Package Dependencies

### Core Dependencies

**`package.json`** - Essential packages for Phase 2:
```json
{
  "name": "qi-v2-agent",
  "version": "0.1.0",
  "description": "AI Coding Assistant with Local LLM Support",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "bun build --compile src/index.ts --outfile qi-agent",
    "build:lib": "bun build src/index.ts --outdir dist --target node",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "clean": "rm -rf dist qi-agent"
  },
  "dependencies": {
    "@langchain/langgraph": "^0.3.11",
    "@langchain/core": "^0.3.30",
    "@langchain/mcp-adapters": "^0.1.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@langchain/ollama": "^0.3.0",
    "ink": "^5.0.1",
    "@inkjs/ui": "^3.0.0",
    "react": "^18.3.1",
    "zod": "^3.24.1",
    "js-yaml": "^4.1.0",
    "commander": "^12.1.0",
    "chalk": "^5.4.1"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "vitest": "^3.0.0",
    "@types/js-yaml": "^4.0.9",
    "@types/react": "^18.3.12",
    "bun-types": "^1.1.38"
  },
  "peerDependencies": {
    "typescript": "^5.6.3"
  }
}
```

### Installing Dependencies

```bash
# Install all dependencies (faster than npm)
bun install

# Verify installations
bun pm ls | head -20
```

**Performance Benefits:**
- **Bun lockfile**: Binary `bun.lockb` for faster installs
- **Native Module Resolution**: No transpilation needed for TypeScript
- **Efficient Caching**: Faster subsequent installs

## Project Structure

### Recommended Directory Layout

```
qi-v2-agent/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── agent/
│   │   ├── factory.ts              # Agent creation and management
│   │   ├── streaming.ts            # Response streaming utilities
│   │   └── memory.ts               # Conversation memory management
│   ├── mcp/
│   │   ├── client.ts               # MultiServerMCPClient wrapper
│   │   ├── server-manager.ts       # Server lifecycle management
│   │   └── security.ts             # 2025 security implementations
│   ├── ui/
│   │   ├── app.tsx                 # Main Ink React app
│   │   ├── components/             # Reusable UI components
│   │   └── hooks/                  # Custom React hooks
│   ├── config/
│   │   ├── schema.ts               # Zod configuration schemas
│   │   ├── manager.ts              # Configuration management
│   │   └── defaults.ts             # Default configurations
│   └── utils/
│       ├── logger.ts               # Logging utilities
│       ├── errors.ts               # Error handling
│       └── types.ts                # Shared TypeScript types
├── test/
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests
│   └── fixtures/                   # Test data and mocks
├── docs/
├── servers/                        # Example MCP servers
│   ├── time-server.ts
│   ├── calculator-server.ts
│   └── file-server.ts
├── config/
│   ├── qi-config.yaml              # Main configuration
│   └── mcp-servers.json            # MCP server definitions
├── tsconfig.json
├── biome.json
├── vitest.config.ts
└── package.json
```

## Development Environment Setup

### Essential VS Code Extensions (2025)

**`.vscode/extensions.json`**:
```json
{
  "recommendations": [
    "biomejs.biome",
    "oven.bun-vscode", 
    "vitest.explorer",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

### VS Code Settings

**`.vscode/settings.json`**:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

### Development Scripts

**Enhanced package.json scripts for development workflow:**

```json
{
  "scripts": {
    "dev": "bun --watch --hot src/index.ts",
    "dev:debug": "bun --inspect --watch src/index.ts",
    "build": "bun build --compile src/index.ts --outfile qi-agent",
    "build:cross": "bun build --compile --target=bun-linux-x64 src/index.ts --outfile qi-agent-linux",
    "build:lib": "bun build src/index.ts --outdir dist --target node --format esm",
    "test": "bun test",
    "test:ui": "bun test --ui",
    "test:coverage": "bun test --coverage",
    "test:watch": "bun test --watch",
    "type-check": "tsc --noEmit",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "clean": "rm -rf dist qi-agent qi-agent-*",
    "install:servers": "bun install --cwd servers",
    "start:servers": "cd servers && bun run start:all"
  }
}
```

## Basic Project Files

### Main Entry Point

**`src/index.ts`** - Application entry point:
```typescript
#!/usr/bin/env bun

import { Command } from 'commander';
import { version } from '../package.json';
import { QiV2AgentFactory } from './agent/factory.js';
import { ConfigManager } from './config/manager.js';
import { logger } from './utils/logger.js';

const program = new Command();

program
  .name('qi-agent')
  .description('AI Coding Assistant with Local LLM Support')
  .version(version);

program
  .command('chat')
  .description('Start interactive chat session')
  .option('-c, --config <path>', 'Configuration file path', './config/qi-config.yaml')
  .option('-m, --model <name>', 'Model to use', 'deepseek-r1')
  .option('--debug', 'Enable debug logging')
  .action(async (options) => {
    try {
      if (options.debug) {
        logger.level = 'debug';
      }

      const configManager = new ConfigManager(options.config);
      const config = await configManager.load();
      
      const agent = new QiV2AgentFactory(config);
      await agent.start();
      
      logger.info('Qi Agent started successfully');
    } catch (error) {
      logger.error('Failed to start Qi Agent:', error);
      process.exit(1);
    }
  });

program.parse();
```

### Bun-Specific Features

**`src/utils/bun-features.ts`** - Leveraging Bun capabilities:
```typescript
import { spawn } from 'bun';
import { file } from 'bun';

export class BunUtilities {
  /**
   * Fast file operations using Bun's native file API
   */
  static async readFile(path: string): Promise<string> {
    const bunFile = file(path);
    return await bunFile.text();
  }

  static async writeFile(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
  }

  /**
   * Efficient subprocess management with Bun
   */
  static async spawnProcess(command: string[], options?: {
    cwd?: string;
    env?: Record<string, string>;
  }): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const proc = spawn({
      cmd: command,
      cwd: options?.cwd,
      env: options?.env,
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return { stdout, stderr, exitCode };
  }

  /**
   * Native HTTP server for MCP transport
   */
  static createServer(port: number, handler: (req: Request) => Response | Promise<Response>) {
    return Bun.serve({
      port,
      fetch: handler,
    });
  }
}
```

## Performance Optimization

### Bun Runtime Configuration

**`bunfig.toml`** - Bun configuration for optimal performance:
```toml
[install]
# Use binary lockfile for faster installs
lockfile = true
# Faster installation with parallel downloads
parallel = true
# Cache packages globally
cache = true

[run]
# Enable hot reloading for development
hot = true
# Watch mode configurations
watch = ["src/**/*.ts", "config/**/*.yaml"]

[build]
# Optimize for production builds
minify = true
# Target modern environments
target = "bun"
# Generate source maps for debugging
sourcemap = true
```

### TypeScript Performance Tips

1. **Use Bun's Native Execution**: No `ts-node` or similar tools needed
2. **Enable Path Mapping**: Faster resolution with baseUrl and paths
3. **Skip Library Checks**: `skipLibCheck: true` for faster compilation
4. **Prefer Interface over Type**: Better performance for complex types
5. **Use Module Resolution**: `"moduleResolution": "bundler"` for Bun

## Verification & Testing

### Basic Setup Verification

**`src/verify-setup.ts`** - Setup verification script:
```typescript
import { logger } from './utils/logger.js';
import type { ConfigSchema } from './config/schema.js';

export async function verifySetup(): Promise<boolean> {
  const checks = [
    { name: 'Bun Runtime', test: () => typeof Bun !== 'undefined' },
    { name: 'TypeScript Support', test: () => import.meta.env !== undefined },
    { name: 'Module Resolution', test: async () => {
      try {
        await import('@langchain/langgraph');
        return true;
      } catch {
        return false;
      }
    }},
    { name: 'File System Access', test: async () => {
      try {
        const file = Bun.file('./package.json');
        await file.exists();
        return true;
      } catch {
        return false;
      }
    }}
  ];

  logger.info('🔍 Verifying qi-v2 agent setup...');

  let allPassed = true;
  for (const check of checks) {
    try {
      const result = typeof check.test === 'function' ? await check.test() : check.test;
      if (result) {
        logger.info(`✅ ${check.name}`);
      } else {
        logger.error(`❌ ${check.name}`);
        allPassed = false;
      }
    } catch (error) {
      logger.error(`❌ ${check.name}: ${error}`);
      allPassed = false;
    }
  }

  return allPassed;
}

// Run verification if called directly
if (import.meta.main) {
  const success = await verifySetup();
  process.exit(success ? 0 : 1);
}
```

### Running Verification

```bash
# Verify setup
bun run src/verify-setup.ts

# Expected output:
# 🔍 Verifying qi-v2 agent setup...
# ✅ Bun Runtime
# ✅ TypeScript Support  
# ✅ Module Resolution
# ✅ File System Access
```

## Next Steps

After completing T1 project setup:

1. **Proceed to T2**: [Development Tooling](./T2-development-tooling.md) for Biome and Vitest configuration
2. **Test Basic Functionality**: Run `bun dev` to ensure hot reloading works
3. **Verify Dependencies**: Ensure all @langchain packages are properly installed
4. **Configure IDE**: Set up VS Code with recommended extensions

## Common Issues & Solutions

### Bun Installation Issues
```bash
# If installation fails, try manual installation
wget https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip
unzip bun-linux-x64.zip
sudo mv bun-linux-x64/bun /usr/local/bin/bun
```

### TypeScript Path Resolution
```bash
# If path imports fail, verify tsconfig.json baseUrl
bun run --print "import.meta.resolve('@/utils/logger')"
```

### Dependency Installation Issues
```bash
# Clear cache and reinstall
bun pm cache rm
rm -rf node_modules bun.lockb
bun install
```

This T1 setup provides a solid foundation for the qi-v2 agent with modern Bun runtime, native TypeScript support, and optimal performance configuration for the development workflow.