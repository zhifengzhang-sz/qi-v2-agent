/**
 * @qi/tools - Glob Tool
 *
 * Fast file pattern matching with performance optimization.
 * Adapts Claude Code's glob patterns while maintaining QiCore Result<T> integration.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  failure,
  fromAsyncTryCatch,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
import { z } from 'zod';
import type { ToolContext } from '../../core/interfaces/ITool.js';
import { BaseFileTool } from '../file/BaseTool.js';

/**
 * Glob tool input schema
 */
const globToolInputSchema = z.object({
  pattern: z.string().min(1, 'Pattern cannot be empty'),
  path: z.string().optional().describe('Directory to search in (defaults to current directory)'),
  max_results: z.number().int().positive().max(10000).optional().default(1000),
  include_hidden: z.boolean().optional().default(false),
  case_sensitive: z.boolean().optional().default(true),
  follow_symlinks: z.boolean().optional().default(false),
});

type GlobToolInput = z.infer<typeof globToolInputSchema>;

/**
 * Glob tool output
 */
interface GlobToolOutput {
  matches: string[];
  total_found: number;
  search_path: string;
  pattern_used: string;
  is_truncated: boolean;
  execution_time_ms: number;
}

/**
 * File entry for matching
 */
interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size?: number;
  modified?: Date;
}

/**
 * Glob Tool - Fast file pattern matching
 */
export class GlobTool extends BaseFileTool<GlobToolInput, GlobToolOutput> {
  readonly name = 'GlobTool';
  readonly description =
    'Fast file pattern matching with glob patterns, supporting wildcards and performance optimization';
  readonly version = '1.0.0';
  readonly inputSchema = globToolInputSchema;
  readonly isReadOnly = true;
  readonly isConcurrencySafe = true;

  // Performance settings
  private readonly maxTraversalDepth = 20;
  private readonly maxDirectoryEntries = 50000;

  /**
   * Execute glob pattern matching
   */
  async executeImpl(
    input: GlobToolInput,
    context: ToolContext
  ): Promise<Result<GlobToolOutput, QiError>> {
    const startTime = Date.now();
    const {
      pattern,
      path: searchPath,
      max_results,
      include_hidden,
      case_sensitive,
      follow_symlinks,
    } = input;

    // Determine search directory
    const resolvedPath = searchPath
      ? path.resolve(searchPath)
      : context.currentDirectory || process.cwd();

    // Check if search path exists
    const pathExistsResult = await this.checkPathExists(resolvedPath);
    if (pathExistsResult.tag === 'failure') {
      return pathExistsResult;
    }

    // Perform glob matching
    const matchResult = await this.performGlobSearch(pattern, resolvedPath, {
      maxResults: max_results!,
      includeHidden: include_hidden!,
      caseSensitive: case_sensitive!,
      followSymlinks: follow_symlinks!,
    });

    if (matchResult.tag === 'failure') {
      return matchResult;
    }

    const matches = matchResult.value;
    const executionTime = Date.now() - startTime;

    return success({
      matches: matches.slice(0, max_results!),
      total_found: matches.length,
      search_path: resolvedPath,
      pattern_used: pattern,
      is_truncated: matches.length > max_results!,
      execution_time_ms: executionTime,
    });
  }

  /**
   * Enhanced validation for glob patterns
   */
  validate(input: GlobToolInput): Result<void, QiError> {
    // Check for potentially dangerous patterns
    if (input.pattern.includes('..')) {
      return failure(validationError('Pattern cannot contain parent directory references (..)'));
    }

    // Validate pattern syntax
    try {
      this.compileGlobPattern(input.pattern, input.case_sensitive ?? true);
    } catch (error) {
      return failure(
        validationError(
          `Invalid glob pattern: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }

    // Check path if specified
    if (input.path) {
      if (!path.isAbsolute(input.path) && !path.resolve(input.path)) {
        return failure(validationError('Search path must be absolute or resolvable'));
      }
    }

    return success(undefined);
  }

  // Private helper methods

  private async checkPathExists(searchPath: string): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const stats = await fs.stat(searchPath);
        if (!stats.isDirectory()) {
          throw new Error(`Search path is not a directory: ${searchPath}`);
        }
        return undefined;
      },
      (error) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return validationError(`Search path does not exist: ${searchPath}`);
        }
        return systemError(
          `Cannot access search path: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    );
  }

  private async performGlobSearch(
    pattern: string,
    searchPath: string,
    options: {
      maxResults: number;
      includeHidden: boolean;
      caseSensitive: boolean;
      followSymlinks: boolean;
    }
  ): Promise<Result<string[], QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const regex = this.compileGlobPattern(pattern, options.caseSensitive);
        const matches: string[] = [];
        let processedEntries = 0;

        const walkDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
          if (depth > this.maxTraversalDepth) {
            return;
          }

          if (processedEntries > this.maxDirectoryEntries) {
            return; // Prevent excessive processing
          }

          if (matches.length >= options.maxResults) {
            return; // Stop when we have enough results
          }

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            processedEntries += entries.length;

            for (const entry of entries) {
              if (matches.length >= options.maxResults) {
                break;
              }

              // Skip hidden files unless requested
              if (!options.includeHidden && entry.name.startsWith('.')) {
                continue;
              }

              const fullPath = path.join(dirPath, entry.name);
              const relativePath = path.relative(searchPath, fullPath);

              // Handle different glob patterns
              if (this.testGlobMatch(regex, relativePath, entry.name)) {
                matches.push(fullPath);
              }

              // Recurse into directories
              if (entry.isDirectory()) {
                await walkDirectory(fullPath, depth + 1);
              } else if (entry.isSymbolicLink() && options.followSymlinks) {
                try {
                  const stats = await fs.stat(fullPath);
                  if (stats.isDirectory()) {
                    await walkDirectory(fullPath, depth + 1);
                  }
                } catch {
                  // Skip broken symlinks
                }
              }
            }
          } catch (error) {
            // Skip directories that can't be read (permissions, etc.)
            if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
              return;
            }
            throw error;
          }
        };

        await walkDirectory(searchPath);

        // Sort results for consistent output
        matches.sort();

        return matches;
      },
      (error) =>
        systemError(`Glob search failed: ${error instanceof Error ? error.message : String(error)}`)
    );
  }

  private compileGlobPattern(pattern: string, caseSensitive: boolean): RegExp {
    // Convert glob pattern to regex
    let regexPattern = pattern
      // Escape regex special characters except glob wildcards
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      // Convert glob patterns to regex
      .replace(/\\\*\\\*/g, '.*') // ** matches anything including path separators
      .replace(/\\\*/g, '[^/\\\\]*') // * matches anything except path separators
      .replace(/\\\?/g, '[^/\\\\]'); // ? matches single character except path separators

    // Handle path separators
    regexPattern = regexPattern.replace(/\//g, '[/\\\\]');

    const flags = caseSensitive ? '' : 'i';
    return new RegExp(`^${regexPattern}$`, flags);
  }

  private testGlobMatch(regex: RegExp, relativePath: string, fileName: string): boolean {
    // Test against both relative path and just filename
    return regex.test(relativePath) || regex.test(fileName);
  }
}
