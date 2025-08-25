/**
 * Filesystem MCP Storage Wrapper
 *
 * Provides a wrapper around the Filesystem MCP service for context archival,
 * compression, and long-term storage.
 */

import { create, failure, fromAsyncTryCatch, type QiError, type Result, success } from '@qi/base';
import type { MCPServiceConnection } from '../../messaging/index.js';
import type { SimpleLogger } from '../../utils/index.js';
import {
  type CompressedContext,
  type CompressionAlgorithm,
  type CompressionStats,
  type Context,
  type StorageLocation,
  validateCompressedContext,
  validateContext,
} from '../schemas/index.js';

// =============================================================================
// Filesystem Storage Types
// =============================================================================

/**
 * Filesystem storage configuration
 */
export interface FilesystemStorageConfig {
  basePath: string;
  compressionEnabled: boolean;
  defaultAlgorithm: CompressionAlgorithm;
  maxFileSize: string; // e.g., "100MB"
  enabled: boolean;
  backupEnabled: boolean;
  archiveEnabled: boolean;
}

/**
 * Archive metadata
 */
export interface ArchiveMetadata {
  contextId: string;
  originalSize: number;
  compressedSize: number;
  algorithm: CompressionAlgorithm;
  archivedAt: Date;
  checksum: string;
  version: number;
}

/**
 * Filesystem storage metrics
 */
export interface FilesystemStorageMetrics {
  totalFiles: number;
  totalSizeBytes: number;
  compressedFiles: number;
  averageCompressionRatio: number;
  archiveOperations: number;
  retrievalOperations: number;
  averageCompressionTime: number;
  averageRetrievalTime: number;
}

// =============================================================================
// Filesystem Storage Implementation
// =============================================================================

/**
 * Filesystem MCP storage wrapper for context archival and compression
 */
export class FilesystemContextStorage {
  private filesystemService: MCPServiceConnection;
  private logger: SimpleLogger;
  private config: FilesystemStorageConfig;
  private metrics: FilesystemStorageMetrics;

  constructor(
    filesystemService: MCPServiceConnection,
    logger: SimpleLogger,
    config: FilesystemStorageConfig
  ) {
    this.filesystemService = filesystemService;
    this.logger = logger;
    this.config = config;
    this.metrics = {
      totalFiles: 0,
      totalSizeBytes: 0,
      compressedFiles: 0,
      averageCompressionRatio: 1.0,
      archiveOperations: 0,
      retrievalOperations: 0,
      averageCompressionTime: 0,
      averageRetrievalTime: 0,
    };
  }

