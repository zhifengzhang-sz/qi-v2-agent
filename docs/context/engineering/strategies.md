# Context Engineering Strategies Implementation Guide

**Document Version**: 1.0  
**Date**: 2025-01-25  
**Status**: Design Phase  
**Target**: v-0.11.x Context Engineering Foundation

## Overview

This guide provides detailed implementations for the four core context engineering strategies: **Write, Select, Compress, and Isolate**. These strategies are based on 2025 research and implemented using TypeScript with QiCore Result<T> patterns and MCP service integration.

## Strategy Pattern Architecture

```typescript
// Base strategy interface
interface ContextStrategy {
  readonly name: string;
  readonly version: string;
  initialize(): Promise<Result<void, QiError>>;
  cleanup(): Promise<Result<void, QiError>>;
  getMetrics(): StrategyMetrics;
}

// Strategy registry for pluggable implementations
class StrategyRegistry {
  private strategies = new Map<string, ContextStrategy>();
  
  register<T extends ContextStrategy>(name: string, strategy: T): Result<void, QiError> {
    if (this.strategies.has(name)) {
      return failure(create('STRATEGY_EXISTS', `Strategy ${name} already registered`, 'BUSINESS'));
    }
    
    this.strategies.set(name, strategy);
    return success(undefined);
  }
  
  get<T extends ContextStrategy>(name: string): T | undefined {
    return this.strategies.get(name) as T;
  }
}
```

## Write Strategy: External Memory Management

### **Purpose**
Store context outside the immediate LLM prompt to preserve working memory while maintaining accessibility.

### **Core Interface**

```typescript
interface WriteStrategy extends ContextStrategy {
  // External storage operations
  storeInScratchpad(context: Context, namespace?: string): Promise<Result<ScratchpadRef, QiError>>;
  storeInMemory(context: Context, ttl?: number): Promise<Result<MemoryRef, QiError>>;
  storeInStateObject(context: Context, schema: z.ZodSchema): Promise<Result<StateRef, QiError>>;
  
  // Retrieval operations
  retrieveFromScratchpad(ref: ScratchpadRef): Promise<Result<Context, QiError>>;
  retrieveFromMemory(ref: MemoryRef): Promise<Result<Context, QiError>>;
  retrieveFromStateObject(ref: StateRef): Promise<Result<Context, QiError>>;
  
  // Bulk operations
  batchStore(contexts: Context[], storage: StorageType): Promise<Result<StorageRef[], QiError>>;
  batchRetrieve(refs: StorageRef[]): Promise<Result<Context[], QiError>>;
  
  // Lifecycle management
  evictExpired(): Promise<Result<StorageRef[], QiError>>;
  compactStorage(): Promise<Result<void, QiError>>;
}

// Reference types
interface ScratchpadRef {
  id: string;
  namespace: string;
  createdAt: Date;
  ttl?: number;
}

interface MemoryRef {
  id: string;
  key: string;
  createdAt: Date;
  expiresAt?: Date;
}

interface StateRef {
  id: string;
  schemaVersion: string;
  fields: string[];
  createdAt: Date;
}

type StorageRef = ScratchpadRef | MemoryRef | StateRef;
type StorageType = 'scratchpad' | 'memory' | 'state';
```

### **Implementation**

