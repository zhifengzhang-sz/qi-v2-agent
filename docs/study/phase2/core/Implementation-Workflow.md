# Phase 2 Implementation Workflow

## Overview

This guide provides step-by-step implementation instructions for building the qi-v2 agent using TypeScript SDKs. Follow this workflow to go from empty project to working agent in 5-7 days.

**Core Principle**: Use official SDKs wherever possible. Custom code only for business logic.

## Prerequisites

- **Bun v1.1.35+** installed
- **Node.js 18+** as fallback
- Basic TypeScript knowledge
- Understanding of Phase 1 findings (SDK-first approach)

## Day 1: Project Foundation

### Step 1.1: Project Setup
```bash
# Create new project
bun create qi-agent-v2
cd qi-agent-v2

# Initialize with TypeScript
bun init -y
```

### Step 1.2: Core Dependencies
```bash
# Essential SDKs (the "3 package imports")
bun add @langchain/langgraph @langchain/ollama @modelcontextprotocol/sdk

# Development tools
bun add -d typescript @types/node biome vitest
```

### Step 1.3: Basic Project Structure
```
src/
├── main.ts          # Entry point
├── config/          # Configuration schemas
├── agents/          # Agent definitions
├── mcp/            # MCP integration
└── ui/             # Terminal interface
```

### Step 1.4: Minimal Working Agent
**File: `src/main.ts`**
```typescript
import { ChatOllama } from '@langchain/ollama';

async function main() {
  console.log('🤖 qi-v2 agent - Starting...');
  
  // Test Ollama connection
  const model = new ChatOllama({
    model: 'llama3.2',
    temperature: 0.1,
  });
  
  const response = await model.invoke([
    { role: 'user', content: 'Hello! Are you working?' }
  ]);
  
  console.log('✅ Agent Response:', response.content);
  console.log('🎉 Foundation working!');
}

main().catch(console.error);
```

### Step 1.5: Validation
```bash
# Test basic setup
bun run src/main.ts

# Expected output:
# 🤖 qi-v2 agent - Starting...
# ✅ Agent Response: Hello! Yes, I'm working correctly.
# 🎉 Foundation working!
```

**✅ Day 1 Complete**: Basic TypeScript project with working LLM connection

---

## Day 2: Agent Architecture

### Step 2.1: Read Decision Guide
**Required Reading**: [SDK Integration Decision Framework](./SDK-integration-decision-framework.md)
- Focus on "SDK-First vs Custom Implementation" section
- Understand when to use SDKs vs custom code

### Step 2.2: LangGraph Agent Setup
**File: `src/agents/core-agent.ts`**
```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOllama } from '@langchain/ollama';

export async function createQiAgent() {
  const model = new ChatOllama({
    model: 'llama3.2',
    temperature: 0.1,
  });

  // Start with no tools - we'll add MCP tools in Day 3
  const agent = createReactAgent({
    llm: model,
    tools: [], // Empty for now
  });

  return agent;
}
```

### Step 2.3: Update Main Entry Point
**File: `src/main.ts`**
```typescript
import { createQiAgent } from './agents/core-agent.js';

async function main() {
  console.log('🤖 qi-v2 agent - Starting...');
  
  const agent = await createQiAgent();
  
  const response = await agent.invoke({
    messages: [{ role: 'user', content: 'Hello! What can you do?' }]
  });
  
  console.log('✅ Agent Response:', response.messages[response.messages.length - 1].content);
  console.log('🎉 LangGraph agent working!');
}

main().catch(console.error);
```

### Step 2.4: Validation
```bash
bun run src/main.ts

# Expected: Agent responds about its capabilities
```

**✅ Day 2 Complete**: LangGraph agent architecture working

---

## Day 3: MCP Integration

### Step 3.1: Read Decision Guide
**Required Reading**: [T4: MCP Integration Decisions](./T4-mcp-integration-decisions.md)
- Choose single-server vs multi-server approach
- Understand SDK vs custom MCP handling

