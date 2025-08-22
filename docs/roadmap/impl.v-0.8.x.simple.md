# qi-v2-agent v0.8.x Simple Implementation Guide

**Document Version**: 1.0  
**Date**: 2025-01-17  
**Status**: Implementation Ready  
**Philosophy**: Practical value over architectural complexity

## Executive Summary

This guide provides a **simple, practical approach** to enhancing qi-v2-agent v0.8.x. Instead of building 8 complex modules, we focus on **4 core enhancements** that deliver immediate value while maintaining the existing architecture.

### Key Principles
- **Enhance existing files** rather than creating parallel systems
- **Multi-provider support** (Ollama, OpenRouter, etc.) not just Ollama
- **Incremental improvement** without breaking qi-prompt functionality
- **2-3 week timeline** with concrete deliverables

## Core Enhancements Overview

### Enhancement 1: Session Persistence (State Management)
**Goal**: Remember conversations and context across qi-prompt restarts
**Files**: Extend existing `lib/src/state/StateManager.ts`
**Timeline**: 3-4 days

### Enhancement 2: Multi-Provider Model Support
**Goal**: Seamlessly work with Ollama, OpenRouter, and other providers
**Files**: Enhance existing prompt system in `app/src/prompt/`
**Timeline**: 4-5 days

### Enhancement 3: Context Optimization
**Goal**: Handle large contexts without hitting token limits
**Files**: Extend existing `lib/src/context/ContextManager.ts`
**Timeline**: 2-3 days

### Enhancement 4: Essential MCP Integration
**Goal**: Connect to key MCP services (RAG, Web, Memory)
**Files**: Add MCP capabilities to existing tool system
**Timeline**: 5-6 days

## Enhancement 1: Session Persistence

### Current State
- `lib/src/state/StateManager.ts` - Basic state management
- `lib/src/state/StatePersistence.ts` - Session persistence foundation
- Sessions don't persist across qi-prompt restarts

### Implementation Plan

#### Step 1.1: Extend IStateManager Interface
```typescript
// lib/src/state/abstractions/IStateManager.ts
export interface IStateManager {
  // ... existing methods
  
  // Add session persistence
  persistSession(sessionId: string, data: SessionData): Promise<void>;
  loadSession(sessionId: string): Promise<SessionData | null>;
  listSessions(): Promise<SessionSummary[]>;
  
  // Add context memory
  setContextMemory(key: string, value: any): void;
  getContextMemory(key: string): any;
  clearOldContextMemory(maxAge: number): void;
}

export interface SessionData {
  id: string;
  startTime: Date;
  lastActivity: Date;
  messages: ConversationEntry[];
  context: Record<string, any>;
  summary?: string;
}

export interface SessionSummary {
  id: string;
  startTime: Date;
  lastActivity: Date;
  messageCount: number;
  summary: string;
}
```

#### Step 1.2: Implement Enhanced StateManager
```typescript
// lib/src/state/StateManager.ts
export class StateManager implements IStateManager {
  private sessionStorage: Map<string, SessionData> = new Map();
  private contextMemory: Map<string, any> = new Map();
  private dbPath: string;
  
  constructor(config: StateManagerConfig) {
    // ... existing constructor
    this.dbPath = config.sessionDbPath || './data/sessions.db';
    this.initializeSessionDb();
  }
  
  async persistSession(sessionId: string, data: SessionData): Promise<void> {
    // Store in memory
    this.sessionStorage.set(sessionId, data);
    
    // Persist to SQLite
    await this.saveSessionToDb(sessionId, data);
  }
  
  async loadSession(sessionId: string): Promise<SessionData | null> {
    // Check memory first
    if (this.sessionStorage.has(sessionId)) {
      return this.sessionStorage.get(sessionId)!;
    }
    
    // Load from database
    const session = await this.loadSessionFromDb(sessionId);
    if (session) {
      this.sessionStorage.set(sessionId, session);
    }
    return session;
  }
  
  // ... implement other methods
}
```

