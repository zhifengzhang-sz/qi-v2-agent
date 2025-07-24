# TypeScript Implementation Plan: Qi V2 Agent

## Executive Summary

**Project**: Local AI coding assistant with Claude Code-like functionality using TypeScript and local LLMs.

**Key Breakthrough**: The Phase 1 study revealed that official TypeScript SDKs eliminate ~90% of custom implementation work, reducing development time from 14 weeks to **8-10 days**.

**Architecture**: Simplified 3-layer system leveraging official SDKs instead of custom protocol development.

**Timeline**: Production-ready system in 8-10 days through SDK-first approach.

---

## Phase 1 Study Key Findings

### The SDK Advantage
Our comprehensive analysis of Python implementations showed:
- **Python Reality**: 1,699+ lines of custom protocol code across 7 layers
- **TypeScript Reality**: 3 npm package imports with official SDK support

### Technology Transformation
```bash
# Instead of weeks of custom development:
npm install @langchain/langgraph          # Complete agent orchestration
npm install @modelcontextprotocol/sdk     # Official MCP protocol support  
npm install @langchain/mcp-adapters       # Production-ready integration
```

### Timeline Impact
- **Original Estimate**: 14 weeks for custom implementation
- **Revised Estimate**: 8-10 days with official SDKs
- **Time Savings**: ~90% reduction due to SDK ecosystem maturity

---

## Updated Architecture Overview

### Simplified 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface Layer                     │
│                   (Ink + TypeScript CLI)                        │
│   • Real-time streaming display                                 │
│   • Professional terminal UI components                         │
│   • Interactive command handling                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   Agent Orchestration Layer                     │
│                    (LangGraph.js v0.3.11+)                      │
│   • Built-in checkpointing & debugging                          │
│   • Parallel node execution                                     │
│   • Human-in-the-loop support                                   │
│   • LangGraph Studio integration                                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                      Foundation Layer                           │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│   │ LLM         │ │ RAG System  │ │ MCP         │ │ Config &  │ │
│   │ LangChain + │ │ ChromaDB +  │ │ Multi-Server│ │ Security  │ │
│   │ Ollama      │ │ Semantic    │ │ Integration │ │ Management│ │
│   │             │ │ Search      │ │ (Official)  │ │           │ │
│   └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Key Simplifications**:
- ❌ **Eliminated**: Complex dual-workflow system (LangGraph + n8n)
- ✅ **Unified**: Single LangGraph orchestration with built-in capabilities
- ✅ **Official**: MCP integration via @langchain/mcp-adapters
- ✅ **Modern**: Latest SDK features (checkpointing, parallel execution, Studio integration)

---

## Technology Stack

### Core Dependencies (Production-Ready)

```json
{
  "agents": {
    "@langchain/langgraph": "^0.3.11",
    "@langchain/core": "^0.3.15",
    "@langchain/mcp-adapters": "^0.1.0"
  },
  "mcp": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  },
  "llm": {
    "@langchain/ollama": "^0.1.1"
  },
  "rag": {
    "chromadb": "^1.9.2",
    "@langchain/community": "^0.3.15",
    "@langchain/textsplitters": "^0.1.1"
  },
  "ui": {
    "ink": "^5.0.1",
    "@inkjs/ui": "^2.0.0",
    "react": "^18.3.1"
  },
  "validation": {
    "zod": "^3.23.8"
  },
  "config": {
    "js-yaml": "^4.1.0"
  },
  "tools": {
    "commander": "^12.1.0",
    "chalk": "^5.3.0"
  }
}
```

### Package Highlights

**@langchain/langgraph v0.3.11+**:
- ✅ Built-in checkpointing for debugging and recovery
- ✅ Parallel node execution for improved performance  
- ✅ Human-in-the-loop interactive capabilities
- ✅ Multiple streaming modes (messages, updates, events)
- ✅ LangGraph Studio integration for visual debugging

**@modelcontextprotocol/sdk v0.5.0**:
- ✅ All transport types (stdio, SSE, HTTP, WebSocket)
- ✅ Full TypeScript interfaces for protocol messages
- ✅ Official Anthropic maintenance and updates
- ✅ Production-grade error handling and validation

**@langchain/mcp-adapters**:
- ✅ MultiServerMCPClient for managing multiple MCP servers
- ✅ Automatic tool conversion (MCP → LangChain tools)
- ✅ Configuration-driven server management
- ✅ Battle-tested integration patterns

---

## Implementation Schedule (8-10 Days)

### Phase 1: SDK-First Setup (Days 1-2)

