# qi-v2-agent v0.8.x Implementation Guide

## Overview

Implementation guide for the remaining v0.8.x enhancements:

1. **Session Persistence** - Add conversation memory across restarts
2. **Multi-Provider Support** - Enable Ollama, OpenRouter, and extensible provider system  
3. **Context Optimization** - Intelligent context pruning for token limits
4. **MCP Integration** - Connect RAG, Web, and Memory services

## Enhancement 1: Session Persistence

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

#### Step 1.2: Implement Session Methods in StateManager
```typescript
// lib/src/state/StateManager.ts
import type { MCPServiceManager } from '../mcp/MCPServiceManager.js';
import type { Result, QiError } from '@qi/base';
import { success, failure, fromAsyncTryCatch } from '@qi/base';

export class StateManager implements IStateManager {
  private sessionStorage: Map<string, SessionData> = new Map();
  private contextMemory: Map<string, any> = new Map();
  private serviceManager: MCPServiceManager;
  
  constructor(config: StateManagerConfig, serviceManager: MCPServiceManager) {
    // ... existing constructor
    this.serviceManager = serviceManager;
  }
  
  async persistSession(sessionId: string, data: SessionData): Promise<void> {
    // Store in memory cache
    this.sessionStorage.set(sessionId, data);
    
    // Persist to MCP memory server
    await this.saveSessionToMCP(sessionId, data);
  }
  
  async loadPersistedSession(sessionId: string): Promise<SessionData | null> {
    // Check memory cache first
    if (this.sessionStorage.has(sessionId)) {
      return this.sessionStorage.get(sessionId)!;
    }
    
    // Load from MCP memory server
    const session = await this.loadSessionFromMCP(sessionId);
    if (session) {
      this.sessionStorage.set(sessionId, session);
    }
    return session;
  }
  
  // MCP-based storage methods
  private async saveSessionToMCP(sessionId: string, data: SessionData): Promise<Result<void, QiError>> {
    if (!this.serviceManager.isConnected('memory')) {
      return failure(create('MCP_UNAVAILABLE', 'Memory service not connected', 'SYSTEM'));
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      return failure(create('MCP_CLIENT_UNAVAILABLE', 'Memory client not available', 'SYSTEM'));
    }

    try {
      await client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [{
            name: `session_${sessionId}`,
            entityType: 'session',
            observations: [JSON.stringify(data)]
          }]
        }
      });
      return success(undefined);
    } catch (error) {
      return failure(create('SESSION_SAVE_FAILED', `Failed to save session: ${error}`, 'SYSTEM'));
    }
  }
  
  private async loadSessionFromMCP(sessionId: string): Promise<SessionData | null> {
    if (!this.serviceManager.isConnected('memory')) {
      return null; // Graceful degradation
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      return null;
    }

    try {
      const result = await client.callTool({
        name: 'search_nodes',
        arguments: { query: `session_${sessionId}` }
      });
      
      if (result.content?.[0]?.text) {
        const searchData = JSON.parse(result.content[0].text);
        if (searchData.entities?.[0]?.observations?.[0]) {
          return JSON.parse(searchData.entities[0].observations[0]);
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to load session from MCP:', error);
      return null;
    }
  }
}
```

#### Step 1.3: Integration with qi-prompt
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


