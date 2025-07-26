# SDK Integration Patterns - Leveraging TypeScript SDKs

## Overview

This guide demonstrates how to leverage official TypeScript SDKs to achieve the dramatic simplification shown in Phase 1 analysis. Instead of building custom implementations, we use existing SDKs to reduce complexity by 80-99% while maintaining full functionality.

**Core Principle:** Official SDKs provide production-ready implementations that eliminate the need for custom protocol handling, connection management, and error recovery code.

## Phase 1 Key Findings

### Complexity Reduction Through SDKs

**Before (Custom Implementation):**
- 1,699+ lines of custom Python protocol code
- Custom connection management and error handling
- Manual type definitions and validation
- Complex transport layer implementations

**After (TypeScript SDKs):**
- ~3 package imports replace custom implementations
- 99% code reduction in protocol handling
- Built-in TypeScript types and validation
- Production-ready connection management

### SDK Architecture Benefits

```typescript
// Phase 1 Demonstration: 1,699+ lines → 3 imports
import { createReactAgent } from '@langchain/langgraph/prebuilt';     // Agent creation
import { ChatOllama } from '@langchain/ollama';                       // LLM integration  
import { Client } from '@modelcontextprotocol/sdk/client/index.js';   // MCP protocol
```

## Essential SDK Patterns

### 1. LangGraph Agent Creation

**SDK Pattern: Use createReactAgent() for 99% of agent needs**

```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOllama } from '@langchain/ollama';

// Replaces hundreds of lines of custom agent implementation
async function createAgent(tools: any[], config: AgentConfig) {
  const model = new ChatOllama({
    model: config.model.name,
    temperature: config.model.temperature,
    baseUrl: config.model.baseUrl
  });

  // SDK handles: state management, tool calling, conversation flow, streaming
  return createReactAgent({
    llm: model,
    tools,
    checkpointSaver: undefined, // Add if state persistence needed
    interruptBefore: [],        // Add if human-in-the-loop needed
    interruptAfter: []
  });
}

// Usage: Single function call replaces entire agent architecture
const agent = await createAgent(mcpTools, config);
const response = await agent.invoke({
  messages: [{ role: 'user', content: 'Hello' }]
});
```

**What the SDK Provides:**
- ✅ State management and conversation history
- ✅ Tool calling and result integration
- ✅ Streaming response handling
- ✅ Error recovery and retry logic
- ✅ Type safety and validation

### 2. MCP Client Integration

**SDK Pattern: Direct MCP SDK usage eliminates custom protocol code**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Replaces hundreds of lines of custom MCP protocol implementation
class SDKMCPManager {
  private clients = new Map<string, Client>();

