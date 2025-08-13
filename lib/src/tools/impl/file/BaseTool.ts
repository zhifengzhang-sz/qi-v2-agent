/**
 * @qi/tools - Base Tool Implementation
 *
 * Provides common functionality for all file operation tools including
 * permission checks, validation, and error handling patterns.
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
import { createQiLogger } from '../../../utils/QiCoreLogger.js';
import type {
  ITool,
  PermissionResult,
  ToolContext,
  ToolMetrics,
} from '../../core/interfaces/index.js';

/**
 * Base file tool with common file operation functionality
 */
export abstract class BaseFileTool<TInput, TOutput> implements ITool<TInput, TOutput> {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly version: string;
  abstract readonly inputSchema: any;
  abstract readonly isReadOnly: boolean;
  abstract readonly isConcurrencySafe: boolean;

  readonly maxRetries: number = 3;
  readonly timeout: number = 30000; // 30 seconds

  /**
   * Abstract method for tool-specific execution logic
   */
  abstract executeImpl(input: TInput, context: ToolContext): Promise<Result<TOutput, QiError>>;

  /**
   * Execute the tool with common error handling and metrics
   */
  async execute(input: TInput, context: ToolContext): Promise<Result<TOutput, QiError>> {
    const startTime = Date.now();

    // Validate input beyond schema
    const validationResult = this.validate(input);
    if (validationResult.tag === 'failure') {
      this.recordMetrics({
        startTime,
        endTime: Date.now(),
        success: false,
        retryCount: 0,
      });
      return validationResult;
    }

    // Check permissions
    const permissionResult = this.checkPermissions(input, context);
    if (permissionResult.tag === 'failure') {
      this.recordMetrics({
        startTime,
        endTime: Date.now(),
        success: false,
        retryCount: 0,
      });
      return failure(permissionResult.error);
    }

    if (!permissionResult.value.allowed) {
      this.recordMetrics({
        startTime,
        endTime: Date.now(),
        success: false,
        retryCount: 0,
      });
      return failure(validationError(permissionResult.value.reason || 'Permission denied'));
    }

    // Execute tool-specific logic
    const result = await this.executeImpl(input, context);

    // Record metrics
    const endTime = Date.now();
    this.recordMetrics({
      startTime,
      endTime,
      success: result.tag === 'success',
      retryCount: 0,
    });

    return result;
  }

  /**
   * Basic validation - override in specific tools for custom validation
   */
  validate(_input: TInput): Result<void, QiError> {
    // Default validation passes - tools override for specific checks
    return success(undefined);
  }

  /**
   * Check permissions for file operations
   */
  checkPermissions(input: TInput, context: ToolContext): Result<PermissionResult, QiError> {
    // Extract file path from input if it has one
    const filePath = this.extractFilePath(input);

    if (filePath) {
      // Validate path is absolute as per Claude Code patterns
      if (!path.isAbsolute(filePath)) {
        return success({
          allowed: false,
          reason: 'File path must be absolute',
        });
      }

      // Check if path is in allowed/denied lists
      const pathCheck = this.checkPathPermissions(filePath, context.permissions);
      if (!pathCheck.allowed) {
        return success(pathCheck);
      }
    }

    // Check operation-specific permissions
    if (!this.isReadOnly && !context.permissions.writeFiles) {
      return success({
        allowed: false,
        reason: 'Write file permission not granted',
      });
    }

    if (this.isReadOnly && !context.permissions.readFiles) {
      return success({
        allowed: false,
        reason: 'Read file permission not granted',
      });
    }

    return success({
      allowed: true,
    });
  }

  /**
   * Get usage instructions
   */
  async getUsageInstructions(): Promise<Result<string, QiError>> {
    return success(`${this.description}\n\nVersion: ${this.version}`);
  }

  /**
   * Extract file path from input if present
   */
  protected extractFilePath(input: TInput): string | null {
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, any>;
      return obj.file_path || obj.filePath || obj.path || null;
    }
    return null;
  }

  /**
   * Check if file path is allowed based on permissions
   */
  protected checkPathPermissions(
    filePath: string,
    permissions: ToolContext['permissions']
  ): PermissionResult {
    // Check denied paths first
    if (permissions.deniedPaths) {
      for (const deniedPath of permissions.deniedPaths) {
        if (filePath.startsWith(deniedPath)) {
          return {
            allowed: false,
            reason: `Access to path '${deniedPath}' is denied`,
          };
        }
      }
    }

    // Check allowed paths if specified
    if (permissions.allowedPaths && permissions.allowedPaths.length > 0) {
      let allowed = false;
      for (const allowedPath of permissions.allowedPaths) {
        if (filePath.startsWith(allowedPath)) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        return {
          allowed: false,
          reason: 'File path not in allowed paths',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if file exists safely
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure directory exists for file path
   */
  protected async ensureDirectoryExists(filePath: string): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        return undefined;
      },
      (error) =>
        systemError(
          `Failed to create directory: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  /**
   * Read file safely with error handling
   */
  protected async readFileSafe(filePath: string): Promise<Result<string, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        return await fs.readFile(filePath, 'utf-8');
      },
      (error) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return validationError(`File not found: ${filePath}`);
        }
        return systemError(
          `Failed to read file: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    );
  }

  /**
   * Write file safely with backup and error handling
   */
  protected async writeFileSafe(filePath: string, content: string): Promise<Result<void, QiError>> {
    // Ensure directory exists first
    const dirResult = await this.ensureDirectoryExists(filePath);
    if (dirResult.tag === 'failure') {
      return dirResult;
    }

    return fromAsyncTryCatch(
      async () => {
        // Create backup if file exists
        const exists = await this.fileExists(filePath);
        if (exists) {
          const backupPath = `${filePath}.backup`;
          await fs.copyFile(filePath, backupPath);
        }

        // Write new content
        await fs.writeFile(filePath, content, 'utf-8');
        return undefined;
      },
      (error) =>
        systemError(
          `Failed to write file: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  /**
   * Record execution metrics with QiCore logging
   */
  protected recordMetrics(metrics: ToolMetrics): void {
    // Use QiCore logger for metrics recording with graceful degradation
    const logger = createQiLogger({
      name: `tool-${this.name.toLowerCase()}`,
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      pretty: process.env.NODE_ENV === 'development',
    });

    logger.debug('Tool execution completed', {
      component: `tool-${this.name.toLowerCase()}`,
      method: 'execute',
      duration: metrics.endTime - metrics.startTime,
      success: metrics.success,
      retryCount: metrics.retryCount,
      timestamp: metrics.endTime,
    });
  }
}
