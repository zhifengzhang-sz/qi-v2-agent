/**
 * Memory MCP Storage Wrapper
 *
 * Provides a wrapper around the Memory MCP service for hot context storage
 * with TTL support, performance monitoring, and error handling.
 */

import { create, failure, fromAsyncTryCatch, type QiError, type Result, success } from '@qi/base';
import type { MCPServiceConnection } from '../../messaging/index.js';
import type { SimpleLogger } from '../../utils/index.js';
import {
  type Context,
  type ContextQuery,
  type StorageLocation,
  validateContext,
} from '../schemas/index.js';

// =============================================================================
// Memory Storage Types
// =============================================================================

/**
 * Memory storage configuration
 */
export interface MemoryStorageConfig {
  maxSize: string; // e.g., "1GB"
  evictionPolicy: 'LRU' | 'LFU' | 'FIFO';
  defaultTTL: number; // seconds
  enabled: boolean;
  compressionEnabled: boolean;
  metricsEnabled: boolean;
}

/**
 * Memory storage entry
 */
export interface MemoryEntry {
  context: Context;
  storedAt: Date;
  lastAccessed: Date;
  ttl?: number;
  accessCount: number;
  compressed: boolean;
}

/**
 * Memory storage metrics
 */
export interface MemoryStorageMetrics {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  averageAccessTime: number;
  cacheHitRate: number;
}

// =============================================================================
// Memory Storage Implementation
// =============================================================================

/**
 * Memory MCP storage wrapper for hot context storage
 */
export class MemoryContextStorage {
  private memoryService: MCPServiceConnection;
  private logger: SimpleLogger;
  private config: MemoryStorageConfig;
  private metrics: MemoryStorageMetrics;
  private lastCleanup: Date;

  constructor(
    memoryService: MCPServiceConnection,
    logger: SimpleLogger,
    config: MemoryStorageConfig
  ) {
    this.memoryService = memoryService;
    this.logger = logger;
    this.config = config;
    this.metrics = {
      totalEntries: 0,
      totalSizeBytes: 0,
      hitCount: 0,
      missCount: 0,
      evictionCount: 0,
      averageAccessTime: 0,
      cacheHitRate: 0,
    };
    this.lastCleanup = new Date();
  }

  /**
   * Store a context in memory
   */
  async store(context: Context, ttl?: number): Promise<Result<StorageLocation, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Validate context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedContext = validationResult.value;
        const key = `context:${validatedContext.id}`;
        const effectiveTTL = ttl || this.config.defaultTTL;

        // Create memory entry
        const entry: MemoryEntry = {
          context: validatedContext,
          storedAt: new Date(),
          lastAccessed: new Date(),
          ttl: effectiveTTL,
          accessCount: 0,
          compressed: false,
        };

        // Store in memory service
        await this.memoryService.client.callTool({
          name: 'store',
          arguments: {
            key,
            value: JSON.stringify(entry),
            ttl: effectiveTTL,
          },
        });

        // Create storage location
        const storageLocation: StorageLocation = {
          contextId: validatedContext.id,
          service: 'memory',
          path: key,
          storedAt: entry.storedAt,
          storageSize: JSON.stringify(entry).length,
          compressed: entry.compressed,
          encrypted: false,
          accessCount: 0,
        };

        // Update metrics
        this.updateStoreMetrics(storageLocation.storageSize!, Date.now() - startTime);

        this.logger.debug('Context stored in memory', {
          contextId: validatedContext.id,
          key,
          ttl: effectiveTTL,
          size: storageLocation.storageSize,
        });

