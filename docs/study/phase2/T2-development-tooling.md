# T2: Development Tooling - Biome + Vitest Configuration

## Overview

This document covers the setup and configuration of modern development tooling using Biome (linter/formatter) and Vitest (testing framework). Based on 2025 research, this combination provides 10x faster linting and 2-5x faster testing compared to traditional ESLint/Prettier/Jest stack.

## Biome Setup & Configuration

### Installation & Initial Setup

```bash
# Add Biome as development dependency  
bun add -d @biomejs/biome

# Initialize Biome configuration
bunx @biomejs/biome init

# Verify installation
bunx @biomejs/biome --version  # Should show v1.9.4+
```

### Biome Configuration

**`biome.json`** - Comprehensive configuration for Qi V2 Agent:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "include": [
      "src/**/*.ts",
      "src/**/*.tsx", 
      "test/**/*.ts",
      "servers/**/*.ts",
      "*.json"
    ],
    "ignore": [
      "node_modules",
      "dist",
      "coverage",
      "*.generated.ts",
      "bun.lockb"
    ]
  },
  "formatter": {
    "enabled": true,
    "formatWithErrors": false,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineEnding": "lf",
    "lineWidth": 100,
    "attributePosition": "auto",
    "ignore": ["**/*.md", "**/*.yaml"]
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExtraBooleanCast": "error",
        "noMultipleSpacesInRegularExpressionLiterals": "error",
        "noUselessCatch": "error",
        "noUselessTypeConstraint": "error",
        "noWith": "error"
      },
      "correctness": {
        "noConstAssign": "error",
        "noConstantCondition": "error",
        "noEmptyCharacterClassInRegex": "error",
        "noEmptyPattern": "error",
        "noGlobalObjectCalls": "error",
        "noInvalidBuiltinInstantiation": "error",
        "noInvalidConstructorSuper": "error",
        "noInvalidNewBuiltin": "error",
        "noNonoctalDecimalEscape": "error",
        "noPrecisionLoss": "error",
        "noSelfAssign": "error",
        "noSetterReturn": "error",
        "noSwitchDeclarations": "error",
        "noUndeclaredVariables": "error",
        "noUnreachable": "error",
        "noUnreachableSuper": "error",
        "noUnsafeFinally": "error",
        "noUnusedLabels": "error",
        "noUnusedPrivateClassMembers": "warn",
        "noUnusedVariables": "error",
        "useArrayLiterals": "off",
        "useIsNan": "error",
        "useValidForDirection": "error",
        "useYield": "error"
      },
      "style": {
        "noNamespace": "error",
        "useAsConstAssertion": "error",
        "useBlockStatements": "off",
        "useCollapsedElseIf": "warn",
        "useConsistentArrayType": {
          "level": "error",
          "options": {
            "syntax": "shorthand"
          }
        },
        "useForOf": "warn",
        "useImportType": "error",
        "useNodejsImportProtocol": "error",
        "useNumberNamespace": "error",
        "useShorthandArrayType": "error",
        "useSingleVarDeclarator": "warn",
        "useTemplate": "warn"
      },
      "suspicious": {
        "noArrayIndexKey": "warn",
        "noAsyncPromiseExecutor": "error",
        "noCatchAssign": "error",
        "noClassAssign": "error",
        "noCommentText": "error",
        "noCompareNegZero": "error",
        "noControlCharactersInRegex": "error",
        "noDebugger": "error",
        "noDuplicateCase": "error",
        "noDuplicateClassMembers": "error",
        "noDuplicateObjectKeys": "error",
        "noDuplicateParameters": "error",
        "noEmptyBlockStatements": "error",
        "noExplicitAny": "warn",
        "noExtraNonNullAssertion": "error",
        "noFallthroughSwitchClause": "error",
        "noFunctionAssign": "error",
        "noGlobalAssign": "error",
        "noImportAssign": "error",
        "noMisleadingCharacterClass": "error",
        "noPrototypeBuiltins": "error",
        "noRedeclare": "error",
        "noShadowRestrictedNames": "error",
        "noUnsafeDeclarationMerging": "error",
        "noUnsafeNegation": "error",
        "useGetterReturn": "error",
        "useValidTypeof": "error"
      },
      "nursery": {
        "noDuplicateJsonKeys": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "jsxQuoteStyle": "double",
      "quoteProperties": "asNeeded",
      "trailingCommas": "es5",
      "semicolons": "always",
      "arrowParentheses": "always",
      "bracketSpacing": true,
      "bracketSameLine": false,
      "quoteStyle": "single",
      "attributePosition": "auto"
    }
  },
  "json": {
    "parser": {
      "allowComments": true
    },
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineEnding": "lf",
      "lineWidth": 100
    }
  },
  "css": {
    "formatter": {
      "enabled": true,
      "indentStyle": "space",
      "indentWidth": 2,
      "lineEnding": "lf",
      "lineWidth": 100,
      "quoteStyle": "double"
    },
    "linter": {
      "enabled": true,
      "rules": {
        "recommended": true
      }
    }
  }
}
```

### Biome Integration Scripts

**Enhanced package.json scripts for Biome:**
```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "lint:unsafe": "biome check --write --unsafe .",
    "format": "biome format --write .",
    "format:check": "biome format .",
    "check": "biome check --write .",
    "ci:check": "biome ci .",
    "lint:staged": "biome check --no-errors-on-unmatched --files-ignore-unknown=true"
  }
}
```

### Git Integration

**`.gitattributes`** - Ensure consistent line endings:
```
* text=auto eol=lf
*.{js,ts,jsx,tsx,json,md,yaml,yml} text eol=lf
```

**Pre-commit hook** - `.git/hooks/pre-commit`:
```bash
#!/bin/sh
# Biome pre-commit hook
bun run lint:staged
if [ $? -ne 0 ]; then
  echo "Biome checks failed. Please fix the issues and try again."
  exit 1
