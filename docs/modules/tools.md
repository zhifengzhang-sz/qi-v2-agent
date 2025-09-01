# Tools Module

Comprehensive tool execution, registry management, MCP integration, and tool coordination for agent frameworks.

## Overview

The Tools module provides a unified system for tool discovery, registration, execution, and lifecycle management. It features full Model Context Protocol (MCP) integration, comprehensive error handling, and performance monitoring for production agent systems.

## Key Features

- **Tool Registry**: Discovery, registration, and lifecycle management
- **MCP Integration**: Model Context Protocol server connectivity
- **Execution Engine**: Safe tool execution with validation and error handling
- **Metrics & Monitoring**: Performance tracking and usage analytics

## Interface

```typescript
import { IToolRegistry } from '@qi/agent/tools';

const toolRegistry: IToolRegistry = createToolRegistry({
  enableMCP: true,
  mcpServers: [
    { endpoint: 'filesystem://tools', name: 'fs-tools', autoConnect: true },
    { endpoint: 'web://search', name: 'web-tools' },
    { endpoint: 'chroma://localhost:8000', name: 'knowledge' }
  ],
  maxConcurrentExecutions: 5,
  defaultTimeout: 30000
});
```

## Core Methods

### discoverMCPTools()
Discover available tools from MCP servers.

```typescript
const discovery = await toolRegistry.discoverMCPTools();
if (discovery.isOk()) {
  console.log(`Found ${discovery.value.totalTools} tools`);
  console.log(`Servers connected: ${discovery.value.servers.length}`);
  
  // Tools by category
  Object.entries(discovery.value.toolsByCategory).forEach(([category, count]) => {
    console.log(`${category}: ${count} tools`);
  });
}
```

### registerTool()
Register custom tools in the registry.

```typescript
const customTool = {
  id: 'code-formatter',
  name: 'Code Formatter',
  description: 'Format code using Prettier',
  version: '1.0.0',
  category: 'development',
  source: 'builtin' as const,
  isAvailable: true,
  parameters: {
    type: 'object' as const,
    properties: {
      code: { type: 'string', description: 'Code to format' },
      language: { type: 'string', description: 'Programming language' }
    },
    required: ['code']
  },
  returnType: 'string'
};

const result = toolRegistry.registerTool(customTool);
```

### executeTool()
Execute tool with parameters and comprehensive error handling.

```typescript
const execution = await toolRegistry.executeTool({
  toolId: 'file-reader',
  parameters: { path: '/src/components/Button.tsx' },
  timeout: 10000,
  metadata: { requestId: 'req-123' }
});

if (execution.isOk()) {
  console.log('Tool executed successfully');
  console.log(`Execution time: ${execution.value.metadata.executionTime}ms`);
  console.log('Output:', execution.value.output);
}
```

### getAvailableTools()
Retrieve all available tools with filtering capabilities.

```typescript
const tools = toolRegistry.getAvailableTools();
if (tools.isOk()) {
  tools.value.forEach(tool => {
    console.log(`${tool.name} (${tool.category}) - ${tool.source}`);
  });
}
```

## Tool Categories

Tools are organized by functional categories:

- **filesystem**: File operations (read, write, search)
- **web**: Web scraping, API calls, content extraction
- **development**: Code formatting, linting, compilation
- **database**: Query execution, schema operations
- **ai**: Model inference, embeddings, classification
- **communication**: Email, messaging, notifications

## MCP Integration

### Server Management
Connect and manage MCP servers:

```typescript
import { createMCPIntegration } from '@qi/agent/tools';

const mcpIntegration = createMCPIntegration();

// Connect to server
const server = await mcpIntegration.connectToServer('filesystem://tools');
if (server.isOk()) {
  console.log(`Connected to ${server.value.name}`);
  console.log(`Available tools: ${server.value.tools.length}`);
}

// Get all connected servers
const servers = mcpIntegration.getConnectedServers();
```

### Tool Execution through MCP
Execute tools directly through MCP protocol:

```typescript
const result = await mcpIntegration.executeMCPTool(
  'filesystem-server',
  'file-read',
  { path: '/config/settings.json' }
);
```

## Tool Execution Engine

### Parameter Validation
Comprehensive parameter validation against tool schemas:

