# @qi/agent

Agent capabilities package with AutoGen/AgentChat abstractions, professional context engineering, and comprehensive tool management.

## Overview

@qi/agent provides advanced agent capabilities through clean abstractions over Microsoft's AutoGen and AgentChat frameworks. It features professional-grade context engineering, comprehensive tool management, and seamless integration with QiCore foundation packages (@qi/cli, @qi/amsg).

## Four-Module Architecture

### 🧠 Context Engineering
Professional context optimization with advanced prompt engineering capabilities:
- **Token Management**: Smart optimization, relevance scoring, precise token counting
- **RAG Integration**: Knowledge retrieval with Chroma MCP integration
- **Cache Strategies**: KV-cache optimization, append-only patterns for performance
- **Dynamic Adaptation**: Task-based context selection and real-time optimization

### 🔄 Workflow Engine (AutoGen Abstraction)  
Multi-agent workflow orchestration with intelligent planning:
- **AutoGen Integration**: Clean abstraction over Microsoft AutoGen framework
- **Planning Strategies**: ReAct, ReWOO, and ADaPT reasoning patterns
- **Agent Coordination**: Multi-agent task distribution and collaboration
- **Workflow Management**: State tracking, progress monitoring, error recovery

### 🤖 Sub-Agent (AgentChat Abstraction)
Single-agent task execution with conversation management:
- **AgentChat Integration**: Clean abstraction over Microsoft AgentChat framework
- **Tool Coordination**: Seamless tool execution and management
- **Conversation Management**: Dialog state, context maintenance
- **Specialization**: Domain-specific agents (FileOps, Web, Git operations)

### 🛠️ Tools
Comprehensive tool execution and MCP integration:
- **Tool Registry**: Discovery, registration, and lifecycle management
- **MCP Integration**: Model Context Protocol server connectivity
- **Execution Engine**: Safe tool execution with validation and error handling
- **Metrics & Monitoring**: Performance tracking and usage analytics

## Installation

```bash
npm install @qi/agent
# or
bun add @qi/agent
```

### Peer Dependencies
Requires QiCore foundation packages:
```bash
npm install @qi/base @qi/core @qi/cli @qi/amsg
```

## Usage

### Basic Agent Setup
```typescript
import { 
  createContextEngineering, 
  createWorkflowEngine, 
  createSubAgent,
  createToolRegistry 
} from '@qi/agent';

// Initialize agent capabilities
const contextEngineering = createContextEngineering({
  maxTokens: 4000,
  enableRAG: true
});

const workflowEngine = createWorkflowEngine({
  defaultStrategy: 'react',
  maxAgentsPerWorkflow: 5
});

const subAgent = createSubAgent({
  enableToolCoordination: true
});

const toolRegistry = createToolRegistry({
  enableMCP: true,
  mcpServers: [
    { endpoint: 'chroma://localhost:8000', name: 'knowledge' }
  ]
});
```

### Context Engineering
```typescript
import { createContextEngineering } from '@qi/agent/context-engineering';

const contextEngine = createContextEngineering({
  maxTokens: 4000,
  relevanceThreshold: 0.7,
  enableRAG: true
});

// Optimize context for token efficiency
const optimized = await contextEngine.optimizeContext({
  content: longText,
  maxTokens: 2000,
  contextType: 'code'
});

// Calculate precise token counts
const tokenCount = contextEngine.calculateTokenCount(text, 'gpt-4');

// Score relevance between text and query
const relevance = contextEngine.scoreRelevance(text, query);
```

### Workflow Engine (AutoGen)
```typescript
import { createWorkflowEngine } from '@qi/agent/workflow-engine';

const workflowEngine = createWorkflowEngine({
  defaultStrategy: 'react',
  maxAgentsPerWorkflow: 3
});

// Execute complex multi-agent workflow
const task = {
  id: 'analysis-task',
  description: 'Analyze codebase and suggest improvements',
  context: projectContext,
  priority: 'high'
};

// Streaming execution with progress updates
for await (const progress of workflowEngine.executeWorkflow(task)) {
  console.log(`Progress: ${progress.progress * 100}%`);
  console.log(`Current step: ${progress.message}`);
}
```

