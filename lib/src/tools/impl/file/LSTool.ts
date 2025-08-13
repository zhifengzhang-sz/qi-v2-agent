/**
 * @qi/tools - LS Tool Implementation
 *
 * Secure directory listing with path validation, filtering, and metadata.
 * Follows Claude Code's security patterns for safe file system browsing.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  failure,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
import { z } from 'zod';
import type { PermissionResult, ToolContext } from '../../core/interfaces/index.js';
import { BaseFileTool } from './BaseTool.js';

/**
 * Input schema for LSTool
 */
const LSToolInputSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  ignore: z.array(z.string()).optional().default([]),
  show_hidden: z.boolean().optional().default(false),
  recursive: z.boolean().optional().default(false),
  max_depth: z.number().int().min(1).max(5).optional().default(3),
});

type LSToolInput = z.infer<typeof LSToolInputSchema>;

/**
 * File/Directory information
 */
interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink' | 'unknown';
  size?: number;
  modified?: string;
  permissions?: string;
  extension?: string;
}

/**
 * Output type for LSTool
 */
interface LSToolOutput {
  path: string;
  total_items: number;
  directories: number;
  files: number;
  symlinks: number;
  items: FileInfo[];
  warnings?: string[];
}

/**
 * Directory listing tool with security-first design:
 * - Absolute path requirement
 * - Path traversal prevention
 * - Configurable ignore patterns
 * - Recursive listing with depth limits
 */
export class LSTool extends BaseFileTool<LSToolInput, LSToolOutput> {
  readonly name = 'LS';
  readonly description = 'List directory contents with security and filtering';
  readonly version = '1.0.0';
  readonly inputSchema = LSToolInputSchema;
  readonly isReadOnly = true;
  readonly isConcurrencySafe = true;