#### Step 1.3: Database Schema
```sql
-- lib/src/state/sql/sessions_schema.sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  start_time DATETIME NOT NULL,
  last_activity DATETIME NOT NULL,
  message_count INTEGER DEFAULT 0,
  session_data TEXT NOT NULL,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);
CREATE INDEX idx_sessions_start_time ON sessions(start_time);
```

#### Step 1.4: Integration with qi-prompt
```typescript
// app/src/prompt/qi-prompt.ts
// Add session management to existing qi-prompt functionality
class QiPrompt {
  private sessionId: string;
  private stateManager: StateManager;
  
  async initialize() {
    // ... existing initialization
    
    // Load or create session
    this.sessionId = this.generateSessionId();
    const existingSession = await this.stateManager.loadSession(this.sessionId);
    
    if (existingSession) {
      console.log(`Restored session ${this.sessionId} with ${existingSession.messages.length} messages`);
      this.restoreContext(existingSession);
    }
  }
  
  async handleMessage(message: string): Promise<string> {
    // ... existing message handling
    
    // Persist session after each interaction
    await this.persistCurrentSession();
    
    return response;
  }
}
```

### Verification Criteria
- [ ] Sessions persist across qi-prompt restarts
- [ ] Can load previous conversation history
- [ ] Session data includes messages and context
- [ ] Database queries complete in <100ms
- [ ] Memory usage stays reasonable (<50MB for session data)

## Enhancement 2: Multi-Provider Model Support

### Current State
- Prompt system primarily designed for single provider
- Limited flexibility in model selection
- Hard-coded provider assumptions

### Implementation Plan

#### Step 2.1: Provider Abstraction
```typescript
// lib/src/models/abstractions/IModelProvider.ts
export interface IModelProvider {
  readonly name: string;
  readonly type: 'local' | 'remote';
  
  isAvailable(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
  invoke(request: ModelRequest): Promise<ModelResponse>;
  streamInvoke(request: ModelRequest): AsyncIterable<ModelChunk>;
}

export interface ModelRequest {
  model?: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface ModelResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}
```

#### Step 2.2: Ollama Provider
```typescript
// lib/src/models/providers/OllamaProvider.ts
export class OllamaProvider implements IModelProvider {
  readonly name = 'ollama';
  readonly type = 'local' as const;
  
  constructor(private baseUrl: string = 'http://localhost:11434') {}
  
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || 'llama3.2:3b',
        prompt: request.prompt,
        system: request.system,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
          stop: request.stop
        }
      })
    });
    
    const data = await response.json();
    
    return {
      content: data.response,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      },
      model: request.model || 'llama3.2:3b',
      provider: 'ollama'
    };
  }
}
```

#### Step 2.3: OpenRouter Provider
```typescript
// lib/src/models/providers/OpenRouterProvider.ts
export class OpenRouterProvider implements IModelProvider {
  readonly name = 'openrouter';
  readonly type = 'remote' as const;
  
  constructor(private apiKey: string, private baseUrl: string = 'https://openrouter.ai/api/v1') {}
  
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
  
  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://qi-v2-agent.dev',
        'X-Title': 'qi-v2-agent'
      },
      body: JSON.stringify({
        model: request.model || 'anthropic/claude-3.5-haiku',
        messages: [
          ...(request.system ? [{ role: 'system', content: request.system }] : []),
          { role: 'user', content: request.prompt }
        ],
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stop: request.stop
      })
    });
    
    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      },
      model: data.model,
      provider: 'openrouter'
    };
  }
}
```

#### Step 2.4: Provider Manager
```typescript
// lib/src/models/ProviderManager.ts
export class ProviderManager {
  private providers: Map<string, IModelProvider> = new Map();
  private preferences: string[] = ['ollama', 'openrouter'];
  
  registerProvider(provider: IModelProvider): void {
    this.providers.set(provider.name, provider);
  }
  
  async getAvailableProvider(): Promise<IModelProvider | null> {
    for (const providerName of this.preferences) {
      const provider = this.providers.get(providerName);
      if (provider && await provider.isAvailable()) {
        return provider;
      }
    }
    return null;
  }
  
  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const provider = await this.getAvailableProvider();
    if (!provider) {
      throw new Error('No available model providers');
    }
    
    return provider.invoke(request);
  }
}
```