## Enhancement 2: Multi-Provider Model Support

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
  private defaultProvider: string = 'ollama';
  
  registerProvider(provider: IModelProvider): void {
    this.providers.set(provider.name, provider);
  }
  
  setDefaultProvider(providerName: string): void {
    this.defaultProvider = providerName;
  }
  
  async getProvider(providerName?: string): Promise<IModelProvider | null> {
    const targetProvider = providerName || this.defaultProvider;
    const provider = this.providers.get(targetProvider);
    
    if (provider && await provider.isAvailable()) {
      return provider;
    }
    
    return null;
  }
  
  async invoke(request: ModelRequest, providerName?: string): Promise<ModelResponse> {
    const provider = await this.getProvider(providerName);
    if (!provider) {
      throw new Error(`Provider not available: ${providerName || this.defaultProvider}`);
    }
    
    return provider.invoke(request);
  }
}
```

#### Step 2.5: Integration with qi-prompt
```typescript
// app/src/prompt/qi-prompt.ts
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
  
  async generateResponse(prompt: string, providerName?: string): Promise<string> {
    const response = await this.providerManager.invoke({
      prompt,
      system: this.getSystemPrompt(),
      temperature: 0.7,
      maxTokens: 4000
    }, providerName);
    
    return response.content;
  }
}
```

## Enhancement 3: Context Optimization

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


## Enhancement 4: Essential MCP Integration

### Implementation Plan

#### Step 4.1: MCP Service Manager

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
  client: Client;
  transport: StdioClientTransport;
  config: MCPServiceConfig;
  status: 'connected' | 'disconnected' | 'error';
}
export class MCPServiceManager {
  private connections: Map<string, MCPServiceConnection> = new Map();

  /**
   * Connect to MCP service
   */
  async connectToService(config: MCPServiceConfig): Promise<Result<void, QiError>> {
    try {
      // Create transport
      const transport = new StdioClientTransport({
        command: config.command[0],
        args: config.command.slice(1),
        env: config.environment,
      });

      // Create client
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

      // Connect
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
   * Get Client for direct use
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

#### Step 4.3: RAG Integration
```typescript
// lib/src/context/RAGIntegration.ts
import type { MCPServiceManager } from '../mcp/MCPServiceManager.js';
import type { Result, QiError } from '@qi/base';
import { success, failure, create } from '@qi/base';

export class RAGIntegration {
  constructor(private serviceManager: MCPServiceManager) {}
  
  async addDocument(content: string, metadata: any = {}): Promise<Result<void, QiError>> {
    // Check if memory service is available
    if (!this.serviceManager.isConnected('memory')) {
      return failure(create('RAG_SERVICE_UNAVAILABLE', 'Memory service not available', 'SYSTEM'));
    }

    try {
      // Get client
      const client = this.serviceManager.getClient('memory');
      if (!client) {
        return failure(create('RAG_SERVICE_UNAVAILABLE', 'Memory client not available', 'SYSTEM'));
      }
      
      // Use client
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
      // Get client
      const client = this.serviceManager.getClient('memory');
      if (!client) {
        return success([]); // Graceful degradation
      }
      
      // Use client
      const result = await client.callTool({
        name: 'search_nodes',
        arguments: { query },
      });
      
      // Process response format
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

#### Step 4.4: Web Content Integration
```typescript
// lib/src/tools/WebTool.ts
import type { MCPServiceManager } from '../mcp/MCPServiceManager.js';
import type { Result, QiError } from '@qi/base';
import { success, failure, create } from '@qi/base';

export class WebTool {
  constructor(private serviceManager: MCPServiceManager) {}
  
  async fetchWebContent(url: string): Promise<Result<string, QiError>> {
    if (!this.serviceManager.isConnected('fetch')) {
      return failure(create('WEB_SERVICE_UNAVAILABLE', 'Fetch service not available', 'SYSTEM'));
    }

    try {
      // Get client
      const client = this.serviceManager.getClient('fetch');
      if (!client) {
        return failure(create('WEB_SERVICE_UNAVAILABLE', 'Fetch client not available', 'SYSTEM'));
      }
      
      // Use client
      const result = await client.callTool({
        name: 'fetch_url',
        arguments: {
          url,
          follow_redirects: true,
          timeout: 30000
        },
      });
      
      // Process response format
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

#### Step 4.5: Integration with qi-prompt
```typescript
// app/src/prompt/qi-prompt.ts
import { MCPServiceManager, RAGIntegration, WebTool } from '@qi/agent/mcp';

export class QiPrompt {
  private serviceManager: MCPServiceManager;
  private ragIntegration: RAGIntegration;
  private webTool: WebTool;
  
  constructor() {
    this.serviceManager = new MCPServiceManager();
    this.ragIntegration = new RAGIntegration(this.serviceManager);
    this.webTool = new WebTool(this.serviceManager);
  }
  
  async initialize(): Promise<void> {
    // ... existing initialization
    
    // Connect to MCP services
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
    
    // Web context
    if (this.needsWebContent(message)) {
      const webResult = await this.webTool.fetchWebContent(message);
      match(
        content => contexts.push(`Web: ${content}`),
        error => this.logger?.warn('Web fetch failed', { error: error.message }),
        webResult
      );
    }
    
    // RAG context
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
    
    // Build enhanced message
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