  async executeImpl(
    input: LSToolInput,
    _context: ToolContext
  ): Promise<Result<LSToolOutput, QiError>> {
    const { path: targetPath, ignore, show_hidden, recursive, max_depth } = input;

    try {
      // Check if path exists and is accessible
      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        return failure(validationError(`Path is not a directory: ${targetPath}`));
      }

      const warnings: string[] = [];
      const items: FileInfo[] = [];

      // Collect items
      await this.collectItems(targetPath, items, {
        ignore: new Set(ignore),
        showHidden: show_hidden,
        recursive,
        maxDepth: max_depth,
        currentDepth: 0,
        rootPath: targetPath,
        warnings,
      });

      // Count types
      const counts = items.reduce(
        (acc, item) => {
          switch (item.type) {
            case 'file':
              acc.files++;
              break;
            case 'directory':
              acc.directories++;
              break;
            case 'symlink':
              acc.symlinks++;
              break;
          }
          return acc;
        },
        { files: 0, directories: 0, symlinks: 0 }
      );

      return success({
        path: targetPath,
        total_items: items.length,
        directories: counts.directories,
        files: counts.files,
        symlinks: counts.symlinks,
        items: items.sort((a, b) => {
          // Sort directories first, then files
          if (a.type !== b.type) {
            if (a.type === 'directory') return -1;
            if (b.type === 'directory') return 1;
          }
          return a.name.localeCompare(b.name);
        }),
        warnings: warnings.length > 0 ? warnings : undefined,
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        switch (error.code) {
          case 'ENOENT':
            return failure(validationError(`Path does not exist: ${targetPath}`));
          case 'EACCES':
            return failure(validationError(`Permission denied accessing: ${targetPath}`));
          case 'ENOTDIR':
            return failure(validationError(`Path is not a directory: ${targetPath}`));
        }
      }

      return failure(
        systemError(
          `Failed to list directory '${targetPath}': ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Validate input with security checks
   */
  validate(input: LSToolInput): Result<void, QiError> {
    // Path must be absolute
    if (!path.isAbsolute(input.path)) {
      return failure(validationError('Path must be absolute'));
    }

    // Prevent path traversal attacks
    if (input.path.includes('..')) {
      return failure(validationError('Path cannot contain parent directory references (..)'));
    }

    // Validate ignore patterns
    for (const pattern of input.ignore || []) {
      if (pattern.length === 0) {
        return failure(validationError('Ignore patterns cannot be empty'));
      }
    }

    return success(undefined);
  }

  /**
   * Enhanced permission check for directory access
   */
  checkPermissions(input: LSToolInput, context: ToolContext): Result<PermissionResult, QiError> {
    // Call base permission check
    const baseResult = super.checkPermissions(input, context);
    if (baseResult.tag === 'failure' || !baseResult.value.allowed) {
      return baseResult;
    }

    // Check for access to sensitive system directories
    const sensitivePaths = ['/etc/shadow', '/etc/passwd', '/proc', '/sys', '/dev', '/root'];

    for (const sensitivePath of sensitivePaths) {
      if (input.path.startsWith(sensitivePath)) {
        return success({
          allowed: false,
          reason: `Access to sensitive system directory '${sensitivePath}' is restricted`,
        });
      }
    }

    return success({ allowed: true });
  }

  /**
   * Recursively collect directory items
   */
  private async collectItems(
    dirPath: string,
    items: FileInfo[],
    options: {
      ignore: Set<string>;
      showHidden: boolean;
      recursive: boolean;
      maxDepth: number;
      currentDepth: number;
      rootPath: string;
      warnings: string[];
    }
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath);

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);

        // Skip hidden files if not requested
        if (!options.showHidden && entry.startsWith('.')) {
          continue;
        }

        // Check ignore patterns
        if (this.shouldIgnore(entry, fullPath, options.ignore)) {
          continue;
        }

        try {
          const stats = await fs.lstat(fullPath); // lstat to detect symlinks
          const fileInfo: FileInfo = {
            name: entry,
            path: fullPath,
            type: this.getFileType(stats),
            size: stats.isFile() ? stats.size : undefined,
            modified: stats.mtime.toISOString(),
            permissions: this.formatPermissions(stats.mode),
            extension: stats.isFile() ? path.extname(entry).slice(1) || undefined : undefined,
          };

          items.push(fileInfo);

          // Recurse into subdirectories if requested and within depth limit
          if (options.recursive && stats.isDirectory() && options.currentDepth < options.maxDepth) {
            await this.collectItems(fullPath, items, {
              ...options,
              currentDepth: options.currentDepth + 1,
            });
          }
        } catch (error) {
          // Log warning but continue processing other files
          options.warnings.push(
            `Failed to access ${fullPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    } catch (error) {
      options.warnings.push(
        `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Determine file type from stats
   */
  private getFileType(stats: Awaited<ReturnType<typeof fs.stat>>): FileInfo['type'] {
    if (stats.isFile()) return 'file';
    if (stats.isDirectory()) return 'directory';
    if (stats.isSymbolicLink()) return 'symlink';
    return 'unknown';
  }

  /**
   * Format file permissions as readable string
   */
  private formatPermissions(mode: number): string {
    const permissions = [];

    // Owner permissions
    permissions.push(mode & 0o400 ? 'r' : '-');
    permissions.push(mode & 0o200 ? 'w' : '-');
    permissions.push(mode & 0o100 ? 'x' : '-');

    // Group permissions
    permissions.push(mode & 0o040 ? 'r' : '-');
    permissions.push(mode & 0o020 ? 'w' : '-');
    permissions.push(mode & 0o010 ? 'x' : '-');

    // Other permissions
    permissions.push(mode & 0o004 ? 'r' : '-');
    permissions.push(mode & 0o002 ? 'w' : '-');
    permissions.push(mode & 0o001 ? 'x' : '-');

    return permissions.join('');
  }

  /**
   * Check if file should be ignored based on patterns
   */
  private shouldIgnore(fileName: string, _fullPath: string, ignorePatterns: Set<string>): boolean {
    // Check exact matches
    if (ignorePatterns.has(fileName)) {
      return true;
    }

    // Check glob-like patterns (simplified)
    for (const pattern of ignorePatterns) {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');

        if (new RegExp(`^${regexPattern}$`).test(fileName)) {
          return true;
        }
      }
    }

    // Default ignore patterns for safety
    const defaultIgnorePatterns = [
      'node_modules',
      '.git',
      '.DS_Store',
      'Thumbs.db',
      '*.tmp',
      '*.temp',
    ];

    for (const pattern of defaultIgnorePatterns) {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');

        if (new RegExp(`^${regexPattern}$`).test(fileName)) {
          return true;
        }
      } else if (fileName === pattern) {
        return true;
      }
    }

    return false;
  }
}
