/**
 * Context Storage Index
 *
 * Central export point for all context storage implementations
 * and the unified storage engine.
 */

// =============================================================================
// Storage Implementations
// =============================================================================

export * from './engine.js';
export * from './filesystem.js';
export * from './memory.js';
export * from './sqlite.js';

// =============================================================================
// Re-export Types for Convenience
// =============================================================================

export type {
  StorageEngineConfig,
  StorageOperationResult,
  StorageRoute,
  UnifiedStorageMetrics,
} from './engine.js';
export type {
  ArchiveMetadata,
  FilesystemStorageConfig,
  FilesystemStorageMetrics,
} from './filesystem.js';
export type {
  MemoryEntry,
  MemoryStorageConfig,
  MemoryStorageMetrics,
} from './memory.js';
export type {
  QueryStats,
  SQLiteStorageConfig,
  SQLiteStorageMetrics,
} from './sqlite.js';

// =============================================================================
// Storage Factory Functions
// =============================================================================

import type { MCPServiceConnection } from '../../messaging/index.js';
import type { SimpleLogger } from '../../utils/index.js';
import { type StorageEngineConfig, UnifiedContextStorageEngine } from './engine.js';
import { FilesystemContextStorage, type FilesystemStorageConfig } from './filesystem.js';
import { MemoryContextStorage, type MemoryStorageConfig } from './memory.js';
import { SQLiteContextStorage, type SQLiteStorageConfig } from './sqlite.js';

/**
 * Create a memory context storage instance
 */
export function createMemoryStorage(
  memoryService: MCPServiceConnection,
  logger: SimpleLogger,
  config: MemoryStorageConfig
): MemoryContextStorage {
  return new MemoryContextStorage(memoryService, logger, config);
}

/**
 * Create a SQLite context storage instance
 */
export function createSQLiteStorage(
  sqliteService: MCPServiceConnection,
  logger: SimpleLogger,
  config: SQLiteStorageConfig
): SQLiteContextStorage {
  return new SQLiteContextStorage(sqliteService, logger, config);
}

/**
 * Create a filesystem context storage instance
 */
export function createFilesystemStorage(
  filesystemService: MCPServiceConnection,
  logger: SimpleLogger,
  config: FilesystemStorageConfig
): FilesystemContextStorage {
  return new FilesystemContextStorage(filesystemService, logger, config);
}

/**
 * Create a unified storage engine instance
 */
export function createUnifiedStorageEngine(
  memoryService: MCPServiceConnection,
  sqliteService: MCPServiceConnection,
  filesystemService: MCPServiceConnection,
  logger: SimpleLogger,
  config: StorageEngineConfig
): UnifiedContextStorageEngine {
  return new UnifiedContextStorageEngine(
    memoryService,
    sqliteService,
    filesystemService,
    logger,
    config
  );
}

// =============================================================================
// Default Configurations
// =============================================================================

/**
 * Default memory storage configuration
 */
export const defaultMemoryConfig: MemoryStorageConfig = {
  maxSize: '1GB',
  evictionPolicy: 'LRU',
  defaultTTL: 3600, // 1 hour
  enabled: true,
  compressionEnabled: true,
  metricsEnabled: true,
};

/**
 * Default SQLite storage configuration
 */
export const defaultSQLiteConfig: SQLiteStorageConfig = {
  databasePath: './data/context-index.db',
  journalMode: 'WAL',
  cacheSize: 10000,
  enabled: true,
  indexingEnabled: true,
  fullTextSearchEnabled: true,
};

/**
 * Default filesystem storage configuration
 */
export const defaultFilesystemConfig: FilesystemStorageConfig = {
  basePath: './data/contexts',
  compressionEnabled: true,
  defaultAlgorithm: 'lz4',
  maxFileSize: '100MB',
  enabled: true,
  backupEnabled: true,
  archiveEnabled: true,
};

/**
 * Default unified storage engine configuration
 */
export const defaultStorageEngineConfig: StorageEngineConfig = {
  memory: defaultMemoryConfig,
  sqlite: defaultSQLiteConfig,
  filesystem: defaultFilesystemConfig,

  defaultStorageService: 'memory',
  fallbackEnabled: true,
  replicationEnabled: false,

  batchSize: 10,
  maxConcurrency: 5,
  timeoutMs: 30000,

  healthCheckInterval: 60000,
  healthCheckEnabled: true,
};
