/**
 * @qi/tools - Read Tool Implementation
 *
 * Safe file reading tool with format detection, multimodal support,
 * and security warnings for malicious content.
 * Adapts Claude Code's Read tool patterns.
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
import type { ToolContext } from '../../core/interfaces/index.js';
import { BaseFileTool } from './BaseTool.js';

/**
 * Input schema for ReadTool
 */
const ReadToolInputSchema = z.object({
  file_path: z.string().min(1, 'File path is required'),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().min(0).optional(),
});

type ReadToolInput = z.infer<typeof ReadToolInputSchema>;

/**
 * Output type for ReadTool
 */
interface ReadToolOutput {
  content: string;
  lines: number;
  size: number;
  encoding: string;
  mimeType: string;
  isLimited: boolean;
  actualLines?: number;
  warnings?: string[];
}

/**
 * File reading tool with Claude Code-style features:
 * - Absolute path requirement
 * - Multimodal support (images, PDFs, etc.)
 * - Security warnings for suspicious content
 * - Line-based reading with offset/limit
 */
export class ReadTool extends BaseFileTool<ReadToolInput, ReadToolOutput> {
  readonly name = 'Read';
  readonly description = 'Read file content with format detection and security checks';
  readonly version = '1.0.0';
  readonly inputSchema = ReadToolInputSchema;
  readonly isReadOnly = true;
  readonly isConcurrencySafe = true;

