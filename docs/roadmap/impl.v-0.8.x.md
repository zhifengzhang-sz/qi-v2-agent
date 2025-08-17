# qi-v2-agent v0.8.x Implementation Guide

**Document Version**: 1.0  
**Date**: 2025-01-17  
**Status**: Implementation Design  
**Classification**: Technical Specification

## Executive Summary

This document provides detailed implementation specifications for qi-v2-agent v-0.8.x enhanced core components. Building on the existing 95% production-ready CLI framework, 90% messaging system, and comprehensive tool system, this guide defines concrete TypeScript interfaces, MCP integration patterns, and step-by-step implementation procedures.

## qi-prompt Enhancement Strategy

**Objective**: Enhance qi-prompt (v-0.8.0 working implementation) with upgraded modules while maintaining functionality throughout development.

### Enhancement Approach
1. **qi-prompt continues working** throughout v-0.8.x development
2. **Individual modules get upgraded** (State Manager, Context Manager, Model Manager, MCP Client)
3. **qi-prompt incorporates** the enhanced module features progressively
4. **End result**: qi-prompt enhanced by all module upgrades
5. **Milestone achieved**: qi-prompt with advanced context management, RAG integration, and enhanced capabilities

### Integration Points for qi-prompt
- **Enhanced State Manager**: qi-prompt gains multi-tier memory (working memory, session memory, knowledge memory)
- **Enhanced Context Manager**: qi-prompt gains RAG integration via Chroma MCP for intelligent context optimization
- **Model Manager**: qi-prompt gains lifecycle management, performance monitoring, and model switching capabilities
- **MCP Client**: qi-prompt gains access to external services (Chroma, Web, Database, Memory, SQLite)
- **Simple Workflows**: qi-prompt maintains well-defined, simple patterns (no fancy complexity) enhanced by new infrastructure

### Development Continuity
- **app/src/qi-prompt.ts**: Continues to work throughout v-0.8.x development
- **Progressive Enhancement**: New module features integrated without breaking existing functionality
- **Backward Compatibility**: Simple workflow patterns preserved while gaining enhanced capabilities
- **Testing Strategy**: Validate qi-prompt functionality after each module upgrade

## Architecture Overview

### Implementation Strategy: Hybrid Approach

**Internal Modules** (Performance Critical):
- Enhanced State Manager with multi-tier memory
- Enhanced Context Manager with RAG capabilities  
- New Model Manager with lifecycle management
- MCP Client for external service integration