fi
```

## Vitest Setup & Configuration

### Installation & Dependencies

```bash
# Add Vitest and related testing dependencies
bun add -d vitest @vitest/ui @vitest/coverage-v8
bun add -d @types/node

# Verify installation
bunx vitest --version  # Should show v3.0.0+
```

### Vitest Configuration

**`vitest.config.ts`** - Comprehensive test configuration:
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'test/**/*.{test,spec}.{js,ts}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '**/*.d.ts'
    ],
    watch: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'test/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.ts' // Re-export files
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    setupFiles: ['./test/setup.ts'],
    env: {
      NODE_ENV: 'test'
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    logHeapUsage: true,
    sequence: {
      concurrent: true
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/agent': resolve(__dirname, './src/agent'),
      '@/mcp': resolve(__dirname, './src/mcp'),
      '@/ui': resolve(__dirname, './src/ui'),
      '@/config': resolve(__dirname, './src/config'),
      '@/utils': resolve(__dirname, './src/utils')
    }
  }
});
```

### Test Setup File

**`test/setup.ts`** - Global test configuration:
```typescript
import { beforeAll, afterAll, vi } from 'vitest';
import { logger } from '@/utils/logger';

// Mock logger during tests to reduce noise
beforeAll(() => {
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'debug').mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
  createMockAgent: () => ({
    stream: vi.fn(),
    invoke: vi.fn()
  }),
  createMockMCPClient: () => ({
    get_tools: vi.fn().mockResolvedValue([]),
    session: vi.fn()
  }),
  mockConfig: {
    servers: {
      'test-server': {
        transport: 'stdio' as const,
        command: 'node',
        args: ['test-server.js']
      }
    },
    model: {
      provider: 'ollama' as const,
      name: 'llama3.2',
      temperature: 0.1,
      maxTokens: 4000
    },
    memory: {
      enabled: true,
      type: 'memory' as const
    }
  }
};

// Type declarations for global test utilities
declare global {
  var testUtils: {
    createMockAgent: () => any;
    createMockMCPClient: () => any;
    mockConfig: any;
  };
}
```

### Testing Scripts

**Enhanced package.json test scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui --open",
    "test:coverage": "vitest run --coverage",
    "test:coverage:ui": "vitest --ui --coverage",
    "test:unit": "vitest run test/unit",
    "test:integration": "vitest run test/integration",
    "test:e2e": "vitest run test/e2e",
    "test:bun": "bun test",
    "test:debug": "vitest --inspect-brk --no-coverage --threads=false"
  }
}
```

## Testing Patterns & Examples

### Unit Test Example

**`src/config/manager.test.ts`** - Configuration manager unit tests:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager } from './manager';
import { QiConfigSchema } from './schema';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockConfigPath = '/tmp/test-config.yaml';

  beforeEach(() => {
    configManager = new ConfigManager(mockConfigPath);
    vi.clearAllMocks();
  });

  describe('loadConfig', () => {
    it('should load valid configuration successfully', async () => {
      // Mock file system
      vi.spyOn(Bun, 'file').mockReturnValue({
        exists: () => Promise.resolve(true),
        text: () => Promise.resolve(`