### Step 3.2: MCP Client Setup
**File: `src/mcp/client.ts`**
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export async function createMCPClient(serverConfig: { command: string; args: string[] }) {
  const client = new Client(
    { name: "qi-agent", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
  });

  await client.connect(transport);
  return client;
}

export async function getMCPTools(client: Client) {
  const { tools } = await client.listTools();
  
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    schema: tool.inputSchema,
    func: async (input: any) => {
      const result = await client.callTool({ name: tool.name, arguments: input });
      return result.content;
    }
  }));
}
```

### Step 3.3: Integrate MCP with Agent
**File: `src/agents/core-agent.ts`**
```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOllama } from '@langchain/ollama';
import { createMCPClient, getMCPTools } from '../mcp/client.js';

export async function createQiAgent() {
  const model = new ChatOllama({
    model: 'llama3.2',
    temperature: 0.1,
  });

  // Connect to file server (example)
  const mcpClient = await createMCPClient({
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
  });

  const tools = await getMCPTools(mcpClient);
  
  const agent = createReactAgent({
    llm: model,
    tools,
  });

  return { agent, mcpClient };
}
```

### Step 3.4: Update Main Entry Point
**File: `src/main.ts`**
```typescript
import { createQiAgent } from './agents/core-agent.js';

async function main() {
  console.log('🤖 qi-v2 agent - Starting with MCP...');
  
  const { agent } = await createQiAgent();
  
  const response = await agent.invoke({
    messages: [{ role: 'user', content: 'What tools do you have access to?' }]
  });
  
  console.log('✅ Agent Response:', response.messages[response.messages.length - 1].content);
  console.log('🎉 MCP integration working!');
}

main().catch(console.error);
```

### Step 3.5: Validation
```bash
bun run src/main.ts

# Expected: Agent lists filesystem tools it has access to
```

**✅ Day 3 Complete**: MCP integration with tools working

---

## Day 4: Configuration Management

### Step 4.1: Read Decision Guide
**Required Reading**: [T7: Configuration Decisions](./T7-configuration-decisions.md)
- Choose YAML + Zod approach
- Understand environment variable substitution

### Step 4.2: Configuration Schema
**File: `src/config/schema.ts`**
```typescript
import { z } from 'zod';

export const ConfigSchema = z.object({
  model: z.object({
    name: z.string().default('llama3.2'),
    temperature: z.number().min(0).max(2).default(0.1),
    baseUrl: z.string().optional(),
  }),
  
  mcp: z.object({
    servers: z.record(z.object({
      command: z.string(),
      args: z.array(z.string()),
    })),
  }),
  
  ui: z.object({
    theme: z.enum(['light', 'dark']).default('dark'),
    showTimestamps: z.boolean().default(true),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
```

### Step 4.3: Configuration Loader
**File: `src/config/loader.ts`**
```typescript
import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { ConfigSchema, type Config } from './schema.js';

export function loadConfig(configPath: string = './config.yaml'): Config {
  try {
    const configFile = readFileSync(configPath, 'utf-8');
    const rawConfig = parse(configFile);
    
    // Environment variable substitution
    const processedConfig = substituteEnvVars(rawConfig);
    
    // Validate with Zod
    const config = ConfigSchema.parse(processedConfig);
    
    console.log('✅ Configuration loaded successfully');
    return config;
    
  } catch (error) {
    console.error('❌ Configuration error:', error);
    process.exit(1);
  }
}

function substituteEnvVars(obj: any): any {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => {
      return process.env[varName] || '';
    });
  }
  if (Array.isArray(obj)) {
    return obj.map(substituteEnvVars);
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = substituteEnvVars(value);
    }
    return result;
  }
  return obj;
}
```

### Step 4.4: Configuration File
**File: `config.yaml`**
```yaml
model:
  name: "llama3.2"
  temperature: 0.1
  # baseUrl: "${OLLAMA_BASE_URL}" # Optional override

mcp:
  servers:
    filesystem:
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    
    # Example: Git server
    # git:
    #   command: "npx" 
    #   args: ["-y", "@modelcontextprotocol/server-git"]

ui:
  theme: "dark"
  showTimestamps: true
```

### Step 4.5: Update Agent to Use Config
**File: `src/agents/core-agent.ts`**
```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOllama } from '@langchain/ollama';
import { createMCPClient, getMCPTools } from '../mcp/client.js';
import type { Config } from '../config/schema.js';

