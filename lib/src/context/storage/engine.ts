/**
 * Unified Context Storage Engine
 *
 * Provides a unified interface over multiple MCP storage services,
 * handling routing, fallbacks, and cross-service operations.
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
import type { MCPServiceConnection } from '../../mcp/index.js';
import type { SimpleLogger } from '../../utils/index.js';
import {
  type CompressedContext,
  type Context,
  type ContextQuery,
  type MCPServiceType,
  type StorageLocation,
  validateContext,
} from '../schemas/index.js';
import {
  FilesystemContextStorage,
  type FilesystemStorageConfig,
  type FilesystemStorageMetrics,
} from './filesystem.js';
import {
  MemoryContextStorage,
  type MemoryStorageConfig,
  type MemoryStorageMetrics,
} from './memory.js';
import {
  SQLiteContextStorage,
  type SQLiteStorageConfig,
  type SQLiteStorageMetrics,
} from './sqlite.js';

// =============================================================================
// Storage Engine Types
// =============================================================================

/**
 * Storage engine configuration
 */
export interface StorageEngineConfig {
  memory: MemoryStorageConfig;
  sqlite: SQLiteStorageConfig;
  filesystem: FilesystemStorageConfig;

  // Routing configuration
  defaultStorageService: MCPServiceType;
  fallbackEnabled: boolean;
  replicationEnabled: boolean;

  // Performance settings
  batchSize: number;
  maxConcurrency: number;
  timeoutMs: number;

  // Health checking
  healthCheckInterval: number;
  healthCheckEnabled: boolean;
}

/**
 * Storage operation result with metadata
 */
export interface StorageOperationResult<T> {
  result: T;
  service: MCPServiceType;
  executionTime: number;
  fallbackUsed: boolean;
}

/**
 * Unified storage metrics
 */
export interface UnifiedStorageMetrics {
  memory: MemoryStorageMetrics;
  sqlite: SQLiteStorageMetrics;
  filesystem: FilesystemStorageMetrics;

  // Overall metrics
  totalOperations: number;
  averageOperationTime: number;
  errorRate: number;
  fallbackRate: number;
  serviceHealthStatus: Record<MCPServiceType, boolean>;
}

/**
 * Storage route definition
 */
export interface StorageRoute {
  service: MCPServiceType;
  condition: (context: Context) => boolean;
  priority: number;
}

// =============================================================================
// Unified Storage Engine Implementation
// =============================================================================

/**
 * Unified context storage engine managing multiple MCP services
 */
export class UnifiedContextStorageEngine {
  private memoryStorage: MemoryContextStorage;
  private sqliteStorage: SQLiteContextStorage;
  private filesystemStorage: FilesystemContextStorage;
  private logger: SimpleLogger;
  private config: StorageEngineConfig;

