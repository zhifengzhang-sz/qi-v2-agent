/**
 * Write Strategy Implementation
 *
 * Implements external memory management for context engineering,
 * allowing contexts to be stored outside immediate LLM prompts
 * while maintaining accessibility and efficiency.
 */

import {
  create,
  failure,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type { SimpleLogger } from '../../utils/index.js';
import { type Context, type MCPServiceType, validateContext } from '../schemas/index.js';
import type { UnifiedContextStorageEngine } from '../storage/index.js';

// =============================================================================
// Write Strategy Types
// =============================================================================

/**
 * Storage reference types for different external storage locations
 */
export type StorageType = 'scratchpad' | 'memory' | 'state' | 'archive';

/**
 * Base storage reference interface
 */
export interface BaseStorageRef {
  id: string;
  contextId: string;
  type: StorageType;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Scratchpad storage reference - for temporary working memory
 */
export interface ScratchpadRef extends BaseStorageRef {
  type: 'scratchpad';
  namespace: string;
  priority: number;
}

/**
 * Memory storage reference - for hot, frequently accessed contexts
 */
export interface MemoryRef extends BaseStorageRef {
  type: 'memory';
  ttl: number;
  accessCount: number;
}

/**
 * State object reference - for structured, schema-validated storage
 */
export interface StateRef extends BaseStorageRef {
  type: 'state';
  schemaVersion: string;
  fields: string[];
  validated: boolean;
}

/**
 * Archive reference - for long-term, compressed storage
 */
export interface ArchiveRef extends BaseStorageRef {
  type: 'archive';
  compressionAlgorithm: string;
  originalSize: number;
  compressedSize: number;
}

/**
 * Union type for all storage references
 */
export type WriteStrategyRef = ScratchpadRef | MemoryRef | StateRef | ArchiveRef;

/**
 * Write strategy configuration
 */
export interface WriteStrategyConfig {
  defaultStorage: StorageType;
  compressionThreshold: number; // bytes
  backupEnabled: boolean;

  // Scratchpad settings
  scratchpadTTL: number; // seconds
  maxScratchpadSize: number; // bytes

  // Memory settings
  memoryTTL: number; // seconds
  memoryCompressionEnabled: boolean;

  // State settings
  stateValidationEnabled: boolean;
  stateBackupEnabled: boolean;

  // Archive settings
  archiveCompressionEnabled: boolean;
  archiveRetentionDays: number;
}

/**
 * Write operation options
 */
export interface WriteOptions {
  storageType?: StorageType;
  ttl?: number;
  namespace?: string;
  priority?: number;
  compress?: boolean;
  replicate?: boolean;
}

/**
 * Batch write result
 */
export interface BatchWriteResult {
  successful: WriteStrategyRef[];
  failed: Array<{ context: Context; error: QiError }>;
  totalProcessed: number;
}

/**
 * Write strategy metrics
 */
export interface WriteStrategyMetrics {
  totalWrites: number;
  writesPerType: Record<StorageType, number>;
  averageWriteTime: number;
  compressionRatio: number;
  cacheHitRate: number;
  errorRate: number;
  storageUtilization: Record<StorageType, number>;
}

// =============================================================================
// Write Strategy Interface
// =============================================================================

/**
 * Write Strategy interface defining external memory management capabilities
 */
export interface IWriteStrategy {
  readonly name: string;
  readonly version: string;

  // Core write operations
  writeToScratchpad(
    context: Context,
    namespace?: string,
    priority?: number
  ): Promise<Result<ScratchpadRef, QiError>>;
  writeToMemory(context: Context, ttl?: number): Promise<Result<MemoryRef, QiError>>;
  writeToState(context: Context, schemaVersion?: string): Promise<Result<StateRef, QiError>>;
  writeToArchive(
    context: Context,
    compressionEnabled?: boolean
  ): Promise<Result<ArchiveRef, QiError>>;

  // Generic write with routing
  write(context: Context, options?: WriteOptions): Promise<Result<WriteStrategyRef, QiError>>;

  // Bulk operations
  batchWrite(
    contexts: Context[],
    storageType: StorageType
  ): Promise<Result<BatchWriteResult, QiError>>;

  // Retrieval operations
  retrieve(ref: WriteStrategyRef): Promise<Result<Context, QiError>>;
  batchRetrieve(refs: WriteStrategyRef[]): Promise<Result<Context[], QiError>>;

  // Management operations
  expire(ref: WriteStrategyRef): Promise<Result<void, QiError>>;
  delete(ref: WriteStrategyRef): Promise<Result<void, QiError>>;
  compress(ref: WriteStrategyRef): Promise<Result<WriteStrategyRef, QiError>>;

  // Lifecycle operations
  evictExpired(): Promise<Result<WriteStrategyRef[], QiError>>;
  compactStorage(): Promise<Result<void, QiError>>;

  // Metrics and monitoring
  getMetrics(): WriteStrategyMetrics;

  // Initialization and cleanup
  initialize(): Promise<Result<void, QiError>>;
  cleanup(): Promise<Result<void, QiError>>;
}

// =============================================================================
// Write Strategy Implementation
// =============================================================================

/**
 * Write Strategy implementation using MCP storage services
 */
export class WriteStrategy implements IWriteStrategy {
  readonly name = 'mcp-write-strategy';
  readonly version = '1.0';

  private storageEngine: UnifiedContextStorageEngine;
  private logger: SimpleLogger;
  private config: WriteStrategyConfig;
  private metrics: WriteStrategyMetrics;
  private referenceStore: Map<string, WriteStrategyRef> = new Map();

  constructor(
    storageEngine: UnifiedContextStorageEngine,
    logger: SimpleLogger,
    config: WriteStrategyConfig
  ) {
    this.storageEngine = storageEngine;
    this.logger = logger;
    this.config = config;
    this.metrics = {
      totalWrites: 0,
      writesPerType: {
        scratchpad: 0,
        memory: 0,
        state: 0,
        archive: 0,
      },
      averageWriteTime: 0,
      compressionRatio: 1.0,
      cacheHitRate: 0.0,
      errorRate: 0.0,
      storageUtilization: {
        scratchpad: 0,
        memory: 0,
        state: 0,
        archive: 0,
      },
    };
  }

  /**
   * Initialize the write strategy
   */
  async initialize(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.logger.info('Initializing Write Strategy', {
          name: this.name,
          version: this.version,
        });

        // Initialize storage engine if needed
        const initResult = await this.storageEngine.initialize();
        if (initResult.tag === 'failure') {
          return initResult;
        }

        // Load any existing references from storage
        await this.loadExistingReferences();

        this.logger.info('Write Strategy initialized successfully');
        return undefined;
      },
      (error) =>
        create(
          'WRITE_STRATEGY_INIT_ERROR',
          `Write strategy initialization failed: ${error}`,
          'SYSTEM',
          { error }
        )
    );
  }

  /**
   * Write context to scratchpad for temporary working memory
   */
  async writeToScratchpad(
    context: Context,
    namespace = 'default',
    priority = 5
  ): Promise<Result<ScratchpadRef, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Validate context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedContext = validationResult.value;

        // Create scratchpad-specific metadata
        const scratchpadContext = {
          ...validatedContext,
          metadata: {
            ...validatedContext.metadata,
            tags: [...validatedContext.metadata.tags, 'scratchpad', namespace],
            mcpStorage: {
              ...validatedContext.metadata.mcpStorage,
              service: 'memory' as MCPServiceType,
            },
          },
        };

        // Store in memory service with TTL
        const storeResult = await this.storageEngine.store(scratchpadContext, 'memory');
        if (storeResult.tag === 'failure') {
          return storeResult;
        }

        // Create scratchpad reference
        const ref: ScratchpadRef = {
          id: crypto.randomUUID(),
          contextId: validatedContext.id,
          type: 'scratchpad',
          namespace,
          priority,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + this.config.scratchpadTTL * 1000),
          metadata: {
            storageLocation: storeResult.value,
          },
        };

        // Store reference for tracking
        this.referenceStore.set(ref.id, ref);

        // Update metrics
        this.updateWriteMetrics('scratchpad', Date.now() - startTime);

        this.logger.debug('Context written to scratchpad', {
          contextId: validatedContext.id,
          namespace,
          priority,
          refId: ref.id,
        });

        return success(ref);
      },
      (error) =>
        create('SCRATCHPAD_WRITE_ERROR', `Failed to write to scratchpad: ${error}`, 'SYSTEM', {
          contextId: context.id,
          namespace,
          error,
        })
    );
  }

  /**
   * Write context to memory for fast access
   */
  async writeToMemory(
    context: Context,
    ttl = this.config.memoryTTL
  ): Promise<Result<MemoryRef, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Validate context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedContext = validationResult.value;

        // Determine if compression is needed
        const contextSize = JSON.stringify(validatedContext).length;
        const shouldCompress =
          contextSize > this.config.compressionThreshold && this.config.memoryCompressionEnabled;

        // Create memory-specific metadata
        const memoryContext = {
          ...validatedContext,
          metadata: {
            ...validatedContext.metadata,
            compressionLevel: shouldCompress ? ('semantic' as const) : ('none' as const),
            tags: [...validatedContext.metadata.tags, 'memory', 'hot-storage'],
            ttl,
            expiresAt: new Date(Date.now() + ttl * 1000),
            mcpStorage: {
              ...validatedContext.metadata.mcpStorage,
              service: 'memory' as MCPServiceType,
              compressionEnabled: shouldCompress,
            },
          },
        };

        // Store in memory service
        const storeResult = await this.storageEngine.store(memoryContext, 'memory');
        if (storeResult.tag === 'failure') {
          return storeResult;
        }

        // Create memory reference
        const ref: MemoryRef = {
          id: crypto.randomUUID(),
          contextId: validatedContext.id,
          type: 'memory',
          ttl,
          accessCount: 0,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + ttl * 1000),
          metadata: {
            storageLocation: storeResult.value,
            compressed: shouldCompress,
            originalSize: contextSize,
          },
        };

        // Store reference for tracking
        this.referenceStore.set(ref.id, ref);

        // Update metrics
        this.updateWriteMetrics('memory', Date.now() - startTime);

        this.logger.debug('Context written to memory', {
          contextId: validatedContext.id,
          ttl,
          compressed: shouldCompress,
          refId: ref.id,
        });

        return success(ref);
      },
      (error) =>
        create('MEMORY_WRITE_ERROR', `Failed to write to memory: ${error}`, 'SYSTEM', {
          contextId: context.id,
          ttl,
          error,
        })
    );
  }

  /**
   * Write context as structured state object
   */
  async writeToState(context: Context, schemaVersion = '1.0'): Promise<Result<StateRef, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Validate context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedContext = validationResult.value;

        // Perform additional validation if enabled
        if (this.config.stateValidationEnabled) {
          // This would perform schema-specific validation
          // For now, we'll just ensure the context has required fields
          if (!validatedContext.content || Object.keys(validatedContext.content).length === 0) {
            return failure(
              create(
                'STATE_VALIDATION_ERROR',
                'State context must have non-empty content',
                'VALIDATION'
              )
            );
          }
        }

        // Extract fields for selective exposure
        const fields = Object.keys(validatedContext.content);

        // Create state-specific metadata
        const stateContext = {
          ...validatedContext,
          metadata: {
            ...validatedContext.metadata,
            tags: [...validatedContext.metadata.tags, 'state', 'validated'],
            mcpStorage: {
              ...validatedContext.metadata.mcpStorage,
              service: 'sqlite' as MCPServiceType, // Use SQLite for state objects
            },
          },
        };

        // Store in SQLite for structured access
        const storeResult = await this.storageEngine.store(stateContext, 'sqlite');
        if (storeResult.tag === 'failure') {
          return storeResult;
        }

        // Create state reference
        const ref: StateRef = {
          id: crypto.randomUUID(),
          contextId: validatedContext.id,
          type: 'state',
          schemaVersion,
          fields,
          validated: this.config.stateValidationEnabled,
          createdAt: new Date(),
          metadata: {
            storageLocation: storeResult.value,
            fieldCount: fields.length,
          },
        };

        // Create backup if enabled
        if (this.config.stateBackupEnabled) {
          await this.createBackup(validatedContext, ref);
        }

        // Store reference for tracking
        this.referenceStore.set(ref.id, ref);

        // Update metrics
        this.updateWriteMetrics('state', Date.now() - startTime);

        this.logger.debug('Context written to state storage', {
          contextId: validatedContext.id,
          schemaVersion,
          fields: fields.length,
          validated: ref.validated,
          refId: ref.id,
        });

        return success(ref);
      },
      (error) =>
        create('STATE_WRITE_ERROR', `Failed to write to state storage: ${error}`, 'SYSTEM', {
          contextId: context.id,
          schemaVersion,
          error,
        })
    );
  }

  /**
   * Write context to archive for long-term storage
   */
  async writeToArchive(
    context: Context,
    compressionEnabled = this.config.archiveCompressionEnabled
  ): Promise<Result<ArchiveRef, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Validate context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedContext = validationResult.value;
        const originalSize = JSON.stringify(validatedContext).length;

        // Create archive-specific metadata
        const archiveContext = {
          ...validatedContext,
          metadata: {
            ...validatedContext.metadata,
            compressionLevel: compressionEnabled ? ('lossless' as const) : ('none' as const),
            tags: [...validatedContext.metadata.tags, 'archive', 'long-term'],
            archived: true,
            mcpStorage: {
              ...validatedContext.metadata.mcpStorage,
              service: 'filesystem' as MCPServiceType,
              compressionEnabled,
            },
          },
        };

        // Store in filesystem service
        const storeResult = await this.storageEngine.store(archiveContext, 'filesystem');
        if (storeResult.tag === 'failure') {
          return storeResult;
        }

        // Calculate compression ratio if compressed
        const compressedSize = storeResult.value.storageSize || originalSize;
        const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1.0;

        // Create archive reference
        const ref: ArchiveRef = {
          id: crypto.randomUUID(),
          contextId: validatedContext.id,
          type: 'archive',
          compressionAlgorithm: compressionEnabled ? 'lz4' : 'none',
          originalSize,
          compressedSize,
          createdAt: new Date(),
          expiresAt:
            this.config.archiveRetentionDays > 0
              ? new Date(Date.now() + this.config.archiveRetentionDays * 24 * 60 * 60 * 1000)
              : undefined,
          metadata: {
            storageLocation: storeResult.value,
            compressionRatio,
            compressed: compressionEnabled,
          },
        };

        // Store reference for tracking
        this.referenceStore.set(ref.id, ref);

        // Update metrics
        this.updateWriteMetrics('archive', Date.now() - startTime, compressionRatio);

        this.logger.debug('Context written to archive', {
          contextId: validatedContext.id,
          originalSize,
          compressedSize,
          compressionRatio,
          refId: ref.id,
        });

        return success(ref);
      },
      (error) =>
        create('ARCHIVE_WRITE_ERROR', `Failed to write to archive: ${error}`, 'SYSTEM', {
          contextId: context.id,
          compressionEnabled,
          error,
        })
    );
  }

  /**
   * Generic write with intelligent routing
   */
  async write(
    context: Context,
    options: WriteOptions = {}
  ): Promise<Result<WriteStrategyRef, QiError>> {
    const storageType = options.storageType || this.determineStorageType(context);

    switch (storageType) {
      case 'scratchpad':
        return await this.writeToScratchpad(context, options.namespace, options.priority);
      case 'memory':
        return await this.writeToMemory(context, options.ttl);
      case 'state':
        return await this.writeToState(context);
      case 'archive':
        return await this.writeToArchive(context, options.compress);
      default:
        return failure(
          create('INVALID_STORAGE_TYPE', `Invalid storage type: ${storageType}`, 'VALIDATION')
        );
    }
  }

  /**
   * Batch write contexts to specified storage
   */
  async batchWrite(
    contexts: Context[],
    storageType: StorageType
  ): Promise<Result<BatchWriteResult, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const result: BatchWriteResult = {
          successful: [],
          failed: [],
          totalProcessed: contexts.length,
        };

        // Process contexts in batches to avoid overwhelming the system
        const batchSize = 10;

        for (let i = 0; i < contexts.length; i += batchSize) {
          const batch = contexts.slice(i, i + batchSize);

          // Process batch concurrently
          const batchPromises = batch.map(async (context) => {
            const writeResult = await this.write(context, { storageType });
            return { context, writeResult };
          });

          const batchResults = await Promise.all(batchPromises);

          // Collect results
          for (const { context, writeResult } of batchResults) {
            if (writeResult.tag === 'success') {
              result.successful.push(writeResult.value);
            } else {
              result.failed.push({ context, error: writeResult.error });
            }
          }
        }

        this.logger.info('Batch write completed', {
          storageType,
          total: result.totalProcessed,
          successful: result.successful.length,
          failed: result.failed.length,
        });

        return success(result);
      },
      (error) =>
        create('BATCH_WRITE_ERROR', `Batch write failed: ${error}`, 'SYSTEM', {
          storageType,
          contextCount: contexts.length,
          error,
        })
    );
  }

  /**
   * Retrieve context by reference
   */
  async retrieve(ref: WriteStrategyRef): Promise<Result<Context, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Check if reference has expired
        if (ref.expiresAt && ref.expiresAt < new Date()) {
          return failure(
            create('REFERENCE_EXPIRED', `Reference ${ref.id} has expired`, 'BUSINESS')
          );
        }

        // Retrieve from storage
        const retrieveResult = await this.storageEngine.retrieve(ref.contextId);
        if (retrieveResult.tag === 'failure') {
          return retrieveResult;
        }

        // Update access count for memory references
        if (ref.type === 'memory') {
          const memoryRef = ref as MemoryRef;
          memoryRef.accessCount++;
          this.referenceStore.set(ref.id, memoryRef);
        }

        this.logger.debug('Context retrieved via reference', {
          refId: ref.id,
          contextId: ref.contextId,
          storageType: ref.type,
        });

        return success(retrieveResult.value);
      },
      (error) =>
        create('RETRIEVE_ERROR', `Failed to retrieve context via reference: ${error}`, 'SYSTEM', {
          refId: ref.id,
          error,
        })
    );
  }

  /**
   * Batch retrieve contexts by references
   */
  async batchRetrieve(refs: WriteStrategyRef[]): Promise<Result<Context[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const contexts: Context[] = [];

        for (const ref of refs) {
          const retrieveResult = await this.retrieve(ref);
          if (retrieveResult.tag === 'success') {
            contexts.push(retrieveResult.value);
          } else {
            // Log error but continue with other references
            this.logger.warn('Failed to retrieve context in batch', {
              refId: ref.id,
              error: retrieveResult.error.message,
            });
          }
        }

        this.logger.debug('Batch retrieve completed', {
          requested: refs.length,
          retrieved: contexts.length,
        });

        return contexts;
      },
      (error) =>
        create('BATCH_RETRIEVE_ERROR', `Batch retrieve failed: ${error}`, 'SYSTEM', {
          refCount: refs.length,
          error,
        })
    );
  }

  /**
   * Delete context by reference
   */
  async delete(ref: WriteStrategyRef): Promise<Result<void, QiError>> {
    // Delete from storage (best effort, continue even if it fails)
    const deleteResult = await this.storageEngine.delete(ref.contextId);

    return match(
      (_) => {
        // Storage delete succeeded, remove reference
        this.referenceStore.delete(ref.id);
        this.logger.debug('Context deleted successfully', { refId: ref.id });
        return undefined;
      },
      (error) => {
        // Storage delete failed, but still remove reference for cleanup
        this.logger.warn('Failed to delete from storage, continuing with reference cleanup', {
          refId: ref.id,
          error: error.message,
        });
        return undefined;
      },
      deleteResult
    );
  }

  /**
   * Evict expired references and contexts
   */
  async evictExpired(): Promise<Result<WriteStrategyRef[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const now = new Date();
        const evictedRefs: WriteStrategyRef[] = [];

        for (const [_refId, ref] of this.referenceStore.entries()) {
          if (ref.expiresAt && ref.expiresAt < now) {
            const deleteResult = await this.delete(ref);
            if (deleteResult.tag === 'success') {
              evictedRefs.push(ref);
            }
          }
        }

        this.logger.info('Expired references evicted', {
          evictedCount: evictedRefs.length,
        });

        return evictedRefs;
      },
      (error) =>
        create('EVICTION_ERROR', `Failed to evict expired references: ${error}`, 'SYSTEM', {
          error,
        })
    );
  }

  /**
   * Get write strategy metrics
   */
  getMetrics(): WriteStrategyMetrics {
    // Update storage utilization
    for (const storageType of Object.keys(this.metrics.storageUtilization) as StorageType[]) {
      const refs = Array.from(this.referenceStore.values()).filter(
        (ref) => ref.type === storageType
      );
      this.metrics.storageUtilization[storageType] = refs.length;
    }

    return { ...this.metrics };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.logger.info('Cleaning up Write Strategy');

        // Evict expired references
        await this.evictExpired();

        // Clear in-memory references
        this.referenceStore.clear();

        this.logger.info('Write Strategy cleanup completed');

        return undefined;
      },
      (error) =>
        create('CLEANUP_ERROR', `Write strategy cleanup failed: ${error}`, 'SYSTEM', { error })
    );
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private determineStorageType(context: Context): StorageType {
    // High-priority or conversation contexts go to memory
    if (context.metadata.priority >= 8 || context.type === 'conversation') {
      return 'memory';
    }

    // Large contexts or archived contexts go to archive
    const contextSize = JSON.stringify(context).length;
    if (contextSize > this.config.compressionThreshold || context.metadata.archived) {
      return 'archive';
    }

    // Structured contexts go to state storage
    if (context.type === 'task' || context.type === 'workflow') {
      return 'state';
    }

    // Default to configured default storage
    return this.config.defaultStorage;
  }

  private async loadExistingReferences(): Promise<void> {
    // In a real implementation, this would load references from persistent storage
    // For now, we'll start with an empty reference store
    this.referenceStore.clear();
  }

  private async createBackup(context: Context, ref: WriteStrategyRef): Promise<void> {
    try {
      // Store backup in filesystem
      await this.storageEngine.store(context, 'filesystem');
      this.logger.debug('Backup created for state context', {
        contextId: context.id,
        refId: ref.id,
      });
    } catch (error) {
      this.logger.warn('Failed to create backup', {
        contextId: context.id,
        error,
      });
    }
  }

  private updateWriteMetrics(
    storageType: StorageType,
    executionTime: number,
    compressionRatio = 1.0
  ): void {
    this.metrics.totalWrites++;
    this.metrics.writesPerType[storageType]++;

    // Update average write time
    this.metrics.averageWriteTime =
      (this.metrics.averageWriteTime * (this.metrics.totalWrites - 1) + executionTime) /
      this.metrics.totalWrites;

    // Update compression ratio
    if (compressionRatio < 1.0) {
      const compressedWrites = Object.values(this.metrics.writesPerType).reduce(
        (sum, count, index) => (index > 0 ? sum + count : sum),
        0
      );
      this.metrics.compressionRatio =
        (this.metrics.compressionRatio * (compressedWrites - 1) + compressionRatio) /
        compressedWrites;
    }
  }

  // Additional methods for strategy interface completion...
  async expire(ref: WriteStrategyRef): Promise<Result<void, QiError>> {
    // Set expiration to now
    ref.expiresAt = new Date();
    this.referenceStore.set(ref.id, ref);
    return success(undefined);
  }

  async compress(ref: WriteStrategyRef): Promise<Result<WriteStrategyRef, QiError>> {
    // This would implement compression of the referenced context
    // For now, return the reference as-is
    return success(ref);
  }

  async compactStorage(): Promise<Result<void, QiError>> {
    // This would implement storage compaction
    // For now, just evict expired references
    await this.evictExpired();
    return success(undefined);
  }
}