export async function createQiAgent(config: Config) {
  const model = new ChatOllama({
    model: config.model.name,
    temperature: config.model.temperature,
    baseUrl: config.model.baseUrl,
  });

  // Connect to all configured MCP servers
  const allTools = [];
  for (const [serverName, serverConfig] of Object.entries(config.mcp.servers)) {
    console.log(`🔌 Connecting to MCP server: ${serverName}`);
    const mcpClient = await createMCPClient(serverConfig);
    const tools = await getMCPTools(mcpClient);
    allTools.push(...tools);
  }

  const agent = createReactAgent({
    llm: model,
    tools: allTools,
  });

  return agent;
}
```

### Step 4.6: Update Main Entry Point
**File: `src/main.ts`**
```typescript
import { loadConfig } from './config/loader.js';
import { createQiAgent } from './agents/core-agent.js';

async function main() {
  console.log('🤖 qi-v2 agent - Loading configuration...');
  
  const config = loadConfig();
  const agent = await createQiAgent(config);
  
  const response = await agent.invoke({
    messages: [{ role: 'user', content: 'Hello! What tools are available?' }]
  });
  
  console.log('✅ Agent Response:', response.messages[response.messages.length - 1].content);
  console.log('🎉 Configuration system working!');
}

main().catch(console.error);
```

### Step 4.7: Add YAML Dependency
```bash
bun add yaml zod
bun add -d @types/yaml
```

### Step 4.8: Validation
```bash
bun run src/main.ts

# Expected: Agent loads config and shows configured tools
```

**✅ Day 4 Complete**: Configuration management with YAML + Zod working

---

## Day 5: Terminal UI

### Step 5.1: Add UI Dependencies
```bash
bun add ink react @inkjs/ui
bun add -d @types/react
```

### Step 5.2: Basic Terminal Interface
**File: `src/ui/app.tsx`**
```typescript
import React, { useState } from 'react';
import { Box, Text, TextInput } from 'ink';

interface AppProps {
  agent: any;
}