  /**
   * Initialize filesystem storage structure
   */
  async initialize(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.logger.info('Initializing filesystem context storage');

        // Create base directory structure
        const directories = [
          this.config.basePath,
          `${this.config.basePath}/contexts`,
          `${this.config.basePath}/compressed`,
          `${this.config.basePath}/archives`,
          `${this.config.basePath}/metadata`,
          `${this.config.basePath}/backups`,
        ];

        for (const dir of directories) {
          await this.filesystemService.client.callTool({
            name: 'create_directory',
            arguments: { path: dir },
          });
        }

        this.logger.info('Filesystem context storage initialized successfully');

        return success(undefined);
      },
      (error) =>
        create(
          'FILESYSTEM_INIT_ERROR',
          `Failed to initialize filesystem storage: ${error}`,
          'SYSTEM',
          { error }
        )
    );
  }

  /**
   * Store a context as a regular file
   */
  async store(context: Context): Promise<Result<StorageLocation, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Validate context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedContext = validationResult.value;
        const filePath = `${this.config.basePath}/contexts/${validatedContext.id}.json`;

        // Prepare context data with metadata
        const contextData = {
          context: validatedContext,
          storedAt: new Date(),
          version: validatedContext.version,
          checksum: validatedContext.checksum,
        };

        const jsonContent = JSON.stringify(contextData, null, 2);

        // Write to filesystem
        await this.filesystemService.client.callTool({
          name: 'write_file',
          arguments: {
            path: filePath,
            content: jsonContent,
          },
        });

        // Create storage location
        const storageLocation: StorageLocation = {
          contextId: validatedContext.id,
          service: 'filesystem',
          path: filePath,
          storedAt: new Date(),
          storageSize: jsonContent.length,
          compressed: false,
          encrypted: false,
          accessCount: 0,
        };

        // Update metrics
        this.updateStoreMetrics(jsonContent.length, Date.now() - startTime);

        this.logger.debug('Context stored in filesystem', {
          contextId: validatedContext.id,
          path: filePath,
          size: jsonContent.length,
        });

        return success(storageLocation);
      },
      (error) =>
        create(
          'FILESYSTEM_STORE_ERROR',
          `Failed to store context in filesystem: ${error}`,
          'SYSTEM',
          { contextId: context.id, error }
        )
    );
  }

  /**
   * Store a compressed context
   */
  async storeCompressed(
    compressedContext: CompressedContext
  ): Promise<Result<StorageLocation, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Validate compressed context
        const validationResult = validateCompressedContext(compressedContext);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedCompressed = validationResult.value;
        const filePath = `${this.config.basePath}/compressed/${validatedCompressed.contextId}.${validatedCompressed.algorithm}`;

        // Create compressed file data
        const compressedData = {
          compressedContext: validatedCompressed,
          archivedAt: new Date(),
          version: '1.0',
        };

        const jsonContent = JSON.stringify(compressedData, null, 2);

        // Write to filesystem
        await this.filesystemService.client.callTool({
          name: 'write_file',
          arguments: {
            path: filePath,
            content: jsonContent,
          },
        });

        // Store metadata separately
        await this.storeArchiveMetadata({
          contextId: validatedCompressed.contextId,
          originalSize: validatedCompressed.stats.originalSize,
          compressedSize: validatedCompressed.stats.compressedSize,
          algorithm: validatedCompressed.algorithm,
          archivedAt: new Date(),
          checksum: validatedCompressed.checksum,
          version: 1,
        });

        // Create storage location
        const storageLocation: StorageLocation = {
          contextId: validatedCompressed.contextId,
          service: 'filesystem',
          path: filePath,
          storedAt: new Date(),
          storageSize: jsonContent.length,
          compressed: true,
          encrypted: false,
          accessCount: 0,
        };

        // Update metrics
        this.updateCompressedStoreMetrics(
          validatedCompressed.stats.originalSize,
          validatedCompressed.stats.compressedSize,
          Date.now() - startTime
        );

        this.logger.debug('Compressed context stored in filesystem', {
          contextId: validatedCompressed.contextId,
          path: filePath,
          algorithm: validatedCompressed.algorithm,
          compressionRatio: validatedCompressed.stats.compressionRatio,
        });

        return success(storageLocation);
      },
      (error) =>
        create(
          'FILESYSTEM_STORE_COMPRESSED_ERROR',
          `Failed to store compressed context in filesystem: ${error}`,
          'SYSTEM',
          { contextId: compressedContext.contextId, error }
        )
    );
  }

  /**
   * Retrieve a context from filesystem
   */
  async retrieve(contextId: string): Promise<Result<Context, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        const filePath = `${this.config.basePath}/contexts/${contextId}.json`;

        // Read from filesystem
        const result = await this.filesystemService.client.callTool({
          name: 'read_file',
          arguments: { path: filePath },
        });

        if (!result.content) {
          return failure(
            create('CONTEXT_NOT_FOUND', `Context ${contextId} not found in filesystem`, 'BUSINESS')
          );
        }

        // Parse context data
        const contextData = JSON.parse(result.content);
        const context = contextData.context;

        // Validate retrieved context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        // Update metrics
        this.updateRetrieveMetrics(Date.now() - startTime);

        this.logger.debug('Context retrieved from filesystem', {
          contextId,
          path: filePath,
        });

        return success(validationResult.value);
      },
      (error) =>
        create(
          'FILESYSTEM_RETRIEVE_ERROR',
          `Failed to retrieve context from filesystem: ${error}`,
          'SYSTEM',
          { contextId, error }
        )
    );
  }

  /**
   * Retrieve a compressed context and decompress it
   */
  async retrieveCompressed(contextId: string): Promise<Result<Context, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Try to find the compressed file (we don't know the algorithm)
        const algorithms: CompressionAlgorithm[] = ['lz4', 'gzip', 'brotli', 'zstd'];
        let compressedData: any = null;
        let algorithm: CompressionAlgorithm | null = null;

        for (const algo of algorithms) {
          try {
            const filePath = `${this.config.basePath}/compressed/${contextId}.${algo}`;
            const result = await this.filesystemService.client.callTool({
              name: 'read_file',
              arguments: { path: filePath },
            });

            if (result.content) {
              compressedData = JSON.parse(result.content);
              algorithm = algo;
              break;
            }
          } catch {
            // Continue trying other algorithms
          }
        }

        if (!compressedData || !algorithm) {
          return failure(
            create(
              'COMPRESSED_CONTEXT_NOT_FOUND',
              `Compressed context ${contextId} not found in filesystem`,
              'BUSINESS'
            )
          );
        }

        // Decompress the context
        const compressedContext = compressedData.compressedContext;
        const decompressResult = await this.decompressContext(compressedContext);
        if (decompressResult.tag === 'failure') {
          return decompressResult;
        }

        // Update metrics
        this.updateRetrieveMetrics(Date.now() - startTime);

        this.logger.debug('Compressed context retrieved and decompressed', {
          contextId,
          algorithm,
          originalSize: compressedContext.stats.originalSize,
        });

        return success(decompressResult.value);
      },
      (error) =>
        create(
          'FILESYSTEM_RETRIEVE_COMPRESSED_ERROR',
          `Failed to retrieve compressed context from filesystem: ${error}`,
          'SYSTEM',
          { contextId, error }
        )
    );
  }

  /**
   * Compress a context using specified algorithm
   */
  async compressContext(
    context: Context,
    algorithm: CompressionAlgorithm = this.config.defaultAlgorithm
  ): Promise<Result<CompressedContext, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        const originalData = JSON.stringify(context);
        const originalSize = originalData.length;

        // For this implementation, we'll use a simple base64 encoding as "compression"
        // In a real implementation, you would use actual compression libraries
        const compressedData = this.performCompression(originalData, algorithm);
        const compressedSize = compressedData.length;

        const compressionRatio = compressedSize / originalSize;
        const compressionTime = Date.now() - startTime;

        // Create compression stats
        const stats: CompressionStats = {
          originalSize,
          compressedSize,
          compressionRatio,
          algorithm,
          compressedAt: new Date(),
          decompressionTime: undefined,
        };

        // Create compressed context
        const compressedContext: CompressedContext = {
          contextId: context.id,
          algorithm,
          data: compressedData,
          stats,
          preservedMetadata: {
            type: context.type,
            priority: context.metadata.priority,
            relevanceScore: context.metadata.relevanceScore,
            tags: context.metadata.tags,
            createdAt: context.metadata.createdAt,
            lastAccessed: context.metadata.lastAccessed,
          },
          checksum: await this.calculateChecksum(originalData),
          verified: true,
        };

        this.logger.debug('Context compressed', {
          contextId: context.id,
          algorithm,
          originalSize,
          compressedSize,
          compressionRatio,
          compressionTime,
        });

        return success(compressedContext);
      },
      (error) =>
        create('FILESYSTEM_COMPRESSION_ERROR', `Failed to compress context: ${error}`, 'SYSTEM', {
          contextId: context.id,
          algorithm,
          error,
        })
    );
  }

  /**
   * Decompress a compressed context
   */
  async decompressContext(compressedContext: CompressedContext): Promise<Result<Context, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Verify checksum if available
        if (compressedContext.checksum && compressedContext.verified) {
          const decompressedData = this.performDecompression(
            compressedContext.data,
            compressedContext.algorithm
          );

          const calculatedChecksum = await this.calculateChecksum(decompressedData);
          if (calculatedChecksum !== compressedContext.checksum) {
            return failure(
              create('CHECKSUM_MISMATCH', 'Decompressed context checksum does not match', 'SYSTEM')
            );
          }

          const context = JSON.parse(decompressedData);

          // Update decompression time in stats if needed
          const decompressionTime = Date.now() - startTime;

          // Validate decompressed context
          const validationResult = validateContext(context);
          if (validationResult.tag === 'failure') {
            return validationResult;
          }

          this.logger.debug('Context decompressed', {
            contextId: compressedContext.contextId,
            algorithm: compressedContext.algorithm,
            decompressionTime,
          });

          return success(validationResult.value);
        }

        return failure(
          create('CONTEXT_NOT_VERIFIED', 'Compressed context is not verified', 'BUSINESS')
        );
      },
      (error) =>
        create(
          'FILESYSTEM_DECOMPRESSION_ERROR',
          `Failed to decompress context: ${error}`,
          'SYSTEM',
          { contextId: compressedContext.contextId, error }
        )
    );
  }

  /**
   * Archive old contexts (compress and move to archive directory)
   */
  async archiveOldContexts(olderThanDays = 30): Promise<Result<number, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        // List all context files
        const listResult = await this.filesystemService.client.callTool({
          name: 'list_files',
          arguments: { path: `${this.config.basePath}/contexts` },
        });

        let archivedCount = 0;
        const files = listResult.files || [];

        for (const file of files) {
          if (file.name.endsWith('.json')) {
            // Check file modification time
            const stats = await this.filesystemService.client.callTool({
              name: 'get_file_stats',
              arguments: { path: file.path },
            });

            const modifiedDate = new Date(stats.modified);
            if (modifiedDate < cutoffDate) {
              // Read and compress the context
              const contextId = file.name.replace('.json', '');
              const retrieveResult = await this.retrieve(contextId);

              if (retrieveResult.tag === 'success') {
                const context = retrieveResult.value;
                const compressResult = await this.compressContext(context);

                if (compressResult.tag === 'success') {
                  // Store in archive directory
                  const archivePath = `${this.config.basePath}/archives/${contextId}.${compressResult.value.algorithm}`;
                  await this.filesystemService.client.callTool({
                    name: 'write_file',
                    arguments: {
                      path: archivePath,
                      content: JSON.stringify({
                        compressedContext: compressResult.value,
                        archivedAt: new Date(),
                        originalPath: file.path,
                      }),
                    },
                  });

                  // Delete original file
                  await this.filesystemService.client.callTool({
                    name: 'delete_file',
                    arguments: { path: file.path },
                  });

                  archivedCount++;
                }
              }
            }
          }
        }

        this.metrics.archiveOperations += archivedCount;

        this.logger.info('Context archiving completed', {
          archivedCount,
          olderThanDays,
        });

        return success(archivedCount);
      },
      (error) =>
        create('FILESYSTEM_ARCHIVE_ERROR', `Failed to archive old contexts: ${error}`, 'SYSTEM', {
          error,
        })
    );
  }

  /**
   * Delete a context from filesystem
   */
  async delete(contextId: string): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Delete regular context file
        const contextPath = `${this.config.basePath}/contexts/${contextId}.json`;
        try {
          await this.filesystemService.client.callTool({
            name: 'delete_file',
            arguments: { path: contextPath },
          });
        } catch {
          // File might not exist, continue
        }

        // Delete compressed versions
        const algorithms: CompressionAlgorithm[] = ['lz4', 'gzip', 'brotli', 'zstd'];
        for (const algorithm of algorithms) {
          try {
            const compressedPath = `${this.config.basePath}/compressed/${contextId}.${algorithm}`;
            await this.filesystemService.client.callTool({
              name: 'delete_file',
              arguments: { path: compressedPath },
            });
          } catch {
            // File might not exist, continue
          }
        }

        // Delete metadata
        try {
          const metadataPath = `${this.config.basePath}/metadata/${contextId}.json`;
          await this.filesystemService.client.callTool({
            name: 'delete_file',
            arguments: { path: metadataPath },
          });
        } catch {
          // File might not exist, continue
        }

        this.logger.debug('Context deleted from filesystem', { contextId });

        return success(undefined);
      },
      (error) =>
        create(
          'FILESYSTEM_DELETE_ERROR',
          `Failed to delete context from filesystem: ${error}`,
          'SYSTEM',
          { contextId, error }
        )
    );
  }

  /**
   * Get filesystem storage metrics
   */
  getMetrics(): FilesystemStorageMetrics {
    return { ...this.metrics };
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private performCompression(data: string, algorithm: CompressionAlgorithm): string {
    // Simplified compression - in reality would use actual compression libraries
    switch (algorithm) {
      case 'gzip':
      case 'lz4':
      case 'brotli':
      case 'zstd':
      default:
        // For demo purposes, just use base64 encoding
        return Buffer.from(data).toString('base64');
    }
  }

  private performDecompression(data: string, algorithm: CompressionAlgorithm): string {
    // Simplified decompression - in reality would use actual compression libraries
    switch (algorithm) {
      case 'gzip':
      case 'lz4':
      case 'brotli':
      case 'zstd':
      default:
        // For demo purposes, decode from base64
        return Buffer.from(data, 'base64').toString('utf-8');
    }
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataArray = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataArray);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async storeArchiveMetadata(metadata: ArchiveMetadata): Promise<void> {
    const metadataPath = `${this.config.basePath}/metadata/${metadata.contextId}.json`;
    await this.filesystemService.client.callTool({
      name: 'write_file',
      arguments: {
        path: metadataPath,
        content: JSON.stringify(metadata, null, 2),
      },
    });
  }

  private updateStoreMetrics(sizeBytes: number, operationTime: number): void {
    this.metrics.totalFiles++;
    this.metrics.totalSizeBytes += sizeBytes;
  }

  private updateCompressedStoreMetrics(
    originalSize: number,
    compressedSize: number,
    operationTime: number
  ): void {
    this.metrics.compressedFiles++;
    this.metrics.totalSizeBytes += compressedSize;

    // Update average compression ratio
    const newRatio = compressedSize / originalSize;
    this.metrics.averageCompressionRatio =
      (this.metrics.averageCompressionRatio * (this.metrics.compressedFiles - 1) + newRatio) /
      this.metrics.compressedFiles;

    // Update average compression time
    this.metrics.averageCompressionTime =
      (this.metrics.averageCompressionTime * (this.metrics.compressedFiles - 1) + operationTime) /
      this.metrics.compressedFiles;
  }

  private updateRetrieveMetrics(operationTime: number): void {
    this.metrics.retrievalOperations++;
    this.metrics.averageRetrievalTime =
      (this.metrics.averageRetrievalTime * (this.metrics.retrievalOperations - 1) + operationTime) /
      this.metrics.retrievalOperations;
  }
}