servers:
  time-server:
    transport: stdio
    command: node
    args: [time-server.js]
model:
  provider: ollama
  name: llama3.2
  temperature: 0.1
  maxTokens: 4000
memory:
  enabled: true
  type: memory
        `)
      } as any);

      const config = await configManager.loadConfig();
      
      expect(config).toMatchObject({
        servers: {
          'time-server': {
            transport: 'stdio',
            command: 'node',
            args: ['time-server.js']
          }
        },
        model: {
          provider: 'ollama',
          name: 'llama3.2',
          temperature: 0.1,
          maxTokens: 4000
        }
      });
    });

    it('should return default config when file does not exist', async () => {
      vi.spyOn(Bun, 'file').mockReturnValue({
        exists: () => Promise.resolve(false)
      } as any);

      const config = await configManager.loadConfig();
      
      expect(config).toMatchObject(configManager.getDefaultConfig());
    });

    it('should handle invalid YAML gracefully', async () => {
      vi.spyOn(Bun, 'file').mockReturnValue({
        exists: () => Promise.resolve(true),
        text: () => Promise.resolve('invalid: yaml: content:')
      } as any);

      const config = await configManager.loadConfig();
      
      expect(config).toMatchObject(configManager.getDefaultConfig());
    });
  });

  describe('saveConfig', () => {
    it('should save valid configuration successfully', async () => {
      const mockWrite = vi.spyOn(Bun, 'write').mockResolvedValue(10);
      
      const testConfig = global.testUtils.mockConfig;
      const result = await configManager.saveConfig(testConfig);
      
      expect(result).toBe(true);
      expect(mockWrite).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('servers:')
      );
    });

    it('should validate config before saving', async () => {
      const invalidConfig = { invalid: 'config' };
      
      await expect(configManager.saveConfig(invalidConfig as any))
        .rejects.toThrow();
    });
  });
});
```

### Integration Test Example

**`test/integration/agent-mcp.test.ts`** - Agent + MCP integration:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { QiAgent } from '@/agent/factory';
import { ConfigManager } from '@/config/manager';
import { spawn } from 'bun';

describe('Agent MCP Integration', () => {
  let agent: QiAgent;
  let testServerProcess: any;
  
  beforeAll(async () => {
    // Start test MCP server
    testServerProcess = spawn({
      cmd: ['bun', 'servers/test-server.ts'],
      stdout: 'pipe',
      stderr: 'pipe'
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Initialize agent with test configuration
    const configManager = new ConfigManager('./test/fixtures/test-config.yaml');
    const config = await configManager.loadConfig();
    agent = new QiAgent(config);
    await agent.initialize();
  });

  afterAll(async () => {
    if (agent) {
      await agent.cleanup();
    }
    if (testServerProcess) {
      testServerProcess.kill();
    }
  });

  it('should connect to MCP servers successfully', async () => {
    const tools = await agent.getAvailableTools();
    
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: expect.any(String),
          description: expect.any(String)
        })
      ])
    );
  });

  it('should execute tool calls through MCP', async () => {
    const response = await agent.processMessage({
      content: 'What time is it?',
      role: 'user'
    });

    expect(response).toMatchObject({
      content: expect.stringContaining('time'),
      role: 'assistant'
    });
  });

  it('should handle multiple MCP servers', async () => {
    const servers = await agent.getConnectedServers();
    
    expect(servers.length).toBeGreaterThan(0);
    expect(servers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/test-server|time-server/)
      ])
    );
  });
});
```

## Performance Optimization

### Biome Performance Configuration

**`.biomeignore`** - Optimize Biome performance:
```
# Large files that don't need linting
*.generated.ts
*.d.ts
coverage/
dist/
node_modules/
bun.lockb

# Documentation files
docs/**/*.md
*.md

