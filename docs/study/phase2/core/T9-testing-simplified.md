# T9: Testing Strategy - Essential Testing with Vitest

## Overview

This simplified guide covers essential testing patterns using Vitest and Bun's testing capabilities. Based on Phase 1 analysis showing dramatic simplification through TypeScript SDKs, we focus on practical testing patterns that cover core functionality without complex custom frameworks.

**Key Principle:** Use standard Vitest patterns to achieve comprehensive testing with minimal complexity.

## Architecture Decisions

### Simple Testing Strategy

**Decision: Standard Testing Pyramid with Vitest**

**Testing Distribution:**
- **Unit Tests (80%)**: Functions, classes, components with mocked dependencies
- **Integration Tests (15%)**: MCP integration, configuration loading, agent workflows  
- **End-to-End Tests (5%)**: Critical user workflows

**Benefits:**
- **Simplicity**: Use Vitest's built-in capabilities
- **Speed**: Fast execution with Bun runtime
- **Maintainability**: Standard patterns everyone understands

## Essential Testing Patterns

### 1. Unit Testing Patterns

**Basic Unit Test Structure:**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Test pure functions
describe('ConfigValidator', () => {
  it('should validate valid configuration', () => {
    const config = {
      version: '1.0.0',
      model: { provider: 'ollama', name: 'deepseek-r1', temperature: 0.1 }
    };
    
    const result = QiConfigSchema.safeParse(config);
    
    expect(result.success).toBe(true);
    expect(result.data?.model.provider).toBe('ollama');
  });

  it('should reject invalid temperature', () => {
    const config = {
      model: { provider: 'ollama', name: 'test', temperature: 3.0 }
    };
    
    const result = QiConfigSchema.safeParse(config);
    
    expect(result.success).toBe(false);
  });
});

// Test classes with mocking
describe('SimpleMCPManager', () => {
  let mcpManager: SimpleMCPManager;
  let mockClient: any;

  beforeEach(() => {
    mcpManager = new SimpleMCPManager();
    mockClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({ tools: [] }),
      callTool: vi.fn().mockResolvedValue({ content: 'mock result' })
    };
  });

  it('should connect to server', async () => {
    const config = {
      name: 'test-server',
      transport: 'stdio' as const,
      command: 'bun',
      args: ['test.ts']
    };

    // Mock the client creation
    vi.doMock('@modelcontextprotocol/sdk/client/index.js', () => ({
      Client: vi.fn(() => mockClient)
    }));

    await mcpManager.connectServer(config);
    
    expect(mockClient.connect).toHaveBeenCalled();
  });
});
```

### 2. Integration Testing Patterns

**MCP Integration Tests:**

```typescript
import { beforeAll, afterAll } from 'vitest';