export function App({ agent }: AppProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (query: string) => {
    if (!query.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: query }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await agent.invoke({
        messages: [{ role: 'user', content: query }]
      });
      
      const content = response.messages[response.messages.length - 1].content;
      setMessages(prev => [...prev, { role: 'assistant', content }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'error', content: `Error: ${error}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>🤖 qi-v2 agent</Text>
      <Text color="gray">Type your message and press Enter. Ctrl+C to exit.</Text>
      
      <Box flexDirection="column" marginY={1}>
        {messages.map((msg, i) => (
          <Box key={i} marginBottom={1}>
            <Text color={msg.role === 'user' ? 'green' : msg.role === 'error' ? 'red' : 'blue'}>
              {msg.role === 'user' ? '👤' : msg.role === 'error' ? '❌' : '🤖'} {msg.content}
            </Text>
          </Box>
        ))}
        
        {isLoading && <Text color="yellow">🤔 Thinking...</Text>}
      </Box>

      <Box>
        <Text color="cyan">› </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Ask me anything..."
        />
      </Box>
    </Box>
  );
}
```

### Step 5.3: Update Main Entry Point
**File: `src/main.ts`**
```typescript
import React from 'react';
import { render } from 'ink';
import { loadConfig } from './config/loader.js';
import { createQiAgent } from './agents/core-agent.js';
import { App } from './ui/app.js';

async function main() {
  console.log('🤖 qi-v2 agent - Starting...');
  
  const config = loadConfig();
  const agent = await createQiAgent(config);
  
  console.log('✅ Agent ready! Starting UI...');
  
  // Render terminal UI
  render(React.createElement(App, { agent }));
}

main().catch(console.error);
```

### Step 5.4: Validation
```bash
bun run src/main.ts

# Expected: Interactive terminal interface launches
# You can type messages and get responses
```

**✅ Day 5 Complete**: Terminal UI with Ink working

---

## Day 6: Testing & Validation

### Step 6.1: Read Decision Guide
**Required Reading**: [T9: Testing Decisions](./T9-testing-decisions.md)
- Choose standard testing tools (Vitest)
- Understand test pyramid for SDK integration

### Step 6.2: Test Configuration
**File: `vitest.config.ts`**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html']
    }
  }
});
```

### Step 6.3: Configuration Tests
**File: `src/config/loader.test.ts`**
```typescript
import { test, expect, beforeEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { loadConfig } from './loader.js';

const testConfigPath = './test-config.yaml';

beforeEach(() => {
  // Clean up any existing test config
  try {
    unlinkSync(testConfigPath);
  } catch {}
});

test('loads valid configuration', () => {
  const validConfig = `
model:
  name: "test-model"
  temperature: 0.5
mcp:
  servers:
    test:
      command: "echo"
      args: ["hello"]
ui:
  theme: "light"
  showTimestamps: false
`;

  writeFileSync(testConfigPath, validConfig);
  const config = loadConfig(testConfigPath);
  
  expect(config.model.name).toBe('test-model');
  expect(config.model.temperature).toBe(0.5);
  expect(config.ui.theme).toBe('light');
  
  unlinkSync(testConfigPath);
});

test('handles environment variable substitution', () => {
  process.env.TEST_MODEL = 'env-model';
  
  const configWithEnv = `
model:
  name: "\${TEST_MODEL}"
  temperature: 0.1
mcp:
  servers: {}
ui:
  theme: "dark"
  showTimestamps: true
`;

  writeFileSync(testConfigPath, configWithEnv);
  const config = loadConfig(testConfigPath);
  
  expect(config.model.name).toBe('env-model');
  
  unlinkSync(testConfigPath);
  delete process.env.TEST_MODEL;
});
```

### Step 6.4: MCP Integration Tests  
**File: `src/mcp/client.test.ts`**
```typescript
import { test, expect, vi } from 'vitest';
import { getMCPTools } from './client.js';

test('converts MCP tools to LangChain format', async () => {
  // Mock MCP client
  const mockClient = {
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'read_file',
          description: 'Read a file',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
        }
      ]
    }),
    callTool: vi.fn().mockResolvedValue({
      content: 'file content'
    })
  };

  const tools = await getMCPTools(mockClient as any);
  
  expect(tools).toHaveLength(1);
  expect(tools[0].name).toBe('read_file');
  expect(tools[0].description).toBe('Read a file');
  
  // Test tool execution
  const result = await tools[0].func({ path: '/test' });
  expect(result).toBe('file content');
  expect(mockClient.callTool).toHaveBeenCalledWith({
    name: 'read_file',
    arguments: { path: '/test' }
  });
});
```

### Step 6.5: Add Test Scripts
**File: `package.json`** (add to scripts section)
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "biome check src",
    "format": "biome format --write src"
  }
}
```

### Step 6.6: Run Tests
```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage

# Check linting
bun run lint
```

### Step 6.7: Validation
```bash
bun test

# Expected: All tests pass
# Expected: Coverage report generated
```

**✅ Day 6 Complete**: Testing framework with Vitest working

---

## Day 7: Production Ready

### Step 7.1: Read Security Guide
**Required Reading**: [T8: Security Decisions](./T8-security-decisions.md)
- Understand OS-level security approach
- Plan path-based permissions

