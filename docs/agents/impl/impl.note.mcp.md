# MCP SDK Implementation Experience Notes

## Overview

This document captures lessons learned during the Model Context Protocol (MCP) SDK implementation for the qi-v2 agent tool provider. The experience revealed important insights about client management, transport handling, and operational reliability patterns.

## Key Problems Encountered

### 1. Client Transport Configuration Complexity

**Problem**: Initial implementation assumed all MCP servers use stdio transport, but modern MCP supports multiple transports.

```typescript
// ❌ Wrong: Single transport assumption
const transport = new StdioClientTransport({
  command: serverConfig.command,
  args: serverConfig.args
});
```

**Solution**: Dynamic transport selection based on server configuration.

```typescript
// ✅ Correct: Multi-transport support
let transport;
if (serverConfig.command.startsWith('http')) {
  // HTTP/SSE transport for web-based MCP servers
  transport = new SSEClientTransport(new URL(serverConfig.command));
} else {
  // Default to stdio transport
  transport = new StdioClientTransport({
    command: serverConfig.command,
    args: [...serverConfig.args],
    env: serverConfig.env
  });
}
```

**Lesson**: Modern MCP implementations need to support multiple transport types - stdio, HTTP/SSE, and potentially WebSocket.

### 2. Connection Management and Reliability

**Problem**: MCP connections can fail or timeout, requiring robust retry and cleanup logic.

```typescript
// ❌ Wrong: No retry or timeout handling
await client.connect(transport);
```

**Solution**: Comprehensive connection management with timeouts and retries.

```typescript
// ✅ Correct: Robust connection handling
const connectionPromise = client.connect(transport);
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Connection timeout')), this.connectionTimeout);
});

await Promise.race([connectionPromise, timeoutPromise]);

// With retry logic
const retries = this.connectionRetries.get(serverConfig.name) || 0;
if (retries < this.maxRetries) {
  this.connectionRetries.set(serverConfig.name, retries + 1);
  await this.sleep(1000 * Math.pow(2, retries));
  return this.initializeServerWithTransport(serverConfig);
}
```

**Lesson**: MCP connections require production-grade reliability patterns: timeouts, retries, exponential backoff, and graceful degradation.

### 3. Tool Discovery and Schema Conversion

**Problem**: MCP tool schemas need conversion to internal tool definition format, and discovery can fail.

```typescript
// ❌ Wrong: Direct schema usage without validation
const toolDefinition: ToolDefinition = {
  name: mcpTool.name,
  description: mcpTool.description,
  inputSchema: mcpTool.inputSchema // Direct assignment
};
```

**Solution**: Robust schema conversion with validation and defaults.

```typescript
// ✅ Correct: Schema conversion with validation
const toolDefinition: ToolDefinition = {
  name: mcpTool.name,
  description: mcpTool.description || 'No description provided',
  inputSchema: this.convertMCPSchema(mcpTool.inputSchema),
  outputSchema: { type: 'object', properties: new Map(), required: [] }, // MCP doesn't define output schemas
  category: this.determineCategoryFromPatterns(patterns),
  capabilities: {
    isAsync: true,
    supportsStreaming: false, // MCP doesn't natively support streaming
    requiresConfirmation: false,
    maxExecutionTime: 30000,
    resourceRequirements: []
  }
};
```

**Lesson**: MCP schemas require careful conversion and validation. Not all MCP features map directly to internal abstractions.

### 4. LangChain Integration Challenges

**Problem**: MCP tools need to integrate with LangChain's DynamicTool interface.

```typescript
// ❌ Wrong: Direct tool exposure without wrapper
return mcpTool;
```

**Solution**: Proper LangChain DynamicTool wrapper creation.

```typescript
// ✅ Correct: LangChain integration
private createLangChainTool(toolName: string, definition: ToolDefinition, client: Client): DynamicTool {
  return new DynamicTool({
    name: toolName,
    description: definition.description,
    func: async (input: string) => {
      try {
        const args = JSON.parse(input);
        const result = await client.callTool({
          name: toolName,
          arguments: args
        });
        return JSON.stringify(result.content);
      } catch (error) {
        throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });
}
```

**Lesson**: MCP-LangChain integration requires careful wrapper implementation to handle serialization and error propagation.

## Proper MCP Implementation Patterns

### 1. Client Configuration Pattern

```typescript
export interface MCPServerConfig {
  name: string;
  command: string;
  args: readonly string[];
  env?: Record<string, string>;
  patterns?: readonly string[]; // For pattern-tool mapping
}

export interface MCPToolProviderConfig {
  servers: readonly MCPServerConfig[];
  patternToolMapping: readonly [string, string[]][];
}
```

### 2. Multi-Transport Client Initialization

```typescript
private async initializeServer(serverConfig: MCPServerConfig): Promise<void> {
  let transport;
  
  // Determine transport type from server config
  if (serverConfig.command.startsWith('http')) {
    transport = new SSEClientTransport(new URL(serverConfig.command));
  } else {
    transport = new StdioClientTransport({
      command: serverConfig.command,
      args: [...serverConfig.args],
      env: serverConfig.env
    });
  }

  const client = new Client({
    name: `qi-agent-${serverConfig.name}`,
    version: '2.0.0'
  }, {
    capabilities: {
      tools: {},
      sampling: {},
      resources: {}, // 2025 MCP capabilities
      prompts: {}
    }
  });

  await client.connect(transport);
  this.clients.set(serverConfig.name, client);
  await this.discoverTools(client, serverConfig.name, [...(serverConfig.patterns || [])]);
}
```