#### Step 2.5: Integration with qi-prompt
```typescript
// app/src/prompt/qi-prompt.ts
// Enhance existing qi-prompt to use ProviderManager
export class QiPrompt {
  private providerManager: ProviderManager;
  
  constructor() {
    this.providerManager = new ProviderManager();
    
    // Register providers
    this.providerManager.registerProvider(new OllamaProvider());
    
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      this.providerManager.registerProvider(new OpenRouterProvider(openrouterKey));
    }
  }
  
  async generateResponse(prompt: string): Promise<string> {
    const response = await this.providerManager.invoke({
      prompt,
      system: this.getSystemPrompt(),
      temperature: 0.7,
      maxTokens: 4000
    });
    
    return response.content;
  }
}
```

### Verification Criteria
- [ ] Works with Ollama when available
- [ ] Falls back to OpenRouter when Ollama unavailable
- [ ] Same prompt produces consistent results across providers
- [ ] Provider switching is automatic and transparent
- [ ] Easy to add new providers

## Enhancement 3: Context Optimization

### Current State
- Context can grow very large during conversations
- No automatic pruning or optimization
- Risk of hitting token limits

### Implementation Plan

#### Step 3.1: Extend IContextManager
```typescript
// lib/src/context/abstractions/IContextManager.ts
export interface IContextManager {
  // ... existing methods
  
  // Add optimization capabilities
  optimizeContext(context: string, maxTokens: number): Promise<string>;
  calculateTokenCount(text: string): number;
  scoreRelevance(text: string, query: string): number;
  pruneOldContext(context: string, maxAge: number): Promise<string>;
}
```

#### Step 3.2: Simple Context Optimizer
```typescript
// lib/src/context/ContextOptimizer.ts
export class ContextOptimizer {
  private readonly maxTokensDefault = 16000;
  
  async optimizeContext(context: string, maxTokens: number = this.maxTokensDefault): Promise<string> {
    const currentTokens = this.calculateTokenCount(context);
    
    if (currentTokens <= maxTokens) {
      return context;
    }
    
    // Split context into sections
    const sections = this.splitIntoSections(context);
    
    // Score each section for relevance
    const scoredSections = sections.map(section => ({
      content: section,
      score: this.scoreSection(section),
      tokens: this.calculateTokenCount(section)
    }));
    
    // Sort by score (highest first)
    scoredSections.sort((a, b) => b.score - a.score);
    
    // Build optimized context within token limit
    let optimizedContext = '';
    let tokenCount = 0;
    
    for (const section of scoredSections) {
      if (tokenCount + section.tokens <= maxTokens) {
        optimizedContext += section.content + '\n';
        tokenCount += section.tokens;
      }
    }
    
    return optimizedContext.trim();
  }
  
  calculateTokenCount(text: string): number {
    // Simple approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
  
  private scoreSection(section: string): number {
    let score = 0;
    
    // Recency bonus (sections later in text are more recent)
    score += 0.3;
    
    // Length penalty (very short sections are less useful)
    if (section.length < 50) score -= 0.2;
    
    // Code/structured content bonus
    if (this.hasCodeOrStructure(section)) score += 0.4;
    
    // Question/answer pattern bonus
    if (this.hasQAPattern(section)) score += 0.3;
    
    // Error/warning content bonus
    if (this.hasErrorContent(section)) score += 0.2;
    
    return Math.max(0, score);
  }
  
  private hasCodeOrStructure(text: string): boolean {
    return /```|function|class|import|export|\{|\[/.test(text);
  }
  
  private hasQAPattern(text: string): boolean {
    return /\?|Q:|A:|Question:|Answer:/.test(text);
  }
  
  private hasErrorContent(text: string): boolean {
    return /error|warning|exception|failed|issue/.test(text.toLowerCase());
  }
}
```

#### Step 3.3: Integration with ContextManager
```typescript
// lib/src/context/ContextManager.ts
export class ContextManager implements IContextManager {
  private optimizer: ContextOptimizer;
  