#### Day 1: Project Foundation
**Morning (4 hours)**:
```bash
# Project scaffolding
mkdir qi-v2-agent && cd qi-v2-agent
npm init -y
npm install -D typescript @types/node tsx nodemon

# Core dependencies installation
npm install @langchain/langgraph @langchain/core @langchain/mcp-adapters
npm install @modelcontextprotocol/sdk @langchain/ollama
npm install ink @inkjs/ui react zod js-yaml
```

**Afternoon (4 hours)**:
- TypeScript configuration setup
- Basic project structure creation
- Zod configuration schema definition
- Initial CLI scaffold with Commander

**Evening Deliverable**: Working TypeScript project with all dependencies installed

#### Day 2: Configuration & MCP Setup
**Morning (4 hours)**:
```typescript
// config/schema.ts - Type-safe configuration
import { z } from 'zod';

export const ConfigSchema = z.object({
  mcpServers: z.record(z.object({
    transport: z.enum(['stdio', 'sse', 'http', 'websocket']),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
  })),
  ollama: z.object({
    model: z.string().default('llama3.2'),
    baseUrl: z.string().default('http://localhost:11434'),
  }),
  chromadb: z.object({
    path: z.string().default('./data/chroma'),
  }),
});
```

**Afternoon (4 hours)**:
- MCP server configuration system
- MultiServerMCPClient basic setup
- Ollama connection testing
- ChromaDB initialization

**Evening Deliverable**: Configuration system with MCP connectivity

### Phase 2: Core Agent Implementation (Days 3-4)

#### Day 3: LangGraph Agent Creation
**Morning (4 hours)**:
```typescript
// agent/factory.ts - Agent creation with official SDK
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import { ChatOllama } from '@langchain/ollama';

export class AgentFactory {
  private mcpClient: MultiServerMCPClient;
  private model: ChatOllama;

  async createAgent() {
    // Load tools from MCP servers (automatic conversion)
    const tools = await this.mcpClient.get_tools();
    
    // Create agent with built-in capabilities (1 line vs 485 lines custom)
    return createReactAgent({
      llm: this.model,
      tools: tools,
      checkpointSaver: new MemorySaver(),
      streaming: true
    });
  }
}
```

**Afternoon (4 hours)**:
- MCP tool auto-loading implementation
- Agent streaming response handling
- Basic error handling and recovery
- Tool execution result processing

**Evening Deliverable**: Working agent with MCP tool integration

#### Day 4: RAG & Context Management
**Morning (4 hours)**:
```typescript
// rag/manager.ts - ChromaDB + LangChain RAG integration
import { ChromaDB } from 'chromadb';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export class RAGManager {
  private chroma: ChromaDB;
  private splitter: RecursiveCharacterTextSplitter;

  async indexCodebase(projectPath: string) {
    // Automatic file discovery and indexing
    const files = await this.discoverFiles(projectPath);
    const chunks = await this.splitter.splitDocuments(files);
    
    // Store in ChromaDB with metadata
    await this.chroma.add({
      documents: chunks.map(c => c.pageContent),
      metadatas: chunks.map(c => c.metadata),
      ids: chunks.map((_, i) => `chunk_${i}`)
    });
  }

  async semanticSearch(query: string, limit = 5) {
    return await this.chroma.query({
      queryTexts: [query],
      nResults: limit
    });
  }
}
```

**Afternoon (4 hours)**:
- Context retrieval and relevance scoring
- Token-efficient context assembly
- Conversation memory integration
- Performance optimization for large codebases

**Evening Deliverable**: RAG system with semantic search capabilities

### Phase 3: UI & Security (Days 5-6)

#### Day 5: Ink Terminal Interface
**Morning (4 hours)**:
```typescript
// ui/chat.tsx - Real-time streaming chat interface
import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import { TextInput } from '@inkjs/ui';

export const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);

  const handleUserInput = async (input: string) => {
    setStreaming(true);
    
    // Stream agent responses with real-time updates
    for await (const chunk of agent.stream({ input })) {
      updateMessages(chunk);
    }
    
    setStreaming(false);
  };

  return (
    <Box flexDirection="column">
      <Box flexDirection="column" flexGrow={1}>
        {messages.map(msg => (
          <Text key={msg.id}>{msg.content}</Text>
        ))}
      </Box>
      
      <TextInput 
        placeholder="Ask me anything..."
        onSubmit={handleUserInput}
        isDisabled={streaming}
      />
    </Box>
  );
};
```

**Afternoon (4 hours)**:
- Progress indicators and status displays
- File diff visualization components
- Interactive command palette
- Professional theming and styling

