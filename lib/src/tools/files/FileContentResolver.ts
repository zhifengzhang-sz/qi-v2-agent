/**
 * File Content Resolver Tool
 *
 * Resolves file references and provides content with metadata.
 * Used for Claude Code-style @file.txt pattern resolution.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';

/**
 * File reference information
 */
export interface FileReference {
  readonly id: string;
  readonly path: string;
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly exists: boolean;
  readonly isDirectory: boolean;
  readonly content?: string;
  readonly error?: string;
  readonly lastModified?: Date;
  readonly size?: number;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * File content resolver configuration
 */
export interface FileResolverConfig {
  readonly basePath?: string;
  readonly maxFileSize: number;
  readonly allowedExtensions?: readonly string[];
  readonly excludePatterns?: readonly string[];
  readonly enableCache: boolean;
  readonly cacheTimeout: number;
}

/**
 * Default configuration for file resolver
 */
const DEFAULT_CONFIG: FileResolverConfig = {
  maxFileSize: 1024 * 1024, // 1MB
  enableCache: true,
  cacheTimeout: 30 * 1000, // 30 seconds
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
  ],
};

import type { Tool } from '../index.js';

/**
 * File Content Resolver Tool
 *
 * Provides file content resolution with caching and validation.
 */
export class FileContentResolver implements Tool<string, FileReference> {
  readonly name = 'FileContentResolver';
  readonly description = 'Resolves file references and provides content with metadata';
  readonly version = '1.0.0';
  private config: FileResolverConfig;
  private cache = new Map<string, { reference: FileReference; timestamp: number }>();

  constructor(config: Partial<FileResolverConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Tool interface implementation
   */
  async execute(input: string): Promise<FileReference> {
    return this.resolveFile(input);
  }

  /**
   * Resolve a file reference with content
   */
  async resolveFile(filePath: string, basePath?: string): Promise<FileReference> {
    const resolvedBasePath = basePath || this.config.basePath || process.cwd();
    const cacheKey = `${resolvedBasePath}:${filePath}`;

    // Check cache first
    if (this.config.enableCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return cached.reference;
      }
    }

    // Resolve the file reference
    const reference = await this.createFileReference(filePath, resolvedBasePath);

    // Cache the result
    if (this.config.enableCache) {
      this.cache.set(cacheKey, {
        reference,
        timestamp: Date.now(),
      });
    }

    return reference;
  }

  /**
   * Resolve multiple file references
   */
  async resolveFiles(filePaths: string[], basePath?: string): Promise<FileReference[]> {
    const promises = filePaths.map((path) => this.resolveFile(path, basePath));
    return Promise.all(promises);
  }

  /**
   * Create a file reference with content and metadata
   */
  private async createFileReference(filePath: string, basePath: string): Promise<FileReference> {
    const absolutePath = isAbsolute(filePath) ? filePath : resolve(basePath, filePath);
    const relativePath = relative(basePath, absolutePath);
    const exists = existsSync(absolutePath);

    const metadata = new Map<string, unknown>();
    metadata.set('resolvedAt', new Date().toISOString());
    metadata.set('basePath', basePath);

    if (!exists) {
      return {
        id: randomUUID(),
        path: filePath,
        absolutePath,
        relativePath,
        exists: false,
        isDirectory: false,
        error: 'File not found',
        metadata,
      };
    }

    try {
      const stats = statSync(absolutePath);
      const isDirectory = stats.isDirectory();

      // Check if file should be excluded
      if (this.shouldExclude(relativePath)) {
        return {
          id: randomUUID(),
          path: filePath,
          absolutePath,
          relativePath,
          exists: true,
          isDirectory,
          error: 'File excluded by patterns',
          metadata,
        };
      }

      // Check file size limit for content reading
      if (!isDirectory && stats.size > this.config.maxFileSize) {
        metadata.set('actualSize', stats.size);
        return {
          id: randomUUID(),
          path: filePath,
          absolutePath,
          relativePath,
          exists: true,
          isDirectory: false,
          size: stats.size,
          lastModified: stats.mtime,
          error: `File too large (${stats.size} bytes, max ${this.config.maxFileSize})`,
          metadata,
        };
      }

      let content: string | undefined;

      if (!isDirectory) {
        // Check allowed extensions if configured
        if (this.config.allowedExtensions) {
          const extension = basename(absolutePath).split('.').pop()?.toLowerCase();
          if (extension && !this.config.allowedExtensions.includes(extension)) {
            return {
              id: randomUUID(),
              path: filePath,
              absolutePath,
              relativePath,
              exists: true,
              isDirectory: false,
              size: stats.size,
              lastModified: stats.mtime,
              error: `File extension '${extension}' not allowed`,
              metadata,
            };
          }
        }

        // Read file content
        try {
          content = readFileSync(absolutePath, 'utf-8');
          metadata.set('encoding', 'utf-8');
          metadata.set('lines', content.split('\n').length);
        } catch (readError) {
          return {
            id: randomUUID(),
            path: filePath,
            absolutePath,
            relativePath,
            exists: true,
            isDirectory: false,
            size: stats.size,
            lastModified: stats.mtime,
            error: `Failed to read file: ${readError instanceof Error ? readError.message : 'Unknown error'}`,
            metadata,
          };
        }
      }

      return {
        id: randomUUID(),
        path: filePath,
        absolutePath,
        relativePath,
        exists: true,
        isDirectory,
        content,
        size: stats.size,
        lastModified: stats.mtime,
        metadata,
      };
    } catch (statError) {
      return {
        id: randomUUID(),
        path: filePath,
        absolutePath,
        relativePath,
        exists: true,
        isDirectory: false,
        error: `Failed to get file stats: ${statError instanceof Error ? statError.message : 'Unknown error'}`,
        metadata,
      };
    }
  }

  /**
   * Check if a file path should be excluded based on patterns
   */
  private shouldExclude(relativePath: string): boolean {
    if (!this.config.excludePatterns) return false;

    const normalizedPath = relativePath.replace(/\\/g, '/');

    return this.config.excludePatterns.some((pattern) => {
      if (pattern.includes('*')) {
        // Simple glob pattern matching
        const regexPattern = pattern.replace(/\*/g, '.*');
        return new RegExp(regexPattern).test(normalizedPath);
      }

      // Exact or directory matching
      return normalizedPath.includes(pattern);
    });
  }

  /**
   * Clear the file resolution cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size,
      // Hit rate tracking would need additional implementation
    };
  }
}