  constructor() {
    // ... existing constructor
    this.optimizer = new ContextOptimizer();
  }
  
  async optimizeContext(context: string, maxTokens: number): Promise<string> {
    return this.optimizer.optimizeContext(context, maxTokens);
  }
  
  calculateTokenCount(text: string): number {
    return this.optimizer.calculateTokenCount(text);
  }
  
  // ... other methods
}
```

#### Step 3.4: Integration with qi-prompt
```typescript
// app/src/prompt/qi-prompt.ts
export class QiPrompt {
  async buildPromptContext(userMessage: string): Promise<string> {
    // Build full context
    let context = this.buildInitialContext();
    context += this.getConversationHistory();
    context += `\nUser: ${userMessage}`;
    
    // Optimize if too large
    const maxTokens = this.getMaxTokensForProvider();
    const optimizedContext = await this.contextManager.optimizeContext(context, maxTokens);
    
    return optimizedContext;
  }
  
  private getMaxTokensForProvider(): number {
    // Different providers have different limits
    const provider = this.getCurrentProvider();
    
    switch (provider) {
      case 'ollama': return 8000;  // Conservative for local models
      case 'openrouter': return 32000; // Varies by model
      default: return 16000;
    }
  }
}
```

### Verification Criteria
- [ ] Large contexts get pruned to fit token limits
- [ ] Important content (code, errors, Q&A) is preserved
- [ ] Optimization completes in <500ms for 32k context
- [ ] Pruned context maintains conversation coherence
- [ ] Token counting is reasonably accurate

## Enhancement 4: Essential MCP Integration

### Current State
- No MCP (Model Context Protocol) integration
- Missing RAG capabilities
- No external service connections

### Implementation Plan

#### Step 4.1: MCP Service Manager (Use SDK Directly)
**IMPORTANT**: Do NOT create MCP client wrapper classes. Use the SDK's `Client` class directly.

```typescript
// lib/src/mcp/MCPServiceManager.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Result, QiError } from '@qi/base';
import { success, failure, create } from '@qi/base';

export interface MCPServiceConfig {
  name: string;
  command: string[];
  environment?: Record<string, string>;
  autoConnect?: boolean;
}

export interface MCPServiceConnection {
  client: Client;  // Use SDK Client directly - NO WRAPPER
  transport: StdioClientTransport;
  config: MCPServiceConfig;
  status: 'connected' | 'disconnected' | 'error';
}

/**
 * Simple service manager - NO CLIENT WRAPPER
 * Just manages connections and exposes SDK Client instances
 */
export class MCPServiceManager {
  private connections: Map<string, MCPServiceConnection> = new Map();

