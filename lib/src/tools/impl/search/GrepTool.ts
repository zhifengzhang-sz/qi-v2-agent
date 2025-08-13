/**
 * @qi/tools - Grep Tool
 *
 * Content search with regex support and performance optimization.
 * Adapts ripgrep patterns while maintaining QiCore Result<T> integration.
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
 * Grep tool input schema
 */
const grepToolInputSchema = z.object({
  pattern: z.string().min(1, 'Pattern cannot be empty'),
  path: z.string().optional().describe('File or directory to search in'),
  recursive: z.boolean().optional().default(true),
  case_insensitive: z.boolean().optional().default(false),
  whole_words: z.boolean().optional().default(false),
  line_numbers: z.boolean().optional().default(true),
  context_lines: z.number().int().min(0).max(10).optional().default(0),
  max_matches: z.number().int().positive().max(10000).optional().default(1000),
  include_files: z.array(z.string()).optional().describe('File patterns to include (glob)'),
  exclude_files: z.array(z.string()).optional().describe('File patterns to exclude (glob)'),
  binary_files: z.enum(['skip', 'text', 'match']).optional().default('skip'),
  follow_symlinks: z.boolean().optional().default(false),
});

type GrepToolInput = z.infer<typeof grepToolInputSchema>;

/**
 * Search match result
 */
interface SearchMatch {
  file: string;
  line_number: number;
  content: string;
  match_start: number;
  match_end: number;
  context_before?: string[];
  context_after?: string[];
}

/**
 * Grep tool output
 */
interface GrepToolOutput {
  matches: SearchMatch[];
  total_matches: number;
  files_searched: number;
  files_with_matches: number;
  search_path: string;
  pattern_used: string;
  is_truncated: boolean;
  execution_time_ms: number;
  binary_files_skipped: number;
}

/**
 * File type detection result
 */
interface FileTypeInfo {
  isBinary: boolean;
  encoding?: string;
  mimeType?: string;
}

/**
 * Grep Tool - Content search with regex support
 */
export class GrepTool extends BaseFileTool<GrepToolInput, GrepToolOutput> {
  readonly name = 'GrepTool';
  readonly description =
    'Content search with regex support, context lines, and performance optimization';
  readonly version = '1.0.0';
  readonly inputSchema = grepToolInputSchema;
  readonly isReadOnly = true;
  readonly isConcurrencySafe = true;

  // Performance limits
  private readonly maxFileSize = 100 * 1024 * 1024; // 100MB
  private readonly maxFilesPerDirectory = 10000;
  private readonly binaryDetectionBytes = 1024; // First 1KB to detect binary

  /**
   * Execute content search
   */
  async executeImpl(
    input: GrepToolInput,
    context: ToolContext
  ): Promise<Result<GrepToolOutput, QiError>> {
    const startTime = Date.now();
    const {
      pattern,
      path: searchPath,
      recursive,
      case_insensitive,
      whole_words,
      line_numbers,
      context_lines,
      max_matches,
      include_files,
      exclude_files,
      binary_files,
      follow_symlinks,
    } = input;

    // Determine search path
    const resolvedPath = searchPath
      ? path.resolve(searchPath)
      : context.currentDirectory || process.cwd();

    // Compile search regex
    const regexResult = this.compileSearchRegex(pattern, case_insensitive!, whole_words!);
    if (regexResult.tag === 'failure') {
      return regexResult;
    }

    const searchRegex = regexResult.value;

    // Perform search
    const searchResult = await this.performSearch(resolvedPath, searchRegex, {
      recursive: recursive!,
      lineNumbers: line_numbers!,
      contextLines: context_lines!,
      maxMatches: max_matches!,
      includeFiles: include_files,
      excludeFiles: exclude_files,
      binaryFiles: binary_files!,
      followSymlinks: follow_symlinks!,
    });

    if (searchResult.tag === 'failure') {
      return searchResult;
    }

    const { matches, filesSearched, filesWithMatches, binaryFilesSkipped } = searchResult.value;

    const executionTime = Date.now() - startTime;

    return success({
      matches: matches.slice(0, max_matches!),
      total_matches: matches.length,
      files_searched: filesSearched,
      files_with_matches: filesWithMatches,
      search_path: resolvedPath,
      pattern_used: pattern,
      is_truncated: matches.length > max_matches!,
      execution_time_ms: executionTime,
      binary_files_skipped: binaryFilesSkipped,
    });
  }