**Evening Deliverable**: Polished terminal UI with streaming responses

#### Day 6: Security Implementation
**Morning (4 hours)**:
```typescript
// security/mcp-validator.ts - 2025 security best practices
export class MCPSecurityManager {
  private trustedServers: Set<string> = new Set();
  private toolPermissions: Map<string, string[]> = new Map();

  async validateServer(serverConfig: MCPServerConfig): Promise<boolean> {
    // Trusted server verification
    if (!this.trustedServers.has(serverConfig.id)) {
      throw new Error(`Untrusted MCP server: ${serverConfig.id}`);
    }

    // Transport security validation
    if (serverConfig.transport === 'http' && !serverConfig.url?.startsWith('https://')) {
      throw new Error('HTTP transport requires HTTPS for security');
    }

    return true;
  }

  sanitizeInput(input: string): string {
    // Prompt injection protection
    return input.replace(/```[\s\S]*?```/g, '[CODE_BLOCK]')
                .replace(/<\|.*?\|>/g, '[SPECIAL_TOKEN]');
  }

  validateToolExecution(toolName: string, args: any): boolean {
    // Tool permission scoping
    const allowedTools = this.toolPermissions.get('user') || [];
    return allowedTools.includes(toolName);
  }
}
```

**Afternoon (4 hours)**:
- Audit logging for all tool calls
- Input sanitization and validation
- Tool permission management UI
- Security configuration options

**Evening Deliverable**: Security-hardened system with comprehensive protections

### Phase 4: Production Ready (Days 7-8)

#### Day 7: Testing & Performance
**Morning (4 hours)**:
```typescript
// tests/integration.test.ts - Comprehensive testing
import { describe, it, expect } from 'jest';
import { AgentFactory } from '../agent/factory';

describe('Agent Integration Tests', () => {
  it('should create agent with MCP tools', async () => {
    const factory = new AgentFactory();
    const agent = await factory.createAgent();
    
    expect(agent).toBeDefined();
    expect(await agent.getTools()).toHaveLength(0); // Adjust based on MCP servers
  });

  it('should handle streaming responses', async () => {
    const responses = [];
    for await (const chunk of agent.stream({ input: 'Hello' })) {
      responses.push(chunk);
    }
    
    expect(responses.length).toBeGreaterThan(0);
  });
});
```

**Afternoon (4 hours)**:
- Performance optimization and profiling
- Memory usage optimization
- Parallel execution testing
- Load testing with multiple conversations

**Evening Deliverable**: Fully tested system with performance optimization

#### Day 8: Documentation & Deployment
**Morning (4 hours)**:
- README with installation and usage instructions
- Configuration guide with examples
- Troubleshooting documentation
- API documentation generation

**Afternoon (4 hours)**:
```json
// package.json - Distribution setup
{
  "name": "qi-v2-agent",
  "version": "1.0.0",
  "bin": {
    "qi": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsx build",
    "start": "node dist/cli.js",
    "dev": "tsx src/cli.ts"
  },
  "pkg": {
    "targets": ["node18-linux-x64", "node18-macos-x64", "node18-win-x64"],
    "outputPath": "dist/binaries"
  }
}
```

- Package build and distribution setup
- Binary compilation for multiple platforms
- Installation automation scripts
- Release preparation and testing

**Evening Deliverable**: Production-ready system with distribution packages

---

## Core Implementation Patterns

### 1. Agent Factory Pattern
```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

export class QiAgentFactory {
  async createAgent(config: QiConfig) {
    // MCP integration with automatic tool loading
    const mcpClient = new MultiServerMCPClient({
      mcpServers: config.mcpServers
    });
    
    const tools = await mcpClient.get_tools();
    
    // Agent creation (official SDK - 1 line vs 485 custom lines)
    return createReactAgent({
      llm: new ChatOllama({ model: config.ollama.model }),
      tools: tools,
      checkpointSaver: new MemorySaver(),
      streaming: true
    });
  }
}
```

### 2. MCP Multi-Server Management
```typescript
const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    "filesystem": {
      transport: "stdio",
      command: "node",
      args: ["./servers/fs-server.js"]
    },
    "web-search": {
      transport: "sse",
      url: "http://localhost:8000/mcp"
    },
    "git": {
      transport: "stdio", 
      command: "python",
      args: ["-m", "git_mcp_server"]
    }
  }
});

// Automatic tool conversion and loading
const tools = await mcpClient.get_tools();
console.log(`Loaded ${tools.length} tools from ${Object.keys(config.mcpServers).length} servers`);
```