### Step 7.2: Security Implementation
**File: `src/security/permissions.ts`**
```typescript
import { resolve, relative } from 'path';

export class PathValidator {
  private allowedPaths: string[];
  private deniedPaths: string[];

  constructor(allowedPaths: string[] = [], deniedPaths: string[] = []) {
    this.allowedPaths = allowedPaths.map(p => resolve(p));
    this.deniedPaths = deniedPaths.map(p => resolve(p));
  }

  isPathAllowed(targetPath: string): boolean {
    const resolvedPath = resolve(targetPath);
    
    // Check denied paths first
    for (const deniedPath of this.deniedPaths) {
      if (this.isWithinPath(resolvedPath, deniedPath)) {
        return false;
      }
    }
    
    // Check allowed paths
    for (const allowedPath of this.allowedPaths) {
      if (this.isWithinPath(resolvedPath, allowedPath)) {
        return true;
      }
    }
    
    return false;
  }

  private isWithinPath(targetPath: string, basePath: string): boolean {
    const rel = relative(basePath, targetPath);
    return !rel.startsWith('..') && !resolve(basePath, rel).startsWith('..');
  }
}
```

### Step 7.3: Build Configuration
**File: `build.ts`**
```typescript
#!/usr/bin/env bun

const result = await Bun.build({
  entrypoints: ['./src/main.ts'],
  outdir: './dist',
  target: 'bun',
  splitting: false,
  minify: true,
});

if (!result.success) {
  console.error('❌ Build failed');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log('✅ Build successful');
console.log(`📦 Generated ${result.outputs.length} files`);
```

### Step 7.4: Production Scripts
**File: `package.json`** (update scripts)
```json
{
  "scripts": {
    "dev": "bun --watch src/main.ts",
    "build": "bun run build.ts",
    "start": "bun run dist/main.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "biome check src",
    "format": "biome format --write src",
    "compile": "bun build --compile src/main.ts --outfile qi-agent"
  }
}
```

### Step 7.5: Documentation
**File: `README.md`**
```markdown
# qi-v2 agent

A local AI coding assistant built with TypeScript SDKs.

## Quick Start

```bash
# Install dependencies
bun install

# Copy example config
cp config.example.yaml config.yaml

# Start development
bun run dev
```

## Configuration

Edit `config.yaml` to configure:
- Model settings (name, temperature)
- MCP servers (filesystem, git, etc.)  
- UI preferences (theme, timestamps)

## Production

```bash
# Build for production
bun run build
bun run start

# Create single binary
bun run compile
./qi-agent
```

## Architecture

Built with official TypeScript SDKs:
- **@langchain/langgraph** - Agent architecture
- **@langchain/ollama** - Local LLM integration  
- **@modelcontextprotocol/sdk** - Tool protocol

See `docs/study/phase2/` for implementation details.
```

### Step 7.6: Final Validation
```bash
# Run full test suite
bun run test:coverage

# Check code quality  
bun run lint

# Build production version
bun run build

# Test production build
bun run start

# Create binary
bun run compile
./qi-agent
```

**✅ Day 7 Complete**: Production-ready agent with security, build, and documentation

---

## Implementation Summary

**What You Built:**
- ✅ **Foundation**: TypeScript project with SDK dependencies
- ✅ **Agent**: LangGraph-powered agent with local LLM
- ✅ **Tools**: MCP integration with filesystem and other tools
- ✅ **Config**: YAML configuration with Zod validation
- ✅ **UI**: Interactive terminal interface with Ink
- ✅ **Tests**: Comprehensive test suite with Vitest
- ✅ **Production**: Security, build system, and deployment

**Key Results:**
- **~300 lines of custom code** (vs 1,699+ lines custom implementation)
- **3 main SDK imports** handle the complexity
- **5-7 day implementation** (vs weeks for custom approach)
- **Production-ready** with testing, security, and build system

**Next Steps:**
- Add more MCP servers (git, web browsing, etc.)
- Extend UI with advanced features
- Add monitoring and logging
- Deploy to production environment

This workflow demonstrates the **"3 package imports replace 1,699+ lines"** principle in practice, delivering a fully functional AI coding assistant using official SDKs with minimal custom implementation.