  /**
   * Connect to MCP service using SDK Client directly
   */
  async connectToService(config: MCPServiceConfig): Promise<Result<void, QiError>> {
    try {
      // Create transport using SDK (handles process internally)
      const transport = new StdioClientTransport({
        command: config.command[0],
        args: config.command.slice(1),
        env: config.environment,
      });

      // Create client using SDK
      const client = new Client(
        {
          name: 'qi-v2-agent',
          version: '0.8.3',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        },
      );

      // Connect using SDK
      await client.connect(transport);

      // Store connection
      this.connections.set(config.name, {
        client,
        transport,
        config,
        status: 'connected',
      });

      return success(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return failure(
        create('MCP_CONNECTION_FAILED', `Failed to connect to ${config.name}: ${errorMessage}`, 'SYSTEM'),
      );
    }
  }

  /**
   * Get SDK Client for direct use - NO WRAPPER METHODS
   */
  getClient(serviceName: string): Client | null {
    const connection = this.connections.get(serviceName);
    return connection?.status === 'connected' ? connection.client : null;
  }

  isConnected(serviceName: string): boolean {
    return this.connections.get(serviceName)?.status === 'connected' || false;
  }

  getConnectedServices(): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.status === 'connected')
      .map(([name]) => name);
  }

  async shutdown(): Promise<void> {
    for (const [name, connection] of this.connections) {
      try {
        await connection.transport.close();
      } catch (error) {
        console.error(`Error closing connection to ${name}:`, error);
      }
    }
    this.connections.clear();
  }
}
```

**Key Changes from Failed Approach:**
- ❌ No `MCPClient` wrapper class
- ✅ Use SDK `Client` class directly via `getClient()`
- ✅ Use `StdioClientTransport` correctly (handles process internally)
- ✅ Service manager only manages connections, doesn't wrap SDK functionality

#### Step 4.2: Predefined Service Configurations
```typescript
// lib/src/mcp/services/ServiceConfigs.ts
export const CORE_MCP_SERVICES: MCPServiceConfig[] = [
  {
    name: 'chroma',
    command: ['npx', '@chroma-core/chroma-mcp'],
    environment: {
      CHROMA_HOST: 'localhost',
      CHROMA_PORT: '8000'
    },
    autoConnect: true
  },
  {
    name: 'web',
    command: ['node', 'node_modules/@modelcontextprotocol/servers/lib/fetch/index.js'],
    environment: {
      FETCH_TIMEOUT: '30000'
    },
    autoConnect: true
  },
  {
    name: 'memory',
    command: ['node', 'node_modules/@modelcontextprotocol/servers/lib/memory/index.js'],
    environment: {
      MEMORY_BACKEND: 'filesystem',
      MEMORY_PATH: './data/memory'
    },
    autoConnect: false // Only connect when needed
  }
];
```

#### Step 4.3: RAG Integration (Use SDK Client Directly)
```typescript
// lib/src/context/RAGIntegration.ts
import type { MCPServiceManager } from '../mcp/MCPServiceManager.js';
import type { Result, QiError } from '@qi/base';
import { success, failure, create } from '@qi/base';

export class RAGIntegration {
  constructor(private serviceManager: MCPServiceManager) {}  // No wrapper client!
  
  async addDocument(content: string, metadata: any = {}): Promise<Result<void, QiError>> {
    // Check if memory service is available
    if (!this.serviceManager.isConnected('memory')) {
      return failure(create('RAG_SERVICE_UNAVAILABLE', 'Memory service not available', 'SYSTEM'));
    }

    try {
      // Get SDK client directly - NO WRAPPER
      const client = this.serviceManager.getClient('memory');
      if (!client) {
        return failure(create('RAG_SERVICE_UNAVAILABLE', 'Memory client not available', 'SYSTEM'));
      }
      
      // Use SDK client directly
      await client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [{
            name: this.generateId(),
            entityType: 'knowledge',
            observations: [content],
          }],
        },
      });
      
      return success(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return failure(create('RAG_STORAGE_ERROR', `Error storing document: ${errorMessage}`, 'SYSTEM'));
    }
  }
  
  async searchRelevantContext(query: string, maxResults: number = 3): Promise<Result<string[], QiError>> {
    if (!this.serviceManager.isConnected('memory')) {
      return success([]); // Graceful degradation
    }

    try {
      // Get SDK client directly - NO WRAPPER
      const client = this.serviceManager.getClient('memory');
      if (!client) {
        return success([]); // Graceful degradation
      }
      
      // Use SDK client directly
      const result = await client.callTool({
        name: 'search_nodes',
        arguments: { query },
      });
      
      // Process MCP SDK response format (content array with text)
      const documents: string[] = [];
      if (result.content && Array.isArray(result.content)) {
        for (const contentItem of result.content) {
          if (contentItem.type === 'text' && contentItem.text) {
            try {
              const searchData = JSON.parse(contentItem.text);
              if (searchData.entities) {
                for (const entity of searchData.entities.slice(0, maxResults)) {
                  if (entity.observations?.[0]) {
                    documents.push(entity.observations[0]);
                  }
                }
              }
            } catch {
              documents.push(contentItem.text);
            }
          }
        }
      }
      
      return success(documents);
    } catch (error) {
      console.warn('RAG search error:', error);
      return success([]); // Graceful degradation
    }
  }
  
  isAvailable(): boolean {
    return this.serviceManager.isConnected('memory');
  }
  
  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }
}
```

#### Step 4.4: Web Content Integration (Use SDK Client Directly)
```typescript
// lib/src/tools/WebTool.ts
import type { MCPServiceManager } from '../mcp/MCPServiceManager.js';
import type { Result, QiError } from '@qi/base';
import { success, failure, create } from '@qi/base';

