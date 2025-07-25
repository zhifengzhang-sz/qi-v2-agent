# T4: MCP Integration - SDK-First Approach

## Overview

This simplified guide covers Model Context Protocol (MCP) integration using official TypeScript SDKs. Based on Phase 1 analysis showing dramatic simplification through official SDKs, we leverage `@modelcontextprotocol/sdk` to eliminate custom protocol implementation.

**Key Principle:** Use official SDKs for 80%+ complexity reduction versus custom implementations.

## Architecture Decisions

### SDK-First Strategy

**Decision: Use Official MCP TypeScript SDK Directly**

**Benefits from Phase 1 Analysis:**
- **99% Code Reduction**: Official SDKs eliminate custom protocol handling
- **Built-in Features**: Connection management, health checking, reconnection
- **Type Safety**: Full TypeScript support with proper types
- **Maintenance**: No custom transport or error handling code

### Simple Multi-Server Pattern

**Decision: Configuration-Driven Server Management**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

interface ServerConfig {
  name: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

class SimpleMCPManager {
  private clients = new Map<string, Client>();

  async connectServer(config: ServerConfig): Promise<void> {
    const transport = config.transport === 'stdio' 
      ? new StdioClientTransport({
          command: config.command!,
          args: config.args || [],
          env: config.env
        })
      : new SSEClientTransport(new URL(config.url!));

    const client = new Client(
      { name: "qi-agent", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    this.clients.set(config.name, client);
  }

  async listTools(): Promise<Tool[]> {
    const allTools: Tool[] = [];
    
    for (const [serverName, client] of this.clients) {
      try {
        const response = await client.listTools();
        const tools = response.tools.map(tool => ({
          ...tool,
          server: serverName
        }));
        allTools.push(...tools);
      } catch (error) {
        console.warn(`Failed to list tools from ${serverName}:`, error);
      }
    }
    
    return allTools;
  }

  async executeTool(toolName: string, parameters: any): Promise<any> {
    for (const [serverName, client] of this.clients) {
      try {
        const tools = await client.listTools();
        const tool = tools.tools.find(t => t.name === toolName);
        
        if (tool) {
          const result = await client.callTool({
            name: toolName,
            arguments: parameters
          });
          return result.content;
        }
      } catch (error) {
        console.warn(`Tool execution failed on ${serverName}:`, error);
      }
    }
    
    throw new Error(`Tool ${toolName} not found on any server`);
  }
}
```

## Configuration Patterns

### Simple Server Configuration

```yaml
# qi-config.yaml
servers:
  file-server:
    transport: stdio
    command: bun
    args: ["./servers/file-server.ts"]
    
  web-search:
    transport: sse
    url: "http://localhost:8001/mcp"
    
  calculator:
    transport: stdio
    command: node
    args: ["./servers/calc-server.js"]
```

### Configuration Loading

```typescript
interface QiConfig {
  servers: Record<string, ServerConfig>;
  model: ModelConfig;
}

async function loadConfig(): Promise<QiConfig> {
  const configFile = await fs.readFile('./qi-config.yaml', 'utf-8');
  return YAML.parse(configFile);
}

async function initializeMCP(): Promise<SimpleMCPManager> {
  const config = await loadConfig();
  const mcpManager = new SimpleMCPManager();
  
  // Connect to all configured servers
  await Promise.allSettled(
    Object.entries(config.servers).map(([name, serverConfig]) =>
      mcpManager.connectServer({ name, ...serverConfig })
    )
  );
  
  return mcpManager;
}
```

## Integration Strategies

### LangGraph Integration

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOllama } from '@langchain/ollama';

class MCPToolConverter {
  static convertMCPTool(mcpTool: any, mcpManager: SimpleMCPManager) {
    return {
      name: mcpTool.name,
      description: mcpTool.description,
      schema: mcpTool.inputSchema,
      func: async (input: any) => {
        return await mcpManager.executeTool(mcpTool.name, input);
      }
    };
  }
}

async function createAgentWithMCP(): Promise<any> {
  const mcpManager = await initializeMCP();
  const mcpTools = await mcpManager.listTools();
  
  // Convert MCP tools to LangGraph tools
  const tools = mcpTools.map(tool => 
    MCPToolConverter.convertMCPTool(tool, mcpManager)
  );
  
  const model = new ChatOllama({
    model: "deepseek-r1",
    temperature: 0.1
  });
  
  return createReactAgent({
    llm: model,
    tools,
    checkpointSaver: undefined // Add if needed
  });
}
```

## Error Handling

### Simple Error Recovery

```typescript
class MCPManager extends SimpleMCPManager {
  private reconnectAttempts = new Map<string, number>();
  private maxReconnectAttempts = 3;

  async connectServer(config: ServerConfig): Promise<void> {
    try {
      await super.connectServer(config);
      this.reconnectAttempts.set(config.name, 0);
    } catch (error) {
      const attempts = this.reconnectAttempts.get(config.name) || 0;
      
      if (attempts < this.maxReconnectAttempts) {
        this.reconnectAttempts.set(config.name, attempts + 1);
        console.log(`Retrying connection to ${config.name} (${attempts + 1}/${this.maxReconnectAttempts})`);
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts)));
        return this.connectServer(config);
      }
      
      console.error(`Failed to connect to ${config.name} after ${this.maxReconnectAttempts} attempts`);
      throw error;
    }
  }

  async executeTool(toolName: string, parameters: any): Promise<any> {
    try {
      return await super.executeTool(toolName, parameters);
    } catch (error) {
      console.error(`Tool execution failed for ${toolName}:`, error);
      return {
        error: `Tool ${toolName} is currently unavailable`,
        details: error.message
      };
    }
  }
}
```

## Testing Patterns

### Simple MCP Testing

```typescript
describe('MCP Integration', () => {
  let mcpManager: SimpleMCPManager;

  beforeEach(async () => {
    mcpManager = new SimpleMCPManager();
    
    // Connect to test servers
    await mcpManager.connectServer({
      name: 'test-server',
      transport: 'stdio',
      command: 'bun',
      args: ['./test/mock-server.ts']
    });
  });

  it('should list available tools', async () => {
    const tools = await mcpManager.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0]).toHaveProperty('name');
    expect(tools[0]).toHaveProperty('description');
  });

  it('should execute tools', async () => {
    const result = await mcpManager.executeTool('test_tool', { input: 'test' });
    expect(result).toBeDefined();
  });
});
```

## Performance Considerations

### Connection Pooling

The MCP SDK handles connection pooling automatically. For additional optimization:

```typescript
class OptimizedMCPManager extends SimpleMCPManager {
  private toolCache = new Map<string, Tool[]>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  async listTools(): Promise<Tool[]> {
    const cacheKey = 'all_tools';
    const cached = this.toolCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.tools;
    }

    const tools = await super.listTools();
    this.toolCache.set(cacheKey, { tools, timestamp: Date.now() });
    
    return tools;
  }
}
```

## Next Steps

After implementing T4 MCP integration:

1. **Proceed to T5**: [Ollama Integration](./T5-ollama-integration.md) for local LLM setup
2. **Test Integration**: Verify MCP servers connect and tools execute properly
3. **Add Servers**: Implement specific MCP servers for your use cases
4. **Monitor Performance**: Add logging and metrics for MCP operations

This simplified approach leverages the 99% complexity reduction from Phase 1 analysis, using official SDKs instead of custom implementations.