  /**
   * Enhanced validation for search patterns
   */
  validate(input: GrepToolInput): Result<void, QiError> {
    // Validate regex pattern
    try {
      new RegExp(input.pattern, input.case_insensitive ? 'gi' : 'g');
    } catch (error) {
      return failure(
        validationError(
          `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }

    // Check path if specified
    if (input.path) {
      if (!path.isAbsolute(input.path) && !path.resolve(input.path)) {
        return failure(validationError('Search path must be absolute or resolvable'));
      }
    }

    // Validate file patterns
    if (input.include_files) {
      for (const pattern of input.include_files) {
        if (pattern.includes('..')) {
          return failure(
            validationError('File patterns cannot contain parent directory references')
          );
        }
      }
    }

    if (input.exclude_files) {
      for (const pattern of input.exclude_files) {
        if (pattern.includes('..')) {
          return failure(
            validationError('File patterns cannot contain parent directory references')
          );
        }
      }
    }

    return success(undefined);
  }

  // Private helper methods

  private compileSearchRegex(
    pattern: string,
    caseInsensitive: boolean,
    wholeWords: boolean
  ): Result<RegExp, QiError> {
    try {
      let regexPattern = pattern;

      // Add word boundaries if whole words requested
      if (wholeWords) {
        regexPattern = `\\b${regexPattern}\\b`;
      }

      const flags = (caseInsensitive ? 'gi' : 'g') + 'm'; // multiline mode
      return success(new RegExp(regexPattern, flags));
    } catch (error) {
      return failure(
        validationError(
          `Failed to compile search pattern: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  private async performSearch(
    searchPath: string,
    regex: RegExp,
    options: {
      recursive: boolean;
      lineNumbers: boolean;
      contextLines: number;
      maxMatches: number;
      includeFiles?: string[];
      excludeFiles?: string[];
      binaryFiles: 'skip' | 'text' | 'match';
      followSymlinks: boolean;
    }
  ): Promise<
    Result<
      {
        matches: SearchMatch[];
        filesSearched: number;
        filesWithMatches: number;
        binaryFilesSkipped: number;
      },
      QiError
    >
  > {
    return fromAsyncTryCatch(
      async () => {
        const matches: SearchMatch[] = [];
        let filesSearched = 0;
        let filesWithMatches = 0;
        let binaryFilesSkipped = 0;

        const searchFile = async (filePath: string): Promise<void> => {
          if (matches.length >= options.maxMatches) {
            return;
          }

          try {
            // Check file size
            const stats = await fs.stat(filePath);
            if (stats.size > this.maxFileSize) {
              return; // Skip very large files
            }

            filesSearched++;

            // Check if file matches include/exclude patterns
            if (!this.shouldSearchFile(filePath, options.includeFiles, options.excludeFiles)) {
              return;
            }

            // Detect file type
            const fileTypeInfo = await this.detectFileType(filePath);

            if (fileTypeInfo.isBinary) {
              if (options.binaryFiles === 'skip') {
                binaryFilesSkipped++;
                return;
              } else if (options.binaryFiles === 'match') {
                // For binary files with 'match', just check if pattern exists
                const content = await fs.readFile(filePath);
                if (regex.test(content.toString('binary'))) {
                  matches.push({
                    file: filePath,
                    line_number: 0,
                    content: '[Binary file matches]',
                    match_start: 0,
                    match_end: 0,
                  });
                  filesWithMatches++;
                }
                return;
              }
              // If binaryFiles === 'text', continue with text processing
            }

            // Read and search file content
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split(/\r?\n/);

            let fileHasMatches = false;

            for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
              if (matches.length >= options.maxMatches) {
                break;
              }

              const line = lines[lineIndex];
              regex.lastIndex = 0; // Reset regex
              const match = regex.exec(line);

              if (match) {
                fileHasMatches = true;

                const searchMatch: SearchMatch = {
                  file: filePath,
                  line_number: options.lineNumbers ? lineIndex + 1 : 0,
                  content: line,
                  match_start: match.index,
                  match_end: match.index + match[0].length,
                };

                // Add context lines if requested
                if (options.contextLines > 0) {
                  searchMatch.context_before = this.getContextLines(
                    lines,
                    lineIndex - options.contextLines,
                    lineIndex
                  );
                  searchMatch.context_after = this.getContextLines(
                    lines,
                    lineIndex + 1,
                    lineIndex + 1 + options.contextLines
                  );
                }

                matches.push(searchMatch);
              }
            }

            if (fileHasMatches) {
              filesWithMatches++;
            }
          } catch (error) {
            // Skip files that can't be read (permissions, encoding issues, etc.)
            if (error instanceof Error && 'code' in error) {
              const code = (error as any).code;
              if (['EACCES', 'EISDIR', 'ENOENT'].includes(code)) {
                return;
              }
            }
            // Re-throw other errors
            throw error;
          }
        };

        const walkDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
          if (depth > 20) {
            // Prevent deep recursion
            return;
          }

          if (matches.length >= options.maxMatches) {
            return;
          }

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            if (entries.length > this.maxFilesPerDirectory) {
              // Sort entries to prioritize certain file types
              entries.sort((a, b) => {
                const aScore = this.getFileTypeScore(a.name);
                const bScore = this.getFileTypeScore(b.name);
                return bScore - aScore;
              });
            }

            const filesToProcess = entries.slice(0, this.maxFilesPerDirectory);

            for (const entry of filesToProcess) {
              if (matches.length >= options.maxMatches) {
                break;
              }

              const fullPath = path.join(dirPath, entry.name);

              if (entry.isFile()) {
                await searchFile(fullPath);
              } else if (entry.isDirectory() && options.recursive) {
                // Skip hidden directories unless specifically included
                if (
                  !entry.name.startsWith('.') ||
                  this.shouldSearchFile(fullPath, options.includeFiles, options.excludeFiles)
                ) {
                  await walkDirectory(fullPath, depth + 1);
                }
              } else if (entry.isSymbolicLink() && options.followSymlinks) {
                try {
                  const stats = await fs.stat(fullPath);
                  if (stats.isFile()) {
                    await searchFile(fullPath);
                  } else if (stats.isDirectory() && options.recursive) {
                    await walkDirectory(fullPath, depth + 1);
                  }
                } catch {
                  // Skip broken symlinks
                }
              }
            }
          } catch (error) {
            // Skip directories that can't be read
            if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
              return;
            }
            throw error;
          }
        };

        // Start search
        const stats = await fs.stat(searchPath);

        if (stats.isFile()) {
          await searchFile(searchPath);
        } else if (stats.isDirectory()) {
          await walkDirectory(searchPath);
        } else {
          throw new Error(`Search path is neither file nor directory: ${searchPath}`);
        }

        return {
          matches,
          filesSearched,
          filesWithMatches,
          binaryFilesSkipped,
        };
      },
      (error) =>
        systemError(`Search failed: ${error instanceof Error ? error.message : String(error)}`)
    );
  }