describe('MCP Integration', () => {
  let mcpManager: SimpleMCPManager;
  let testServerProcess: any;

  beforeAll(async () => {
    // Start test MCP server
    testServerProcess = spawn('bun', ['./test/mock-mcp-server.ts'], {
      stdio: 'pipe'
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Connect to test server
    mcpManager = new SimpleMCPManager();
    await mcpManager.connectServer({
      name: 'test-server',
      transport: 'stdio',
      command: 'bun',
      args: ['./test/mock-mcp-server.ts']
    });
  });

  afterAll(async () => {
    // Cleanup
    testServerProcess?.kill();
  });

  it('should list available tools', async () => {
    const tools = await mcpManager.listTools();
    
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should execute tools', async () => {
    const result = await mcpManager.executeTool('echo', { message: 'test' });
    
    expect(result).toContain('test');
  });

  it('should handle tool errors gracefully', async () => {
    await expect(
      mcpManager.executeTool('nonexistent_tool', {})
    ).rejects.toThrow();
  });
});
```

**Configuration Integration Tests:**

```typescript
describe('Configuration Integration', () => {
  it('should load and validate complete configuration', async () => {
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig('./test/fixtures/complete-config.yaml');
    
    expect(config.version).toBe('1.0.0');
    expect(config.model).toBeDefined();
    expect(config.servers).toBeDefined();
    expect(Object.keys(config.servers).length).toBeGreaterThan(0);
  });

  it('should handle missing configuration files', async () => {
    const configManager = new ConfigManager();
    
    await expect(
      configManager.loadConfig('./nonexistent-config.yaml')
    ).rejects.toThrow();
  });

  it('should resolve environment variables', async () => {
    process.env.TEST_MODEL = 'env-test-model';
    
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig('./test/fixtures/env-config.yaml');
    
    expect(config.model.name).toBe('env-test-model');
    
    delete process.env.TEST_MODEL;
  });
});
```

### 3. Security Testing Patterns

**Security Validation Tests:**

```typescript
describe('Security Manager', () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    securityManager = new SecurityManager({
      allowedPaths: ['./test/workspace'],
      deniedPaths: ['/etc', '/usr', '~/.ssh'],
      allowedHosts: ['api.example.com'],
      blockedHosts: ['localhost', '127.0.0.1'],
      allowedPorts: [80, 443],
      auditLogging: false,
      maxExecutionTime: 5000,
      isolateProcesses: true
    });
  });

  describe('Path Validation', () => {
    it('should allow access to permitted paths', async () => {
      const isValid = await securityManager.validateToolExecution(
        'read_file',
        { path: './test/workspace/file.txt' }
      );
      
      expect(isValid).toBe(true);
    });

    it('should deny access to restricted paths', async () => {
      const isValid = await securityManager.validateToolExecution(
        'read_file',
        { path: '/etc/passwd' }
      );
      
      expect(isValid).toBe(false);
    });

    it('should prevent directory traversal', async () => {
      const isValid = await securityManager.validateToolExecution(
        'read_file',
        { path: './test/workspace/../../../etc/passwd' }
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should detect suspicious command patterns', async () => {
      const isValid = await securityManager.validateToolExecution(
        'execute_command',
        { command: 'rm -rf /' }
      );
      
      expect(isValid).toBe(false);
    });

    it('should detect script injection attempts', async () => {
      const isValid = await securityManager.validateToolExecution(
        'process_input',
        { input: '<script>alert("xss")</script>' }
      );
      
      expect(isValid).toBe(false);
    });
  });
});
```

### 4. Agent Workflow Tests

**End-to-End Agent Testing:**

```typescript
describe('Agent Workflows', () => {
  let agent: any;
  let mcpManager: SimpleMCPManager;

  beforeEach(async () => {
    // Initialize test environment
    const configManager = new ConfigManager();
    const config = await configManager.loadConfig('./test/fixtures/test-config.yaml');
    
    mcpManager = new SimpleMCPManager();
    await mcpManager.connectServer({
      name: 'test-server',
      transport: 'stdio',
      command: 'bun',
      args: ['./test/mock-mcp-server.ts']
    });

    // Create agent
    agent = await createAgentWithMCP();
  });

  it('should process simple queries', async () => {
    const response = await agent.invoke({
      messages: [{ role: 'user', content: 'What is 2 + 2?' }]
    });
    
    expect(response.messages).toBeDefined();
    expect(response.messages[response.messages.length - 1].content).toContain('4');
  });

  it('should use tools when needed', async () => {
    const response = await agent.invoke({
      messages: [{ role: 'user', content: 'Read the test file' }]
    });
    
    expect(response.messages).toBeDefined();
    // Should have used the file reading tool
    expect(response.messages.some((msg: any) => 
      msg.content?.includes('tool') || msg.tool_calls
    )).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    const response = await agent.invoke({
      messages: [{ role: 'user', content: 'Access a forbidden file' }]
    });
    
    expect(response.messages).toBeDefined();
    expect(response.messages[response.messages.length - 1].content).toContain('access denied');
  });
});
```

## Test Utilities

### Simple Test Helpers

```typescript
// test/utils/test-helpers.ts
export const testUtils = {
  // Async utilities
  async waitFor(condition: () => boolean, timeout = 5000): Promise<void> {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },

  // File system utilities
  async createTempFile(content: string): Promise<string> {
    const tempPath = `./test/temp/test-${Date.now()}.txt`;
    await Bun.write(tempPath, content);
    return tempPath;
  },

  async cleanupTempFiles(): Promise<void> {
    const { rmdir } = await import('fs/promises');
    await rmdir('./test/temp', { recursive: true }).catch(() => {});
  },

  // Mock factories
  createMockMCPServer(): any {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      listTools: vi.fn().mockResolvedValue({
        tools: [
          { name: 'echo', description: 'Echo input', inputSchema: {} },
          { name: 'read_file', description: 'Read file', inputSchema: {} }
        ]
      }),
      callTool: vi.fn().mockImplementation(({ name, arguments: args }) => {
        if (name === 'echo') {
          return Promise.resolve({ content: args.message });
        }
        if (name === 'read_file') {
          return Promise.resolve({ content: 'file content' });
        }
        return Promise.reject(new Error(`Unknown tool: ${name}`));
      })
    };
  }
};