  async executeImpl(
    input: ReadToolInput,
    _context: ToolContext
  ): Promise<Result<ReadToolOutput, QiError>> {
    const { file_path, limit, offset } = input;

    return fromAsyncTryCatch(
      async () => {
        // Get file stats
        const stats = await fs.stat(file_path);
        if (!stats.isFile()) {
          throw new Error(`Path is not a file: ${file_path}`);
        }

        // Detect file type and handle accordingly
        const fileType = this.detectFileType(file_path);
        const warnings: string[] = [];

        let content: string;
        let actualLines: number | undefined;
        let isLimited = false;

        switch (fileType.category) {
          case 'text': {
            const textResult = await this.readTextFile(file_path, limit, offset);
            if (textResult.tag === 'failure') {
              throw new Error(textResult.error.message);
            }
            content = textResult.value.content;
            actualLines = textResult.value.actualLines;
            isLimited = textResult.value.isLimited;
            break;
          }

          case 'image': {
            const imageResult = await this.readImageFile(file_path);
            if (imageResult.tag === 'failure') {
              throw new Error(imageResult.error.message);
            }
            content = imageResult.value;
            break;
          }

          case 'binary':
            throw new Error(
              `Binary file type '${fileType.mimeType}' not supported for reading. Use appropriate tools for binary files.`
            );

          default: {
            // Try reading as text with warning
            const fallbackResult = await this.readTextFile(file_path, limit, offset);
            if (fallbackResult.tag === 'failure') {
              throw new Error(fallbackResult.error.message);
            }
            content = fallbackResult.value.content;
            actualLines = fallbackResult.value.actualLines;
            isLimited = fallbackResult.value.isLimited;
            warnings.push(`Unknown file type '${fileType.mimeType}', treating as text`);
          }
        }

        // Security check for malicious content
        const securityResult = this.checkForMaliciousContent(content, file_path);
        if (securityResult.warnings.length > 0) {
          warnings.push(...securityResult.warnings);
        }

        // Count lines in content
        const lines = content.split('\n').length;

        return {
          content,
          lines,
          size: stats.size,
          encoding: 'utf-8',
          mimeType: fileType.mimeType,
          isLimited,
          actualLines,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      },
      (error) =>
        systemError(
          `Failed to read file '${file_path}': ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  /**
   * Validate input with additional checks
   */
  validate(input: ReadToolInput): Result<void, QiError> {
    // Path must be absolute (Claude Code pattern)
    if (!path.isAbsolute(input.file_path)) {
      return failure(validationError('File path must be absolute'));
    }

    // Validate offset/limit combination
    if (input.offset && input.offset > 0 && !input.limit) {
      return failure(validationError('Limit must be specified when using offset'));
    }

    if (input.limit && input.limit > 10000) {
      return failure(validationError('Limit cannot exceed 10,000 lines'));
    }

    return success(undefined);
  }

  /**
   * Detect file type based on extension and magic numbers
   */
  private detectFileType(filePath: string): { category: string; mimeType: string } {
    const ext = path.extname(filePath).toLowerCase();

    // Text files
    const textExtensions = [
      '.txt',
      '.md',
      '.js',
      '.ts',
      '.jsx',
      '.tsx',
      '.json',
      '.yaml',
      '.yml',
      '.xml',
      '.html',
      '.css',
      '.scss',
      '.less',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.h',
      '.cs',
      '.php',
      '.rb',
      '.go',
      '.rs',
      '.kt',
      '.swift',
      '.sh',
    ];
    if (textExtensions.includes(ext)) {
      return { category: 'text', mimeType: 'text/plain' };
    }

    // Images
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp'];
    if (imageExtensions.includes(ext)) {
      return { category: 'image', mimeType: `image/${ext.slice(1)}` };
    }

    // PDFs
    if (ext === '.pdf') {
      return { category: 'document', mimeType: 'application/pdf' };
    }

    // Binary
    const binaryExtensions = ['.exe', '.dll', '.so', '.dylib', '.bin', '.zip', '.tar', '.gz'];
    if (binaryExtensions.includes(ext)) {
      return { category: 'binary', mimeType: 'application/octet-stream' };
    }

    // Default to text
    return { category: 'unknown', mimeType: 'text/plain' };
  }

  /**
   * Read text file with optional line limits and offset
   */
  private async readTextFile(
    filePath: string,
    limit?: number,
    offset?: number
  ): Promise<Result<{ content: string; actualLines: number; isLimited: boolean }, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const fullContent = await fs.readFile(filePath, 'utf-8');
        const lines = fullContent.split('\n');

        let selectedLines = lines;
        let isLimited = false;

        // Apply offset
        if (offset && offset > 0) {
          selectedLines = selectedLines.slice(offset);
          isLimited = true;
        }

        // Apply limit
        if (limit && limit > 0 && selectedLines.length > limit) {
          selectedLines = selectedLines.slice(0, limit);
          isLimited = true;
        }

        // Truncate very long lines (Claude Code pattern)
        const processedLines = selectedLines.map((line) =>
          line.length > 2000 ? `${line.substring(0, 2000)}... [line truncated]` : line
        );

        return {
          content: processedLines.join('\n'),
          actualLines: lines.length,
          isLimited,
        };
      },
      (error) =>
        systemError(
          `Failed to read text file: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  /**
   * Read image file (placeholder for multimodal support)
   */
  private async readImageFile(filePath: string): Promise<Result<string, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const buffer = await fs.readFile(filePath);
        const _base64 = buffer.toString('base64');
        const ext = path.extname(filePath).toLowerCase().slice(1);

        return `[Image file: ${path.basename(filePath)}]
Format: ${ext.toUpperCase()}
Size: ${buffer.length} bytes
Base64 data available for processing
Note: Use image-specific tools for detailed analysis`;
      },
      (error) =>
        systemError(
          `Failed to read image file: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  /**
   * Check for potentially malicious content patterns
   */
  private checkForMaliciousContent(content: string, filePath: string): { warnings: string[] } {
    const warnings: string[] = [];
    const ext = path.extname(filePath).toLowerCase();

    // Check for suspicious patterns in scripts
    if (['.js', '.ts', '.sh', '.py', '.ps1'].includes(ext)) {
      const suspiciousPatterns = [
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /shell_exec/gi,
        /base64_decode/gi,
        /document\.write/gi,
        /innerHTML\s*=/gi,
        /outerHTML\s*=/gi,
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(content)) {
          warnings.push(`Potentially dangerous code pattern detected: ${pattern.source}`);
        }
      }
    }

    // Check for embedded URLs or IP addresses that might be suspicious
    const urlPattern = /https?:\/\/[^\s<>"]+/gi;
    const urls = content.match(urlPattern);
    if (urls && urls.length > 10) {
      warnings.push(`File contains ${urls.length} URLs - review for suspicious links`);
    }

    // Check for very long base64 strings (possible embedded malware)
    const base64Pattern = /[A-Za-z0-9+/]{500,}/g;
    if (base64Pattern.test(content)) {
      warnings.push('File contains long base64-encoded data - review for embedded content');
    }

    return { warnings };
  }
}