```typescript
import { createToolExecutor } from '@qi/agent/tools';

const executor = createToolExecutor();

// Validate before execution
const validation = executor.validateParameters(tool, parameters);
if (validation.isErr()) {
  console.error('Invalid parameters:', validation.error.message);
}
```

### Error Handling
Robust error handling with categorized error types:

```typescript
const result = await executor.execute(tool, parameters);
result.match(
  (success) => console.log('Tool executed successfully'),
  (error) => {
    switch (error.source) {
      case 'validation':
        console.error('Parameter validation failed');
        break;
      case 'timeout':
        console.error('Tool execution timed out');
        break;
      case 'mcp':
        console.error('MCP protocol error');
        break;
      case 'network':
        console.error('Network connectivity issue');
        break;
    }
  }
);
```

## Configuration

```typescript
interface ToolsConfig {
  readonly maxConcurrentExecutions?: number;
  readonly defaultTimeout?: number;
  readonly enableMCP?: boolean;
  readonly mcpServers?: Array<{
    endpoint: string;
    name: string;
    autoConnect?: boolean;
  }>;
  readonly builtinTools?: Tool[];
  readonly executionConfig?: {
    retryAttempts: number;
    retryDelay: number;
    enableCaching: boolean;
  };
}
```

## Built-in Tools

The Tools module includes essential built-in tools:

```typescript
const toolRegistry = createToolRegistry({
  builtinTools: [
    {
      id: 'text-processor',
      name: 'Text Processor',
      category: 'utilities',
      // ... tool definition
    }
  ]
});
```

## Performance Monitoring

### Execution Metrics
Track tool usage and performance:

```typescript
const metrics = executor.getMetrics();
if (metrics.isOk()) {
  console.log(`Total executions: ${metrics.value.totalExecutions}`);
  console.log(`Success rate: ${metrics.value.successfulExecutions / metrics.value.totalExecutions * 100}%`);
  console.log(`Average execution time: ${metrics.value.averageExecutionTime}ms`);
}
```

### Usage Analytics
Monitor tool usage patterns:

```typescript
// Tool usage statistics
Object.entries(metrics.value.toolUsageStats).forEach(([tool, count]) => {
  console.log(`${tool}: ${count} executions`);
});

// Error patterns
Object.entries(metrics.value.errorStats).forEach(([error, count]) => {
  console.log(`${error}: ${count} occurrences`);
});
```

## Integration with QiCore

```typescript
import { Result } from '@qi/base';

// All methods return Result<T, QiError>
const discoveryResult: Result<ToolDiscoveryResult, QiError> = 
  await toolRegistry.discoverMCPTools();

discoveryResult.match(
  (discovery) => {
    console.log('Tool discovery completed');
    console.log(`Found ${discovery.totalTools} tools`);
  },
  (error) => console.error('Discovery failed:', error.message)
);
```

## Caching and Performance

### Execution Caching
Enable caching for improved performance:

```typescript
const toolRegistry = createToolRegistry({
  executionConfig: {
    retryAttempts: 3,
    retryDelay: 1000,
    enableCaching: true
  }
});
```

### Connection Pooling
MCP servers use connection pooling for efficiency:

```typescript
// Servers maintain persistent connections
const servers = mcpIntegration.getConnectedServers();
servers.value.forEach(server => {
  console.log(`${server.name}: ${server.isConnected ? 'connected' : 'disconnected'}`);
});
```

## Error Recovery

Tools support automatic retry and recovery:

```typescript
// Automatic retry with exponential backoff
const execution = await toolRegistry.executeTool({
  toolId: 'flaky-service',
  parameters: { data: input },
  // Tool registry handles retries based on configuration
});
```

## Tool Development

### Custom Tool Creation
Create custom tools with full type safety:

```typescript
const customTool: Tool = {
  id: 'my-custom-tool',
  name: 'My Custom Tool',
  description: 'Performs custom operations',
  version: '1.0.0',
  category: 'custom',
  source: 'builtin',
  isAvailable: true,
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input data' },
      options: { 
        type: 'object', 
        description: 'Configuration options',
        properties: {
          format: { type: 'string', enum: ['json', 'yaml', 'xml'] }
        }
      }
    },
    required: ['input']
  },
  returnType: 'object'
};

toolRegistry.registerTool(customTool);
```