  async connectServer(config: ServerConfig): Promise<void> {
    // SDK handles transport selection and connection management
    const transport = this.createTransport(config);
    const client = new Client(
      { name: "qi-agent", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    await client.connect(transport);
    this.clients.set(config.name, client);
  }

  private createTransport(config: ServerConfig) {
    // SDK provides ready-to-use transport implementations
    switch (config.transport) {
      case 'stdio':
        return new StdioClientTransport({
          command: config.command!,
          args: config.args || []
        });
      
      case 'sse':
        return new SSEClientTransport(new URL(config.url!));
      
      default:
        throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }

  async executeTool(toolName: string, parameters: any): Promise<any> {
    for (const [_, client] of this.clients) {
      try {
        // SDK handles: serialization, protocol compliance, error handling
        const result = await client.callTool({
          name: toolName,
          arguments: parameters
        });
        return result.content;
      } catch (error) {
        continue; // Try next server
      }
    }
    throw new Error(`Tool ${toolName} not found`);
  }
}
```

**What the SDK Provides:**
- ✅ MCP protocol implementation
- ✅ Transport layer abstractions  
- ✅ Connection lifecycle management
- ✅ Automatic serialization/deserialization
- ✅ Built-in error handling and retries

### 3. LangChain LLM Integration

**SDK Pattern: Provider-specific ChatLLM classes handle all complexity**

```typescript
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';

// Replaces custom LLM protocol implementations
function createLLMFromConfig(config: ModelConfig): BaseChatModel {
  // Each SDK handles provider-specific protocols and features
  switch (config.provider) {
    case 'ollama':
      return new ChatOllama({
        model: config.name,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        baseUrl: config.baseUrl || 'http://localhost:11434'
      });

    case 'openai':
      return new ChatOpenAI({
        modelName: config.name,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        openAIApiKey: config.apiKey
      });

    case 'anthropic':
      return new ChatAnthropic({
        modelName: config.name,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        anthropicApiKey: config.apiKey
      });

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// SDK provides unified interface across all providers
async function generateResponse(llm: BaseChatModel, messages: any[]) {
  // Same interface works for all providers
  return await llm.invoke(messages);
}

// Streaming works the same way across providers
async function* streamResponse(llm: BaseChatModel, messages: any[]) {
  const stream = await llm.stream(messages);
  for await (const chunk of stream) {
    yield chunk.content;
  }
}
```

**What the SDK Provides:**
- ✅ Provider-specific API implementations
- ✅ Unified interface across providers
- ✅ Streaming support with error handling
- ✅ Rate limiting and retry logic
- ✅ Token counting and billing integration

### 4. Configuration Validation

**SDK Pattern: Zod provides runtime validation and TypeScript types**

```typescript
import { z } from 'zod';

// Replaces hundreds of lines of custom validation code
const ConfigSchema = z.object({
  model: z.object({
    provider: z.enum(['ollama', 'openai', 'anthropic']),
    name: z.string(),
    temperature: z.number().min(0).max(2).default(0.1)
  }),
  servers: z.record(z.object({
    transport: z.enum(['stdio', 'sse']),
    command: z.string().optional(),
    url: z.string().url().optional()
  }))
});

// SDK provides both validation and TypeScript types
type Config = z.infer<typeof ConfigSchema>;

function validateConfig(rawConfig: unknown): Config {
  // Single line replaces complex validation logic
  return ConfigSchema.parse(rawConfig);
}
```

**What the SDK Provides:**
- ✅ Runtime type validation
- ✅ Automatic TypeScript type generation
- ✅ Detailed error messages
- ✅ Schema composition and transformation

## Complete Integration Example

### Putting It All Together

```typescript
// main.ts - Complete application using SDK patterns
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOllama } from '@langchain/ollama';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { parse as parseYAML } from 'yaml';
import { readFile } from 'fs/promises';

// 1. Configuration (SDK: Zod)
const ConfigSchema = z.object({
  model: z.object({
    name: z.string().default('deepseek-r1'),
    temperature: z.number().default(0.1)
  }),
  servers: z.record(z.object({
    command: z.string(),
    args: z.array(z.string()).default([])
  }))
});

async function loadConfig(): Promise<z.infer<typeof ConfigSchema>> {
  const configFile = await readFile('./qi-config.yaml', 'utf-8');
  const rawConfig = parseYAML(configFile);
  return ConfigSchema.parse(rawConfig); // SDK handles validation
}

// 2. MCP Integration (SDK: @modelcontextprotocol/sdk)
async function connectMCPServers(config: any): Promise<any[]> {
  const tools = [];
  
  for (const [name, serverConfig] of Object.entries(config.servers)) {
    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args
    });
    
    const client = new Client(
      { name: "qi-agent", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    
    await client.connect(transport); // SDK handles connection
    
    const { tools: mcpTools } = await client.listTools(); // SDK handles protocol
    
    // Convert MCP tools to LangGraph format
    for (const tool of mcpTools) {
      tools.push({
        name: tool.name,
        description: tool.description,
        schema: tool.inputSchema,
        func: async (input: any) => {
          const result = await client.callTool({
            name: tool.name,
            arguments: input
          });
          return result.content;
        }
      });
    }
  }
  
  return tools;
}

// 3. Agent Creation (SDK: @langchain/langgraph)
async function createQiAgent(config: any, tools: any[]) {
  const model = new ChatOllama({
    model: config.model.name,
    temperature: config.model.temperature
  }); // SDK handles Ollama integration
  
  return createReactAgent({
    llm: model,
    tools
  }); // SDK handles agent creation
}

// 4. Main Application
async function main() {
  try {
    // Load and validate configuration
    const config = await loadConfig();
    
    // Connect to MCP servers
    const tools = await connectMCPServers(config);
    
    // Create agent
    const agent = await createQiAgent(config, tools);
    
    // Use agent
    const response = await agent.invoke({
      messages: [{ role: 'user', content: 'Hello, what tools do you have?' }]
    });
    
    console.log(response.messages[response.messages.length - 1].content);
    
  } catch (error) {
    console.error('Application failed:', error);
  }
}

// Total lines: ~100 (vs 1,699+ custom implementation)
main().catch(console.error);
```

## SDK Comparison: Before vs After

### Before: Custom Implementation

```typescript
// Hundreds of lines for each component:

class CustomMCPClient {
  // 200+ lines: connection management
  // 150+ lines: protocol implementation  
  // 100+ lines: error handling
  // 80+ lines: serialization
  // 70+ lines: transport abstraction
}

class CustomAgent {
  // 300+ lines: state management
  // 250+ lines: tool execution
  // 200+ lines: conversation flow
  // 150+ lines: streaming
}

class CustomLLMClient {
  // 180+ lines: provider APIs
  // 120+ lines: streaming
  // 100+ lines: error handling
  // 80+ lines: rate limiting
}

// Total: 1,600+ lines of complex custom code
```

### After: SDK Integration

```typescript
// SDK handles complexity, we just configure:

const mcpClient = new Client(config, capabilities);
await mcpClient.connect(transport); // SDK handles everything

const agent = createReactAgent({ llm, tools }); // SDK handles everything

const llm = new ChatOllama(config); // SDK handles everything

// Total: ~50 lines of configuration code
```

## When to Use SDKs vs Custom Code

### Always Use SDKs For:

✅ **Protocol Implementation**: MCP, HTTP, WebSocket protocols  
✅ **Agent Architecture**: State management, tool calling, conversation flow  
✅ **LLM Integration**: Provider APIs, streaming, error handling  
✅ **Validation**: Schema validation, type checking  
✅ **Connection Management**: Pooling, retries, timeouts  

### Consider Custom Code For:

⚠️ **Business Logic**: Application-specific workflows  
⚠️ **UI Components**: Custom terminal interface elements  
⚠️ **Domain Tools**: Specialized tools for your use case  
⚠️ **Integration Glue**: Connecting different systems  
⚠️ **Performance Optimization**: Specific bottlenecks  

### Never Custom Implement:

❌ **Standard Protocols**: HTTP, WebSocket, stdio  
❌ **LLM Provider APIs**: OpenAI, Anthropic, Ollama APIs  
❌ **Agent Frameworks**: Conversation state, tool orchestration  
❌ **Validation Libraries**: Schema validation, type checking  

## Migration Strategy

### From Custom to SDK Implementation

**Step 1: Identify SDK Opportunities**
```bash
# Audit codebase for SDK-replaceable code
grep -r "class.*Client" src/          # Custom clients → SDK clients
grep -r "protocol.*implementation" src/ # Custom protocols → SDK protocols  
grep -r "connection.*management" src/   # Custom connections → SDK transports
```

**Step 2: Replace Custom Implementations**
```typescript
// Before: Custom MCP client (200+ lines)
class CustomMCPClient { /* complex implementation */ }

// After: SDK client (5 lines)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
const client = new Client(config, capabilities);
```

**Step 3: Test SDK Integration**
```typescript
// Verify SDK provides same functionality
describe('SDK Migration', () => {
  it('should provide same functionality as custom implementation', async () => {
    const customResult = await customImplementation.execute();
    const sdkResult = await sdkImplementation.execute();
    
    expect(sdkResult).toEqual(customResult);
  });
});
```

**Step 4: Remove Custom Code**
```bash
# Remove replaced custom implementations
rm src/custom-mcp-client.ts    # Replaced by MCP SDK
rm src/custom-agent.ts         # Replaced by LangGraph SDK  
rm src/custom-llm-client.ts    # Replaced by LangChain SDK
```

## Performance Benefits

### Development Speed
- **Custom**: Weeks to implement and debug protocol handling
- **SDK**: Minutes to configure and integrate

### Maintenance Burden  
- **Custom**: Ongoing maintenance for protocol updates, bug fixes
- **SDK**: Automatic updates and community support

### Code Quality
- **Custom**: Potential bugs in protocol implementation
- **SDK**: Production-tested, community-validated implementations

### Feature Completeness
- **Custom**: Limited features, basic implementations
- **SDK**: Full feature sets, advanced capabilities

## Next Steps

After understanding SDK integration patterns:

1. **Audit Existing Code**: Identify opportunities for SDK replacement
2. **Plan Migration**: Prioritize high-impact SDK integrations
3. **Implement Gradually**: Replace custom code with SDK usage
4. **Measure Improvement**: Track complexity reduction and development speed

This SDK-first approach achieves the 80-99% complexity reduction demonstrated in Phase 1 analysis, enabling rapid development while maintaining production-grade reliability.