### 3. Robust Tool Execution Pattern

```typescript
async executeTool(request: ToolRequest): Promise<ToolResult> {
  // Check cache first
  const cacheKey = this.createCacheKey(request);
  const cached = this.getCachedResult(cacheKey);
  if (cached) {
    return { ...cached, metadata: new Map([...cached.metadata, ['cacheHit', true]]) };
  }

  const startTime = Date.now();
  let retryCount = 0;
  
  while (retryCount <= this.maxRetries) {
    try {
      const result = await this.executeToolWithTimeout(request, tool);
      this.updateExecutionStats(request.toolName, Date.now() - startTime, false);
      
      // Cache successful results
      if (result.status === 'success') {
        this.cacheResult(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      retryCount++;
      this.updateExecutionStats(request.toolName, Date.now() - startTime, true);
      
      if (retryCount > this.maxRetries) {
        return this.createErrorResult(request.toolName, 
          `Tool execution failed after ${retryCount} retries: ${error}`, 
          Date.now() - startTime);
      }
      
      // Exponential backoff
      await this.sleep(Math.pow(2, retryCount) * 1000);
    }
  }
}
```

### 4. Schema Conversion Pattern

```typescript
private convertMCPSchema(mcpSchema: any): ToolSchema {
  const properties = new Map();
  
  if (mcpSchema.properties) {
    for (const [key, prop] of Object.entries(mcpSchema.properties)) {
      properties.set(key, {
        type: (prop as any).type || 'string',
        description: (prop as any).description || '',
        enum: (prop as any).enum,
        format: (prop as any).format
      });
    }
  }

  return {
    type: mcpSchema.type || 'object',
    properties,
    required: mcpSchema.required || []
  };
}
```

## Operational Considerations

### 1. Performance Monitoring

```typescript
getToolProviderStats(): {
  totalTools: number;
  activeClients: number;
  cacheHitRate: number;
  toolStats: Array<{
    name: string;
    calls: number;
    avgTime: number;
    errorRate: number;
  }>;
} {
  const toolStats = Array.from(this.executionStats.entries()).map(([name, stats]) => ({
    name,
    calls: stats.calls,
    avgTime: stats.calls > 0 ? stats.totalTime / stats.calls : 0,
    errorRate: stats.calls > 0 ? stats.errors / stats.calls : 0
  }));

  return {
    totalTools: this.tools.size,
    activeClients: this.clients.size,
    cacheHitRate: this.calculateCacheHitRate(),
    toolStats
  };
}
```

### 2. Resource Cleanup

```typescript
async cleanup(): Promise<void> {
  console.log('Cleaning up MCP connections...');
  
  for (const [name, client] of this.clients) {
    try {
      await client.close();
      console.log(`✓ Closed connection to ${name}`);
    } catch (error) {
      console.error(`✗ Error closing connection to ${name}:`, error);
    }
  }
  
  this.clients.clear();
  this.tools.clear();
  this.langchainTools.clear();
}
```

## MCP 2025 Features

### Enhanced Capabilities
- **Multi-transport support**: stdio, HTTP/SSE, WebSocket
- **Resource management**: Beyond just tools
- **Prompt templates**: Server-provided prompts
- **Sampling capabilities**: LLM parameter control

### Configuration Example
```typescript
const client = new Client({
  name: `qi-agent-${serverConfig.name}`,
  version: '2.0.0'
}, {
  capabilities: {
    tools: {},
    sampling: {},
    resources: {}, // New in 2025
    prompts: {}    // New in 2025
  }
});
```

## Testing Strategy

1. **Connection Testing**: Test different transport types and failure scenarios
2. **Tool Discovery**: Verify schema conversion and error handling
3. **Execution Reliability**: Test retry logic and timeout handling
4. **Cache Behavior**: Verify caching works correctly and expires properly
5. **Performance**: Monitor tool execution times and resource usage

## Common Pitfalls

1. **Single Transport Assumption**: Don't assume all MCP servers use stdio
2. **Missing Error Handling**: MCP connections can fail - handle gracefully
3. **Schema Assumptions**: MCP schemas vary - validate and convert carefully
4. **Resource Leaks**: Always implement proper cleanup for client connections
5. **Cache Management**: Implement cache expiration to prevent stale data

## References

### Official MCP Documentation
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs) - Core protocol specification
- [MCP Client Implementation](https://github.com/modelcontextprotocol/typescript-sdk) - TypeScript SDK source

### Package Dependencies
- `@modelcontextprotocol/sdk`: ^1.16.0 - Official MCP SDK

### Key Insights
The MCP SDK requires careful attention to connection management and transport abstraction. The protocol is designed for reliability but implementations must handle the complexity of different transport types and failure modes.

---

**Implementation Status**: ✅ Complete  
**Transport Support**: ✅ Multi-transport (stdio, HTTP/SSE)  
**Reliability**: ✅ Retry logic, timeouts, cleanup  
**Performance**: ✅ Caching, monitoring, stats