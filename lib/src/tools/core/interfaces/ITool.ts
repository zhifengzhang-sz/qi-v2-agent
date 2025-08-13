/**
 * @qi/tools - Core Tool Interface
 *
 * Defines the standard interface for all tools in the qi-v2-agent system.
 * Follows Claude Code's tool patterns while maintaining QiCore Result<T> integration.
 */

import type { QiError, Result } from '@qi/base';
import type { z } from 'zod';

/**
 * Tool execution context containing session and environment information
 */
export interface ToolContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly currentDirectory: string;
  readonly environment: ReadonlyMap<string, string>;
  readonly permissions: ToolPermissions;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Tool permissions and security context
 */
export interface ToolPermissions {
  readonly readFiles: boolean;
  readonly writeFiles: boolean;
  readonly executeCommands: boolean;
  readonly networkAccess: boolean;
  readonly systemAccess: boolean;
  readonly manageProcesses: boolean;
  readonly allowedPaths?: readonly string[];
  readonly deniedPaths?: readonly string[];
}

/**
 * Permission check result
 */
export interface PermissionResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly requiredLevel?: string;
}

/**
 * Tool execution metrics
 */
export interface ToolMetrics {
  readonly startTime: number;
  readonly endTime: number;
  readonly memoryUsage?: NodeJS.MemoryUsage;
  readonly success: boolean;
  readonly retryCount: number;
}

/**
 * Core tool interface that all tools must implement
 *
 * Adapts Claude Code's tool interface while adding QiCore patterns and proper abstraction
 */
export interface ITool<TInput = unknown, TOutput = unknown> {
  /**
   * Unique tool identifier
   */
  readonly name: string;

  /**
   * Human-readable description of what the tool does
   */
  readonly description: string;

  /**
   * Tool version for compatibility tracking
   */
  readonly version: string;

  /**
   * Zod schema for input validation
   */
  readonly inputSchema: z.ZodSchema<TInput>;

  /**
   * Whether this tool modifies external state (files, system, etc.)
   */
  readonly isReadOnly: boolean;

  /**
   * Whether this tool can be executed concurrently with other tools
   */
  readonly isConcurrencySafe: boolean;

  /**
   * Maximum number of retry attempts for failed executions
   */
  readonly maxRetries: number;

  /**
   * Execution timeout in milliseconds
   */
  readonly timeout: number;

  /**
   * Execute the tool with validated input
   *
   * @param input Validated input parameters
   * @param context Execution context with session info
   * @returns Result containing tool output or error
   */
  execute(input: TInput, context: ToolContext): Promise<Result<TOutput, QiError>>;

  /**
   * Validate input parameters beyond schema validation
   *
   * @param input Input to validate
   * @returns Result indicating validation success or failure
   */
  validate(input: TInput): Result<void, QiError>;

  /**
   * Check if the tool can be executed in the given context
   *
   * @param input Tool input parameters
   * @param context Execution context
   * @returns Result indicating permission status
   */
  checkPermissions(input: TInput, context: ToolContext): Result<PermissionResult, QiError>;

  /**
   * Optional cleanup method called when tool is unregistered
   */
  cleanup?(): Promise<Result<void, QiError>>;

  /**
   * Get usage instructions for this tool
   */
  getUsageInstructions(): Promise<Result<string, QiError>>;
}

/**
 * Enhanced tool interface for tools that support streaming output
 */
export interface IStreamingTool<TInput = unknown, TOutput = unknown>
  extends ITool<TInput, TOutput> {
  /**
   * Execute tool with streaming output support
   *
   * @param input Validated input parameters
   * @param context Execution context
   * @returns AsyncGenerator yielding incremental results
   */
  executeStream(
    input: TInput,
    context: ToolContext
  ): AsyncGenerator<Result<Partial<TOutput>, QiError>, Result<TOutput, QiError>, unknown>;
}

/**
 * Tool interface for tools that can be cached
 */
export interface ICacheableTool<TInput = unknown, TOutput = unknown>
  extends ITool<TInput, TOutput> {
  /**
   * Generate cache key for input and context
   */
  getCacheKey(input: TInput, context: ToolContext): string;

  /**
   * Determine if result should be cached
   */
  shouldCache(input: TInput, output: TOutput, context: ToolContext): boolean;

  /**
   * Get cache TTL in milliseconds
   */
  getCacheTTL(input: TInput, context: ToolContext): number;
}

/**
 * Tool metadata for registry management
 */
export interface ToolMetadata {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly dependencies: readonly string[];
  readonly author?: string;
  readonly homepage?: string;
  readonly repository?: string;
}

/**
 * Tool execution call specification
 */
export interface ToolCall<TInput = unknown> {
  readonly toolName: string;
  readonly input: TInput;
  readonly callId: string;
  readonly timestamp: number;
  readonly context: ToolContext;
}

/**
 * Tool execution result
 */
export interface ToolResult<TOutput = unknown> {
  readonly callId: string;
  readonly toolName: string;
  readonly success: boolean;
  readonly output?: TOutput;
  readonly error?: QiError;
  readonly metrics: ToolMetrics;
  readonly metadata: ReadonlyMap<string, unknown>;
}