### 3. Streaming Response Management
```typescript
export class StreamingManager {
  async handleAgentStream(agent: LangGraphAgent, input: string) {
    const responses: AgentResponse[] = [];
    
    // Multiple streaming modes available
    for await (const chunk of agent.stream(
      { messages: [{ role: 'user', content: input }] },
      { streamMode: 'values' } // or 'updates', 'debug'
    )) {
      // Real-time UI updates
      this.updateTerminalDisplay(chunk);
      responses.push(chunk);
    }
    
    return responses;
  }
}
```

### 4. RAG Integration Pattern
```typescript
export class QiRAGSystem {
  constructor(
    private chroma: ChromaDB,
    private splitter: RecursiveCharacterTextSplitter
  ) {}

  async enhanceAgentWithRAG(agent: LangGraphAgent, query: string) {
    // Semantic search for relevant context
    const relevantDocs = await this.chroma.query({
      queryTexts: [query],
      nResults: 5
    });
    
    // Context injection
    const enhancedQuery = `
Context: ${relevantDocs.documents.join('\n')}

User Query: ${query}
`;
    
    return agent.stream({ messages: [{ role: 'user', content: enhancedQuery }] });
  }
}
```

---

## Security Implementation (2025 Best Practices)

### MCP Security Framework
```typescript
export class MCPSecurityFramework {
  private auditLogger = new AuditLogger();
  private inputSanitizer = new InputSanitizer();
  private permissionManager = new PermissionManager();

  async secureToolExecution(toolName: string, args: any, userId: string) {
    // 1. Input sanitization (prompt injection protection)
    const sanitizedArgs = this.inputSanitizer.sanitize(args);
    
    // 2. Permission validation
    if (!this.permissionManager.canExecute(userId, toolName)) {
      throw new SecurityError(`User ${userId} lacks permission for tool ${toolName}`);
    }
    
    // 3. Audit logging
    this.auditLogger.log({
      event: 'tool_execution',
      user: userId,
      tool: toolName,
      args: sanitizedArgs,
      timestamp: new Date()
    });
    
    // 4. Execute with monitoring
    return await this.executeWithTimeout(toolName, sanitizedArgs);
  }
}
```

### Trusted Server Verification
```typescript
export class TrustedServerManager {
  private trustedFingerprints: Map<string, string> = new Map();

  async verifyServerTrust(serverConfig: MCPServerConfig): Promise<boolean> {
    if (serverConfig.transport === 'stdio') {
      // Verify executable signature/hash
      const executableHash = await this.computeFileHash(serverConfig.command);
      const trustedHash = this.trustedFingerprints.get(serverConfig.command);
      
      if (executableHash !== trustedHash) {
        throw new SecurityError(`Untrusted MCP server executable: ${serverConfig.command}`);
      }
    }
    
    if (serverConfig.transport === 'http' || serverConfig.transport === 'sse') {
      // Require HTTPS for remote connections
      if (!serverConfig.url?.startsWith('https://')) {
        throw new SecurityError('Remote MCP servers must use HTTPS');
      }
      
      // Verify SSL certificate
      await this.verifyCertificate(serverConfig.url);
    }
    
    return true;
  }
}
```

---

## Testing Strategy

### Unit Testing
```typescript
// tests/unit/agent.test.ts
import { QiAgentFactory } from '../../src/agent/factory';

describe('QiAgentFactory', () => {
  it('creates agent with correct configuration', async () => {
    const config = { /* test config */ };
    const factory = new QiAgentFactory();
    const agent = await factory.createAgent(config);
    
    expect(agent).toBeDefined();
    expect(agent.tools).toHaveLength(0); // Adjust based on test MCP servers
  });
});
```

### Integration Testing
```typescript
// tests/integration/mcp.test.ts
describe('MCP Integration', () => {
  it('loads tools from multiple servers', async () => {
    const mcpClient = new MultiServerMCPClient(testConfig);
    const tools = await mcpClient.get_tools();
    
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some(t => t.name === 'filesystem_read')).toBe(true);
  });
});
```

### End-to-End Testing
```typescript
// tests/e2e/cli.test.ts
describe('CLI End-to-End', () => {
  it('handles complete conversation flow', async () => {
    const cli = new QiCLI();
    const response = await cli.processInput('Create a simple TypeScript function');
    
    expect(response).toContain('function');
    expect(response).toContain('TypeScript');
  });
});
```

---

## Deployment & Distribution