export class WebTool {
  constructor(private serviceManager: MCPServiceManager) {}  // No wrapper client!
  
  async fetchWebContent(url: string): Promise<Result<string, QiError>> {
    if (!this.serviceManager.isConnected('fetch')) {
      return failure(create('WEB_SERVICE_UNAVAILABLE', 'Fetch service not available', 'SYSTEM'));
    }

    try {
      // Get SDK client directly - NO WRAPPER
      const client = this.serviceManager.getClient('fetch');
      if (!client) {
        return failure(create('WEB_SERVICE_UNAVAILABLE', 'Fetch client not available', 'SYSTEM'));
      }
      
      // Use SDK client directly
      const result = await client.callTool({
        name: 'fetch_url',
        arguments: {
          url,
          follow_redirects: true,
          timeout: 30000
        },
      });
      
      // Process MCP SDK response format
      let content = '';
      if (result.content && Array.isArray(result.content)) {
        for (const contentItem of result.content) {
          if (contentItem.type === 'text' && contentItem.text) {
            content = contentItem.text;
            break;
          }
        }
      }
      
      return success(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return failure(create('WEB_FETCH_ERROR', `Error fetching ${url}: ${errorMessage}`, 'SYSTEM'));
    }
  }
  
  isWebFetchAvailable(): boolean {
    return this.serviceManager.isConnected('fetch');
  }
}
```

#### Step 4.5: Integration with qi-prompt (Use Service Manager)
```typescript
// app/src/prompt/qi-prompt.ts
import { MCPServiceManager, RAGIntegration, WebTool } from '@qi/agent/mcp';

export class QiPrompt {
  private serviceManager: MCPServiceManager;  // No wrapper client!
  private ragIntegration: RAGIntegration;
  private webTool: WebTool;
  
  constructor() {
    // Use service manager, not wrapper client
    this.serviceManager = new MCPServiceManager();
    this.ragIntegration = new RAGIntegration(this.serviceManager);
    this.webTool = new WebTool(this.serviceManager);
  }
  
  async initialize(): Promise<void> {
    // ... existing initialization
    
    // Connect to MCP services using service manager
    const servicesToConnect = [
      { name: 'memory', command: ['npx', '@modelcontextprotocol/server-memory'], autoConnect: true },
      { name: 'fetch', command: ['npx', '@modelcontextprotocol/server-fetch'], autoConnect: true },
    ];
    
    for (const service of servicesToConnect) {
      if (service.autoConnect) {
        try {
          const result = await this.serviceManager.connectToService(service);
          if (result.tag === 'success') {
            console.log(`✅ Connected to MCP service: ${service.name}`);
          } else {
            console.warn(`⚠️ Failed to connect to ${service.name}: ${result.error.message}`);
          }
        } catch (error) {
          console.warn(`⚠️ Error connecting to ${service.name}:`, error);
        }
      }
    }
  }
  
  async handleMessage(message: string): Promise<string> {
    // Build context using proper QiCore functional patterns
    const contextResult = await this.buildContextForMessage(message);
    
    return match(
      context => this.generateResponse(context.enhancedMessage),
      error => {
        this.logger?.warn('Context building failed', { error: error.message });
        return this.generateResponse(message); // Graceful degradation
      },
      contextResult
    );
  }