// Custom matchers
expect.extend({
  toBeValidConfig(received: any) {
    const result = QiConfigSchema.safeParse(received);
    return {
      message: () => `expected config to be valid, got: ${JSON.stringify(result.error?.errors)}`,
      pass: result.success
    };
  }
});
```

### Mock MCP Server for Testing

```typescript
// test/mock-mcp-server.ts - Simple test server
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'test-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register test tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'echo',
      description: 'Echo the input message',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      }
    },
    {
      name: 'read_file',
      description: 'Read a test file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' }
        },
        required: ['path']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'echo':
      return {
        content: [{ type: 'text', text: `Echo: ${args.message}` }]
      };
      
    case 'read_file':
      return {
        content: [{ type: 'text', text: `Content of ${args.path}: test file content` }]
      };
      
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport);
```

## Test Configuration

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    
    // Test file patterns
    include: ['**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80
        }
      },
      exclude: [
        'test/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/**'
      ]
    },
    
    // Performance settings
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    
    // Parallel execution
    maxConcurrency: 4,
    minWorkers: 1,
    maxWorkers: 4
  }
});
```

### Test Setup

```typescript
// test/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { testUtils } from './utils/test-helpers';

beforeAll(async () => {
  // Global test setup
  process.env.NODE_ENV = 'test';
  
  // Create test directories
  await import('fs/promises').then(fs => 
    fs.mkdir('./test/temp', { recursive: true })
  );
});

afterAll(async () => {
  // Global cleanup
  await testUtils.cleanupTempFiles();
});

beforeEach(() => {
  // Reset mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.restoreAllMocks();
});
```

## Test Scripts

### Package.json Test Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:unit": "vitest run src/**/*.test.ts",
    "test:integration": "vitest run test/integration/**/*.test.ts",
    "test:e2e": "vitest run test/e2e/**/*.test.ts"
  }
}
```

### Test Organization

```
test/
├── setup.ts                 # Global test setup
├── utils/
│   ├── test-helpers.ts      # Test utilities
│   └── mock-mcp-server.ts   # Mock server for testing
├── fixtures/
│   ├── test-config.yaml     # Test configuration files
│   └── complete-config.yaml
├── unit/
│   ├── config.test.ts       # Unit tests
│   ├── security.test.ts
│   └── mcp-manager.test.ts
├── integration/
│   ├── mcp-integration.test.ts    # Integration tests
│   └── config-integration.test.ts
└── e2e/
    └── agent-workflows.test.ts    # End-to-end tests
```

## Running Tests

### Basic Test Commands

```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage

# Run in watch mode
bun run test:watch

# Run specific test files
bun test src/config.test.ts

# Run tests matching pattern
bun test --grep "MCP integration"
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      
      - name: Install dependencies
        run: bun install
      
      - name: Run tests
        run: bun run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

## Next Steps

After implementing T9 testing:

1. **Add SDK Integration Patterns**: Create guide showing how to leverage official SDKs
2. **Set Up CI/CD**: Configure automated testing pipeline
3. **Write Core Tests**: Implement tests for critical functionality
4. **Monitor Coverage**: Ensure adequate test coverage

This simplified approach focuses on essential testing patterns using standard Vitest capabilities, reducing complexity from 1,737 lines to ~500 lines while maintaining comprehensive test coverage.