### Sub-Agent (AgentChat)
```typescript
import { createSubAgent } from '@qi/agent/sub-agent';

const subAgent = createSubAgent({
  maxConversationTurns: 10,
  enableToolCoordination: true
});

// Execute single-agent task
const result = await subAgent.executeTask({
  id: 'file-analysis',
  type: 'code-review',
  description: 'Review this TypeScript file for issues',
  context: fileContent
});

// Handle conversation
const response = await subAgent.handleConversation(
  'Can you explain the main function in this code?',
  contextId
);
```

### Tool Management
```typescript
import { createToolRegistry } from '@qi/agent/tools';

const toolRegistry = createToolRegistry({
  enableMCP: true,
  mcpServers: [
    { endpoint: 'filesystem://tools', name: 'fs-tools' },
    { endpoint: 'web://search', name: 'web-tools' }
  ]
});

// Discover available tools
const discovery = await toolRegistry.discoverMCPTools();
console.log(`Found ${discovery.totalTools} tools`);

// Execute tool
const result = await toolRegistry.executeTool({
  toolId: 'file-read',
  parameters: { path: '/path/to/file.ts' }
});
```

## Integration with QiCore

### Message-Driven Architecture
```typescript
import { QiAsyncMessageQueue } from '@qi/amsg';
import { createCLI } from '@qi/cli';
import { AgentCoordinator } from '@qi/agent';

// Integration with QiCore messaging
const messageQueue = new QiAsyncMessageQueue();
const cli = createCLI({ framework: 'hybrid', messageQueue });

const agent = new AgentCoordinator({
  enableContextEngineering: true,
  enableWorkflowEngine: true,
  enableSubAgent: true,
  enableTools: true
});

// Process messages with agent capabilities
for await (const message of messageQueue) {
  const result = await agent.processMessage(message);
  cli.displayMessage(result.content);
}
```

## Module Exports

### Context Engineering
```typescript
import {
  IContextEngineering,
  createContextEngineering,
  ContextOptimizationRequest,
  RAGRequest
} from '@qi/agent/context-engineering';
```

### Workflow Engine  
```typescript
import {
  IWorkflowEngine,
  createWorkflowEngine,
  WorkflowTask,
  WorkflowPlan
} from '@qi/agent/workflow-engine';
```

### Sub-Agent
```typescript
import {
  ISubAgent,
  createSubAgent,
  createFileOpsAgent,
  createWebAgent
} from '@qi/agent/sub-agent';
```

### Tools
```typescript
import {
  IToolRegistry,
  createToolRegistry,
  createMCPIntegration,
  Tool
} from '@qi/agent/tools';
```

## Configuration

### AutoGen Integration
```typescript
const workflowEngine = createWorkflowEngine({
  autoGenConfig: {
    endpoint: 'https://api.autogen.example.com',
    apiKey: process.env.AUTOGEN_API_KEY,
    model: 'gpt-4'
  }
});
```

### AgentChat Integration
```typescript
const subAgent = createSubAgent({
  agentChatConfig: {
    endpoint: 'https://api.agentchat.example.com',
    apiKey: process.env.AGENTCHAT_API_KEY,
    model: 'gpt-4'
  }
});
```

## Architecture Benefits

### Clean Abstractions
- **Version Independence**: AutoGen/AgentChat updates don't break applications
- **Framework Agnostic**: Can support other agent frameworks in future
- **Consistent APIs**: All modules follow QiCore Result<T> patterns

### Professional Features
- **Context Engineering**: Advanced prompt optimization not available elsewhere
- **Message Integration**: Seamless integration with @qi/amsg async messaging
- **Tool Coordination**: Comprehensive MCP protocol support
- **Error Handling**: Production-grade error handling and recovery

### QiCore Integration
- **Result<T> Patterns**: Functional error handling throughout
- **Structured Logging**: Professional logging with context
- **Configuration Management**: Standard Qi configuration patterns

## Version

**Current**: v-0.1.0-alpha.1 - @qi/agent Package Architecture (Interfaces Only)

### Features
- ✅ Four-module architecture (context-engineering, workflow-engine, sub-agent, tools)
- ✅ AutoGen and AgentChat abstractions with clean interfaces
- ✅ Professional context engineering interface definitions
- ✅ Comprehensive tool management with MCP protocol interfaces
- ⚠️ QiCore foundation package integration planned (@qi/cli, @qi/amsg need extraction)

### Limitations (v-0.1.0-alpha.1)
- Interface definitions only, no implementations
- Missing @qi/cli and @qi/amsg packages
- Cannot be used until QiCore migration complete

## Status

@qi/agent package with four-module architecture and clean abstractions over AutoGen/AgentChat frameworks.