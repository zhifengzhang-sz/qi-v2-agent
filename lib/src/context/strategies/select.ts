/**
 * Select Strategy Implementation
 *
 * Implements intelligent context retrieval with relevance scoring,
 * enabling optimal context selection based on multiple criteria
 * including semantic similarity, recency, and priority.
 */

import {
  create,
  failure,
  flatMap,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type { SimpleLogger } from '../../utils/index.js';
import {
  type Context,
  type ContextQuery,
  type ContextType,
  validateContext,
} from '../schemas/index.js';
import type { StorageQueryOptions, UnifiedContextStorageEngine } from '../storage/index.js';

// =============================================================================
// Select Strategy Types
// =============================================================================

/**
 * Base strategy interface that all context strategies must implement
 */
export interface ContextStrategy {
  readonly name: string;
  readonly version: string;
  initialize(): Promise<Result<void, QiError>>;
  cleanup(): Promise<Result<void, QiError>>;
  getMetrics(): StrategyMetrics;
}

/**
 * Base metrics interface for all strategies
 */
export interface StrategyMetrics {
  operationCount: number;
  errorCount: number;
  averageLatency: number;
  lastOperation: Date | null;
}

/**
 * Context with associated relevance score
 */
export interface ScoredContext {
  context: Context;
  score: number;
  scoringMethod: string;
  scoredAt: Date;
}

/**
 * Multi-criteria selection configuration
 */
export interface SelectionCriteria {
  query?: string;
  relevanceWeight: number;
  recencyWeight: number;
  priorityWeight: number;
  limit: number;
  minScore?: number;
}

/**
 * Constraints for context selection optimization
 */
export interface SelectionConstraints {
  maxTokens?: number;
  maxContexts?: number;
  requiredTypes?: ContextType[];
  excludeTypes?: ContextType[];
  timeRange?: { start: Date; end: Date };
}

/**
 * Task description for task-specific relevance scoring
 */
export interface TaskDescription {
  id: string;
  type: string;
  description: string;
  keywords: string[];
  priority: number;
}

/**
 * Metrics specific to selection operations
 */
export interface SelectStrategyMetrics extends StrategyMetrics {
  scoringOperations: number;
  scoringErrors: number;
  selectionOperations: number;
  selectionErrors: number;
  cacheHits: number;
  cacheMisses: number;
  averageScoringLatency: number;
  averageSelectionLatency: number;
}

// =============================================================================
// Select Strategy Interface
// =============================================================================

/**
 * Intelligent context selection strategy interface
 */
export interface SelectStrategy extends ContextStrategy {
  // Core relevance scoring
  scoreRelevance(context: Context, query: string): Promise<Result<number, QiError>>;
  scoreRelevanceBatch(
    contexts: Context[],
    query: string
  ): Promise<Result<ScoredContext[], QiError>>;

  // Basic selection methods
  selectByRelevance(
    contexts: Context[],
    query: string,
    limit: number
  ): Promise<Result<Context[], QiError>>;
  selectByRecency(contexts: Context[], limit: number): Promise<Result<Context[], QiError>>;
  selectByPriority(contexts: Context[], limit: number): Promise<Result<Context[], QiError>>;

  // Advanced selection methods
  selectBySemanticSimilarity(query: string, limit: number): Promise<Result<Context[], QiError>>;
  selectByTaskRelevance(task: TaskDescription, limit: number): Promise<Result<Context[], QiError>>;

  // Multi-criteria selection
  selectMultiCriteria(criteria: SelectionCriteria): Promise<Result<Context[], QiError>>;

  // Optimization
  optimizeSelection(
    contexts: Context[],
    constraints: SelectionConstraints
  ): Promise<Result<Context[], QiError>>;

  // Strategy-specific metrics
  getMetrics(): SelectStrategyMetrics;
}

// =============================================================================
// Strategy Registry Types
// =============================================================================

/**
 * Registry for managing pluggable strategy implementations
 */
export class StrategyRegistry {
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

  list(): string[] {
    return Array.from(this.strategies.keys());
  }

  unregister(name: string): Result<void, QiError> {
    if (!this.strategies.has(name)) {
      return failure(create('STRATEGY_NOT_FOUND', `Strategy ${name} not found`, 'BUSINESS'));
    }

    this.strategies.delete(name);
    return success(undefined);
  }
}

// =============================================================================
// Exports
// =============================================================================

// =============================================================================
// Intelligent Select Strategy Implementation
// =============================================================================

/**
 * Intelligent context selection strategy implementation
 */
export class IntelligentSelectStrategy implements SelectStrategy {
  readonly name = 'intelligent-select-strategy';
  readonly version = '1.0.0';

  private storageEngine: UnifiedContextStorageEngine;
  private logger: SimpleLogger;
  private metrics: SelectStrategyMetrics;
  private semanticCache: Map<string, ScoredContext[]>;
  private initialized = false;

  constructor(storageEngine: UnifiedContextStorageEngine, logger: SimpleLogger) {
    this.storageEngine = storageEngine;
    this.logger = logger;
    this.metrics = {
      operationCount: 0,
      errorCount: 0,
      averageLatency: 0,
      lastOperation: null,
      scoringOperations: 0,
      scoringErrors: 0,
      selectionOperations: 0,
      selectionErrors: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageScoringLatency: 0,
      averageSelectionLatency: 0,
    };
    this.semanticCache = new Map();
  }

  // =============================================================================
  // Strategy Interface Implementation
  // =============================================================================

  async initialize(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.logger.info('Initializing intelligent select strategy');

        // Setup cache cleanup interval
        this.setupCacheCleanup();

        this.initialized = true;
        this.logger.info('Intelligent select strategy initialized');

        return success(undefined);
      },
      (error) =>
        create(
          'SELECT_STRATEGY_INIT_ERROR',
          `Failed to initialize select strategy: ${error}`,
          'SYSTEM'
        )
    );
  }

  async cleanup(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.semanticCache.clear();
        this.initialized = false;
        this.logger.info('Select strategy cleaned up');

        return success(undefined);
      },
      (error) =>
        create(
          'SELECT_STRATEGY_CLEANUP_ERROR',
          `Failed to cleanup select strategy: ${error}`,
          'SYSTEM'
        )
    );
  }

  getMetrics(): SelectStrategyMetrics {
    return { ...this.metrics };
  }

  // =============================================================================
  // Relevance Scoring Implementation
  // =============================================================================

  async scoreRelevance(context: Context, query: string): Promise<Result<number, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        this.metrics.scoringOperations++;

        // Multi-factor relevance scoring
        let totalScore = 0;
        let totalWeight = 0;

        // 1. Content similarity (40% weight)
        const contentScore = this.calculateContentSimilarity(context, query);
        totalScore += contentScore * 0.4;
        totalWeight += 0.4;

        // 2. Metadata relevance (30% weight)
        const metadataScore = this.calculateMetadataRelevance(context, query);
        totalScore += metadataScore * 0.3;
        totalWeight += 0.3;

        // 3. Recency bonus (20% weight)
        const recencyScore = this.calculateRecencyScore(context);
        totalScore += recencyScore * 0.2;
        totalWeight += 0.2;

        // 4. Priority boost (10% weight)
        const priorityScore = context.metadata.priority / 10;
        totalScore += priorityScore * 0.1;
        totalWeight += 0.1;

        // Normalize score to 0-1 range
        const normalizedScore = Math.min(totalScore / totalWeight, 1.0);

        // Update metrics
        const latency = Date.now() - startTime;
        this.updateScoringMetrics(latency);

        this.logger.debug('Context relevance scored', {
          contextId: context.id,
          query: query.substring(0, 50),
          score: normalizedScore,
          latency,
        });

        return success(normalizedScore);
      },
      (error) => {
        this.metrics.scoringErrors++;
        return create('RELEVANCE_SCORING_ERROR', `Failed to score relevance: ${error}`, 'SYSTEM');
      }
    );
  }

  async scoreRelevanceBatch(
    contexts: Context[],
    query: string
  ): Promise<Result<ScoredContext[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        const scoredContexts: ScoredContext[] = [];

        // Process in parallel for better performance
        const scoringPromises = contexts.map(async (context) => {
          const scoreResult = await this.scoreRelevance(context, query);

          if (scoreResult.tag === 'success') {
            return {
              context,
              score: scoreResult.value,
              scoringMethod: 'relevance',
              scoredAt: new Date(),
            } as ScoredContext;
          }

          return null;
        });

        const results = await Promise.all(scoringPromises);

        // Filter out failed scorings
        for (const result of results) {
          if (result !== null) {
            scoredContexts.push(result);
          }
        }

        const latency = Date.now() - startTime;
        this.updateScoringMetrics(latency);

        this.logger.info('Batch relevance scoring completed', {
          totalContexts: contexts.length,
          scoredContexts: scoredContexts.length,
          latency,
        });

        return success(scoredContexts);
      },
      (error) => {
        this.metrics.scoringErrors++;
        return create('BATCH_SCORING_ERROR', `Failed to score batch: ${error}`, 'SYSTEM');
      }
    );
  }

  // =============================================================================
  // Helper Methods for Scoring
  // =============================================================================

  private calculateContentSimilarity(context: Context, query: string): number {
    const contentText = JSON.stringify(context.content).toLowerCase();
    const queryText = query.toLowerCase();

    // Simple keyword matching - could be enhanced with TF-IDF or embeddings
    const queryWords = queryText.split(/\s+/).filter((word) => word.length > 2);
    if (queryWords.length === 0) return 0;

    const matches = queryWords.filter((word) => contentText.includes(word)).length;
    return matches / queryWords.length;
  }

  private calculateMetadataRelevance(context: Context, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Tag matching
    const tagMatches = context.metadata.tags.filter((tag) =>
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

  private async scoreSemanticSimilarity(
    context: Context,
    query: string
  ): Promise<Result<number, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Enhanced semantic similarity scoring using multiple factors
        let totalScore = 0;
        let weightSum = 0;

        // 1. Content similarity (60% weight)
        const contentScore = this.calculateContentSimilarity(context, query);
        totalScore += contentScore * 0.6;
        weightSum += 0.6;

        // 2. Semantic keyword overlap (25% weight)
        const keywordScore = this.calculateKeywordSimilarity(context, query);
        totalScore += keywordScore * 0.25;
        weightSum += 0.25;

        // 3. Context type relevance (15% weight)
        const typeScore = this.calculateTypeRelevance(context, query);
        totalScore += typeScore * 0.15;
        weightSum += 0.15;

        // Normalize score
        const normalizedScore = weightSum > 0 ? totalScore / weightSum : 0;

        return success(Math.min(1.0, Math.max(0.0, normalizedScore)));
      },
      (error) =>
        create('SEMANTIC_SCORING_ERROR', `Failed to score semantic similarity: ${error}`, 'SYSTEM')
    );
  }

  private calculateKeywordSimilarity(context: Context, query: string): number {
    const contextText = JSON.stringify(context.content).toLowerCase();
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    if (queryWords.length === 0) return 0;

    // Extract important words (longer than 3 characters, not common stop words)
    const stopWords = new Set([
      'the',
      'and',
      'for',
      'are',
      'but',
      'not',
      'you',
      'all',
      'can',
      'had',
      'her',
      'was',
      'one',
      'our',
      'out',
      'day',
      'get',
      'has',
      'him',
      'his',
      'how',
      'man',
      'new',
      'now',
      'old',
      'see',
      'two',
      'way',
      'who',
      'boy',
      'did',
      'its',
      'let',
      'put',
      'say',
      'she',
      'too',
      'use',
    ]);
    const importantWords = queryWords.filter((word) => word.length > 3 && !stopWords.has(word));

    if (importantWords.length === 0) return this.calculateContentSimilarity(context, query);

    // Calculate weighted keyword matches
    let totalWeight = 0;
    let matchWeight = 0;

    for (const word of importantWords) {
      const weight = word.length / 10; // Longer words have more weight
      totalWeight += weight;

      if (contextText.includes(word)) {
        matchWeight += weight;
      }
    }

    return totalWeight > 0 ? matchWeight / totalWeight : 0;
  }

  private calculateTypeRelevance(context: Context, query: string): number {
    const queryLower = query.toLowerCase();

    // Type-specific keyword matching
    const typeKeywords: Record<string, string[]> = {
      conversation: ['conversation', 'chat', 'discussion', 'message', 'talk'],
      task: ['task', 'todo', 'work', 'job', 'assignment', 'action'],
      workflow: ['workflow', 'process', 'procedure', 'steps', 'sequence'],
      file: ['file', 'document', 'text', 'code', 'content'],
      system: ['system', 'config', 'setting', 'configuration', 'setup'],
    };

    const contextType = context.type;
    const relevantKeywords = typeKeywords[contextType] || [];

    if (relevantKeywords.length === 0) return 0.5; // Neutral score for unknown types

    const matches = relevantKeywords.filter((keyword) => queryLower.includes(keyword)).length;
    return Math.min(1.0, matches / relevantKeywords.length + 0.3); // Base score of 0.3
  }

  private async scoreTaskRelevance(
    context: Context,
    task: TaskDescription
  ): Promise<Result<number, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        let totalScore = 0;
        let weightSum = 0;

        // 1. Task type matching (30% weight)
        const typeScore = this.calculateTaskTypeRelevance(context, task);
        totalScore += typeScore * 0.3;
        weightSum += 0.3;

        // 2. Keyword relevance (40% weight)
        const keywordScore = this.calculateTaskKeywordRelevance(context, task);
        totalScore += keywordScore * 0.4;
        weightSum += 0.4;

        // 3. Priority alignment (20% weight)
        const priorityScore = this.calculateTaskPriorityRelevance(context, task);
        totalScore += priorityScore * 0.2;
        weightSum += 0.2;

        // 4. Description similarity (10% weight)
        const descriptionScore = this.calculateContentSimilarity(context, task.description);
        totalScore += descriptionScore * 0.1;
        weightSum += 0.1;

        // Normalize score
        const normalizedScore = weightSum > 0 ? totalScore / weightSum : 0;

        return success(Math.min(1.0, Math.max(0.0, normalizedScore)));
      },
      (error) =>
        create('TASK_RELEVANCE_SCORING_ERROR', `Failed to score task relevance: ${error}`, 'SYSTEM')
    );
  }

  private calculateTaskTypeRelevance(context: Context, task: TaskDescription): number {
    const contextTypeStr = context.type.toLowerCase();
    const taskTypeStr = task.type.toLowerCase();

    // Direct type match
    if (contextTypeStr === taskTypeStr) {
      return 1.0;
    }

    // Semantic type matching
    const typeMapping: Record<string, string[]> = {
      development: ['code', 'programming', 'software', 'debug', 'implementation'],
      documentation: ['docs', 'readme', 'guide', 'manual', 'specification'],
      testing: ['test', 'qa', 'verification', 'validation', 'coverage'],
      deployment: ['deploy', 'production', 'release', 'staging', 'build'],
      analysis: ['research', 'investigation', 'study', 'review', 'audit'],
    };

    const taskKeywords = typeMapping[taskTypeStr] || [];
    const contextContent = JSON.stringify(context.content).toLowerCase();

    const matches = taskKeywords.filter((keyword) => contextContent.includes(keyword)).length;
    return taskKeywords.length > 0 ? Math.min(0.8, matches / taskKeywords.length) : 0.5;
  }

  private calculateTaskKeywordRelevance(context: Context, task: TaskDescription): number {
    const contextText = JSON.stringify(context.content).toLowerCase();
    const allKeywords = task.keywords
      .concat(task.description.split(/\s+/))
      .filter((word) => word.length > 2);

    if (allKeywords.length === 0) return 0.5;

    let totalWeight = 0;
    let matchWeight = 0;

    for (const keyword of allKeywords) {
      const keywordLower = keyword.toLowerCase();
      const weight = Math.min(1.0, keyword.length / 8); // Longer keywords get more weight
      totalWeight += weight;

      if (contextText.includes(keywordLower)) {
        matchWeight += weight;
      }
    }

    return totalWeight > 0 ? matchWeight / totalWeight : 0;
  }

  private calculateTaskPriorityRelevance(context: Context, task: TaskDescription): number {
    const contextPriority = context.metadata.priority;
    const taskPriority = task.priority;

    // Higher priority tasks should match higher priority contexts
    const priorityDiff = Math.abs(contextPriority - taskPriority);
    const maxPriority = 10;

    // Score decreases as priority difference increases
    return Math.max(0, 1.0 - priorityDiff / maxPriority);
  }

  private async scoreMultiCriteria(
    context: Context,
    criteria: SelectionCriteria
  ): Promise<Result<number, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        let totalScore = 0;
        let totalWeight =
          criteria.relevanceWeight + criteria.recencyWeight + criteria.priorityWeight;

        // Normalize weights to ensure they sum to 1.0
        if (totalWeight === 0) {
          totalWeight = 1.0;
          // Default equal weighting if no weights specified
          criteria.relevanceWeight = criteria.relevanceWeight || 0.33;
          criteria.recencyWeight = criteria.recencyWeight || 0.33;
          criteria.priorityWeight = criteria.priorityWeight || 0.34;
        }

        const normalizedRelevanceWeight = criteria.relevanceWeight / totalWeight;
        const normalizedRecencyWeight = criteria.recencyWeight / totalWeight;
        const normalizedPriorityWeight = criteria.priorityWeight / totalWeight;

        // 1. Relevance scoring (based on query if provided)
        if (criteria.query && normalizedRelevanceWeight > 0) {
          const relevanceResult = await this.scoreSemanticSimilarity(context, criteria.query);
          if (relevanceResult.tag === 'success') {
            totalScore += relevanceResult.value * normalizedRelevanceWeight;
          }
        }

        // 2. Recency scoring
        if (normalizedRecencyWeight > 0) {
          const recencyScore = this.calculateRecencyScore(context);
          totalScore += recencyScore * normalizedRecencyWeight;
        }

        // 3. Priority scoring
        if (normalizedPriorityWeight > 0) {
          const priorityScore = context.metadata.priority / 10; // Normalize to 0-1 range
          totalScore += priorityScore * normalizedPriorityWeight;
        }

        // Ensure score is within valid range
        const normalizedScore = Math.min(1.0, Math.max(0.0, totalScore));

        return success(normalizedScore);
      },
      (error) =>
        create('MULTI_CRITERIA_SCORING_ERROR', `Failed to score multi-criteria: ${error}`, 'SYSTEM')
    );
  }

  private setupCacheCleanup(): void {
    // Clean up cache every 5 minutes
    setInterval(
      () => {
        this.cleanupExpiredCache();
      },
      5 * 60 * 1000
    );
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, scoredContexts] of this.semanticCache.entries()) {
      if (scoredContexts.length > 0) {
        const age = now - scoredContexts[0].scoredAt.getTime();
        if (age > maxAge) {
          this.semanticCache.delete(key);
        }
      }
    }
  }

  private updateScoringMetrics(latency: number): void {
    this.metrics.averageScoringLatency =
      (this.metrics.averageScoringLatency * (this.metrics.scoringOperations - 1) + latency) /
      this.metrics.scoringOperations;
  }

  private updateSelectionMetrics(latency: number): void {
    this.metrics.selectionOperations++;
    this.metrics.averageSelectionLatency =
      (this.metrics.averageSelectionLatency * (this.metrics.selectionOperations - 1) + latency) /
      this.metrics.selectionOperations;
  }

  // =============================================================================
  // Selection Methods Implementation
  // =============================================================================

  async selectByRelevance(
    contexts: Context[],
    query: string,
    limit: number
  ): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        this.logger.debug('Selecting contexts by relevance', {
          contextCount: contexts.length,
          query: query.substring(0, 50),
          limit,
        });

        // Score all contexts for relevance
        const scoringResult = await this.scoreRelevanceBatch(contexts, query);
        if (scoringResult.tag === 'failure') {
          return scoringResult;
        }

        // Sort by relevance score (highest first) and take top N
        const sortedContexts = scoringResult.value
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((sc) => sc.context);

        const latency = Date.now() - startTime;
        this.updateSelectionMetrics(latency);

        this.logger.info('Relevance-based selection completed', {
          inputCount: contexts.length,
          outputCount: sortedContexts.length,
          averageScore:
            scoringResult.value.reduce((sum, sc) => sum + sc.score, 0) / scoringResult.value.length,
          latency,
        });

        return success(sortedContexts);
      },
      (error) => {
        this.metrics.selectionErrors++;
        return create(
          'RELEVANCE_SELECTION_ERROR',
          `Failed to select by relevance: ${error}`,
          'SYSTEM'
        );
      }
    );
  }

  async selectByRecency(contexts: Context[], limit: number): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        this.logger.debug('Selecting contexts by recency', {
          contextCount: contexts.length,
          limit,
        });

        // Sort by lastAccessed timestamp (most recent first) and take top N
        const sortedContexts = [...contexts]
          .sort((a, b) => b.metadata.lastAccessed.getTime() - a.metadata.lastAccessed.getTime())
          .slice(0, limit);

        const latency = Date.now() - startTime;
        this.updateSelectionMetrics(latency);

        this.logger.info('Recency-based selection completed', {
          inputCount: contexts.length,
          outputCount: sortedContexts.length,
          latency,
        });

        return success(sortedContexts);
      },
      (error) => {
        this.metrics.selectionErrors++;
        return create('RECENCY_SELECTION_ERROR', `Failed to select by recency: ${error}`, 'SYSTEM');
      }
    );
  }

  async selectByPriority(contexts: Context[], limit: number): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        this.logger.debug('Selecting contexts by priority', {
          contextCount: contexts.length,
          limit,
        });

        // Sort by priority (highest first) and take top N
        const sortedContexts = [...contexts]
          .sort((a, b) => b.metadata.priority - a.metadata.priority)
          .slice(0, limit);

        const latency = Date.now() - startTime;
        this.updateSelectionMetrics(latency);

        this.logger.info('Priority-based selection completed', {
          inputCount: contexts.length,
          outputCount: sortedContexts.length,
          averagePriority:
            sortedContexts.reduce((sum, c) => sum + c.metadata.priority, 0) / sortedContexts.length,
          latency,
        });

        return success(sortedContexts);
      },
      (error) => {
        this.metrics.selectionErrors++;
        return create(
          'PRIORITY_SELECTION_ERROR',
          `Failed to select by priority: ${error}`,
          'SYSTEM'
        );
      }
    );
  }

  async selectBySemanticSimilarity(
    query: string,
    limit: number
  ): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Check cache first
        const cacheKey = `semantic:${this.hashQuery(query)}:${limit}`;
        const cached = this.semanticCache.get(cacheKey);

        if (cached && this.isCacheValid(cached)) {
          this.metrics.cacheHits++;
          const cachedContexts = cached.map((sc) => sc.context);

          this.logger.debug('Semantic similarity selection served from cache', {
            query: query.substring(0, 50),
            contextCount: cachedContexts.length,
          });

          return success(cachedContexts);
        }

        this.metrics.cacheMisses++;

        // Query contexts from storage engine using semantic search
        this.logger.debug('Selecting contexts by semantic similarity', {
          query: query.substring(0, 50),
          limit,
        });

        // Query storage engine for contexts
        const queryOptions: StorageQueryOptions = {
          limit,
          orderBy: 'relevanceScore',
          orderDirection: 'desc',
        };

        const queryResult = await this.storageEngine.query(
          { content: query, type: 'semantic_search' as ContextType },
          queryOptions
        );

        if (queryResult.tag === 'failure') {
          this.logger.warn('Storage query failed, falling back to empty results', {
            error: queryResult.value.message,
          });
          return success([]);
        }

        const contexts = queryResult.value;

        // Score contexts for semantic similarity using content matching
        const scoredContexts: ScoredContext[] = [];
        for (const context of contexts) {
          const scoreResult = await this.scoreSemanticSimilarity(context, query);
          if (scoreResult.tag === 'success') {
            scoredContexts.push({
              context,
              score: scoreResult.value,
              scoringMethod: 'semantic_similarity',
              scoredAt: new Date(),
            });
          }
        }

        // Sort by semantic similarity score and take top results
        const topContexts = scoredContexts
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((sc) => sc.context);

        // Cache results for future queries
        this.semanticCache.set(cacheKey, scoredContexts.slice(0, limit));

        const latency = Date.now() - startTime;
        this.updateSelectionMetrics(latency);

        this.logger.info('Semantic similarity selection completed', {
          query: query.substring(0, 50),
          contextCount: topContexts.length,
          averageScore:
            scoredContexts.reduce((sum, sc) => sum + sc.score, 0) / scoredContexts.length,
          latency,
        });

        return success(topContexts);
      },
      (error) => {
        this.metrics.selectionErrors++;
        return create(
          'SEMANTIC_SELECTION_ERROR',
          `Failed to select by semantic similarity: ${error}`,
          'SYSTEM'
        );
      }
    );
  }

  async selectByTaskRelevance(
    task: TaskDescription,
    limit: number
  ): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        this.logger.debug('Selecting contexts by task relevance', {
          taskType: task.type,
          taskDescription: task.description.substring(0, 50),
          limit,
        });

        // Create a composite query from task information
        const compositeQuery = `${task.type} ${task.description} ${task.keywords.join(' ')}`;

        // Query storage engine for contexts
        const queryOptions: StorageQueryOptions = {
          limit: limit * 2, // Get more results to allow for better filtering
          orderBy: 'lastAccessed',
          orderDirection: 'desc',
        };

        const queryResult = await this.storageEngine.query(
          { content: compositeQuery, type: 'task' as ContextType },
          queryOptions
        );

        if (queryResult.tag === 'failure') {
          this.logger.warn(
            'Storage query failed for task relevance, falling back to empty results',
            {
              error: queryResult.value.message,
              taskType: task.type,
            }
          );
          return success([]);
        }

        const contexts = queryResult.value;

        // Score contexts based on task relevance
        const scoredContexts: ScoredContext[] = [];
        for (const context of contexts) {
          const scoreResult = await this.scoreTaskRelevance(context, task);
          if (scoreResult.tag === 'success') {
            scoredContexts.push({
              context,
              score: scoreResult.value,
              scoringMethod: 'task_relevance',
              scoredAt: new Date(),
            });
          }
        }

        // Sort by task relevance score and take top results
        const topContexts = scoredContexts
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map((sc) => sc.context);

        const latency = Date.now() - startTime;
        this.updateSelectionMetrics(latency);

        this.logger.info('Task relevance selection completed', {
          taskType: task.type,
          taskDescription: task.description.substring(0, 50),
          contextCount: topContexts.length,
          averageScore:
            scoredContexts.reduce((sum, sc) => sum + sc.score, 0) / scoredContexts.length,
          latency,
        });

        return success(topContexts);
      },
      (error) => {
        this.metrics.selectionErrors++;
        return create(
          'TASK_RELEVANCE_SELECTION_ERROR',
          `Failed to select by task relevance: ${error}`,
          'SYSTEM'
        );
      }
    );
  }

  async selectMultiCriteria(criteria: SelectionCriteria): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        this.logger.debug('Multi-criteria context selection', {
          hasQuery: !!criteria.query,
          relevanceWeight: criteria.relevanceWeight,
          recencyWeight: criteria.recencyWeight,
          priorityWeight: criteria.priorityWeight,
          limit: criteria.limit,
          minScore: criteria.minScore,
        });

        // Query storage engine for contexts based on query if provided
        let contexts: Context[];
        if (criteria.query) {
          const queryOptions: StorageQueryOptions = {
            limit: criteria.limit * 3, // Get more results for better multi-criteria filtering
            orderBy: 'relevanceScore',
            orderDirection: 'desc',
          };

          const queryResult = await this.storageEngine.query(
            { content: criteria.query, type: 'conversation' as ContextType },
            queryOptions
          );

          if (queryResult.tag === 'failure') {
            this.logger.warn('Storage query failed for multi-criteria selection', {
              error: queryResult.value.message,
            });
            return success([]);
          }

          contexts = queryResult.value;
        } else {
          // Get recent contexts if no query specified
          const queryResult = await this.storageEngine.query(
            { type: 'conversation' as ContextType },
            { limit: criteria.limit * 3, orderBy: 'lastAccessed', orderDirection: 'desc' }
          );

          if (queryResult.tag === 'failure') {
            this.logger.warn('Storage query failed for multi-criteria selection (no query)', {
              error: queryResult.value.message,
            });
            return success([]);
          }

          contexts = queryResult.value;
        }

        // Score contexts using multi-criteria approach
        const scoredContexts: ScoredContext[] = [];
        for (const context of contexts) {
          const scoreResult = await this.scoreMultiCriteria(context, criteria);
          if (scoreResult.tag === 'success') {
            const score = scoreResult.value;

            // Apply minimum score filter if specified
            if (!criteria.minScore || score >= criteria.minScore) {
              scoredContexts.push({
                context,
                score,
                scoringMethod: 'multi_criteria',
                scoredAt: new Date(),
              });
            }
          }
        }

        // Sort by combined score and take top results
        const topContexts = scoredContexts
          .sort((a, b) => b.score - a.score)
          .slice(0, criteria.limit)
          .map((sc) => sc.context);

        const latency = Date.now() - startTime;
        this.updateSelectionMetrics(latency);

        this.logger.info('Multi-criteria selection completed', {
          query: criteria.query?.substring(0, 50) || 'none',
          contextCount: topContexts.length,
          averageScore:
            scoredContexts.reduce((sum, sc) => sum + sc.score, 0) / scoredContexts.length,
          relevanceWeight: criteria.relevanceWeight,
          recencyWeight: criteria.recencyWeight,
          priorityWeight: criteria.priorityWeight,
          latency,
        });

        return success(topContexts);
      },
      (error) => {
        this.metrics.selectionErrors++;
        return create(
          'MULTI_CRITERIA_SELECTION_ERROR',
          `Failed multi-criteria selection: ${error}`,
          'SYSTEM'
        );
      }
    );
  }

  async optimizeSelection(
    contexts: Context[],
    constraints: SelectionConstraints
  ): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        this.logger.debug('Optimizing context selection', {
          inputCount: contexts.length,
          maxTokens: constraints.maxTokens,
          maxContexts: constraints.maxContexts,
          requiredTypes: constraints.requiredTypes?.length || 0,
          excludeTypes: constraints.excludeTypes?.length || 0,
        });

        let filteredContexts = [...contexts];

        // Apply type filters
        if (constraints.requiredTypes && constraints.requiredTypes.length > 0) {
          filteredContexts = filteredContexts.filter((context) =>
            constraints.requiredTypes!.includes(context.type)
          );
        }

        if (constraints.excludeTypes && constraints.excludeTypes.length > 0) {
          filteredContexts = filteredContexts.filter(
            (context) => !constraints.excludeTypes!.includes(context.type)
          );
        }

        // Apply time range filter
        if (constraints.timeRange) {
          filteredContexts = filteredContexts.filter((context) => {
            const contextTime = context.metadata.lastAccessed;
            return (
              contextTime >= constraints.timeRange!.start &&
              contextTime <= constraints.timeRange!.end
            );
          });
        }

        // Apply count limit
        if (constraints.maxContexts && filteredContexts.length > constraints.maxContexts) {
          // Sort by priority and recency before truncating
          filteredContexts.sort((a, b) => {
            const priorityDiff = b.metadata.priority - a.metadata.priority;
            if (priorityDiff !== 0) return priorityDiff;
            return b.metadata.lastAccessed.getTime() - a.metadata.lastAccessed.getTime();
          });

          filteredContexts = filteredContexts.slice(0, constraints.maxContexts);
        }

        // Apply token limit (rough estimation)
        if (constraints.maxTokens) {
          let totalTokens = 0;
          const optimizedContexts: Context[] = [];

          for (const context of filteredContexts) {
            const contextTokens = this.estimateTokenCount(context);
            if (totalTokens + contextTokens <= constraints.maxTokens) {
              optimizedContexts.push(context);
              totalTokens += contextTokens;
            } else {
              break;
            }
          }

          filteredContexts = optimizedContexts;
        }

        const latency = Date.now() - startTime;
        this.updateSelectionMetrics(latency);

        this.logger.info('Selection optimization completed', {
          inputCount: contexts.length,
          outputCount: filteredContexts.length,
          latency,
        });

        return success(filteredContexts);
      },
      (error) => {
        this.metrics.selectionErrors++;
        return create(
          'SELECTION_OPTIMIZATION_ERROR',
          `Failed to optimize selection: ${error}`,
          'SYSTEM'
        );
      }
    );
  }

  // =============================================================================
  // Additional Helper Methods
  // =============================================================================

  private hashQuery(query: string): string {
    // Simple hash function for caching keys
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private isCacheValid(scoredContexts: ScoredContext[]): boolean {
    if (scoredContexts.length === 0) return false;

    const now = Date.now();
    const cacheAge = now - scoredContexts[0].scoredAt.getTime();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    return cacheAge < maxAge;
  }

  private estimateTokenCount(context: Context): number {
    // Rough estimation: 4 characters per token
    const contentSize = JSON.stringify(context.content).length;
    const metadataSize = JSON.stringify(context.metadata).length;
    return Math.ceil((contentSize + metadataSize) / 4);
  }
}

// =============================================================================
// Exports
// =============================================================================

export type {
  ContextStrategy,
  StrategyMetrics,
  ScoredContext,
  SelectionCriteria,
  SelectionConstraints,
  TaskDescription,
  SelectStrategyMetrics,
  SelectStrategy,
};

// Export the implementation
export { IntelligentSelectStrategy, StrategyRegistry };