  private serviceHealth: Map<MCPServiceType, boolean> = new Map();
  private operationMetrics: Map<string, number[]> = new Map();
  private routes: StorageRoute[] = [];
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    memoryService: MCPServiceConnection,
    sqliteService: MCPServiceConnection,
    filesystemService: MCPServiceConnection,
    logger: SimpleLogger,
    config: StorageEngineConfig
  ) {
    this.memoryStorage = new MemoryContextStorage(memoryService, logger, config.memory);
    this.sqliteStorage = new SQLiteContextStorage(sqliteService, logger, config.sqlite);
    this.filesystemStorage = new FilesystemContextStorage(
      filesystemService,
      logger,
      config.filesystem
    );
    this.logger = logger;
    this.config = config;

    // Initialize service health status
    this.serviceHealth.set('memory', true);
    this.serviceHealth.set('sqlite', true);
    this.serviceHealth.set('filesystem', true);

    // Set up default routes
    this.initializeDefaultRoutes();

    // Start health checking if enabled
    if (config.healthCheckEnabled) {
      this.startHealthChecking();
    }
  }

  /**
   * Initialize the storage engine
   */
  async initialize(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.logger.info('Initializing unified context storage engine');

        // Initialize SQLite storage (needs schema setup)
        const sqliteResult = await this.sqliteStorage.initialize();
        if (sqliteResult.tag === 'failure') {
          this.logger.error('Failed to initialize SQLite storage', { error: sqliteResult.error });
          this.serviceHealth.set('sqlite', false);
        }

        // Initialize filesystem storage (needs directory structure)
        const filesystemResult = await this.filesystemStorage.initialize();
        if (filesystemResult.tag === 'failure') {
          this.logger.error('Failed to initialize filesystem storage', {
            error: filesystemResult.error,
          });
          this.serviceHealth.set('filesystem', false);
        }

        // Memory storage doesn't need initialization

        this.logger.info('Unified context storage engine initialized', {
          serviceHealth: Object.fromEntries(this.serviceHealth),
        });

        return undefined; // fromAsyncTryCatch will wrap this in success()
      },
      (error) =>
        create(
          'STORAGE_ENGINE_INIT_ERROR',
          `Failed to initialize storage engine: ${error}`,
          'SYSTEM'
        )
    );
  }

  /**
   * Store a context using intelligent routing
   */
  async store(
    context: Context,
    preferredService?: MCPServiceType
  ): Promise<Result<StorageLocation, QiError>> {
    const startTime = Date.now();

    // Validate context first
    const validationResult = validateContext(context);
    if (validationResult.tag === 'failure') {
      return validationResult;
    }

    const validatedContext = validationResult.value;
    const targetService = preferredService || this.routeContext(validatedContext);
    const primaryResult = await this.storeInService(validatedContext, targetService);

    if (primaryResult.tag === 'success') {
      // Success path - replicate if needed
      if (this.config.replicationEnabled) {
        this.replicateAsync(validatedContext, targetService);
      }

      this.recordOperationMetrics('store', Date.now() - startTime, false);
      return primaryResult;
    }

    // Primary failed - try fallback if enabled
    if (!this.config.fallbackEnabled) {
      this.recordOperationMetrics('store', Date.now() - startTime, false, true);
      return primaryResult;
    }

    this.logger.warn('Primary storage failed, attempting fallback', {
      primaryService: targetService,
      error: primaryResult.error.message,
    });

    return await this.tryFallbackStorage(validatedContext, targetService, startTime);
  }

  private async tryFallbackStorage(
    context: Context,
    primaryService: MCPServiceType,
    startTime: number
  ): Promise<Result<StorageLocation, QiError>> {
    const fallbackServices = this.getFallbackServices(primaryService).filter((service) =>
      this.serviceHealth.get(service)
    );

    if (fallbackServices.length === 0) {
      this.recordOperationMetrics('store', Date.now() - startTime, false, true);
      return failure(
        create('NO_FALLBACK_SERVICES', 'No healthy fallback services available', 'SYSTEM')
      );
    }

    // Try first available fallback service
    const fallbackService = fallbackServices[0];
    const fallbackResult = await this.storeInService(context, fallbackService);

    return match(
      (location) => {
        this.recordOperationMetrics('store', Date.now() - startTime, true);
        this.logger.info('Fallback storage succeeded', {
          fallbackService,
          contextId: context.id,
        });
        return success({
          ...location,
          service: fallbackService,
        });
      },
      (error) => {
        // All fallbacks failed
        this.recordOperationMetrics('store', Date.now() - startTime, false, true);
        return failure(create('ALL_STORAGE_FAILED', 'All storage services failed', 'SYSTEM'));
      },
      fallbackResult
    );
  }

  /**
   * Retrieve a context from any available service
   */
  async retrieve(contextId: string): Promise<Result<Context, QiError>> {
    const startTime = Date.now();

    return await flatMap(async () => {
      // Try each service in order of preference
      const services: MCPServiceType[] = ['memory', 'sqlite', 'filesystem'];
      let lastError: QiError | null = null;

      for (const service of services) {
        if (!this.serviceHealth.get(service)) {
          continue;
        }

        const result = await this.retrieveFromService(contextId, service);

        if (result.tag === 'success') {
          this.recordOperationMetrics('retrieve', Date.now() - startTime, service !== services[0]);

          // If retrieved from slower storage, cache in faster storage
          if (service !== 'memory' && this.serviceHealth.get('memory')) {
            this.cacheAsync(result.value);
          }

          return result;
        }

        lastError = result.error;
      }

      // Not found in any service
      this.recordOperationMetrics('retrieve', Date.now() - startTime, false, true);

      return failure(
        lastError ||
          create(
            'CONTEXT_NOT_FOUND',
            `Context ${contextId} not found in any storage service`,
            'BUSINESS'
          )
      );
    }, success(undefined));
  }

  /**
   * Query contexts across services
   */
  async query(query: ContextQuery): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await flatMap(async () => {
      // For complex queries, prefer SQLite
      if (this.serviceHealth.get('sqlite')) {
        const sqliteResult = await this.sqliteStorage.query(query);

        if (sqliteResult.tag === 'success') {
          this.recordOperationMetrics('query', Date.now() - startTime, false);
          return sqliteResult;
        }
      }

      // Fallback to memory storage for simple queries
      if (this.serviceHealth.get('memory')) {
        const memoryResult = await this.memoryStorage.query(query);

        if (memoryResult.tag === 'success') {
          this.recordOperationMetrics('query', Date.now() - startTime, true);
          return memoryResult;
        }
      }

      // No services available for querying
      this.recordOperationMetrics('query', Date.now() - startTime, false, true);

      return failure(
        create('QUERY_FAILED', 'No storage services available for querying', 'SYSTEM')
      );
    }, success(undefined));
  }

  /**
   * Update a context across all replicas
   */
  async update(contextId: string, updates: Partial<Context>): Promise<Result<void, QiError>> {
    const startTime = Date.now();

    return await flatMap(async () => {
      let updateCount = 0;
      let lastError: QiError | null = null;

      // Try to update in all services where the context exists
      const services: MCPServiceType[] = ['memory', 'sqlite', 'filesystem'];

      for (const service of services) {
        if (!this.serviceHealth.get(service)) {
          continue;
        }

        const updateResult = await this.updateInService(contextId, updates, service);

        if (updateResult.tag === 'success') {
          updateCount++;
        } else {
          lastError = updateResult.error;
        }
      }

      if (updateCount > 0) {
        this.recordOperationMetrics('update', Date.now() - startTime, false);
        return success(undefined);
      }

      // No updates succeeded
      this.recordOperationMetrics('update', Date.now() - startTime, false, true);

      return failure(
        lastError ||
          create('UPDATE_FAILED', `Failed to update context ${contextId} in any service`, 'SYSTEM')
      );
    }, success(undefined));
  }

  /**
   * Delete a context from all services
   */
  async delete(contextId: string): Promise<Result<void, QiError>> {
    const startTime = Date.now();

    return await flatMap(async () => {
      let deleteCount = 0;
      const services: MCPServiceType[] = ['memory', 'sqlite', 'filesystem'];

      // Try to delete from all services
      for (const service of services) {
        if (!this.serviceHealth.get(service)) {
          continue;
        }

        const deleteResult = await this.deleteFromService(contextId, service);

        if (deleteResult.tag === 'success') {
          deleteCount++;
        }
      }

      this.recordOperationMetrics('delete', Date.now() - startTime, false);

      this.logger.debug('Context deleted from storage services', {
        contextId,
        servicesUpdated: deleteCount,
      });

      return success(undefined);
    }, success(undefined));
  }

  /**
   * Get unified storage metrics
   */
  getMetrics(): UnifiedStorageMetrics {
    return {
      memory: this.memoryStorage.getMetrics(),
      sqlite: this.sqliteStorage.getMetrics(),
      filesystem: this.filesystemStorage.getMetrics(),

      totalOperations: this.getTotalOperations(),
      averageOperationTime: this.getAverageOperationTime(),
      errorRate: this.getErrorRate(),
      fallbackRate: this.getFallbackRate(),
      serviceHealthStatus: Object.fromEntries(this.serviceHealth),
    };
  }

  /**
   * Add a custom storage route
   */
  addRoute(route: StorageRoute): void {
    this.routes.push(route);
    this.routes.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Shutdown the storage engine
   */
  async shutdown(): Promise<Result<void, QiError>> {
    return await flatMap(async () => {
      this.logger.info('Shutting down unified context storage engine');

      // Stop health checking
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      // Perform any cleanup operations
      if (this.config.memory.enabled) {
        await this.memoryStorage.cleanup();
      }

      this.logger.info('Unified context storage engine shutdown completed');

      return success(undefined);
    }, success(undefined));
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private initializeDefaultRoutes(): void {
    // High-priority contexts go to memory for fast access
    this.addRoute({
      service: 'memory',
      condition: (context) => context.metadata.priority >= 8,
      priority: 100,
    });

    // Conversation contexts go to memory for fast retrieval
    this.addRoute({
      service: 'memory',
      condition: (context) => context.type === 'conversation',
      priority: 90,
    });

    // Large contexts or archived contexts go to filesystem
    this.addRoute({
      service: 'filesystem',
      condition: (context) => {
        const size = JSON.stringify(context).length;
        return size > 50000 || context.metadata.archived;
      },
      priority: 80,
    });

    // Default route to configured default service
    this.addRoute({
      service: this.config.defaultStorageService,
      condition: () => true,
      priority: 0,
    });
  }

  private routeContext(context: Context): MCPServiceType {
    for (const route of this.routes) {
      if (route.condition(context) && this.serviceHealth.get(route.service)) {
        return route.service;
      }
    }

    return this.config.defaultStorageService;
  }

  private getFallbackServices(primaryService: MCPServiceType): MCPServiceType[] {
    const allServices: MCPServiceType[] = ['memory', 'sqlite', 'filesystem'];
    return allServices.filter(
      (service) => service !== primaryService && this.serviceHealth.get(service)
    );
  }

  private async storeInService(
    context: Context,
    service: MCPServiceType
  ): Promise<Result<StorageLocation, QiError>> {
    switch (service) {
      case 'memory':
        return await this.memoryStorage.store(context);
      case 'sqlite':
        return await this.sqliteStorage.store(context);
      case 'filesystem':
        return await this.filesystemStorage.store(context);
      default:
        return failure(create('UNKNOWN_SERVICE', `Unknown storage service: ${service}`, 'SYSTEM'));
    }
  }

  private async retrieveFromService(
    contextId: string,
    service: MCPServiceType
  ): Promise<Result<Context, QiError>> {
    switch (service) {
      case 'memory':
        return await this.memoryStorage.retrieve(contextId);
      case 'sqlite':
        return await this.sqliteStorage.retrieve(contextId);
      case 'filesystem':
        return await this.filesystemStorage.retrieve(contextId);
      default:
        return failure(create('UNKNOWN_SERVICE', `Unknown storage service: ${service}`, 'SYSTEM'));
    }
  }

  private async updateInService(
    contextId: string,
    updates: Partial<Context>,
    service: MCPServiceType
  ): Promise<Result<void, QiError>> {
    switch (service) {
      case 'memory':
        return await this.memoryStorage.update(contextId, updates);
      case 'sqlite': {
        // SQLite storage update implementation
        const retrieveResult = await this.sqliteStorage.retrieve(contextId);
        if (retrieveResult.tag === 'failure') {
          return failure(retrieveResult.error);
        }

        const updatedContext = { ...retrieveResult.value, ...updates };

        // Validate the updated context
        const validation = validateContext(updatedContext);
        if (validation.tag === 'failure') {
          return failure(validation.error);
        }

        // Store the updated context (SQLite store should handle overwrites)
        const storeResult = await this.sqliteStorage.store(updatedContext);
        return storeResult.tag === 'success' ? success(undefined) : failure(storeResult.error);
      }
      case 'filesystem': {
        // Update would involve re-storing the context
        const retrieveResult = await this.filesystemStorage.retrieve(contextId);
        if (retrieveResult.tag === 'failure') {
          return failure(retrieveResult.error);
        }

        const updatedContext = { ...retrieveResult.value, ...updates };
        const storeResult = await this.filesystemStorage.store(updatedContext);

        return storeResult.tag === 'success' ? success(undefined) : failure(storeResult.error);
      }
      default:
        return failure(create('UNKNOWN_SERVICE', `Unknown storage service: ${service}`, 'SYSTEM'));
    }
  }

  private async deleteFromService(
    contextId: string,
    service: MCPServiceType
  ): Promise<Result<void, QiError>> {
    switch (service) {
      case 'memory':
        return await this.memoryStorage.delete(contextId);
      case 'sqlite':
        return await this.sqliteStorage.delete(contextId);
      case 'filesystem':
        return await this.filesystemStorage.delete(contextId);
      default:
        return failure(create('UNKNOWN_SERVICE', `Unknown storage service: ${service}`, 'SYSTEM'));
    }
  }

  private async replicateAsync(context: Context, excludeService: MCPServiceType): Promise<void> {
    // Replicate to other services in background
    const services: MCPServiceType[] = ['memory', 'sqlite', 'filesystem'];

    for (const service of services) {
      if (service !== excludeService && this.serviceHealth.get(service)) {
        this.storeInService(context, service).catch((error) => {
          this.logger.warn('Background replication failed', {
            service,
            contextId: context.id,
            error: error.message,
          });
        });
      }
    }
  }

  private async cacheAsync(context: Context): Promise<void> {
    // Cache context in memory in background
    if (this.serviceHealth.get('memory')) {
      this.memoryStorage.store(context).catch((error) => {
        this.logger.warn('Background caching failed', {
          contextId: context.id,
          error: error.message,
        });
      });
    }
  }

  private recordOperationMetrics(
    operation: string,
    executionTime: number,
    fallbackUsed: boolean,
    failed = false
  ): void {
    const key = failed ? `${operation}_failed` : operation;
    const metrics = this.operationMetrics.get(key) || [];
    metrics.push(executionTime);

    // Keep only last 1000 operations for metrics
    if (metrics.length > 1000) {
      metrics.shift();
    }

    this.operationMetrics.set(key, metrics);

    if (fallbackUsed) {
      const fallbackMetrics = this.operationMetrics.get('fallback_used') || [];
      fallbackMetrics.push(1);
      this.operationMetrics.set('fallback_used', fallbackMetrics);
    }
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const healthChecks = [
      { service: 'memory' as MCPServiceType, check: () => this.memoryStorage.healthCheck() },
      // SQLite and Filesystem don't have explicit health checks in the current implementation
      // but we could add them
    ];

    for (const { service, check } of healthChecks) {
      try {
        const result = await check();
        const isHealthy = result.tag === 'success' ? result.value : false;

        if (this.serviceHealth.get(service) !== isHealthy) {
          this.logger.info(`Service health status changed`, {
            service,
            previousHealth: this.serviceHealth.get(service),
            currentHealth: isHealthy,
          });

          this.serviceHealth.set(service, isHealthy);
        }
      } catch (error) {
        this.logger.warn(`Health check failed for service ${service}`, { error });
        this.serviceHealth.set(service, false);
      }
    }
  }

  private getTotalOperations(): number {
    let total = 0;
    for (const metrics of this.operationMetrics.values()) {
      total += metrics.length;
    }
    return total;
  }

  private getAverageOperationTime(): number {
    let totalTime = 0;
    let totalOps = 0;

    for (const [key, metrics] of this.operationMetrics.entries()) {
      if (!key.endsWith('_failed')) {
        totalTime += metrics.reduce((sum, time) => sum + time, 0);
        totalOps += metrics.length;
      }
    }

    return totalOps > 0 ? totalTime / totalOps : 0;
  }

  private getErrorRate(): number {
    const totalOps = this.getTotalOperations();
    let errorOps = 0;

    for (const [key, metrics] of this.operationMetrics.entries()) {
      if (key.endsWith('_failed')) {
        errorOps += metrics.length;
      }
    }

    return totalOps > 0 ? errorOps / totalOps : 0;
  }

  private getFallbackRate(): number {
    const fallbackMetrics = this.operationMetrics.get('fallback_used') || [];
    const totalOps = this.getTotalOperations();

    return totalOps > 0 ? fallbackMetrics.length / totalOps : 0;
  }
}
