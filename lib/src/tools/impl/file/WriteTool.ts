/**
 * @qi/tools - Write Tool Implementation
 *
 * File creation and writing tool with overwrite protection and backup support.
 * Follows Claude Code's "edit-over-create" philosophy for existing files.
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
import type { PermissionResult, ToolContext } from '../../core/interfaces/index.js';
import { BaseFileTool } from './BaseTool.js';

/**
 * Input schema for WriteTool
 */
const WriteToolInputSchema = z.object({
  file_path: z.string().min(1, 'File path is required'),
  content: z.string(),
  create_backup: z.boolean().optional().default(true),
  force_overwrite: z.boolean().optional().default(false),
});

type WriteToolInput = z.infer<typeof WriteToolInputSchema>;

/**
 * Output type for WriteTool
 */
interface WriteToolOutput {
  success: boolean;
  file_path: string;
  bytes_written: number;
  created: boolean;
  backup_created?: string;
  warning?: string;
}

/**
 * File writing tool with Claude Code-style features:
 * - Absolute path requirement
 * - Automatic backup creation
 * - "Edit-over-create" philosophy warnings
 * - Directory creation
 */
export class WriteTool extends BaseFileTool<WriteToolInput, WriteToolOutput> {
  readonly name = 'Write';
  readonly description = 'Create or write file content with backup protection';
  readonly version = '1.0.0';
  readonly inputSchema = WriteToolInputSchema;
  readonly isReadOnly = false;
  readonly isConcurrencySafe = false; // Writing files is not safe for concurrency

  async executeImpl(
    input: WriteToolInput,
    _context: ToolContext
  ): Promise<Result<WriteToolOutput, QiError>> {
    const { file_path, content, create_backup, force_overwrite } = input;

    return fromAsyncTryCatch(
      async () => {
        // Check if file already exists
        const exists = await this.fileExists(file_path);
        let backupPath: string | undefined;
        let warning: string | undefined;

        // Claude Code pattern: suggest using Edit for existing files
        if (exists && !force_overwrite) {
          warning = `File already exists. Consider using Edit tool for modifications instead of overwriting.`;
        }

        // Create backup if file exists and backup is requested
        if (exists && create_backup) {
          backupPath = `${file_path}.backup.${Date.now()}`;
          await fs.copyFile(file_path, backupPath);
        }

        // Ensure directory exists
        const dirResult = await this.ensureDirectoryExists(file_path);
        if (dirResult.tag === 'failure') {
          throw new Error(dirResult.error.message);
        }

        // Write the file
        await fs.writeFile(file_path, content, 'utf-8');

        // Get file stats for response
        const stats = await fs.stat(file_path);

        return {
          success: true,
          file_path,
          bytes_written: stats.size,
          created: !exists,
          backup_created: backupPath,
          warning,
        };
      },
      (error) =>
        systemError(
          `Failed to write file '${file_path}': ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  /**
   * Validate input with additional checks
   */
  validate(input: WriteToolInput): Result<void, QiError> {
    // Path must be absolute
    if (!path.isAbsolute(input.file_path)) {
      return failure(validationError('File path must be absolute'));
    }

    // Content size check (prevent extremely large files)
    if (input.content.length > 10 * 1024 * 1024) {
      // 10MB limit
      return failure(validationError('File content exceeds 10MB limit'));
    }

    // Check for potentially dangerous file extensions in system areas
    const ext = path.extname(input.file_path).toLowerCase();
    const baseName = path.basename(input.file_path);

    // Warn about executable files
    const dangerousExtensions = ['.exe', '.dll', '.so', '.dylib', '.app'];
    if (dangerousExtensions.includes(ext)) {
      return failure(validationError(`Writing ${ext} files is not allowed for security reasons`));
    }

    // Warn about system files
    const systemFiles = ['hosts', 'passwd', 'shadow', 'sudoers'];
    if (systemFiles.includes(baseName)) {
      return failure(validationError(`Writing system file '${baseName}' is not allowed`));
    }

    return success(undefined);
  }

  /**
   * Enhanced permission check for write operations
   */
  checkPermissions(input: WriteToolInput, context: ToolContext): Result<PermissionResult, QiError> {
    // Call base permission check first
    const baseResult = super.checkPermissions(input, context);
    if (baseResult.tag === 'failure' || !baseResult.value.allowed) {
      return baseResult;
    }

    // Additional checks for write operations
    const filePath = input.file_path;

    // Check if writing to system directories
    const systemPaths = ['/etc', '/usr', '/bin', '/sbin', '/sys', '/proc'];
    for (const sysPath of systemPaths) {
      if (filePath.startsWith(sysPath)) {
        return success({
          allowed: false,
          reason: `Writing to system directory '${sysPath}' is not permitted`,
        });
      }
    }

    // Check if trying to write to parent directories with relative paths (security check)
    if (filePath.includes('..')) {
      return success({
        allowed: false,
        reason: 'File paths with parent directory references (..) are not allowed',
      });
    }

    return success({ allowed: true });
  }
}