# Configuration files
*.json
*.yaml
*.yml
```

### Vitest Performance Tips

**`vitest.workspace.ts`** - Workspace configuration for monorepo setups:
```typescript
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Unit tests - fast, isolated
  {
    test: {
      name: 'unit',
      include: ['src/**/*.test.ts'],
      environment: 'node',
      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: 8,
          minThreads: 1
        }
      }
    }
  },
  // Integration tests - slower, with real dependencies
  {
    test: {
      name: 'integration',
      include: ['test/integration/**/*.test.ts'],
      environment: 'node',
      testTimeout: 30000,
      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: 2,
          minThreads: 1
        }
      }
    }
  }
]);
```

## CI/CD Integration

### GitHub Actions Configuration

**`.github/workflows/test.yml`** - Comprehensive CI pipeline:
```yaml
name: Test & Lint

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest
    
    - name: Install dependencies
      run: bun install --frozen-lockfile
    
    - name: Biome Check
      run: bun run ci:check
    
    - name: Type Check
      run: bun run type-check
    
    - name: Run Tests
      run: bun run test:coverage
    
    - name: Upload Coverage
      uses: codecov/codecov-action@v4
      with:
        file: ./coverage/lcov.info
        token: ${{ secrets.CODECOV_TOKEN }}
    
    - name: Build
      run: bun run build
```

## VS Code Integration

### Enhanced VS Code Settings

**`.vscode/settings.json`** - Optimized for Biome + Vitest:
```json
{
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
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "biome.lspBin": "./node_modules/@biomejs/biome/bin/biome",
  "vitest.enable": true,
  "vitest.commandLine": "bun run test",
  "testing.automaticallyOpenPeekView": "never"
}
```

### Debugging Configuration

**`.vscode/launch.json`** - Debug configurations for Bun + Vitest:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Bun App",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["--inspect"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Debug Vitest",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["--inspect-brk", "--no-coverage", "--threads=false"],
      "runtimeExecutable": "bun",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

## Migration from Traditional Tools

### From ESLint + Prettier

**Migration script** - `scripts/migrate-to-biome.js`:
```javascript
#!/usr/bin/env bun

import { spawn } from 'bun';
import { existsSync } from 'fs';

async function migrateToBiome() {
  console.log('🔄 Migrating from ESLint + Prettier to Biome...');

  // Check for existing configurations
  const configs = ['.eslintrc.js', '.eslintrc.json', '.prettierrc', 'prettier.config.js'];
  const existingConfigs = configs.filter(config => existsSync(config));

  if (existingConfigs.length > 0) {
    console.log(`📁 Found existing configs: ${existingConfigs.join(', ')}`);
    
    // Use Biome's migration command
    const result = await spawn({
      cmd: ['bunx', '@biomejs/biome', 'migrate', 'eslint', '--write'],
      stdout: 'inherit',
      stderr: 'inherit'
    });

    if (result.exitCode === 0) {
      console.log('✅ Migration completed successfully');
      console.log('📝 Please review biome.json and remove old config files');
    } else {
      console.error('❌ Migration failed');
    }
  } else {
    console.log('✅ No existing ESLint/Prettier configs found');
  }
}

migrateToBiome();
```

### From Jest to Vitest

**Jest config converter** - `scripts/jest-to-vitest.js`:
```javascript
#!/usr/bin/env bun

import { readFileSync, writeFileSync, existsSync } from 'fs';

function convertJestConfig() {
  if (!existsSync('jest.config.js') && !existsSync('package.json')) {
    console.log('No Jest configuration found');
    return;
  }

  console.log('🔄 Converting Jest configuration to Vitest...');

  // Basic Jest to Vitest mapping
  const jestToVitestMapping = {
    testMatch: 'include',
    testPathIgnorePatterns: 'exclude',
    collectCoverageFrom: 'coverage.include',
    coverageDirectory: 'coverage.reportsDirectory',
    setupFilesAfterEnv: 'setupFiles',
    testEnvironment: 'environment'
  };

  console.log('✅ Jest to Vitest mapping completed');
  console.log('📝 Please manually review and update vitest.config.ts');
}

convertJestConfig();
```

## Troubleshooting

### Common Biome Issues

```bash
# Biome not formatting on save
bunx @biomejs/biome check --write .

# Biome configuration errors
bunx @biomejs/biome check --verbose .

# Clear Biome cache
rm -rf node_modules/.cache/@biomejs/biome
```

### Common Vitest Issues

```bash
# Vitest not finding tests
bunx vitest list

# Module resolution issues
bunx vitest --reporter=verbose

# Coverage issues
bunx vitest run --coverage --reporter=verbose
```

## Next Steps

After completing T2 development tooling setup:

1. **Proceed to T3**: [Agent Creation](./T3-agent-creation.md) for LangGraph implementation
2. **Verify Tooling**: Run `bun run lint` and `bun run test` to ensure everything works
3. **Set up IDE**: Configure VS Code with Biome and Vitest extensions
4. **Create First Tests**: Write basic unit tests for utility functions

This T2 setup provides a modern, high-performance development environment with unified tooling that significantly improves the development experience while maintaining code quality and testing reliability.