        return success(storageLocation);
      },
      (error) =>
        create('MEMORY_STORE_ERROR', `Failed to store context in memory: ${error}`, 'SYSTEM', {
          contextId: context.id,
          error,
        })
    );
  }

  /**
   * Retrieve a context from memory
   */
  async retrieve(contextId: string): Promise<Result<Context, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        const key = `context:${contextId}`;

        // Retrieve from memory service
        const result = await this.memoryService.client.callTool({
          name: 'retrieve',
          arguments: { key },
        });

        if (!result.content) {
          this.metrics.missCount++;
          return failure(
            create('CONTEXT_NOT_FOUND', `Context ${contextId} not found in memory`, 'BUSINESS')
          );
        }

        // Parse memory entry
        const entry: MemoryEntry = JSON.parse(result.content);

        // Check TTL expiration
        if (entry.ttl && entry.storedAt) {
          const expiresAt = new Date(entry.storedAt.getTime() + entry.ttl * 1000);
          if (new Date() > expiresAt) {
            // Entry expired, remove it
            await this.delete(contextId);
            this.metrics.missCount++;
            return failure(
              create('CONTEXT_EXPIRED', `Context ${contextId} has expired`, 'BUSINESS')
            );
          }
        }

        // Update access metadata
        entry.lastAccessed = new Date();
        entry.accessCount++;

        // Store updated entry back
        await this.memoryService.client.callTool({
          name: 'store',
          arguments: {
            key,
            value: JSON.stringify(entry),
            ttl: entry.ttl,
          },
        });

        // Update metrics
        this.updateRetrieveMetrics(Date.now() - startTime, true);

        this.logger.debug('Context retrieved from memory', {
          contextId,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed,
        });

        return success(entry.context);
      },
      (error) => {
        this.updateRetrieveMetrics(Date.now() - startTime, false);
        return create(
          'MEMORY_RETRIEVE_ERROR',
          `Failed to retrieve context from memory: ${error}`,
          'SYSTEM',
          { contextId, error }
        );
      }
    );
  }

  /**
   * Update a context in memory
   */
  async update(contextId: string, updates: Partial<Context>): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // First retrieve the existing context
        const retrieveResult = await this.retrieve(contextId);
        if (retrieveResult.tag === 'failure') {
          return retrieveResult;
        }

        const existingContext = retrieveResult.value;

        // Merge updates
        const updatedContext: Context = {
          ...existingContext,
          ...updates,
          id: contextId, // Ensure ID cannot be changed
          metadata: {
            ...existingContext.metadata,
            ...updates.metadata,
            modifiedAt: new Date(),
            lastAccessed: new Date(),
          },
        };

        // Validate updated context
        const validationResult = validateContext(updatedContext);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        // Store the updated context
        const storeResult = await this.store(validationResult.value);
        if (storeResult.tag === 'failure') {
          return failure(storeResult.error);
        }

        this.logger.debug('Context updated in memory', {
          contextId,
          modifiedAt: updatedContext.metadata.modifiedAt,
        });

        return success(undefined);
      },
      (error) =>
        create('MEMORY_UPDATE_ERROR', `Failed to update context in memory: ${error}`, 'SYSTEM', {
          contextId,
          error,
        })
    );
  }

  /**
   * Delete a context from memory
   */
  async delete(contextId: string): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const key = `context:${contextId}`;

        await this.memoryService.client.callTool({
          name: 'delete',
          arguments: { key },
        });

        this.metrics.totalEntries--;

        this.logger.debug('Context deleted from memory', { contextId, key });

        return success(undefined);
      },
      (error) =>
        create('MEMORY_DELETE_ERROR', `Failed to delete context from memory: ${error}`, 'SYSTEM', {
          contextId,
          error,
        })
    );
  }

  /**
   * Query contexts from memory (limited functionality)
   */
  async query(query: ContextQuery): Promise<Result<Context[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Memory service doesn't support complex queries, so we need to
        // retrieve all contexts and filter in memory (not ideal for large datasets)
        const allKeysResult = await this.listAllKeys();
        if (allKeysResult.tag === 'failure') {
          return allKeysResult;
        }

        const keys = allKeysResult.value;
        const contexts: Context[] = [];

        // Retrieve contexts in batches
        for (const key of keys.slice(0, query.limit || 50)) {
          const contextId = key.replace('context:', '');
          const retrieveResult = await this.retrieve(contextId);

          if (retrieveResult.tag === 'success') {
            const context = retrieveResult.value;

            // Apply basic filters
            if (this.matchesQuery(context, query)) {
              contexts.push(context);
            }
          }
        }

        // Sort results
        this.sortContexts(contexts, query.sortBy || 'relevance', query.sortOrder || 'desc');

        this.logger.debug('Memory query completed', {
          totalKeys: keys.length,
          matchingContexts: contexts.length,
          query,
        });

        return success(contexts);
      },
      (error) =>
        create('MEMORY_QUERY_ERROR', `Failed to query contexts from memory: ${error}`, 'SYSTEM', {
          error,
        })
    );
  }

  /**
   * Get memory storage metrics
   */
  getMetrics(): MemoryStorageMetrics {
    this.metrics.cacheHitRate =
      this.metrics.hitCount / (this.metrics.hitCount + this.metrics.missCount) || 0;

    return { ...this.metrics };
  }

  /**
   * Perform cleanup operations
   */
  async cleanup(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const now = new Date();
        const timeSinceLastCleanup = now.getTime() - this.lastCleanup.getTime();

        // Only cleanup if it's been at least 5 minutes
        if (timeSinceLastCleanup < 5 * 60 * 1000) {
          return success(undefined);
        }

        this.logger.info('Starting memory storage cleanup');

        // Get all keys
        const keysResult = await this.listAllKeys();
        if (keysResult.tag === 'failure') {
          return keysResult;
        }

        const keys = keysResult.value;
        let cleanedCount = 0;

        // Check each context for expiration
        for (const key of keys) {
          try {
            const result = await this.memoryService.client.callTool({
              name: 'retrieve',
              arguments: { key },
            });

            if (result.content) {
              const entry: MemoryEntry = JSON.parse(result.content);

              // Check if expired
              if (entry.ttl && entry.storedAt) {
                const expiresAt = new Date(entry.storedAt.getTime() + entry.ttl * 1000);
                if (now > expiresAt) {
                  await this.memoryService.client.callTool({
                    name: 'delete',
                    arguments: { key },
                  });
                  cleanedCount++;
                }
              }
            }
          } catch (error) {
            this.logger.warn('Error during cleanup', { key, error });
          }
        }

        this.lastCleanup = now;
        this.metrics.evictionCount += cleanedCount;

        this.logger.info('Memory storage cleanup completed', {
          cleanedCount,
          totalKeys: keys.length,
        });

        return success(undefined);
      },
      (error) =>
        create('MEMORY_CLEANUP_ERROR', `Memory cleanup failed: ${error}`, 'SYSTEM', { error })
    );
  }

  /**
   * Check memory service health
   */
  async healthCheck(): Promise<Result<boolean, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Try to store and retrieve a test value
        const testKey = 'health:test';
        const testValue = { timestamp: new Date().toISOString() };

        await this.memoryService.client.callTool({
          name: 'store',
          arguments: {
            key: testKey,
            value: JSON.stringify(testValue),
            ttl: 60,
          },
        });

        const result = await this.memoryService.client.callTool({
          name: 'retrieve',
          arguments: { key: testKey },
        });

        // Cleanup test data
        await this.memoryService.client.callTool({
          name: 'delete',
          arguments: { key: testKey },
        });

        const isHealthy = result.content !== null;

        this.logger.debug('Memory storage health check', { isHealthy });

        return success(isHealthy);
      },
      (error) => {
        this.logger.error('Memory storage health check failed', { error });
        return create(
          'MEMORY_HEALTH_CHECK_ERROR',
          `Memory storage health check failed: ${error}`,
          'SYSTEM',
          { error }
        );
      }
    );
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private async listAllKeys(): Promise<Result<string[], QiError>> {
    try {
      // This is a simplified implementation
      // Real MCP memory service would need to provide key listing functionality
      const result = await this.memoryService.client.callTool({
        name: 'list_keys',
        arguments: { prefix: 'context:' },
      });

      const keys = Array.isArray(result.content) ? result.content : [];
      return success(keys);
    } catch (error) {
      return failure(
        create('MEMORY_LIST_KEYS_ERROR', `Failed to list memory keys: ${error}`, 'SYSTEM', {
          error,
        })
      );
    }
  }

  private matchesQuery(context: Context, query: ContextQuery): boolean {
    // Basic query matching - more sophisticated filtering would be done
    // in a dedicated query engine

    if (query.ids && !query.ids.includes(context.id)) {
      return false;
    }

    if (query.type && context.type !== query.type) {
      return false;
    }

    if (query.types && !query.types.includes(context.type)) {
      return false;
    }

    if (query.minPriority && context.metadata.priority < query.minPriority) {
      return false;
    }

    if (query.maxPriority && context.metadata.priority > query.maxPriority) {
      return false;
    }

    // Add more query filters as needed
    return true;
  }

  private sortContexts(contexts: Context[], sortBy: string, sortOrder: 'asc' | 'desc'): void {
    contexts.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'created':
          comparison = a.metadata.createdAt.getTime() - b.metadata.createdAt.getTime();
          break;
        case 'modified': {
          const aModified = a.metadata.modifiedAt || a.metadata.createdAt;
          const bModified = b.metadata.modifiedAt || b.metadata.createdAt;
          comparison = aModified.getTime() - bModified.getTime();
          break;
        }
        case 'accessed':
          comparison = a.metadata.lastAccessed.getTime() - b.metadata.lastAccessed.getTime();
          break;
        case 'priority':
          comparison = a.metadata.priority - b.metadata.priority;
          break;
        default:
          comparison = a.metadata.relevanceScore - b.metadata.relevanceScore;
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  private updateStoreMetrics(sizeBytes: number, operationTime: number): void {
    this.metrics.totalEntries++;
    this.metrics.totalSizeBytes += sizeBytes;
    this.updateAverageAccessTime(operationTime);
  }

  private updateRetrieveMetrics(operationTime: number, hit: boolean): void {
    if (hit) {
      this.metrics.hitCount++;
    } else {
      this.metrics.missCount++;
    }
    this.updateAverageAccessTime(operationTime);
  }

  private updateAverageAccessTime(operationTime: number): void {
    const totalOperations = this.metrics.hitCount + this.metrics.missCount;
    this.metrics.averageAccessTime =
      (this.metrics.averageAccessTime * (totalOperations - 1) + operationTime) / totalOperations;
  }
}