### Build Configuration
```typescript
// build.config.ts
export default {
  entries: ['src/cli.ts'],
  outDir: 'dist',
  target: 'node18',
  format: 'esm',
  platform: 'node',
  bundle: true,
  minify: false, // Keep readable for debugging
  sourcemap: true,
  external: ['chromadb'] // Keep as external dependency
};
```

### Package Distribution
```json
{
  "scripts": {
    "build": "tsx build",
    "build:binary": "pkg dist/cli.js --targets node18-linux-x64,node18-macos-x64,node18-win-x64 --out-dir binaries",
    "publish": "npm publish --access public"
  },
  "files": [
    "dist/**/*",
    "README.md",
    "LICENSE"
  ]
}
```

### Installation Automation
```bash
#!/bin/bash
# install.sh - Automated setup script

echo "🚀 Installing Qi V2 Agent..."

# Install Node.js dependencies
npm install -g qi-v2-agent

# Setup Ollama
if ! command -v ollama &> /dev/null; then
    echo "📦 Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
fi

# Download default model
echo "🧠 Downloading default model..."
ollama pull llama3.2

# Create default configuration
mkdir -p ~/.config/qi
cat > ~/.config/qi/config.yaml << EOF
mcpServers:
  filesystem:
    transport: stdio
    command: node
    args: ["@modelcontextprotocol/server-filesystem/dist/index.js"]
  
ollama:
  model: llama3.2
  baseUrl: http://localhost:11434
  
chromadb:
  path: ~/.local/share/qi/chroma
EOF

echo "✅ Installation complete! Run 'qi' to start."
```

---

## Success Metrics

### Development Success
- ✅ **Timeline**: 8-10 days from start to production-ready
- ✅ **Code Reduction**: 90% less custom code vs Python approach
- ✅ **SDK Integration**: All major components use official packages
- ✅ **Type Safety**: 100% TypeScript with strict mode

### Technical Performance
- ✅ **Response Time**: < 2 seconds for initial response
- ✅ **Streaming Latency**: < 200ms for stream chunks
- ✅ **Memory Usage**: < 1GB during normal operation
- ✅ **Startup Time**: < 5 seconds including model loading

### User Experience
- ✅ **Setup Time**: < 10 minutes with automated installer
- ✅ **Learning Curve**: < 1 hour for basic usage
- ✅ **UI Quality**: Professional terminal interface matching Claude Code
- ✅ **Reliability**: 99% uptime in local environment

---

## Risk Assessment (Updated)

### Technical Risks - SIGNIFICANTLY REDUCED

| Risk | Original Level | New Level | Mitigation |
|------|----------------|-----------|------------|
| **Protocol Development** | HIGH | **ELIMINATED** | Official SDKs handle all protocols |
| **Integration Complexity** | MEDIUM | **LOW** | @langchain/mcp-adapters provides seamless integration |
| **Performance Issues** | MEDIUM | **LOW** | SDK optimizations and parallel execution |
| **Security Vulnerabilities** | HIGH | **LOW** | 2025 security framework implementation |

### Timeline Risks - DRAMATICALLY REDUCED

| Risk | Original Level | New Level | Mitigation |
|------|----------------|-----------|------------|
| **Learning Curve** | HIGH | **LOW** | SDK documentation and examples |
| **Integration Debugging** | HIGH | **LOW** | Official support and community |
| **Feature Completeness** | MEDIUM | **LOW** | SDK provides most features out-of-box |

---

## Phase 1 Study Reference

This implementation plan is based on the comprehensive Phase 1 study findings documented in:
- `docs/study/phase1/T0-conceptual-overview.md` - Fundamental concepts and SDK advantages
- `docs/study/phase1/README.md` - Executive summary and technology maturity assessment
- `docs/study/phase1/architecture-analysis.md` - Visual proof of complexity reduction

**Key Study Conclusions**:
1. TypeScript SDK ecosystem eliminates ~90% of custom implementation work
2. Official packages provide production-ready, battle-tested solutions
3. Development timeline compressed from 14 weeks to 8-10 days
4. Focus shifts from protocol development to business logic and user experience

---

## Conclusion

This TypeScript implementation plan leverages the full power of the modern SDK ecosystem to deliver a production-ready AI coding assistant in 8-10 days. By using official packages for LangGraph, MCP, and related technologies, we eliminate the complexity of custom protocol development while gaining access to enterprise-grade features and ongoing support.

The plan provides a clear, executable roadmap that any TypeScript developer can follow to build a sophisticated AI agent system with professional-quality UI, comprehensive security, and robust performance.

**Next Steps**: Begin implementation with Day 1 setup, following the detailed schedule and code examples provided in this plan.