```typescript
class MCPWriteStrategy implements WriteStrategy {
  readonly name = 'mcp-write-strategy';
  readonly version = '1.0';
  
  private memoryService: MCPServiceConnection;
  private filesystemService: MCPServiceConnection;
  private logger: SimpleLogger;
  private metrics: WriteStrategyMetrics;
  
  constructor(
    memoryService: MCPServiceConnection,
    filesystemService: MCPServiceConnection,
    logger: SimpleLogger
  ) {
    this.memoryService = memoryService;
    this.filesystemService = filesystemService;
    this.logger = logger;
    this.metrics = new WriteStrategyMetrics();
  }
  
  async initialize(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Initialize scratchpad namespaces
        await this.initializeScratchpadNamespaces();
        
        // Setup cleanup intervals
        this.setupCleanupIntervals();
        
        this.logger.info('Write strategy initialized', { strategy: this.name });
        return success(undefined);
      },
      (error) => create('WRITE_STRATEGY_INIT_ERROR', `Initialization failed: ${error}`, 'SYSTEM')
    );
  }
  
  async storeInMemory(context: Context, ttl?: number): Promise<Result<MemoryRef, QiError>> {
    const timer = this.metrics.operationLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        const key = `context:memory:${context.id}`;
        const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : undefined;
        
        // Serialize context with metadata
        const payload = {
          context,
          storedAt: new Date(),
          expiresAt,
          version: this.version
        };
        
        // Store in memory service
        await this.memoryService.client.callTool({
          name: 'store',
          arguments: { 
            key, 
            value: JSON.stringify(payload),
            ttl: ttl 
          }
        });
        
        const ref: MemoryRef = {
          id: context.id,
          key,
          createdAt: new Date(),
          expiresAt
        };
        
        this.metrics.storageOperations.inc({ type: 'memory', operation: 'store' });
        timer.end();
        
        this.logger.debug('Context stored in memory', { 
          contextId: context.id, 
          key, 
          ttl 
        });
        
        return success(ref);
      },
      (error) => {
        timer.end();
        this.metrics.storageErrors.inc({ type: 'memory', operation: 'store' });
        return create('MEMORY_STORE_ERROR', `Failed to store in memory: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async storeInScratchpad(context: Context, namespace = 'default'): Promise<Result<ScratchpadRef, QiError>> {
    const timer = this.metrics.operationLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        const scratchpadPath = `./scratchpad/${namespace}/${context.id}.json`;
        
        // Create namespace directory if needed
        await this.ensureNamespaceExists(namespace);
        
        // Prepare scratchpad entry
        const entry = {
          context,
          metadata: {
            storedAt: new Date(),
            namespace,
            version: this.version,
            tags: context.metadata.tags
          }
        };
        
        // Store in filesystem
        await this.filesystemService.client.callTool({
          name: 'write_file',
          arguments: {
            path: scratchpadPath,
            content: JSON.stringify(entry, null, 2)
          }
        });
        
        const ref: ScratchpadRef = {
          id: context.id,
          namespace,
          createdAt: new Date()
        };
        
        // Update namespace index
        await this.updateNamespaceIndex(namespace, ref);
        
        this.metrics.storageOperations.inc({ type: 'scratchpad', operation: 'store' });
        timer.end();
        
        this.logger.debug('Context stored in scratchpad', { 
          contextId: context.id, 
          namespace,
          path: scratchpadPath 
        });
        
        return success(ref);
      },
      (error) => {
        timer.end();
        this.metrics.storageErrors.inc({ type: 'scratchpad', operation: 'store' });
        return create('SCRATCHPAD_STORE_ERROR', `Failed to store in scratchpad: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async storeInStateObject(context: Context, schema: z.ZodSchema): Promise<Result<StateRef, QiError>> {
    const timer = this.metrics.operationLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        // Validate context against schema
        const validation = schema.safeParse(context.content);
        if (!validation.success) {
          return failure(create('SCHEMA_VALIDATION_ERROR', 'Context does not match schema', 'VALIDATION'));
        }
        
        const stateKey = `context:state:${context.id}`;
        const schemaVersion = schema._def.description || 'unknown';
        
        // Extract fields from schema for selective exposure
        const fields = this.extractSchemaFields(schema);
        
        // Create state object with selective field exposure
        const stateObject = {
          id: context.id,
          schemaVersion,
          fields,
          data: validation.data,
          metadata: {
            createdAt: new Date(),
            lastAccessed: new Date(),
            accessCount: 0
          }
        };
        
        // Store in memory with special state prefix
        await this.memoryService.client.callTool({
          name: 'store',
          arguments: {
            key: stateKey,
            value: JSON.stringify(stateObject)
          }
        });
        
        const ref: StateRef = {
          id: context.id,
          schemaVersion,
          fields,
          createdAt: new Date()
        };
        
        this.metrics.storageOperations.inc({ type: 'state', operation: 'store' });
        timer.end();
        
        this.logger.debug('Context stored as state object', { 
          contextId: context.id, 
          schemaVersion,
          fields: fields.length 
        });
        
        return success(ref);
      },
      (error) => {
        timer.end();
        this.metrics.storageErrors.inc({ type: 'state', operation: 'store' });
        return create('STATE_STORE_ERROR', `Failed to store state object: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async retrieveFromMemory(ref: MemoryRef): Promise<Result<Context, QiError>> {
    const timer = this.metrics.operationLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        // Check if reference has expired
        if (ref.expiresAt && ref.expiresAt < new Date()) {
          timer.end();
          return failure(create('MEMORY_EXPIRED', 'Memory reference has expired', 'BUSINESS'));
        }
        
        const result = await this.memoryService.client.callTool({
          name: 'retrieve',
          arguments: { key: ref.key }
        });
        
        if (!result.content) {
          timer.end();
          return failure(create('MEMORY_NOT_FOUND', `Context not found in memory: ${ref.id}`, 'BUSINESS'));
        }
        
        const payload = JSON.parse(result.content);
        const context = payload.context as Context;
        
        // Validate retrieved context
        const validation = validateContext(context);
        if (validation.tag === 'failure') {
          timer.end();
          return validation;
        }
        
        // Update access metadata
        await this.updateAccessMetadata(ref.key, 'memory');
        
        this.metrics.storageOperations.inc({ type: 'memory', operation: 'retrieve' });
        timer.end();
        
        this.logger.debug('Context retrieved from memory', { contextId: context.id });
        
        return success(context);
      },
      (error) => {
        timer.end();
        this.metrics.storageErrors.inc({ type: 'memory', operation: 'retrieve' });
        return create('MEMORY_RETRIEVE_ERROR', `Failed to retrieve from memory: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async batchStore(contexts: Context[], storage: StorageType): Promise<Result<StorageRef[], QiError>> {
    const timer = this.metrics.operationLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        const refs: StorageRef[] = [];
        const batchSize = 10; // Process in batches to avoid overwhelming services
        
        for (let i = 0; i < contexts.length; i += batchSize) {
          const batch = contexts.slice(i, i + batchSize);
          
          const batchPromises = batch.map(async (context) => {
            switch (storage) {
              case 'memory':
                return await this.storeInMemory(context);
              case 'scratchpad':
                return await this.storeInScratchpad(context);
              case 'state':
                // Use default schema for batch state storage
                return await this.storeInStateObject(context, ContextSchema);
              default:
                return failure(create('INVALID_STORAGE_TYPE', `Invalid storage type: ${storage}`, 'BUSINESS'));
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          
          // Collect successful results
          for (const result of batchResults) {
            if (result.tag === 'success') {
              refs.push(result.value);
            } else {
              // Log error but continue with other contexts
              this.logger.warn('Batch store partial failure', { error: result.error });
            }
          }
        }
        
        this.metrics.batchOperations.inc({ type: storage, operation: 'store', size: contexts.length });
        timer.end();
        
        this.logger.info('Batch store completed', { 
          total: contexts.length, 
          successful: refs.length,
          storage 
        });
        
        return success(refs);
      },
      (error) => {
        timer.end();
        this.metrics.batchErrors.inc({ type: storage, operation: 'store' });
        return create('BATCH_STORE_ERROR', `Batch store failed: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async evictExpired(): Promise<Result<StorageRef[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const evictedRefs: StorageRef[] = [];
        
        // Evict expired memory contexts
        const memoryEvicted = await this.evictExpiredMemory();
        if (memoryEvicted.tag === 'success') {
          evictedRefs.push(...memoryEvicted.value);
        }
        
        // Clean up old scratchpad entries
        const scratchpadEvicted = await this.evictOldScratchpadEntries();
        if (scratchpadEvicted.tag === 'success') {
          evictedRefs.push(...scratchpadEvicted.value);
        }
        
        this.metrics.evictionOperations.inc({ count: evictedRefs.length });
        
        this.logger.info('Expired contexts evicted', { count: evictedRefs.length });
        
        return success(evictedRefs);
      },
      (error) => create('EVICTION_ERROR', `Eviction failed: ${error}`, 'SYSTEM')
    );
  }
  
  // Helper methods
  private async ensureNamespaceExists(namespace: string): Promise<void> {
    await this.filesystemService.client.callTool({
      name: 'create_directory',
      arguments: { path: `./scratchpad/${namespace}` }
    });
  }
  
  private async updateNamespaceIndex(namespace: string, ref: ScratchpadRef): Promise<void> {
    const indexPath = `./scratchpad/${namespace}/index.json`;
    
    let index: Record<string, ScratchpadRef> = {};
    try {
      const existingIndex = await this.filesystemService.client.callTool({
        name: 'read_file',
        arguments: { path: indexPath }
      });
      if (existingIndex.content) {
        index = JSON.parse(existingIndex.content);
      }
    } catch {
      // Index doesn't exist, will create new one
    }
    
    index[ref.id] = ref;
    
    await this.filesystemService.client.callTool({
      name: 'write_file',
      arguments: {
        path: indexPath,
        content: JSON.stringify(index, null, 2)
      }
    });
  }
  
  private extractSchemaFields(schema: z.ZodSchema): string[] {
    // Simple field extraction - could be enhanced for complex schemas
    if (schema instanceof z.ZodObject) {
      return Object.keys(schema.shape);
    }
    return [];
  }
  
  getMetrics(): WriteStrategyMetrics {
    return this.metrics;
  }
}
```

## Select Strategy: Intelligent Retrieval

### **Core Interface**

```typescript
interface SelectStrategy extends ContextStrategy {
  // Relevance scoring
  scoreRelevance(context: Context, query: string): Promise<Result<number, QiError>>;
  scoreRelevanceBatch(contexts: Context[], query: string): Promise<Result<ScoredContext[], QiError>>;
  
  // Selection methods
  selectByRelevance(contexts: Context[], query: string, limit: number): Promise<Result<Context[], QiError>>;
  selectByRecency(contexts: Context[], limit: number): Promise<Result<Context[], QiError>>;
  selectByPriority(contexts: Context[], limit: number): Promise<Result<Context[], QiError>>;
  
  // Advanced selection
  selectBySemanticSimilarity(query: string, limit: number): Promise<Result<Context[], QiError>>;
  selectByTaskRelevance(task: TaskDescription, limit: number): Promise<Result<Context[], QiError>>;
  
  // Multi-criteria selection
  selectMultiCriteria(criteria: SelectionCriteria): Promise<Result<Context[], QiError>>;
  
  // Optimization
  optimizeSelection(contexts: Context[], constraints: SelectionConstraints): Promise<Result<Context[], QiError>>;
}

interface ScoredContext {
  context: Context;
  score: number;
  scoringMethod: string;
  scoredAt: Date;
}

interface SelectionCriteria {
  query?: string;
  relevanceWeight: number;
  recencyWeight: number;
  priorityWeight: number;
  limit: number;
  minScore?: number;
}

interface SelectionConstraints {
  maxTokens?: number;
  maxContexts?: number;
  requiredTypes?: ContextType[];
  excludeTypes?: ContextType[];
  timeRange?: { start: Date; end: Date };
}
```

### **Implementation**

```typescript
class IntelligentSelectStrategy implements SelectStrategy {
  readonly name = 'intelligent-select-strategy';
  readonly version = '1.0';
  
  private sqliteService: MCPServiceConnection;
  private memoryService: MCPServiceConnection;
  private logger: SimpleLogger;
  private metrics: SelectStrategyMetrics;
  private semanticCache: Map<string, ScoredContext[]>;
  
  constructor(
    sqliteService: MCPServiceConnection,
    memoryService: MCPServiceConnection,
    logger: SimpleLogger
  ) {
    this.sqliteService = sqliteService;
    this.memoryService = memoryService;
    this.logger = logger;
    this.metrics = new SelectStrategyMetrics();
    this.semanticCache = new Map();
  }
  
  async scoreRelevance(context: Context, query: string): Promise<Result<number, QiError>> {
    const timer = this.metrics.scoringLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        // Multi-factor relevance scoring
        let score = 0;
        let totalWeight = 0;
        
        // 1. Content similarity (40% weight)
        const contentScore = await this.calculateContentSimilarity(context, query);
        score += contentScore * 0.4;
        totalWeight += 0.4;
        
        // 2. Metadata relevance (30% weight)
        const metadataScore = this.calculateMetadataRelevance(context, query);
        score += metadataScore * 0.3;
        totalWeight += 0.3;
        
        // 3. Recency bonus (20% weight)
        const recencyScore = this.calculateRecencyScore(context);
        score += recencyScore * 0.2;
        totalWeight += 0.2;
        
        // 4. Priority boost (10% weight)
        const priorityScore = context.metadata.priority / 10;
        score += priorityScore * 0.1;
        totalWeight += 0.1;
        
        // Normalize score
        const normalizedScore = Math.min(score / totalWeight, 1.0);
        
        this.metrics.scoringOperations.inc({ method: 'relevance' });
        timer.end();
        
        this.logger.debug('Context relevance scored', { 
          contextId: context.id, 
          query: query.substring(0, 50),
          score: normalizedScore 
        });
        
        return success(normalizedScore);
      },
      (error) => {
        timer.end();
        this.metrics.scoringErrors.inc({ method: 'relevance' });
        return create('RELEVANCE_SCORING_ERROR', `Failed to score relevance: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async selectByRelevance(contexts: Context[], query: string, limit: number): Promise<Result<Context[], QiError>> {
    const timer = this.metrics.selectionLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        // Score all contexts in batch for efficiency
        const scoringResult = await this.scoreRelevanceBatch(contexts, query);
        if (scoringResult.tag === 'failure') {
          return scoringResult;
        }
        
        const scoredContexts = scoringResult.value;
        
        // Sort by score descending and take top N
        scoredContexts.sort((a, b) => b.score - a.score);
        const selectedContexts = scoredContexts
          .slice(0, limit)
          .map(sc => sc.context);
        
        this.metrics.selectionOperations.inc({ 
          method: 'relevance', 
          inputCount: contexts.length,
          outputCount: selectedContexts.length 
        });
        timer.end();
        
        this.logger.info('Contexts selected by relevance', { 
          total: contexts.length,
          selected: selectedContexts.length,
          query: query.substring(0, 50) 
        });
        
        return success(selectedContexts);
      },
      (error) => {
        timer.end();
        this.metrics.selectionErrors.inc({ method: 'relevance' });
        return create('RELEVANCE_SELECTION_ERROR', `Failed to select by relevance: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async selectMultiCriteria(criteria: SelectionCriteria): Promise<Result<Context[], QiError>> {
    const timer = this.metrics.selectionLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        // Query contexts from SQLite based on basic filters
        const queryResult = await this.queryContextsFromDatabase({
          limit: criteria.limit * 2, // Get more than needed for better selection
          sortBy: 'relevance'
        });
        
        if (queryResult.tag === 'failure') {
          return queryResult;
        }
        
        const candidateContexts = queryResult.value;
        const scoredContexts: ScoredContext[] = [];
        
        // Multi-criteria scoring
        for (const context of candidateContexts) {
          let totalScore = 0;
          let totalWeight = 0;
          
          // Relevance score
          if (criteria.query && criteria.relevanceWeight > 0) {
            const relevanceResult = await this.scoreRelevance(context, criteria.query);
            if (relevanceResult.tag === 'success') {
              totalScore += relevanceResult.value * criteria.relevanceWeight;
              totalWeight += criteria.relevanceWeight;
            }
          }
          
          // Recency score
          if (criteria.recencyWeight > 0) {
            const recencyScore = this.calculateRecencyScore(context);
            totalScore += recencyScore * criteria.recencyWeight;
            totalWeight += criteria.recencyWeight;
          }
          
          // Priority score
          if (criteria.priorityWeight > 0) {
            const priorityScore = context.metadata.priority / 10;
            totalScore += priorityScore * criteria.priorityWeight;
            totalWeight += criteria.priorityWeight;
          }
          
          const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
          
          // Apply minimum score filter
          if (!criteria.minScore || finalScore >= criteria.minScore) {
            scoredContexts.push({
              context,
              score: finalScore,
              scoringMethod: 'multi-criteria',
              scoredAt: new Date()
            });
          }
        }
        
        // Sort and select top contexts
        scoredContexts.sort((a, b) => b.score - a.score);
        const selectedContexts = scoredContexts
          .slice(0, criteria.limit)
          .map(sc => sc.context);
        
        this.metrics.selectionOperations.inc({ 
          method: 'multi-criteria',
          inputCount: candidateContexts.length,
          outputCount: selectedContexts.length 
        });
        timer.end();
        
        this.logger.info('Multi-criteria selection completed', {
          candidates: candidateContexts.length,
          scored: scoredContexts.length,
          selected: selectedContexts.length,
          criteria
        });
        
        return success(selectedContexts);
      },
      (error) => {
        timer.end();
        this.metrics.selectionErrors.inc({ method: 'multi-criteria' });
        return create('MULTI_CRITERIA_SELECTION_ERROR', `Multi-criteria selection failed: ${error}`, 'SYSTEM');
      }
    );
  }
  
  async selectBySemanticSimilarity(query: string, limit: number): Promise<Result<Context[], QiError>> {
    const timer = this.metrics.selectionLatency.startTimer();
    
    return await fromAsyncTryCatch(
      async () => {
        // Check cache first
        const cacheKey = `semantic:${this.hashQuery(query)}:${limit}`;
        const cached = this.semanticCache.get(cacheKey);
        
        if (cached && this.isCacheValid(cached)) {
          timer.end();
          this.metrics.cacheHits.inc({ type: 'semantic' });
          return success(cached.map(sc => sc.context));
        }
        
        // For now, use content-based similarity
        // In production, this would integrate with embedding models
        const contextsResult = await this.queryContextsFromDatabase({
          limit: limit * 3,
          sortBy: 'relevance'
        });
        
        if (contextsResult.tag === 'failure') {
          return contextsResult;
        }
        
        const contexts = contextsResult.value;
        const scoredContexts: ScoredContext[] = [];
        
        for (const context of contexts) {
          const similarityScore = await this.calculateSemanticSimilarity(context, query);
          
          scoredContexts.push({
            context,
            score: similarityScore,
            scoringMethod: 'semantic-similarity',
            scoredAt: new Date()
          });
        }
        
        // Sort by similarity and select top contexts
        scoredContexts.sort((a, b) => b.score - a.score);
        const selectedContexts = scoredContexts
          .slice(0, limit)
          .map(sc => sc.context);
        
        // Cache results
        this.semanticCache.set(cacheKey, scoredContexts.slice(0, limit));
        
        this.metrics.selectionOperations.inc({ 
          method: 'semantic',
          inputCount: contexts.length,
          outputCount: selectedContexts.length 
        });
        timer.end();
        
        this.logger.info('Semantic similarity selection completed', {
          query: query.substring(0, 50),
          candidates: contexts.length,
          selected: selectedContexts.length
        });
        
        return success(selectedContexts);
      },
      (error) => {
        timer.end();
        this.metrics.selectionErrors.inc({ method: 'semantic' });
        return create('SEMANTIC_SELECTION_ERROR', `Semantic selection failed: ${error}`, 'SYSTEM');
      }
    );
  }
  
  // Helper methods
  private async calculateContentSimilarity(context: Context, query: string): Promise<number> {
    const contentText = JSON.stringify(context.content).toLowerCase();
    const queryText = query.toLowerCase();
    
    // Simple keyword matching - could be enhanced with TF-IDF or embeddings
    const queryWords = queryText.split(/\s+/);
    const matches = queryWords.filter(word => contentText.includes(word)).length;
    
    return matches / queryWords.length;
  }
  
  private calculateMetadataRelevance(context: Context, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    // Tag matching
    const tagMatches = context.metadata.tags.filter(tag => 
      queryLower.includes(tag.toLowerCase())
    ).length;
    score += tagMatches * 0.5;
    
    // Type relevance
    if (queryLower.includes(context.type)) {
      score += 0.3;
    }
    
    return Math.min(score, 1.0);
  }
  
  private calculateRecencyScore(context: Context): number {
    const now = Date.now();
    const contextTime = context.metadata.lastAccessed.getTime();
    const age = now - contextTime;
    
    // Exponential decay over 30 days
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    return Math.exp(-age / thirtyDays);
  }
  
  private async calculateSemanticSimilarity(context: Context, query: string): Promise<number> {
    // Placeholder for semantic similarity calculation
    // In production, this would use embedding models
    return await this.calculateContentSimilarity(context, query);
  }
  
  private hashQuery(query: string): string {
    // Simple hash for caching
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
  
  private isCacheValid(cached: ScoredContext[]): boolean {
    if (cached.length === 0) return false;
    
    const cacheAge = Date.now() - cached[0].scoredAt.getTime();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    return cacheAge < maxAge;
  }
}
```

## Compress Strategy: Information Density Optimization

### **Core Interface**

```typescript
interface CompressStrategy extends ContextStrategy {
  // Compression methods
  compressLossless(context: Context): Promise<Result<CompressedContext, QiError>>;
  compressSemantic(context: Context, preservationRatio: number): Promise<Result<CompressedContext, QiError>>;
  compressRelevance(context: Context, query: string): Promise<Result<CompressedContext, QiError>>;
  
  // Decompression
  decompress(compressed: CompressedContext): Promise<Result<Context, QiError>>;
  
  // Batch operations
  compressBatch(contexts: Context[], algorithm: CompressionAlgorithm): Promise<Result<CompressedContext[], QiError>>;
  
  // Analysis
  analyzeCompressionPotential(context: Context): Promise<Result<CompressionAnalysis, QiError>>;
  optimizeCompressionLevel(context: Context, targetSize: number): Promise<Result<CompressedContext, QiError>>;
  
  // Adaptive compression
  adaptiveCompress(context: Context, constraints: CompressionConstraints): Promise<Result<CompressedContext, QiError>>;
}

interface CompressionAnalysis {
  estimatedRatio: number;
  recommendedAlgorithm: CompressionAlgorithm;
  preservationScore: number;
  qualityImpact: number;
}

interface CompressionConstraints {
  maxSize?: number;
  minQuality?: number;
  preserveFields?: string[];
  algorithm?: CompressionAlgorithm;
}
```

## Isolate Strategy: Selective Context Exposure

### **Core Interface**

```typescript
interface IsolateStrategy extends ContextStrategy {
  // Boundary management
  createBoundary(name: string, policy: IsolationPolicy): Promise<Result<BoundaryId, QiError>>;
  deleteBoundary(boundary: BoundaryId): Promise<Result<void, QiError>>;
  updateBoundaryPolicy(boundary: BoundaryId, policy: IsolationPolicy): Promise<Result<void, QiError>>;
  
  // Context isolation
  assignToBoundary(context: Context, boundary: BoundaryId): Promise<Result<void, QiError>>;
  removeFromBoundary(context: Context, boundary: BoundaryId): Promise<Result<void, QiError>>;
  
  // Field-level exposure
  exposeFields(context: Context, fields: string[]): Promise<Result<PartialContext, QiError>>;
  hideFields(context: Context, fields: string[]): Promise<Result<PartialContext, QiError>>;
  createFieldMask(context: Context, mask: FieldMask): Promise<Result<PartialContext, QiError>>;
  
  // Access control
  checkAccess(contextId: ContextId, agent: AgentId, operation: AccessOperation): Promise<Result<boolean, QiError>>;
  grantAccess(contextId: ContextId, agent: AgentId, permissions: Permission[]): Promise<Result<void, QiError>>;
  revokeAccess(contextId: ContextId, agent: AgentId): Promise<Result<void, QiError>>;
  
  // Filtering
  filterByBoundary(contexts: Context[], boundary: BoundaryId): Promise<Result<Context[], QiError>>;
  filterByPermissions(contexts: Context[], agent: AgentId): Promise<Result<Context[], QiError>>;
}

interface IsolationPolicy {
  type: BoundaryType;
  permissions: Permission[];
  allowedAgents?: AgentId[];
  encryptionRequired: boolean;
  auditLog: boolean;
  ttl?: number;
}

interface FieldMask {
  include?: string[];
  exclude?: string[];
  transform?: Record<string, (value: unknown) => unknown>;
}

type AccessOperation = 'read' | 'write' | 'delete' | 'share';
type Permission = 'read' | 'write' | 'delete' | 'share' | 'admin';
```

## Strategy Composition and Orchestration

### **Context Engine Integration**

```typescript
class ContextEngine {
  private writeStrategy: WriteStrategy;
  private selectStrategy: SelectStrategy;
  private compressStrategy: CompressStrategy;
  private isolateStrategy: IsolateStrategy;
  
  constructor(
    writeStrategy: WriteStrategy,
    selectStrategy: SelectStrategy,
    compressStrategy: CompressStrategy,
    isolateStrategy: IsolateStrategy
  ) {
    this.writeStrategy = writeStrategy;
    this.selectStrategy = selectStrategy;
    this.compressStrategy = compressStrategy;
    this.isolateStrategy = isolateStrategy;
  }
  
  // Orchestrated operations combining multiple strategies
  async intelligentContextManagement(
    contexts: Context[],
    query: string,
    constraints: ContextConstraints
  ): Promise<Result<ProcessedContexts, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // 1. Select relevant contexts
        const selectedResult = await this.selectStrategy.selectMultiCriteria({
          query,
          relevanceWeight: 0.4,
          recencyWeight: 0.3,
          priorityWeight: 0.3,
          limit: constraints.maxContexts || 10
        });
        
        if (selectedResult.tag === 'failure') {
          return selectedResult;
        }
        
        let processedContexts = selectedResult.value;
        
        // 2. Apply isolation if required
        if (constraints.isolationRequired) {
          const isolatedResult = await this.isolateStrategy.filterByPermissions(
            processedContexts,
            constraints.agentId!
          );
          
          if (isolatedResult.tag === 'failure') {
            return isolatedResult;
          }
          
          processedContexts = isolatedResult.value;
        }
        
        // 3. Compress if size constraints exist
        if (constraints.maxSize) {
          const compressedContexts: Context[] = [];
          
          for (const context of processedContexts) {
            const compressResult = await this.compressStrategy.adaptiveCompress(context, {
              maxSize: Math.floor(constraints.maxSize / processedContexts.length),
              minQuality: 0.8
            });
            
            if (compressResult.tag === 'success') {
              // Convert compressed context back to regular context for processing
              const decompressResult = await this.compressStrategy.decompress(compressResult.value);
              if (decompressResult.tag === 'success') {
                compressedContexts.push(decompressResult.value);
              }
            } else {
              // Keep original if compression fails
              compressedContexts.push(context);
            }
          }
          
          processedContexts = compressedContexts;
        }
        
        // 4. Store processed contexts for future use
        const storageResult = await this.writeStrategy.batchStore(processedContexts, 'memory');
        let storageRefs: StorageRef[] = [];
        
        if (storageResult.tag === 'success') {
          storageRefs = storageResult.value;
        }
        
        return success({
          contexts: processedContexts,
          storageRefs,
          query,
          processedAt: new Date(),
          totalTokens: this.calculateTotalTokens(processedContexts),
          qualityScore: this.calculateQualityScore(processedContexts)
        });
      },
      (error) => create('CONTEXT_MANAGEMENT_ERROR', `Context management failed: ${error}`, 'SYSTEM')
    );
  }
  
  private calculateTotalTokens(contexts: Context[]): number {
    return contexts.reduce((total, context) => {
      const contentSize = JSON.stringify(context.content).length;
      return total + Math.ceil(contentSize / 4); // Rough token estimation
    }, 0);
  }
  
  private calculateQualityScore(contexts: Context[]): number {
    if (contexts.length === 0) return 0;
    
    const totalScore = contexts.reduce((sum, context) => {
      return sum + (context.metadata.qualityScore || 0.5);
    }, 0);
    
    return totalScore / contexts.length;
  }
}