**External MCP Servers** (Mature Ecosystem):
- RAG/Vector Database → [Chroma MCP](https://github.com/chroma-core/chroma-mcp)
- Web Tools → [Fetch Server](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch)
- Database Integration → [PostgreSQL MCP](https://github.com/modelcontextprotocol/servers)

## Module 1: Enhanced State Manager

### Current Foundation
- `lib/src/state/StateManager.ts` - Centralized state management
- `lib/src/state/StatePersistence.ts` - Session persistence  
- `lib/src/state/agent-state-machine.ts` - State machine patterns
- `lib/src/state/abstractions/IStateManager.ts` - Base interfaces

### Enhancement Specification

#### Multi-Tier Memory Architecture

```typescript
// lib/src/state/abstractions/IEnhancedStateManager.ts
import { IStateManager } from './IStateManager.js';

export interface MultiTierStateManager extends IStateManager {
  // Multi-tier memory architecture
  readonly shortTermMemory: WorkingMemory;     // Current session context
  readonly mediumTermMemory: SessionMemory;    // Cross-session patterns  
  readonly longTermMemory: KnowledgeMemory;    // Learned behaviors and facts
  
  // Advanced persistence with SQLite/PostgreSQL
  persistState(tier: MemoryTier, options?: PersistenceOptions): Promise<void>;
  loadState(tier: MemoryTier, filter?: StateFilter): Promise<void>;
  
  // Conflict resolution for multi-agent scenarios
  resolveStateConflicts(conflicts: StateConflict[]): Promise<Resolution>;
  
  // Performance optimization
  pruneMemory(strategy: PruningStrategy): Promise<PruningResult>;
  archiveOldState(cutoffDate: Date): Promise<ArchiveResult>;
  
  // State synchronization
  syncWithRemoteState(remoteConfig: RemoteStateConfig): Promise<SyncResult>;
  handleStateDistribution(agentIds: string[]): Promise<DistributionResult>;
}

export enum MemoryTier {
  SHORT_TERM = 'short_term',    // 0-4 hours
  MEDIUM_TERM = 'medium_term',  // 4 hours - 7 days
  LONG_TERM = 'long_term'       // 7+ days
}

export interface WorkingMemory {
  readonly sessionId: string;
  readonly currentTask: TaskContext | null;
  readonly recentMessages: readonly ConversationEntry[];
  readonly activeTools: readonly string[];
  readonly contextVariables: ReadonlyMap<string, unknown>;
  
  // Working memory operations
  addContextVariable(key: string, value: unknown): void;
  removeContextVariable(key: string): void;
  setCurrentTask(task: TaskContext): void;
  clearCurrentTask(): void;
  addRecentMessage(message: ConversationEntry): void;
  pruneOldMessages(maxAge: number): void;
}

export interface SessionMemory {
  readonly sessionHistory: readonly SessionSummary[];
  readonly learnedPatterns: readonly Pattern[];
  readonly userPreferences: ReadonlyMap<string, unknown>;
  readonly frequentTasks: readonly TaskFrequency[];
  
  // Session memory operations
  addSessionSummary(summary: SessionSummary): void;
  learnPattern(pattern: Pattern): void;
  updateUserPreference(key: string, value: unknown): void;
  incrementTaskFrequency(taskType: string): void;
  getRelevantPatterns(context: TaskContext): readonly Pattern[];
}

export interface KnowledgeMemory {
  readonly factualKnowledge: ReadonlyMap<string, KnowledgeFact>;
  readonly proceduralKnowledge: readonly ProcedureKnowledge[];
  readonly domainExpertise: ReadonlyMap<string, ExpertiseLevel>;
  readonly errorHistory: readonly ErrorPattern[];
  
  // Knowledge memory operations
  addFact(fact: KnowledgeFact): void;
  addProcedure(procedure: ProcedureKnowledge): void;
  updateExpertise(domain: string, level: ExpertiseLevel): void;
  recordError(error: ErrorPattern): void;
  queryKnowledge(query: KnowledgeQuery): readonly KnowledgeFact[];
}

export interface StateConflict {
  readonly conflictId: string;
  readonly tier: MemoryTier;
  readonly field: string;
  readonly conflictingValues: readonly unknown[];
  readonly sourceAgents: readonly string[];
  readonly timestamp: Date;
  readonly severity: ConflictSeverity;
}

export interface Resolution {
  readonly conflictId: string;
  readonly strategy: ResolutionStrategy;
  readonly resolvedValue: unknown;
  readonly reasoning: string;
  readonly confidence: number;
}
```

#### Implementation Steps

**Step 1: Extend Base State Manager**

```typescript
// lib/src/state/impl/EnhancedStateManager.ts
import { IStateManager } from '../abstractions/IStateManager.js';
import { MultiTierStateManager, MemoryTier, WorkingMemory, SessionMemory, KnowledgeMemory } from '../abstractions/IEnhancedStateManager.js';
import { Database } from 'sqlite3';

export class EnhancedStateManager implements MultiTierStateManager {
  private readonly baseStateManager: IStateManager;
  private readonly database: Database;
  
  private _shortTermMemory: WorkingMemoryImpl;
  private _mediumTermMemory: SessionMemoryImpl;
  private _longTermMemory: KnowledgeMemoryImpl;
  
  constructor(baseStateManager: IStateManager, dbPath: string) {
    this.baseStateManager = baseStateManager;
    this.database = new Database(dbPath);
    
    this._shortTermMemory = new WorkingMemoryImpl();
    this._mediumTermMemory = new SessionMemoryImpl(this.database);
    this._longTermMemory = new KnowledgeMemoryImpl(this.database);
  }
  
  // Delegate base operations to existing state manager
  getConfig() { return this.baseStateManager.getConfig(); }
  updateConfig(updates: Partial<AppConfig>) { return this.baseStateManager.updateConfig(updates); }
  // ... other base methods
  
  // Multi-tier memory implementation
  get shortTermMemory(): WorkingMemory { return this._shortTermMemory; }
  get mediumTermMemory(): SessionMemory { return this._mediumTermMemory; }
  get longTermMemory(): KnowledgeMemory { return this._longTermMemory; }
  
  async persistState(tier: MemoryTier, options?: PersistenceOptions): Promise<void> {
    switch (tier) {
      case MemoryTier.SHORT_TERM:
        await this.persistWorkingMemory(options);
        break;
      case MemoryTier.MEDIUM_TERM:
        await this.persistSessionMemory(options);
        break;
      case MemoryTier.LONG_TERM:
        await this.persistKnowledgeMemory(options);
        break;
    }
  }
  
  async resolveStateConflicts(conflicts: StateConflict[]): Promise<Resolution[]> {
    const resolutions: Resolution[] = [];
    
    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      resolutions.push(resolution);
    }
    
    return resolutions;
  }
  
  private async resolveConflict(conflict: StateConflict): Promise<Resolution> {
    // Implement conflict resolution strategies:
    // 1. Last-writer-wins for simple conflicts
    // 2. Merge strategies for compatible changes
    // 3. User intervention for complex conflicts
    // 4. ML-based resolution for pattern conflicts
    
    switch (conflict.severity) {
      case ConflictSeverity.LOW:
        return this.autoResolveConflict(conflict);
      case ConflictSeverity.MEDIUM:
        return this.mergeResolveConflict(conflict);
      case ConflictSeverity.HIGH:
        return this.escalateConflict(conflict);
    }
  }
}
```

**Step 2: Database Schema**

```sql
-- lib/src/state/sql/enhanced_state_schema.sql

-- Session Memory Tables
CREATE TABLE session_summaries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  task_count INTEGER NOT NULL,
  success_rate REAL NOT NULL,
  summary TEXT NOT NULL,
  metadata JSON
);

CREATE TABLE learned_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  context_hash TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  success_rate REAL NOT NULL,
  pattern_data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Memory Tables  
CREATE TABLE knowledge_facts (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE procedure_knowledge (
  id TEXT PRIMARY KEY,
  procedure_name TEXT NOT NULL,
  steps JSON NOT NULL,
  conditions JSON,
  success_rate REAL,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Step 3: Testing Strategy**

```typescript
// lib/src/state/__tests__/EnhancedStateManager.test.ts
import { EnhancedStateManager } from '../impl/EnhancedStateManager.js';
import { MemoryTier } from '../abstractions/IEnhancedStateManager.js';

describe('EnhancedStateManager', () => {
  let stateManager: EnhancedStateManager;
  
  beforeEach(() => {
    stateManager = new EnhancedStateManager(mockBaseStateManager, ':memory:');
  });
  
  describe('Multi-tier Memory', () => {
    it('should maintain working memory during session', async () => {
      const taskContext = createMockTaskContext();
      stateManager.shortTermMemory.setCurrentTask(taskContext);
      
      expect(stateManager.shortTermMemory.currentTask).toEqual(taskContext);
    });
    
    it('should persist session patterns to medium-term memory', async () => {
      const pattern = createMockPattern();
      stateManager.mediumTermMemory.learnPattern(pattern);
      
      await stateManager.persistState(MemoryTier.MEDIUM_TERM);
      
      const relevantPatterns = stateManager.mediumTermMemory.getRelevantPatterns(mockContext);
      expect(relevantPatterns).toContain(pattern);
    });
    
    it('should resolve state conflicts automatically', async () => {
      const conflicts = [createMockConflict()];
      const resolutions = await stateManager.resolveStateConflicts(conflicts);
      
      expect(resolutions).toHaveLength(1);
      expect(resolutions[0].confidence).toBeGreaterThan(0.7);
    });
  });
});
```

## Module 2: Enhanced Context Manager

### Current Foundation
- `lib/src/context/ContextManager.ts` - Core context management
- `lib/src/context/SecurityBoundaryManager.ts` - Isolation and security
- `lib/src/context/utils/ContextAwarePrompting.ts` - Context-aware inference
- `lib/src/context/abstractions/IContextManager.ts` - Base interfaces

### Enhancement Specification

#### RAG Integration and Context Optimization

```typescript
// lib/src/context/abstractions/IEnhancedContextManager.ts
import { IContextManager } from './IContextManager.js';

export interface EnhancedContextManager extends IContextManager {
  // Context optimization
  optimizeContext(strategy: OptimizationStrategy): Promise<OptimizedContext>;
  scoreContextRelevance(context: Context, task: Task): Promise<number>;
  pruneIrrelevantContext(threshold: number): Promise<Context>;
  
  // Dynamic strategies
  selectContextStrategy(task: Task): Promise<ContextStrategy>;
  adaptContextForTask(context: Context, task: Task): Promise<Context>;
  
  // RAG integration via MCP
  retrieveRelevantContext(query: string, options?: RAGOptions): Promise<Context[]>;
  integrateMCPRAGServer(serverConfig: MCPServerConfig): Promise<void>;
  queryVectorDatabase(embedding: number[], k: number): Promise<VectorResult[]>;
  
  // Multi-modal context handling
  processImageContext(imageData: Buffer, metadata: ImageMetadata): Promise<ImageContext>;
  processDocumentContext(document: Document, extractionOptions: ExtractionOptions): Promise<DocumentContext>;
  fuseMutliModalContext(contexts: MultiModalContext[]): Promise<FusedContext>;
}

export interface OptimizationStrategy {
  readonly name: string;
  readonly maxContextSize: number;
  readonly relevanceThreshold: number;
  readonly priorityWeights: ContextPriorityWeights;
  readonly compressionEnabled: boolean;
}

export interface OptimizedContext {
  readonly originalSize: number;
  readonly optimizedSize: number;
  readonly compressionRatio: number;
  readonly relevanceScore: number;
  readonly context: Context;
  readonly optimizationMetrics: OptimizationMetrics;
}

export interface RAGOptions {
  readonly maxResults: number;
  readonly relevanceThreshold: number;
  readonly includeMetadata: boolean;
  readonly vectorSearchParams: VectorSearchParams;
}

export interface MCPServerConfig {
  readonly serverType: 'chroma' | 'pgvector' | 'custom';
  readonly connectionString: string;
  readonly collectionName?: string;
  readonly embeddingModel?: string;
  readonly credentials?: Record<string, string>;
}
```

#### MCP RAG Integration Implementation

```typescript
// lib/src/context/impl/MCPRAGIntegration.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export class MCPRAGIntegration {
  private mcpClient: Client | null = null;
  private chromaTransport: StdioClientTransport | null = null;
  
  async initializeChromaMCP(config: MCPServerConfig): Promise<void> {
    // Start Chroma MCP server process
    const chromaProcess = spawn('npx', ['@chroma-core/chroma-mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Create MCP client connection
    this.chromaTransport = new StdioClientTransport(
      chromaProcess.stdout,
      chromaProcess.stdin
    );
    
    this.mcpClient = new Client({
      name: 'qi-v2-agent-rag-client',
      version: '1.0.0'
    }, {
      capabilities: {
        resources: {},
        tools: {}
      }
    });
    
    await this.mcpClient.connect(this.chromaTransport);
    
    // Initialize collection if needed
    await this.ensureCollection(config.collectionName || 'qi-agent-context');
  }
  
  async retrieveRelevantContext(query: string, options: RAGOptions): Promise<Context[]> {
    if (!this.mcpClient) {
      throw new Error('MCP RAG client not initialized');
    }
    
    // Generate embedding for query
    const embedding = await this.generateEmbedding(query);
    
    // Query Chroma via MCP
    const result = await this.mcpClient.callTool('vector_search', {
      collection_name: this.collectionName,
      query_embedding: embedding,
      n_results: options.maxResults,
      include: ['documents', 'metadatas', 'distances']
    });
    
    return this.processVectorResults(result, options.relevanceThreshold);
  }
  
  async addContextToRAG(context: Context, metadata: ContextMetadata): Promise<void> {
    if (!this.mcpClient) {
      throw new Error('MCP RAG client not initialized');
    }
    
    const embedding = await this.generateEmbedding(context.content);
    
    await this.mcpClient.callTool('add_documents', {
      collection_name: this.collectionName,
      documents: [context.content],
      embeddings: [embedding],
      metadatas: [metadata],
      ids: [context.id]
    });
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    // Use local embedding model or external service
    // This could integrate with existing prompt system
    return await this.embeddingService.embed(text);
  }
}
```

#### Context Optimization Implementation

```typescript
// lib/src/context/impl/ContextOptimizer.ts
export class ContextOptimizer {
  async optimizeContext(context: Context, strategy: OptimizationStrategy): Promise<OptimizedContext> {
    const originalSize = this.calculateContextSize(context);
    
    // Step 1: Score relevance of each context element
    const scoredElements = await this.scoreContextElements(context, strategy);
    
    // Step 2: Prune low-relevance elements
    const prunedContext = this.pruneByRelevance(scoredElements, strategy.relevanceThreshold);
    
    // Step 3: Apply compression if enabled
    const compressedContext = strategy.compressionEnabled 
      ? await this.compressContext(prunedContext)
      : prunedContext;
    
    // Step 4: Calculate optimization metrics
    const optimizedSize = this.calculateContextSize(compressedContext);
    const compressionRatio = originalSize / optimizedSize;
    
    return {
      originalSize,
      optimizedSize,
      compressionRatio,
      relevanceScore: this.calculateOverallRelevance(compressedContext),
      context: compressedContext,
      optimizationMetrics: this.calculateOptimizationMetrics(context, compressedContext)
    };
  }
  
  private async scoreContextElements(context: Context, strategy: OptimizationStrategy): Promise<ScoredContextElement[]> {
    const elements = this.extractContextElements(context);
    const scoredElements: ScoredContextElement[] = [];
    
    for (const element of elements) {
      const relevanceScore = await this.calculateElementRelevance(element, strategy);
      const priorityScore = this.calculatePriorityScore(element, strategy.priorityWeights);
      const recencyScore = this.calculateRecencyScore(element);
      
      const combinedScore = (relevanceScore * 0.6) + (priorityScore * 0.3) + (recencyScore * 0.1);
      
      scoredElements.push({
        element,
        relevanceScore,
        priorityScore,
        recencyScore,
        combinedScore
      });
    }
    
    return scoredElements.sort((a, b) => b.combinedScore - a.combinedScore);
  }
}
```

## Module 3: Model Manager

### New Module Implementation

```typescript
// lib/src/models/abstractions/IModelManager.ts
export interface ModelManager {
  // Model lifecycle management
  loadModel(modelId: string, options?: LoadOptions): Promise<ModelInstance>;
  unloadModel(modelId: string): Promise<void>;
  switchModel(fromModel: string, toModel: string): Promise<SwitchResult>;
  
  // Model discovery and registry
  discoverAvailableModels(): Promise<ModelInfo[]>;
  registerModel(modelInfo: ModelInfo): Promise<void>;
  unregisterModel(modelId: string): Promise<void>;
  
  // Performance monitoring
  monitorModelPerformance(modelId: string): Promise<PerformanceMetrics>;
  optimizeModelUsage(): Promise<OptimizationResult>;
  getModelBenchmarks(modelId: string): Promise<BenchmarkResults>;
  
  // Resource management
  manageResourceAllocation(): Promise<ResourceAllocation>;
  scaleModelInstances(demand: LoadDemand): Promise<ScalingResult>;
  getResourceUtilization(): Promise<ResourceUtilization>;
  
  // Health and diagnostics
  healthCheck(modelId?: string): Promise<HealthStatus>;
  diagnoseModelIssues(modelId: string): Promise<DiagnosticReport>;
  
  // Configuration and settings
  updateModelConfig(modelId: string, config: ModelConfig): Promise<void>;
  getModelConfig(modelId: string): Promise<ModelConfig>;
  setDefaultModel(modelId: string): Promise<void>;
}

export interface ModelInstance {
  readonly id: string;
  readonly modelInfo: ModelInfo;
  readonly status: ModelStatus;
  readonly loadedAt: Date;
  readonly memoryUsage: number;
  readonly activeConnections: number;
  
  // Instance operations
  invoke(prompt: string, options?: InvokeOptions): Promise<InvokeResult>;
  stream(prompt: string, options?: StreamOptions): AsyncIterable<StreamChunk>;
  warmup(): Promise<void>;
  cooldown(): Promise<void>;
  
  // Monitoring
  getMetrics(): Promise<InstanceMetrics>;
  getStatus(): ModelStatus;
}

export enum ModelStatus {
  LOADING = 'loading',
  READY = 'ready',
  BUSY = 'busy',
  ERROR = 'error',
  UNLOADING = 'unloading',
  OFFLINE = 'offline'
}

export interface LoadOptions {
  readonly preload: boolean;
  readonly warmup: boolean;
  readonly maxMemory?: number;
  readonly priority: LoadPriority;
}

export interface PerformanceMetrics {
  readonly modelId: string;
  readonly averageResponseTime: number;
  readonly throughputPerSecond: number;
  readonly errorRate: number;
  readonly memoryEfficiency: number;
  readonly cpuUtilization: number;
  readonly gpuUtilization?: number;
  readonly timestamp: Date;
}
```

#### Model Manager Implementation

```typescript
// lib/src/models/impl/OllamaModelManager.ts
import { ModelManager, ModelInstance, ModelStatus } from '../abstractions/IModelManager.js';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';

export class OllamaModelManager implements ModelManager {
  private loadedModels = new Map<string, ModelInstanceImpl>();
  private ollamaProcess: ChildProcess | null = null;
  private baseUrl = 'http://localhost:11434';
  
  async initialize(): Promise<void> {
    // Start Ollama server if not running
    await this.ensureOllamaRunning();
    
    // Discover available models
    const models = await this.discoverAvailableModels();
    console.log(`Discovered ${models.length} available models`);
  }
  
  async loadModel(modelId: string, options: LoadOptions = { preload: false, warmup: false, priority: LoadPriority.NORMAL }): Promise<ModelInstance> {
    if (this.loadedModels.has(modelId)) {
      return this.loadedModels.get(modelId)!;
    }
    
    const instance = new ModelInstanceImpl(modelId, this.baseUrl);
    
    try {
      await instance.load(options);
      this.loadedModels.set(modelId, instance);
      
      if (options.warmup) {
        await instance.warmup();
      }
      
      return instance;
    } catch (error) {
      throw new Error(`Failed to load model ${modelId}: ${error.message}`);
    }
  }
  
  async switchModel(fromModel: string, toModel: string): Promise<SwitchResult> {
    const startTime = Date.now();
    
    // Load new model
    const newInstance = await this.loadModel(toModel, { 
      preload: true, 
      warmup: true, 
      priority: LoadPriority.HIGH 
    });
    
    // Unload old model if specified
    if (fromModel && this.loadedModels.has(fromModel)) {
      await this.unloadModel(fromModel);
    }
    
    const switchTime = Date.now() - startTime;
    
    return {
      fromModel,
      toModel,
      switchTimeMs: switchTime,
      success: true,
      newInstance
    };
  }
  
  async monitorModelPerformance(modelId: string): Promise<PerformanceMetrics> {
    const instance = this.loadedModels.get(modelId);
    if (!instance) {
      throw new Error(`Model ${modelId} not loaded`);
    }
    
    return await instance.getMetrics();
  }
  
  private async ensureOllamaRunning(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`);
    } catch (error) {
      // Start Ollama server
      this.ollamaProcess = spawn('ollama', ['serve'], {
        stdio: 'pipe'
      });
      
      // Wait for server to be ready
      await this.waitForOllamaReady();
    }
  }
  
  private async waitForOllamaReady(timeoutMs = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        await axios.get(`${this.baseUrl}/api/tags`);
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Ollama server failed to start within timeout');
  }
}

class ModelInstanceImpl implements ModelInstance {
  readonly id: string;
  private _status: ModelStatus = ModelStatus.OFFLINE;
  private _loadedAt: Date | null = null;
  private _modelInfo: ModelInfo | null = null;
  private baseUrl: string;
  
  constructor(id: string, baseUrl: string) {
    this.id = id;
    this.baseUrl = baseUrl;
  }
  
  get modelInfo(): ModelInfo {
    if (!this._modelInfo) throw new Error('Model not loaded');
    return this._modelInfo;
  }
  
  get status(): ModelStatus { return this._status; }
  get loadedAt(): Date { 
    if (!this._loadedAt) throw new Error('Model not loaded');
    return this._loadedAt; 
  }
  
  async load(options: LoadOptions): Promise<void> {
    this._status = ModelStatus.LOADING;
    
    try {
      // Pull model if needed
      await this.pullModelIfNeeded();
      
      // Load model info
      this._modelInfo = await this.fetchModelInfo();
      
      this._loadedAt = new Date();
      this._status = ModelStatus.READY;
    } catch (error) {
      this._status = ModelStatus.ERROR;
      throw error;
    }
  }
  
  async invoke(prompt: string, options?: InvokeOptions): Promise<InvokeResult> {
    if (this._status !== ModelStatus.READY) {
      throw new Error(`Model ${this.id} not ready (status: ${this._status})`);
    }
    
    this._status = ModelStatus.BUSY;
    
    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, {
        model: this.id,
        prompt,
        stream: false,
        options: options?.parameters
      });
      
      this._status = ModelStatus.READY;
      
      return {
        content: response.data.response,
        usage: {
          promptTokens: response.data.prompt_eval_count || 0,
          completionTokens: response.data.eval_count || 0,
          totalTokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
        },
        metadata: {
          model: this.id,
          responseTimeMs: response.data.total_duration / 1000000, // Convert to ms
          evalDuration: response.data.eval_duration / 1000000
        }
      };
    } catch (error) {
      this._status = ModelStatus.ERROR;
      throw error;
    }
  }
}
```

## Module 4: MCP Client Integration

### MCP Client Implementation

```typescript
// lib/src/mcp/abstractions/IMCPClient.ts
export interface MCPClient {
  // Service discovery and connection
  discoverServices(): Promise<MCPService[]>;
  connectToService(serviceConfig: MCPServiceConfig): Promise<MCPConnection>;
  disconnectFromService(serviceId: string): Promise<void>;
  
  // Tool proxy and marshalling
  executeRemoteTool(serviceId: string, toolName: string, params: any): Promise<ToolResult>;
  listRemoteTools(serviceId: string): Promise<RemoteToolInfo[]>;
  
  // Resource access
  getRemoteResource(serviceId: string, resourcePath: string): Promise<ResourceData>;
  listRemoteResources(serviceId: string): Promise<RemoteResourceInfo[]>;
  
  // Health monitoring and management
  monitorServiceHealth(): Promise<ServiceHealth[]>;
  handleServiceFailover(failedServiceId: string): Promise<void>;
  
  // Configuration
  registerService(config: MCPServiceConfig): Promise<void>;
  unregisterService(serviceId: string): Promise<void>;
  updateServiceConfig(serviceId: string, config: Partial<MCPServiceConfig>): Promise<void>;
}

export interface MCPServiceConfig {
  readonly id: string;
  readonly name: string;
  readonly type: 'stdio' | 'http' | 'websocket';
  readonly connectionString: string;
  readonly command?: string[];
  readonly environment?: Record<string, string>;
  readonly healthCheckInterval?: number;
  readonly retryPolicy?: RetryPolicy;
}

export interface MCPConnection {
  readonly serviceId: string;
  readonly client: Client;
  readonly transport: Transport;
  readonly status: ConnectionStatus;
  readonly connectedAt: Date;
  readonly lastPing: Date;
}
```

#### MCP Client Implementation

```typescript
// lib/src/mcp/impl/MCPClientImpl.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MCPClient, MCPConnection, MCPServiceConfig } from '../abstractions/IMCPClient.js';
import { spawn, ChildProcess } from 'child_process';

export class MCPClientImpl implements MCPClient {
  private connections = new Map<string, MCPConnection>();
  private serviceConfigs = new Map<string, MCPServiceConfig>();
  private processes = new Map<string, ChildProcess>();
  
  async connectToService(serviceConfig: MCPServiceConfig): Promise<MCPConnection> {
    // Store service configuration
    this.serviceConfigs.set(serviceConfig.id, serviceConfig);
    
    let transport: StdioClientTransport;
    let process: ChildProcess | undefined;
    
    switch (serviceConfig.type) {
      case 'stdio':
        // Start MCP server process
        process = spawn(serviceConfig.command![0], serviceConfig.command!.slice(1), {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...serviceConfig.environment }
        });
        
        this.processes.set(serviceConfig.id, process);
        
        transport = new StdioClientTransport(
          process.stdout!,
          process.stdin!
        );
        break;
        
      case 'http':
        throw new Error('HTTP transport not implemented yet');
        
      case 'websocket':
        throw new Error('WebSocket transport not implemented yet');
        
      default:
        throw new Error(`Unsupported transport type: ${serviceConfig.type}`);
    }
    
    // Create MCP client
    const client = new Client({
      name: 'qi-v2-agent',
      version: '1.0.0'
    }, {
      capabilities: {
        resources: {},
        tools: {}
      }
    });
    
    // Connect to service
    await client.connect(transport);
    
    const connection: MCPConnection = {
      serviceId: serviceConfig.id,
      client,
      transport,
      status: ConnectionStatus.CONNECTED,
      connectedAt: new Date(),
      lastPing: new Date()
    };
    
    this.connections.set(serviceConfig.id, connection);
    
    // Start health monitoring
    this.startHealthMonitoring(serviceConfig.id);
    
    return connection;
  }
  
  async executeRemoteTool(serviceId: string, toolName: string, params: any): Promise<ToolResult> {
    const connection = this.connections.get(serviceId);
    if (!connection) {
      throw new Error(`Not connected to service: ${serviceId}`);
    }
    
    if (connection.status !== ConnectionStatus.CONNECTED) {
      throw new Error(`Service ${serviceId} not available (status: ${connection.status})`);
    }
    
    try {
      const result = await connection.client.callTool(toolName, params);
      
      return {
        success: true,
        content: result.content,
        metadata: {
          serviceId,
          toolName,
          executionTime: Date.now() - startTime
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          serviceId,
          toolName,
          executionTime: Date.now() - startTime
        }
      };
    }
  }
  
  private startHealthMonitoring(serviceId: string): void {
    const config = this.serviceConfigs.get(serviceId);
    if (!config?.healthCheckInterval) return;
    
    setInterval(async () => {
      await this.performHealthCheck(serviceId);
    }, config.healthCheckInterval);
  }
  
  private async performHealthCheck(serviceId: string): Promise<void> {
    const connection = this.connections.get(serviceId);
    if (!connection) return;
    
    try {
      // Try to list tools as a health check
      await connection.client.listTools();
      connection.lastPing = new Date();
      
      if (connection.status !== ConnectionStatus.CONNECTED) {
        connection.status = ConnectionStatus.CONNECTED;
        console.log(`Service ${serviceId} recovered`);
      }
    } catch (error) {
      console.warn(`Health check failed for service ${serviceId}:`, error.message);
      
      if (connection.status === ConnectionStatus.CONNECTED) {
        connection.status = ConnectionStatus.UNHEALTHY;
        await this.handleServiceFailover(serviceId);
      }
    }
  }
  
  async handleServiceFailover(failedServiceId: string): Promise<void> {
    console.log(`Attempting failover for service: ${failedServiceId}`);
    
    const config = this.serviceConfigs.get(failedServiceId);
    if (!config) return;
    
    // Disconnect current connection
    await this.disconnectFromService(failedServiceId);
    
    // Retry connection with backoff
    const retryPolicy = config.retryPolicy || { maxRetries: 3, backoffMs: 1000 };
    
    for (let attempt = 1; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, retryPolicy.backoffMs * attempt));
        await this.connectToService(config);
        
        console.log(`Service ${failedServiceId} reconnected on attempt ${attempt}`);
        return;
      } catch (error) {
        console.warn(`Reconnection attempt ${attempt} failed for ${failedServiceId}:`, error.message);
      }
    }
    
    console.error(`Failed to reconnect to service ${failedServiceId} after ${retryPolicy.maxRetries} attempts`);
  }
}
```

#### Detailed MCP Service Integrations

##### **1. Chroma MCP - RAG and Vector Database Integration**

```typescript
// lib/src/mcp/integrations/ChromaMCPIntegration.ts
export class ChromaMCPIntegration {
  constructor(private mcpClient: MCPClient) {}
  
  async initializeForWorkflows(): Promise<void> {
    // Initialize collections for different workflow patterns
    await this.createCollection('workflow-patterns', {
      description: 'ReAct, ReWOO, ADaPT pattern knowledge',
      embeddingFunction: 'all-MiniLM-L6-v2'
    });
    
    await this.createCollection('context-optimization', {
      description: 'Context optimization strategies and results',
      embeddingFunction: 'all-MiniLM-L6-v2'
    });
    
    await this.createCollection('execution-history', {
      description: 'Workflow execution outcomes and learnings',
      embeddingFunction: 'all-MiniLM-L6-v2'
    });
  }
  
  // Context Manager Integration
  async retrieveRelevantContext(query: string, options: RAGOptions): Promise<Context[]> {
    const vectorResults = await this.mcpClient.executeRemoteTool('chroma-rag', 'query_collection', {
      collection_name: 'context-optimization',
      query_texts: [query],
      n_results: options.maxResults,
      include: ['documents', 'metadatas', 'distances']
    });
    
    return this.convertToContextObjects(vectorResults);
  }
  
  // Workflow Pattern Knowledge Retrieval
  async retrievePatternKnowledge(pattern: WorkflowPattern): Promise<PatternContext> {
    const patternQuery = `${pattern.name} workflow pattern execution strategies best practices`;
    
    const results = await this.mcpClient.executeRemoteTool('chroma-rag', 'query_collection', {
      collection_name: 'workflow-patterns',
      query_texts: [patternQuery],
      n_results: 10,
      where: { pattern_type: pattern.name }
    });
    
    return this.buildPatternContext(results);
  }
  
  // Learn from Workflow Outcomes
  async learnContextEffectiveness(context: Context, workflowResult: WorkflowResult): Promise<void> {
    const learningDocument = {
      context_summary: this.summarizeContext(context),
      workflow_pattern: workflowResult.pattern,
      success_rate: workflowResult.success ? 1.0 : 0.0,
      execution_time: workflowResult.executionTime,
      effectiveness_score: this.calculateEffectivenessScore(context, workflowResult)
    };
    
    await this.mcpClient.executeRemoteTool('chroma-rag', 'add_documents', {
      collection_name: 'execution-history',
      documents: [JSON.stringify(learningDocument)],
      metadatas: [{
        pattern: workflowResult.pattern,
        timestamp: new Date().toISOString(),
        success: workflowResult.success
      }]
    });
  }
  
  // Dynamic Context Optimization for Workflows
  async optimizeWorkflowContext(workflow: ExecutableWorkflow, step: WorkflowStep): Promise<OptimizedContext> {
    const optimizationQuery = `optimize context for ${workflow.pattern} pattern step ${step.type}`;
    
    const optimizationStrategies = await this.mcpClient.executeRemoteTool('chroma-rag', 'query_collection', {
      collection_name: 'context-optimization',
      query_texts: [optimizationQuery],
      n_results: 5,
      where: { 
        pattern: workflow.pattern,
        step_type: step.type
      }
    });
    
    return this.applyOptimizationStrategies(step.context, optimizationStrategies);
  }
}
```

##### **2. Fetch Server - Web Content Integration**

```typescript
// lib/src/mcp/integrations/WebContentMCPIntegration.ts
export class WebContentMCPIntegration {
  constructor(private mcpClient: MCPClient) {}
  
  // Real-time Data Fetching for Workflows
  async fetchRealtimeData(url: string, context: WorkflowContext): Promise<WebContent> {
    const fetchResult = await this.mcpClient.executeRemoteTool('fetch-web', 'fetch_content', {
      url,
      headers: this.buildContextualHeaders(context),
      follow_redirects: true,
      timeout: 30000
    });
    
    return {
      url: fetchResult.url,
      content: fetchResult.content,
      contentType: fetchResult.content_type,
      statusCode: fetchResult.status_code,
      extractedAt: new Date(),
      context: context
    };
  }
  
  // Process Web Content for Workflow Steps
  async processWebContent(content: WebContent, extractionRules: ExtractionRule[]): Promise<ProcessedData> {
    const processed: ProcessedData = {
      structured_data: {},
      extracted_text: content.content,
      metadata: content
    };
    
    for (const rule of extractionRules) {
      switch (rule.type) {
        case 'json_extract':
          processed.structured_data[rule.name] = await this.extractJSON(content.content, rule.selector);
          break;
        case 'text_extract':
          processed.structured_data[rule.name] = await this.extractText(content.content, rule.selector);
          break;
        case 'link_extract':
          processed.structured_data[rule.name] = await this.extractLinks(content.content, rule.selector);
          break;
      }
    }
    
    return processed;
  }
  
  // Workflow-Specific Web Operations
  async executeWebWorkflowStep(step: WebWorkflowStep): Promise<WebStepResult> {
    switch (step.operation) {
      case 'fetch_and_analyze':
        const content = await this.fetchRealtimeData(step.url, step.context);
        const analysis = await this.analyzeWebContent(content, step.analysisRules);
        return { content, analysis, success: true };
        
      case 'monitor_changes':
        return await this.monitorWebChanges(step.url, step.monitoringConfig);
        
      case 'extract_structured_data':
        const webContent = await this.fetchRealtimeData(step.url, step.context);
        const structuredData = await this.processWebContent(webContent, step.extractionRules);
        return { structuredData, success: true };
        
      default:
        throw new Error(`Unsupported web operation: ${step.operation}`);
    }
  }
  
  // Integration with Workflow Patterns
  async enhanceWorkflowWithWebData(workflow: ExecutableWorkflow): Promise<EnhancedWorkflow> {
    const webEnhancedSteps = await Promise.all(
      workflow.steps.map(async step => {
        if (this.isWebCapableStep(step)) {
          const webContext = await this.buildWebContext(step);
          return { ...step, webContext, capabilities: [...step.capabilities, 'web-enhanced'] };
        }
        return step;
      })
    );
    
    return { ...workflow, steps: webEnhancedSteps };
  }
}
```

##### **3. PostgreSQL MCP - Database Integration**

```typescript
// lib/src/mcp/integrations/DatabaseMCPIntegration.ts
export class DatabaseMCPIntegration {
  constructor(private mcpClient: MCPClient) {}
  
  async initializeWorkflowTables(): Promise<void> {
    // Create workflow execution tracking tables
    await this.mcpClient.executeRemoteTool('postgresql-db', 'execute_query', {
      query: `
        CREATE TABLE IF NOT EXISTS workflow_executions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pattern VARCHAR(50) NOT NULL,
          input_text TEXT NOT NULL,
          context_data JSONB,
          execution_time INTEGER NOT NULL,
          success BOOLEAN NOT NULL,
          result_data JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS workflow_patterns_performance (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pattern VARCHAR(50) NOT NULL,
          avg_execution_time REAL NOT NULL,
          success_rate REAL NOT NULL,
          usage_count INTEGER NOT NULL,
          last_updated TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS context_optimizations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workflow_id UUID REFERENCES workflow_executions(id),
          original_size INTEGER NOT NULL,
          optimized_size INTEGER NOT NULL,
          optimization_strategy VARCHAR(100) NOT NULL,
          effectiveness_score REAL NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });
  }
  
  // Persist Workflow State and Results
  async persistWorkflowState(execution: WorkflowExecution): Promise<void> {
    await this.mcpClient.executeRemoteTool('postgresql-db', 'execute_query', {
      query: `
        INSERT INTO workflow_executions 
        (pattern, input_text, context_data, execution_time, success, result_data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `,
      params: [
        execution.pattern,
        execution.input,
        JSON.stringify(execution.context),
        execution.executionTime,
        execution.success,
        JSON.stringify(execution.result)
      ]
    });
  }
  
  // Retrieve Workflow History for Pattern Learning
  async retrieveWorkflowHistory(pattern: WorkflowPattern, limit: number = 100): Promise<WorkflowHistory[]> {
    const result = await this.mcpClient.executeRemoteTool('postgresql-db', 'execute_query', {
      query: `
        SELECT pattern, input_text, context_data, execution_time, success, result_data, created_at
        FROM workflow_executions 
        WHERE pattern = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `,
      params: [pattern.name, limit]
    });
    
    return result.rows.map(row => this.convertToWorkflowHistory(row));
  }
  
  // Analyze Workflow Performance Trends
  async analyzeWorkflowPerformance(timeRange: TimeRange): Promise<PerformanceAnalysis> {
    const performanceData = await this.mcpClient.executeRemoteTool('postgresql-db', 'execute_query', {
      query: `
        SELECT 
          pattern,
          COUNT(*) as total_executions,
          AVG(execution_time) as avg_execution_time,
          (COUNT(*) FILTER (WHERE success = true))::FLOAT / COUNT(*) as success_rate,
          MIN(created_at) as first_execution,
          MAX(created_at) as last_execution
        FROM workflow_executions 
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY pattern
        ORDER BY total_executions DESC
      `,
      params: [timeRange.start.toISOString(), timeRange.end.toISOString()]
    });
    
    return this.buildPerformanceAnalysis(performanceData.rows);
  }
  
  // Update Pattern Performance Metrics
  async updatePatternPerformance(pattern: WorkflowPattern, metrics: PatternMetrics): Promise<void> {
    await this.mcpClient.executeRemoteTool('postgresql-db', 'execute_query', {
      query: `
        INSERT INTO workflow_patterns_performance 
        (pattern, avg_execution_time, success_rate, usage_count)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (pattern) DO UPDATE SET
          avg_execution_time = EXCLUDED.avg_execution_time,
          success_rate = EXCLUDED.success_rate,
          usage_count = EXCLUDED.usage_count,
          last_updated = NOW()
      `,
      params: [pattern.name, metrics.avgExecutionTime, metrics.successRate, metrics.usageCount]
    });
  }
}
```

##### **4. Memory MCP - Knowledge Graph Integration**

```typescript
// lib/src/mcp/integrations/MemoryMCPIntegration.ts
export class MemoryMCPIntegration {
  constructor(private mcpClient: MCPClient) {}
  
  async initializeKnowledgeGraph(): Promise<void> {
    // Initialize knowledge graph for workflow patterns and relationships
    await this.mcpClient.executeRemoteTool('memory', 'create_entities', {
      entities: [
        {
          name: 'WorkflowPatterns',
          entityType: 'Category',
          observations: ['Container for all workflow pattern knowledge']
        },
        {
          name: 'ReActPattern',
          entityType: 'WorkflowPattern',
          observations: ['Reasoning and Acting pattern for dynamic problems']
        },
        {
          name: 'ReWOOPattern', 
          entityType: 'WorkflowPattern',
          observations: ['Reasoning Without Observations for complex planning']
        },
        {
          name: 'ADaPTPattern',
          entityType: 'WorkflowPattern',
          observations: ['As-needed Decomposition and Planning for variable complexity']
        }
      ]
    });
  }
  
  async storeWorkflowLearning(pattern: string, insight: WorkflowInsight): Promise<void> {
    // Store learning insights about workflow patterns
    await this.mcpClient.executeRemoteTool('memory', 'add_observations', {
      observations: [
        {
          entityName: `${pattern}Pattern`,
          contents: [
            `Successful execution with input type: ${insight.inputType}`,
            `Performance metrics: ${JSON.stringify(insight.metrics)}`,
            `Optimization applied: ${insight.optimization}`,
            `Success factors: ${insight.successFactors.join(', ')}`
          ]
        }
      ]
    });
  }
  
  async retrievePatternKnowledge(pattern: string): Promise<PatternKnowledge> {
    // Query knowledge graph for pattern-specific insights
    const results = await this.mcpClient.executeRemoteTool('memory', 'search_nodes', {
      query: `${pattern} pattern execution strategies success factors optimization`
    });
    
    return this.buildPatternKnowledge(results);
  }
  
  async createPatternRelationships(): Promise<void> {
    // Create relationships between patterns and their characteristics
    await this.mcpClient.executeRemoteTool('memory', 'create_relations', {
      relations: [
        {
          from: 'ReActPattern',
          to: 'DynamicProblems',
          relationType: 'bestSuitedFor'
        },
        {
          from: 'ReWOOPattern', 
          to: 'ComplexPlanning',
          relationType: 'excelsAt'
        },
        {
          from: 'ADaPTPattern',
          to: 'VariableComplexity',
          relationType: 'adaptsTo'
        }
      ]
    });
  }
  
  async queryWorkflowRecommendations(taskDescription: string): Promise<PatternRecommendation[]> {
    // Use knowledge graph to recommend optimal workflow patterns
    const results = await this.mcpClient.executeRemoteTool('memory', 'search_nodes', {
      query: `${taskDescription} workflow pattern recommendation optimal choice`
    });
    
    return this.buildPatternRecommendations(results);
  }
  
  private buildPatternKnowledge(results: any): PatternKnowledge {
    return {
      pattern: results.entityName,
      insights: results.observations || [],
      relationships: results.relations || [],
      confidenceScore: this.calculateConfidenceScore(results),
      lastUpdated: new Date()
    };
  }
  
  private buildPatternRecommendations(results: any[]): PatternRecommendation[] {
    return results.map(result => ({
      pattern: result.entityName,
      confidence: this.calculateConfidenceScore(result),
      reasoning: result.observations.slice(0, 3),
      expectedPerformance: this.estimatePerformance(result)
    }));
  }
  
  private calculateConfidenceScore(results: any): number {
    // Calculate confidence based on observation count and relationship strength
    return Math.min(0.95, (results.observations?.length || 0) * 0.1 + 0.5);
  }
  
  private estimatePerformance(results: any): number {
    // Estimate performance based on historical patterns
    return Math.random() * 0.3 + 0.7; // Placeholder - would use real metrics
  }
}
```

##### **5. SQLite MCP - Local Database Integration**

```typescript
// lib/src/mcp/integrations/SQLiteMCPIntegration.ts
export class SQLiteMCPIntegration {
  constructor(private mcpClient: MCPClient) {}
  
  async initializeLocalStorage(): Promise<void> {
    // Setup local SQLite databases for caching and state
    await this.mcpClient.executeRemoteTool('sqlite', 'execute', {
      sql: `
        CREATE TABLE IF NOT EXISTS workflow_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_type TEXT NOT NULL,
          input_hash TEXT NOT NULL UNIQUE,
          output_data TEXT NOT NULL,
          performance_score REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          access_count INTEGER DEFAULT 1,
          last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS pattern_optimizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pattern_type TEXT NOT NULL,
          optimization_type TEXT NOT NULL,
          optimization_data TEXT NOT NULL,
          effectiveness_score REAL,
          usage_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_cache_pattern ON workflow_cache(pattern_type);
        CREATE INDEX idx_cache_hash ON workflow_cache(input_hash);
        CREATE INDEX idx_opt_pattern ON pattern_optimizations(pattern_type);
      `
    });
  }
  
  async cacheWorkflowResult(result: WorkflowResult): Promise<void> {
    const inputHash = this.hashInput(result.input);
    
    await this.mcpClient.executeRemoteTool('sqlite', 'execute', {
      sql: `
        INSERT OR REPLACE INTO workflow_cache 
        (pattern_type, input_hash, output_data, performance_score)
        VALUES (?, ?, ?, ?)
      `,
      params: [
        result.patternType,
        inputHash,
        JSON.stringify(result.output),
        result.performanceScore
      ]
    });
  }
  
  async getCachedResult(patternType: string, input: string): Promise<CachedResult | null> {
    const inputHash = this.hashInput(input);
    
    const result = await this.mcpClient.executeRemoteTool('sqlite', 'execute', {
      sql: `
        SELECT output_data, performance_score, created_at
        FROM workflow_cache 
        WHERE pattern_type = ? AND input_hash = ?
      `,
      params: [patternType, inputHash]
    });
    
    if (result.rows.length === 0) return null;
    
    // Update access statistics
    await this.updateCacheAccess(inputHash);
    
    return {
      output: JSON.parse(result.rows[0].output_data),
      performanceScore: result.rows[0].performance_score,
      cacheDate: new Date(result.rows[0].created_at)
    };
  }
  
  async storeOptimization(optimization: PatternOptimization): Promise<void> {
    await this.mcpClient.executeRemoteTool('sqlite', 'execute', {
      sql: `
        INSERT INTO pattern_optimizations 
        (pattern_type, optimization_type, optimization_data, effectiveness_score)
        VALUES (?, ?, ?, ?)
      `,
      params: [
        optimization.patternType,
        optimization.type,
        JSON.stringify(optimization.data),
        optimization.effectivenessScore
      ]
    });
  }
  
  async getOptimizations(patternType: string): Promise<StoredOptimization[]> {
    const result = await this.mcpClient.executeRemoteTool('sqlite', 'execute', {
      sql: `
        SELECT optimization_type, optimization_data, effectiveness_score, usage_count
        FROM pattern_optimizations 
        WHERE pattern_type = ?
        ORDER BY effectiveness_score DESC
      `,
      params: [patternType]
    });
    
    return result.rows.map(row => ({
      type: row.optimization_type,
      data: JSON.parse(row.optimization_data),
      effectivenessScore: row.effectiveness_score,
      usageCount: row.usage_count
    }));
  }
  
  private hashInput(input: string): string {
    // Simple hash function for caching
    return Buffer.from(input).toString('base64').slice(0, 32);
  }
  
  private async updateCacheAccess(inputHash: string): Promise<void> {
    await this.mcpClient.executeRemoteTool('sqlite', 'execute', {
      sql: `
        UPDATE workflow_cache 
        SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP
        WHERE input_hash = ?
      `,
      params: [inputHash]
    });
  }
}
```

#### Predefined MCP Service Configurations

```typescript
// lib/src/mcp/configs/predefined-services.ts
export const PREDEFINED_MCP_SERVICES: MCPServiceConfig[] = [
  {
    id: 'chroma-rag',
    name: 'Chroma Vector Database',
    type: 'stdio',
    connectionString: 'stdio://chroma-mcp',
    command: ['npx', '@chroma-core/chroma-mcp'],
    environment: {
      CHROMA_HOST: 'localhost',
      CHROMA_PORT: '8000',
      CHROMA_COLLECTION_PREFIX: 'qi_agent_'
    },
    healthCheckInterval: 30000,
    retryPolicy: { maxRetries: 3, backoffMs: 2000 },
    integrationClass: 'ChromaMCPIntegration',
    requiredForModules: ['enhanced-context-manager', 'enhanced-workflow-engine']
  },
  {
    id: 'fetch-web',
    name: 'Web Content Fetcher',
    type: 'stdio',
    connectionString: 'stdio://fetch-mcp',
    command: ['node', 'node_modules/@modelcontextprotocol/servers/lib/fetch/index.js'],
    environment: {
      FETCH_TIMEOUT: '30000',
      FETCH_MAX_SIZE: '10485760', // 10MB
      FETCH_USER_AGENT: 'qi-v2-agent/0.8.0'
    },
    healthCheckInterval: 60000,
    retryPolicy: { maxRetries: 5, backoffMs: 1000 },
    integrationClass: 'WebContentMCPIntegration',
    requiredForModules: ['enhanced-tool-system', 'enhanced-workflow-engine']
  },
  {
    id: 'postgresql-db',
    name: 'PostgreSQL Database',
    type: 'stdio',
    connectionString: 'stdio://postgresql-mcp',
    command: ['npx', '@modelcontextprotocol/postgresql'],
    environment: {
      POSTGRES_CONNECTION: process.env.POSTGRES_CONNECTION || 'postgresql://localhost:5432/qi_agent',
      POSTGRES_SCHEMA: 'qi_workflows',
      POSTGRES_POOL_SIZE: '10'
    },
    healthCheckInterval: 30000,
    retryPolicy: { maxRetries: 3, backoffMs: 5000 },
    integrationClass: 'DatabaseMCPIntegration',
    requiredForModules: ['enhanced-state-manager', 'enhanced-workflow-engine']
  },
  {
    id: 'memory-graph',
    name: 'Knowledge Graph Memory',
    type: 'stdio',
    connectionString: 'stdio://memory-mcp',
    command: ['node', 'node_modules/@modelcontextprotocol/servers/lib/memory/index.js'],
    environment: {
      MEMORY_BACKEND: 'filesystem',
      MEMORY_PATH: './data/memory',
      MEMORY_MAX_ENTITIES: '10000'
    },
    healthCheckInterval: 45000,
    retryPolicy: { maxRetries: 3, backoffMs: 3000 },
    integrationClass: 'MemoryMCPIntegration',
    requiredForModules: ['enhanced-workflow-engine', 'enhanced-decision-engine']
  },
  {
    id: 'sqlite-cache',
    name: 'SQLite Local Cache',
    type: 'stdio',
    connectionString: 'stdio://sqlite-mcp',
    command: ['node', 'node_modules/@modelcontextprotocol/servers/lib/sqlite/index.js'],
    environment: {
      SQLITE_DB_PATH: './data/cache.db',
      SQLITE_JOURNAL_MODE: 'WAL'
    },
    healthCheckInterval: 30000,
    retryPolicy: { maxRetries: 2, backoffMs: 1000 },
    integrationClass: 'SQLiteMCPIntegration',
    requiredForModules: ['enhanced-workflow-engine', 'enhanced-state-manager']
  }
];
```

## Module 5: Enhanced Workflow Engine

### Current Foundation
- `lib/src/workflow/` - 90% Research-Grade Implementation
- Advanced patterns: ReAct, ReWOO, ADaPT with LangGraph StateGraph
- QiCore integration with Result<T> patterns
- WorkflowToolExecutor with 6-phase execution pipeline
- Two-layer architecture (Promise + QiCore layers)

### Enhancement Specification

#### Production-Ready Workflow Integration

```typescript
// lib/src/workflow/abstractions/IEnhancedWorkflowEngine.ts
import { IWorkflowEngine } from './IWorkflowEngine.js';

export interface EnhancedWorkflowEngine extends IWorkflowEngine {
  // State integration for workflow memory
  integrateStateManager(stateManager: EnhancedStateManager): Promise<void>;
  persistWorkflowHistory(execution: WorkflowExecution): Promise<void>;
  retrieveWorkflowPatterns(taskType: string): Promise<WorkflowPattern[]>;
  
  // Context optimization for workflow patterns
  integrateContextManager(contextManager: EnhancedContextManager): Promise<void>;
  optimizeContextForPattern(pattern: WorkflowPattern, context: Context): Promise<OptimizedContext>;
  selectOptimalPattern(input: string, context: Context): Promise<WorkflowPattern>;
  
  // Model coordination for workflow phases
  integrateModelManager(modelManager: ModelManager): Promise<void>;
  switchModelForPhase(phase: WorkflowPhase, pattern: WorkflowPattern): Promise<void>;
  getOptimalModelForWorkflow(workflowType: WorkflowMode): Promise<ModelInstance>;
  
  // Advanced execution and monitoring
  executeWithAdaptation(workflow: ExecutableWorkflow, state: WorkflowState): Promise<AdaptiveWorkflowResult>;
  monitorWorkflowPerformance(executionId: string): Promise<WorkflowMetrics>;
  optimizeWorkflowExecution(pattern: WorkflowPattern): Promise<OptimizationResult>;
  
  // Pattern learning and improvement
  learnFromWorkflowOutcome(execution: WorkflowExecution, outcome: WorkflowOutcome): Promise<void>;
  updatePatternEffectiveness(pattern: WorkflowPattern, metrics: WorkflowMetrics): Promise<void>;
}

export interface WorkflowMemoryIntegration {
  readonly activeWorkflows: Map<string, WorkflowExecution>;
  readonly workflowHistory: WorkflowExecution[];
  readonly patternEffectiveness: Map<string, PatternMetrics>;
  readonly learningData: WorkflowLearningData[];
}

export interface WorkflowPattern {
  readonly name: 'react' | 'rewoo' | 'adapt';
  readonly description: string;
  readonly bestForTasks: string[];
  readonly averageSteps: number;
  readonly successRate: number;
  readonly averageExecutionTime: number;
  readonly optimalModelRequirements: ModelRequirements;
}

export interface AdaptiveWorkflowResult extends WorkflowResult {
  readonly adaptations: WorkflowAdaptation[];
  readonly patternSwitches: PatternSwitch[];
  readonly performanceMetrics: DetailedWorkflowMetrics;
  readonly learningInsights: WorkflowLearning[];
}
```

#### Enhanced Workflow Engine Implementation

```typescript
// lib/src/workflow/impl/EnhancedWorkflowEngine.ts
import { QiCoreWorkflowManager } from './QiCoreWorkflowManager.js';
import { EnhancedWorkflowEngine, WorkflowPattern } from '../abstractions/IEnhancedWorkflowEngine.js';

export class EnhancedWorkflowEngineImpl implements EnhancedWorkflowEngine {
  private baseEngine: QiCoreWorkflowManager;
  private stateManager?: EnhancedStateManager;
  private contextManager?: EnhancedContextManager;
  private modelManager?: ModelManager;
  
  private workflowMemory: WorkflowMemoryIntegration;
  private patternSelector: WorkflowPatternSelector;
  private performanceMonitor: WorkflowPerformanceMonitor;
  private adaptationEngine: WorkflowAdaptationEngine;
  
  constructor(baseEngine: QiCoreWorkflowManager) {
    this.baseEngine = baseEngine;
    this.workflowMemory = new WorkflowMemoryManager();
    this.patternSelector = new MLPatternSelector();
    this.performanceMonitor = new RealTimeWorkflowMonitor();
    this.adaptationEngine = new DynamicWorkflowAdapter();
  }
  
  async integrateStateManager(stateManager: EnhancedStateManager): Promise<void> {
    this.stateManager = stateManager;
    
    // Initialize workflow memory in long-term memory
    await this.stateManager.longTermMemory.addProcedure({
      procedure_name: 'workflow_execution_patterns',
      steps: [],
      conditions: {},
      success_rate: 0,
      usage_count: 0
    });
    
    // Load existing workflow history
    const existingPatterns = await this.stateManager.longTermMemory.queryKnowledge({
      domain: 'workflow_execution',
      type: 'procedural'
    });
    
    this.workflowMemory.loadFromState(existingPatterns);
  }
  
  async integrateContextManager(contextManager: EnhancedContextManager): Promise<void> {
    this.contextManager = contextManager;
    
    // Register workflow context optimization strategies
    await this.contextManager.registerOptimizationStrategy('workflow-react', {
      name: 'ReAct Pattern Optimization',
      maxContextSize: 16000,
      relevanceThreshold: 0.8,
      priorityWeights: {
        recent_observations: 0.4,
        tool_results: 0.3,
        reasoning_history: 0.3
      }
    });
    
    await this.contextManager.registerOptimizationStrategy('workflow-rewoo', {
      name: 'ReWOO Pattern Optimization', 
      maxContextSize: 20000,
      relevanceThreshold: 0.7,
      priorityWeights: {
        planning_context: 0.5,
        tool_results: 0.3,
        reasoning_chain: 0.2
      }
    });
  }
  
  async selectOptimalPattern(input: string, context: Context): Promise<WorkflowPattern> {
    // Analyze input complexity and task type
    const taskAnalysis = await this.analyzeTaskComplexity(input);
    
    // Get relevant historical patterns
    const historicalPatterns = this.workflowMemory.patternEffectiveness;
    
    // Use ML pattern selector
    const patternRecommendation = await this.patternSelector.selectPattern({
      input,
      context,
      taskAnalysis,
      historicalData: historicalPatterns
    });
    
    return patternRecommendation;
  }
  
  async executeWithAdaptation(workflow: ExecutableWorkflow, state: WorkflowState): Promise<AdaptiveWorkflowResult> {
    const executionId = generateId();
    const startTime = Date.now();
    
    // Start performance monitoring
    const monitor = await this.performanceMonitor.startMonitoring(executionId, workflow);
    
    // Execute with adaptation capabilities
    const adaptations: WorkflowAdaptation[] = [];
    const patternSwitches: PatternSwitch[] = [];
    
    try {
      let currentWorkflow = workflow;
      let currentState = state;
      
      while (!this.isWorkflowComplete(currentState)) {
        // Monitor performance and check for adaptation needs
        const performanceMetrics = await monitor.getCurrentMetrics();
        
        if (this.shouldAdaptWorkflow(performanceMetrics)) {
          const adaptation = await this.adaptationEngine.adaptWorkflow(
            currentWorkflow,
            currentState,
            performanceMetrics
          );
          
          adaptations.push(adaptation);
          currentWorkflow = adaptation.adaptedWorkflow;
          
          if (adaptation.patternSwitch) {
            patternSwitches.push(adaptation.patternSwitch);
          }
        }
        
        // Execute next step
        const stepResult = await this.baseEngine.executeStep(currentWorkflow, currentState);
        currentState = this.updateWorkflowState(currentState, stepResult);
      }
      
      const endTime = Date.now();
      const finalMetrics = await monitor.finalizeMetrics();
      
      // Learn from execution
      await this.learnFromExecution(executionId, workflow, adaptations, finalMetrics);
      
      return {
        ...this.buildWorkflowResult(currentState),
        adaptations,
        patternSwitches,
        performanceMetrics: finalMetrics,
        learningInsights: await this.extractLearningInsights(executionId, adaptations)
      };
      
    } catch (error) {
      await monitor.recordError(error);
      throw error;
    }
  }
  
  private async analyzeTaskComplexity(input: string): Promise<TaskComplexityAnalysis> {
    // Use existing context manager for analysis if available
    if (this.contextManager) {
      const relevantContext = await this.contextManager.retrieveRelevantContext(input, {
        maxResults: 5,
        relevanceThreshold: 0.7
      });
      
      return {
        complexity: this.calculateComplexityScore(input, relevantContext),
        taskType: this.classifyTaskType(input),
        estimatedSteps: this.estimateStepCount(input),
        requiredCapabilities: this.identifyRequiredCapabilities(input)
      };
    }
    
    // Fallback to basic analysis
    return this.basicTaskAnalysis(input);
  }
}
```

#### Workflow Pattern Optimization

```typescript
// lib/src/workflow/optimization/WorkflowPatternSelector.ts
export class MLPatternSelector {
  async selectPattern(selectionContext: PatternSelectionContext): Promise<WorkflowPattern> {
    const { input, context, taskAnalysis, historicalData } = selectionContext;
    
    // Calculate pattern scores based on multiple factors
    const patternScores = await Promise.all([
      this.scoreReActPattern(input, taskAnalysis, historicalData),
      this.scoreReWOOPattern(input, taskAnalysis, historicalData),
      this.scoreADaPTPattern(input, taskAnalysis, historicalData)
    ]);
    
    // Select highest scoring pattern with confidence threshold
    const bestPattern = this.selectBestPattern(patternScores);
    
    // If confidence is low, use adaptive pattern
    if (bestPattern.confidence < 0.7) {
      return this.createAdaptivePattern(patternScores);
    }
    
    return bestPattern.pattern;
  }
  
  private async scoreReActPattern(input: string, analysis: TaskComplexityAnalysis, historical: Map<string, PatternMetrics>): Promise<PatternScore> {
    const baseScore = this.calculateBaseScore('react', analysis);
    const historicalScore = this.getHistoricalScore('react', historical);
    const taskFitScore = this.calculateTaskFit('react', input, analysis);
    
    return {
      pattern: 'react',
      score: (baseScore * 0.4) + (historicalScore * 0.3) + (taskFitScore * 0.3),
      confidence: this.calculateConfidence('react', analysis),
      reasoning: `ReAct selected for dynamic problem requiring ${analysis.estimatedSteps} adaptation steps`
    };
  }
}
```

## Module 6: Enhanced Tool System

### Current Foundation
- `lib/src/tools/` - 95% Comprehensive Implementation
- 6-phase execution pipeline (validation, pre-execution, execution, post-execution, cleanup, logging)
- 14 operational tools with security framework
- Tool registry and discovery system

### Enhancement Specification

#### Advanced Tool Integration with MCP

```typescript
// lib/src/tools/abstractions/IEnhancedToolSystem.ts
import { IToolExecutor } from './IToolExecutor.js';

export interface EnhancedToolSystem extends IToolExecutor {
  // MCP tool proxy integration
  registerMCPToolProxy(mcpClient: MCPClient): Promise<void>;
  executeRemoteTool(serviceId: string, toolName: string, params: any): Promise<ToolResult>;
  discoverMCPTools(): Promise<RemoteToolInfo[]>;
  
  // Advanced tool orchestration
  executeToolChain(chain: ToolChain): Promise<ChainResult>;
  optimizeToolSelection(task: ToolTask, availableTools: Tool[]): Promise<OptimalToolSelection>;
  
  // Performance monitoring and analytics
  monitorToolPerformance(toolName: string): Promise<ToolMetrics>;
  analyzeToolUsagePatterns(): Promise<UsageAnalytics>;
  optimizeToolExecution(toolName: string): Promise<OptimizationResult>;
  
  // Security and compliance
  validateToolSecurity(tool: Tool): Promise<SecurityValidation>;
  enforceToolCompliance(execution: ToolExecution): Promise<ComplianceResult>;
  auditToolAccess(toolName: string, context: ExecutionContext): Promise<AccessAudit>;
  
  // Workflow integration
  integrateWithWorkflowEngine(workflowEngine: EnhancedWorkflowEngine): Promise<void>;
  executeWorkflowTools(workflowContext: WorkflowContext): Promise<WorkflowToolResult>;
}

export interface ToolChain {
  readonly id: string;
  readonly tools: ToolStep[];
  readonly dependencies: ToolDependency[];
  readonly parallelExecution: boolean;
  readonly errorHandling: ChainErrorStrategy;
}

export interface OptimalToolSelection {
  readonly selectedTool: Tool;
  readonly alternativeTools: Tool[];
  readonly selectionReasoning: string;
  readonly confidence: number;
  readonly estimatedPerformance: PerformanceEstimate;
}
```

## Module 7: System Integration

### Objective
Integrate all enhanced modules and ensure seamless operation across the entire qi-v2-agent system.

### Integration Architecture

```typescript
// lib/src/integration/SystemIntegrator.ts
export class SystemIntegrator {
  async integrateEnhancedModules(config: IntegrationConfig): Promise<IntegratedSystem> {
    // Initialize all enhanced modules
    const enhancedStateManager = new EnhancedStateManager(config.stateManager);
    const enhancedContextManager = new EnhancedContextManager(config.contextManager);
    const modelManager = new OllamaModelManager(config.modelManager);
    const mcpClient = new MCPClientImpl(config.mcpClient);
    const enhancedWorkflowEngine = new EnhancedWorkflowEngine(config.workflowEngine);
    const enhancedToolSystem = new EnhancedToolSystem(config.toolSystem);
    
    // Cross-module integration
    await this.integrateStateWithContext(enhancedStateManager, enhancedContextManager);
    await this.integrateContextWithWorkflow(enhancedContextManager, enhancedWorkflowEngine);
    await this.integrateWorkflowWithTools(enhancedWorkflowEngine, enhancedToolSystem);
    await this.integrateMCPAcrossModules(mcpClient, [
      enhancedContextManager,
      enhancedWorkflowEngine,
      enhancedToolSystem
    ]);
    
    // Validate integration
    await this.validateSystemIntegration();
    
    return new IntegratedSystem({
      stateManager: enhancedStateManager,
      contextManager: enhancedContextManager,
      modelManager,
      mcpClient,
      workflowEngine: enhancedWorkflowEngine,
      toolSystem: enhancedToolSystem
    });
  }
}
```

### Integration Testing Strategy

```typescript
// Integration test specifications
describe('Enhanced System Integration', () => {
  it('should coordinate state, context, and workflow execution', async () => {
    const system = await createIntegratedSystem();
    
    // Test cross-module workflow execution
    const workflowResult = await system.executeCompleteWorkflow({
      input: 'Analyze codebase and suggest improvements',
      pattern: 'react',
      useRAG: true,
      persistResults: true
    });
    
    expect(workflowResult.success).toBe(true);
    expect(workflowResult.stateUpdates).toBeDefined();
    expect(workflowResult.contextOptimizations).toBeDefined();
    expect(workflowResult.toolExecutions).toHaveLength(greaterThan(0));
  });
});
```

## Module 8: Performance Optimization

### Objective
Optimize system performance for production deployment with comprehensive monitoring and tuning.

### Performance Targets
- System response time: <2 seconds
- Memory usage: <4GB for standard operations  
- MCP protocol overhead: <10ms per operation
- Workflow execution efficiency: >85% optimal tool selection
- Context optimization: 30% size reduction with >85% relevance retention

### Optimization Implementation

```typescript
// lib/src/performance/SystemOptimizer.ts
export class SystemOptimizer {
  async optimizeSystemPerformance(system: IntegratedSystem): Promise<OptimizationResult> {
    const optimizations = await Promise.all([
      this.optimizeMemoryUsage(system),
      this.optimizeContextProcessing(system.contextManager),
      this.optimizeWorkflowExecution(system.workflowEngine),
      this.optimizeMCPCommunication(system.mcpClient),
      this.optimizeToolSelection(system.toolSystem)
    ]);
    
    return this.combineOptimizations(optimizations);
  }
  
  private async optimizeMemoryUsage(system: IntegratedSystem): Promise<MemoryOptimization> {
    // Memory profiling and optimization
    const memoryProfile = await this.profileMemoryUsage(system);
    
    // Implement caching strategies
    await this.implementIntelligentCaching(system);
    
    // Optimize state persistence
    await this.optimizeStatePersistence(system.stateManager);
    
    return {
      beforeOptimization: memoryProfile.baseline,
      afterOptimization: await this.measureMemoryUsage(system),
      optimizations: ['intelligent_caching', 'state_persistence', 'context_pruning'],
      improvement: memoryProfile.improvement
    };
  }
}
```

## Installation and Setup Guide

### Prerequisites

#### Core Dependencies
```bash
# MCP Protocol Support
npm install @modelcontextprotocol/sdk@^1.0.0

# Database Support
npm install sqlite3@^5.1.6
npm install pg@^8.11.3                    # PostgreSQL client

# HTTP Client and Utilities
npm install axios@^1.6.0
npm install ws@^8.16.0                    # WebSocket support for MCP

# Development Dependencies
npm install --save-dev @types/sqlite3@^3.1.9
npm install --save-dev @types/pg@^8.10.9
npm install --save-dev @types/ws@^8.5.10
```

#### MCP Server Installation
```bash
# Production-ready RAG server
npm install -g @chroma-core/chroma-mcp@latest

# Official MCP servers collection
npm install -g @modelcontextprotocol/servers@latest

# Optional: PostgreSQL MCP server
npm install -g @modelcontextprotocol/postgresql@latest
```

#### System Requirements
```bash
# Ollama for model management
curl -fsSL https://ollama.ai/install.sh | sh

# ChromaDB for vector storage (if using Chroma MCP)
pip install chromadb==0.4.22

# PostgreSQL (optional, for advanced persistence)
# macOS: brew install postgresql@15
# Ubuntu: sudo apt-get install postgresql-15
```

### Database Setup

```bash
# Create SQLite database for enhanced state
mkdir -p data/state
sqlite3 data/state/enhanced_state.db < lib/src/state/sql/enhanced_state_schema.sql

# Setup PostgreSQL for MCP integration (optional)
createdb qi_agent
psql qi_agent < lib/src/mcp/sql/mcp_integration_schema.sql
```

### Configuration

```typescript
// config/enhanced.config.ts
export const ENHANCED_CONFIG = {
  stateManager: {
    databasePath: './data/state/enhanced_state.db',
    memoryTiers: {
      shortTerm: { maxAge: 4 * 60 * 60 * 1000 }, // 4 hours
      mediumTerm: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
      longTerm: { pruneAfter: 30 * 24 * 60 * 60 * 1000 } // 30 days
    }
  },
  contextManager: {
    ragEnabled: true,
    optimizationThreshold: 0.7,
    maxContextSize: 32000
  },
  modelManager: {
    ollamaUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2:3b',
    modelCacheSize: 3
  },
  mcpClient: {
    autoConnect: true,
    healthCheckInterval: 30000,
    defaultServices: ['chroma-rag', 'fetch-web']
  }
};
```

## Testing Strategy

### Unit Tests

```bash
# Run enhanced state manager tests
npm test -- lib/src/state/__tests__/

# Run context optimization tests  
npm test -- lib/src/context/__tests__/

# Run model manager tests
npm test -- lib/src/models/__tests__/

# Run MCP client tests
npm test -- lib/src/mcp/__tests__/
```

### Integration Tests

```bash
# Test MCP service connectivity
npm run test:integration:mcp

# Test RAG integration
npm run test:integration:rag

# Test model lifecycle
npm run test:integration:models
```

### Performance Tests

```bash
# Context optimization performance
npm run perf:context

# Model switching performance
npm run perf:models

# Memory usage validation
npm run perf:memory
```

## Success Criteria

### Performance Targets
- Multi-tier memory access: <100ms
- Context optimization: 30% size reduction
- Model switching: <5 seconds
- MCP protocol overhead: <10ms per operation

### Functionality Targets
- State persistence across sessions: ✅
- RAG integration with Chroma MCP: ✅
- Automatic context optimization: ✅
- Model lifecycle management: ✅
- Service failover handling: ✅

### Quality Targets
- Unit test coverage: >90%
- Integration test coverage: >80%
- Performance regression tests: ✅
- Memory leak detection: ✅

## Technology References

### Core Technologies

#### **MCP (Model Context Protocol)**
- **Official SDK**: [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- **Protocol Specification**: [MCP Protocol Docs](https://modelcontextprotocol.io/specification/2025-03-26)
- **TypeScript Guide**: [MCP TypeScript Documentation](https://modelcontextprotocol.io/docs/sdk/typescript)
- **Client Development**: [Building MCP Clients](https://modelcontextprotocol.info/docs/tutorials/building-a-client-node/)

#### **Chroma Vector Database**
- **Official MCP Server**: [chroma-core/chroma-mcp](https://github.com/chroma-core/chroma-mcp)
- **ChromaDB Documentation**: [Chroma Docs](https://docs.trychroma.com/)
- **Python Client**: [chromadb==0.4.22](https://pypi.org/project/chromadb/)
- **TypeScript Integration**: [Chroma TypeScript Examples](https://docs.trychroma.com/getting-started)

#### **Database Technologies**
- **SQLite3**: [sqlite3 npm package](https://www.npmjs.com/package/sqlite3)
  - [SQLite Documentation](https://www.sqlite.org/docs.html)
  - [SQLite Performance Tuning](https://www.sqlite.org/optoverview.html)
- **PostgreSQL**: [pg npm package](https://www.npmjs.com/package/pg)
  - [PostgreSQL Documentation](https://www.postgresql.org/docs/15/)
  - [Connection Pooling Guide](https://node-postgres.com/features/pooling)

#### **Model Management**
- **Ollama**: [Ollama Installation](https://ollama.ai/download)
  - [Ollama API Documentation](https://github.com/ollama/ollama/blob/main/docs/api.md)
  - [Model Library](https://ollama.ai/library)
  - [Performance Optimization](https://github.com/ollama/ollama/blob/main/docs/performance.md)

### Testing and Quality Assurance

#### **Testing Frameworks**
- **Jest**: [Jest Testing Framework](https://jestjs.io/docs/getting-started)
  - **TypeScript Setup**: [Jest with TypeScript](https://jestjs.io/docs/getting-started#using-typescript)
  - **Async Testing**: [Testing Asynchronous Code](https://jestjs.io/docs/asynchronous)
- **Supertest**: [API Testing](https://www.npmjs.com/package/supertest)

#### **Performance Testing**
- **Artillery**: [Load Testing](https://www.artillery.io/docs)
- **Clinic.js**: [Node.js Performance Profiling](https://clinicjs.org/)
- **0x**: [Flame Graph Profiling](https://www.npmjs.com/package/0x)

#### **Code Quality**
- **ESLint**: [TypeScript ESLint](https://typescript-eslint.io/)
- **Prettier**: [Code Formatting](https://prettier.io/docs/en/configuration.html)
- **Husky**: [Git Hooks](https://typicode.github.io/husky/)

### Development Tools

#### **TypeScript Configuration**
- **TypeScript**: [v5.3+ Configuration](https://www.typescriptlang.org/tsconfig)
- **ts-node**: [TypeScript Execution](https://typestrong.org/ts-node/)
- **nodemon**: [Development Server](https://nodemon.io/)

#### **Monitoring and Observability**
- **Prometheus**: [Node.js Metrics](https://prometheus.io/docs/guides/node-exporter/)
  - **prom-client**: [Prometheus Client for Node.js](https://www.npmjs.com/package/prom-client)
- **OpenTelemetry**: [Distributed Tracing](https://opentelemetry.io/docs/instrumentation/js/)

### External Service Documentation

#### **MCP Server References**
- **Fetch Server**: [HTTP Content Fetcher](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch)
- **Memory Server**: [Knowledge Graph Storage](https://github.com/modelcontextprotocol/servers/tree/main/src/memory)
- **PostgreSQL Server**: [Database Operations](https://github.com/modelcontextprotocol/servers/tree/main/src/postgresql)

#### **Version Compatibility Matrix**
```yaml
compatibility_matrix:
  node_js: ">=18.0.0"
  typescript: ">=5.3.0"
  mcp_sdk: "^1.0.0"
  ollama: ">=0.1.17"
  chromadb: ">=0.4.20"
  sqlite3: ">=5.1.0"
  postgresql: ">=15.0"
```

---

**Next Steps**: Proceed with implementation of these enhanced modules, starting with the Enhanced State Manager and progressing through Context Manager, Model Manager, and MCP Client integration.