  private async detectFileType(filePath: string): Promise<FileTypeInfo> {
    try {
      // Read first few bytes to detect binary content
      const buffer = Buffer.alloc(this.binaryDetectionBytes);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fd.read(buffer, 0, this.binaryDetectionBytes, 0);
      await fd.close();

      // Check for null bytes (common in binary files)
      const hasNullBytes = buffer.subarray(0, bytesRead).includes(0);

      // Check for high ratio of non-printable characters
      let nonPrintableCount = 0;
      for (let i = 0; i < bytesRead; i++) {
        const byte = buffer[i];
        // Consider bytes outside printable ASCII range + common whitespace
        if ((byte < 32 && ![9, 10, 13].includes(byte)) || byte === 127) {
          nonPrintableCount++;
        }
      }

      const nonPrintableRatio = nonPrintableCount / bytesRead;
      const isBinary = hasNullBytes || nonPrintableRatio > 0.3;

      return {
        isBinary,
        encoding: isBinary ? 'binary' : 'utf-8',
      };
    } catch {
      // If we can't detect, assume text
      return {
        isBinary: false,
        encoding: 'utf-8',
      };
    }
  }

  private shouldSearchFile(
    filePath: string,
    includePatterns?: string[],
    excludePatterns?: string[]
  ): boolean {
    const fileName = path.basename(filePath);
    const relativePath = path.relative(process.cwd(), filePath);

    // Check exclude patterns first
    if (excludePatterns) {
      for (const pattern of excludePatterns) {
        if (this.matchesGlob(fileName, pattern) || this.matchesGlob(relativePath, pattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (includePatterns && includePatterns.length > 0) {
      for (const pattern of includePatterns) {
        if (this.matchesGlob(fileName, pattern) || this.matchesGlob(relativePath, pattern)) {
          return true;
        }
      }
      return false; // If include patterns specified but none match
    }

    return true;
  }

  private matchesGlob(text: string, pattern: string): boolean {
    // Simple glob matching
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(text);
  }

  private getContextLines(lines: string[], start: number, end: number): string[] {
    const contextLines: string[] = [];
    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(lines.length, end);

    for (let i = safeStart; i < safeEnd; i++) {
      contextLines.push(lines[i]);
    }

    return contextLines;
  }

  private getFileTypeScore(fileName: string): number {
    const extension = path.extname(fileName).toLowerCase();

    // Prioritize common source code file types
    const sourceCodeExtensions = [
      '.ts',
      '.js',
      '.jsx',
      '.tsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.cs',
      '.go',
      '.rs',
      '.php',
      '.rb',
    ];
    const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'];
    const documentExtensions = ['.md', '.txt', '.rst', '.doc'];

    if (sourceCodeExtensions.includes(extension)) return 10;
    if (configExtensions.includes(extension)) return 8;
    if (documentExtensions.includes(extension)) return 6;

    return 1; // Default score
  }
}