interface ContextConstraints {
  maxContexts?: number;
  maxSize?: number;
  isolationRequired?: boolean;
  agentId?: AgentId;
  requiredTypes?: ContextType[];
  minQuality?: number;
}

interface ProcessedContexts {
  contexts: Context[];
  storageRefs: StorageRef[];
  query: string;
  processedAt: Date;
  totalTokens: number;
  qualityScore: number;
}
```

## Performance Optimization and Monitoring

### **Strategy Metrics**

```typescript
interface StrategyMetrics {
  operationLatency: HistogramMetric;
  operationCount: CounterMetric;
  errorCount: CounterMetric;
  cacheHitRate: RatioMetric;
}

class ContextEngineMonitor {
  private writeMetrics: WriteStrategyMetrics;
  private selectMetrics: SelectStrategyMetrics;
  private compressMetrics: CompressStrategyMetrics;
  private isolateMetrics: IsolateStrategyMetrics;
  
  generatePerformanceReport(): PerformanceReport {
    return {
      timestamp: new Date(),
      strategies: {
        write: this.writeMetrics.getReport(),
        select: this.selectMetrics.getReport(),
        compress: this.compressMetrics.getReport(),
        isolate: this.isolateMetrics.getReport()
      },
      overall: this.calculateOverallMetrics()
    };
  }
  
  private calculateOverallMetrics(): OverallMetrics {
    return {
      totalOperations: this.getTotalOperations(),
      averageLatency: this.getAverageLatency(),
      errorRate: this.getErrorRate(),
      cacheEfficiency: this.getCacheEfficiency()
    };
  }
}
```

## Next Steps

1. **Multi-Agent Coordination**: Implement distributed context management using these strategies
2. **Performance Optimization**: Add advanced caching, batching, and optimization techniques
3. **API Reference**: Complete interface documentation and usage examples
4. **Testing Framework**: Implement comprehensive testing and benchmarking
5. **Production Integration**: Integrate strategies with existing workflow and agent systems

---

**References**:
- [LangChain Context Engineering Strategies](https://blog.langchain.com/context-engineering-for-agents/)
- [Information Theory for Compression](https://en.wikipedia.org/wiki/Information_theory)
- [Access Control Patterns](https://en.wikipedia.org/wiki/Access_control)