  private async buildContextForMessage(message: string): Promise<Result<{enhancedMessage: string}, QiError>> {
    const contexts: string[] = [];
    
    // Web context - use match, not manual tag checking
    if (this.needsWebContent(message)) {
      const webResult = await this.webTool.fetchWebContent(message);
      match(
        content => contexts.push(`Web: ${content}`),
        error => this.logger?.warn('Web fetch failed', { error: error.message }),
        webResult
      );
    }
    
    // RAG context - use match, not manual tag checking
    const ragResult = await this.ragIntegration.searchRelevantContext(message);
    match(
      documents => {
        if (documents.length > 0) {
          contexts.push(`Knowledge: ${documents.join('\n')}`);
        }
      },
      error => this.logger?.warn('RAG search failed', { error: error.message }),
      ragResult
    );
    
    // Build enhanced message (pure transformation)
    const enhancedMessage = contexts.length > 0 
      ? `${contexts.join('\n\n')}\n\nUser: ${message}`
      : message;
      
    return success({ enhancedMessage });
  }
  
  async shutdown(): Promise<void> {
    // ... existing shutdown code ...
    
    // Shutdown MCP services
    await this.serviceManager.shutdown();
  }
  
  private needsWebContent(message: string): boolean {
    return /latest|current|recent|news|update|search/.test(message.toLowerCase());
  }
  
  private isWorthStoring(response: string): boolean {
    return response.length > 200 && 
           !/sorry|don't know|can't help/.test(response.toLowerCase());
  }
  
  async shutdown(): Promise<void> {
    await this.mcpClient.shutdown();
  }
}
```

### Verification Criteria
- [ ] MCP services start automatically with qi-prompt
- [ ] RAG queries work and return relevant results
- [ ] Web fetching works through MCP
- [ ] Services failures don't crash qi-prompt
- [ ] Knowledge gets stored and retrieved properly

## Implementation Timeline

### Week 1: Core Infrastructure
- **Days 1-2**: Enhancement 1 (Session Persistence) - Database and basic persistence
- **Days 3-4**: Enhancement 2 (Multi-Provider) - Ollama and OpenRouter providers
- **Day 5**: Integration testing and bug fixes

### Week 2: Optimization and MCP
- **Days 1-2**: Enhancement 3 (Context Optimization) - Token management and pruning
- **Days 3-5**: Enhancement 4 (MCP Integration) - RAG and web services

### Week 3: Integration and Testing
- **Days 1-2**: Full system integration with qi-prompt
- **Days 3-4**: Testing, bug fixes, and performance optimization
- **Day 5**: Documentation and deployment

## Testing Strategy

### Unit Tests
```typescript
// lib/src/state/__tests__/StateManager.test.ts
describe('StateManager Session Persistence', () => {
  it('should persist and load sessions', async () => {
    const manager = new StateManager(testConfig);
    const sessionData = createTestSessionData();
    
    await manager.persistSession('test-123', sessionData);
    const loaded = await manager.loadSession('test-123');
    
    expect(loaded).toEqual(sessionData);
  });
});

// lib/src/models/__tests__/ProviderManager.test.ts
describe('ProviderManager', () => {
  it('should fallback to available providers', async () => {
    const manager = new ProviderManager();
    manager.registerProvider(new MockOllamaProvider(false)); // unavailable
    manager.registerProvider(new MockOpenRouterProvider(true)); // available
    
    const response = await manager.invoke({ prompt: 'test' });
    expect(response.provider).toBe('openrouter');
  });
});
```

### Integration Tests
```typescript
// integration/__tests__/qi-prompt.integration.test.ts
describe('QiPrompt Integration', () => {
  it('should work with multiple providers', async () => {
    const qiPrompt = new QiPrompt();
    await qiPrompt.initialize();
    
    const response = await qiPrompt.handleMessage('Hello');
    expect(response).toBeTruthy();
    expect(response.length).toBeGreaterThan(0);
  });
  
  it('should persist conversations', async () => {
    const qiPrompt1 = new QiPrompt();
    await qiPrompt1.initialize();
    await qiPrompt1.handleMessage('Remember: my name is Alice');
    await qiPrompt1.shutdown();
    
    const qiPrompt2 = new QiPrompt();
    await qiPrompt2.initialize();
    const response = await qiPrompt2.handleMessage('What is my name?');
    
    expect(response.toLowerCase()).toContain('alice');
  });
});
```

## Success Metrics

### Performance Targets
- **Session loading**: <200ms
- **Provider switching**: <5 seconds  
- **Context optimization**: <500ms for 32k context
- **MCP tool calls**: <2 seconds average
- **Memory usage**: <200MB total

### Functionality Targets
- ✅ **Multi-provider support**: Works with Ollama and OpenRouter
- ✅ **Session persistence**: Conversations survive restarts
- ✅ **Context optimization**: Handles large contexts gracefully
- ✅ **RAG integration**: Stores and retrieves relevant knowledge
- ✅ **Web integration**: Can fetch external content when needed

### Quality Targets
- **Unit test coverage**: >85%
- **Integration test coverage**: >70%
- **No regressions**: Existing qi-prompt functionality preserved
- **Error handling**: Graceful degradation when services unavailable

## File Structure

```
qi-v2-agent/
├── lib/src/
│   ├── state/
│   │   ├── StateManager.ts (enhanced)
│   │   ├── abstractions/IStateManager.ts (extended)
│   │   └── sql/sessions_schema.sql (new)
│   ├── models/
│   │   ├── ProviderManager.ts (new)
│   │   ├── abstractions/IModelProvider.ts (new)
│   │   └── providers/
│   │       ├── OllamaProvider.ts (new)
│   │       └── OpenRouterProvider.ts (new)
│   ├── context/
│   │   ├── ContextManager.ts (enhanced)
│   │   ├── ContextOptimizer.ts (new)
│   │   ├── RAGIntegration.ts (new)
│   │   └── abstractions/IContextManager.ts (extended)
│   ├── mcp/
│   │   ├── MCPClient.ts (new)
│   │   └── services/ServiceConfigs.ts (new)
│   └── tools/
│       └── WebTool.ts (new)
└── app/src/prompt/
    └── qi-prompt.ts (enhanced)
```

## Dependencies

### New Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "sqlite3": "^5.1.6"
  },
  "devDependencies": {
    "@types/sqlite3": "^3.1.9"
  }
}
```

### MCP Services Installation
```bash
# Install core MCP servers
npm install -g @chroma-core/chroma-mcp
npm install -g @modelcontextprotocol/servers

# Setup ChromaDB for RAG
pip install chromadb==0.4.22
```

## Configuration

### Environment Variables
```bash
# Model providers
OPENROUTER_API_KEY=your_openrouter_api_key_here

# MCP services
CHROMA_HOST=localhost
CHROMA_PORT=8000
MCP_SERVICES_AUTO_START=true

# Session storage
SESSION_DB_PATH=./data/sessions.db
CONTEXT_MAX_TOKENS=16000
```

### Config File
```typescript
// config/enhanced.config.ts
export const ENHANCED_CONFIG = {
  session: {
    dbPath: './data/sessions.db',
    maxSessions: 100,
    pruneAfterDays: 30
  },
  providers: {
    preferred: ['ollama', 'openrouter'],
    ollama: { baseUrl: 'http://localhost:11434' },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1' }
  },
  context: {
    maxTokens: 16000,
    optimizationThreshold: 0.8
  },
  mcp: {
    autoStart: true,
    services: ['chroma', 'web'],
    timeout: 30000
  }
};
```

---

This implementation guide provides concrete, actionable steps to enhance qi-v2-agent v0.8.x with essential capabilities while maintaining simplicity and avoiding over-engineering.