/**
 * @qi/tools - Tool Executor Interface
 *
 * Defines the interface for executing tools with support for concurrent scheduling,
 * security checks, metrics collection, and result processing.
 * Adapts Claude Code's MH1 execution pipeline pattern.
 */

import type { QiError, Result } from '@qi/base';
import type { ToolCall, ToolResult } from './ITool.js';

/**
 * Execution priority levels for tool scheduling
 */
export enum ExecutionPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Execution strategy for handling multiple tools
 */
export enum ExecutionStrategy {
  SEQUENTIAL = 'sequential', // Execute tools one by one
  CONCURRENT = 'concurrent', // Execute safe tools in parallel
  ADAPTIVE = 'adaptive', // Dynamically choose based on tools
}

/**
 * Tool execution options
 */
export interface ExecutionOptions {
  readonly strategy: ExecutionStrategy;
  readonly priority: ExecutionPriority;
  readonly maxConcurrent?: number;
  readonly timeout?: number;
  readonly retryPolicy?: RetryPolicy;
  readonly enableMetrics?: boolean;
  readonly enableCaching?: boolean;
}

/**
 * Retry policy for failed tool executions
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMultiplier: number;
  readonly initialDelay: number;
  readonly maxDelay: number;
  readonly retryableErrors?: readonly string[];
}

/**
 * Tool execution state
 */
export enum ExecutionState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * Execution progress information
 */
export interface ExecutionProgress {
  readonly callId: string;
  readonly toolName: string;
  readonly state: ExecutionState;
  readonly startTime: number;
  readonly progress?: number; // 0-1 progress indicator
  readonly message?: string; // Status message
  readonly metadata?: ReadonlyMap<string, unknown>;
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
  readonly successful: readonly ToolResult[];
  readonly failed: readonly ToolResult[];
  readonly cancelled: readonly ToolResult[];
  readonly totalTime: number;
  readonly concurrentCount: number;
  readonly sequentialCount: number;
}

/**
 * Execution statistics
 */
export interface ExecutorStats {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageExecutionTime: number;
  readonly concurrentExecutions: number;
  readonly activeCalls: number;
  readonly toolStats: ReadonlyMap<
    string,
    {
      readonly count: number;
      readonly avgTime: number;
      readonly successRate: number;
    }
  >;
}

/**
 * Core tool executor interface
 *
 * Implements Claude Code's 6-phase execution pipeline:
 * 1. Discovery & Validation
 * 2. Input Validation
 * 3. Permission Checks
 * 4. Tool Execution
 * 5. Result Processing
 * 6. Cleanup & Metrics
 */
export interface IToolExecutor {
  /**
   * Execute a single tool call
   *
   * @param call Tool call specification
   * @param options Execution options
   * @returns AsyncGenerator yielding execution progress and final result
   */
  execute<TOutput>(
    call: ToolCall,
    options?: Partial<ExecutionOptions>
  ): AsyncGenerator<Result<ExecutionProgress | ToolResult<TOutput>, QiError>, void, unknown>;

  /**
   * Execute multiple tools according to strategy
   *
   * @param calls Array of tool calls
   * @param options Execution options
   * @returns AsyncGenerator yielding progress updates and batch result
   */
  executeBatch(
    calls: readonly ToolCall[],
    options?: Partial<ExecutionOptions>
  ): AsyncGenerator<Result<ExecutionProgress | BatchExecutionResult, QiError>, void, unknown>;

  /**
   * Cancel a running tool execution
   *
   * @param callId Call ID to cancel
   * @returns Result indicating cancellation success
   */
  cancel(callId: string): Promise<Result<void, QiError>>;

  /**
   * Cancel all running executions
   *
   * @returns Result with number of cancelled executions
   */
  cancelAll(): Promise<Result<number, QiError>>;

  /**
   * Get current execution status
   *
   * @param callId Call ID to check
   * @returns Current execution progress
   */
  getExecutionStatus(callId: string): Result<ExecutionProgress, QiError>;

  /**
   * List all active executions
   *
   * @returns Array of active execution progress
   */
  getActiveExecutions(): readonly ExecutionProgress[];

  /**
   * Get executor statistics
   *
   * @returns Current executor statistics
   */
  getStats(): ExecutorStats;

  /**
   * Configure default execution options
   *
   * @param options Default options to use
   */
  setDefaultOptions(options: Partial<ExecutionOptions>): void;

  /**
   * Subscribe to execution events
   *
   * @param listener Event listener function
   * @returns Unsubscribe function
   */
  onExecutionEvent(listener: (event: ExecutionEvent) => void): () => void;
}

/**
 * Execution event types
 */
export enum ExecutionEventType {
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_PROGRESS = 'execution_progress',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  EXECUTION_CANCELLED = 'execution_cancelled',
  BATCH_STARTED = 'batch_started',
  BATCH_COMPLETED = 'batch_completed',
}

/**
 * Execution event data
 */
export interface ExecutionEvent {
  readonly type: ExecutionEventType;
  readonly callId: string;
  readonly toolName: string;
  readonly timestamp: number;
  readonly data?: ExecutionProgress | ToolResult | BatchExecutionResult;
  readonly error?: QiError;
}

/**
 * Advanced executor interface with caching and optimization
 */
export interface IAdvancedToolExecutor extends IToolExecutor {
  /**
   * Execute with caching support
   *
   * @param call Tool call
   * @param options Execution options with caching
   * @returns Cached or fresh execution result
   */
  executeWithCache<TOutput>(
    call: ToolCall,
    options?: Partial<ExecutionOptions>
  ): AsyncGenerator<Result<ExecutionProgress | ToolResult<TOutput>, QiError>, void, unknown>;

  /**
   * Optimize execution order based on dependencies and performance
   *
   * @param calls Tool calls to optimize
   * @returns Optimized execution order
   */
  optimizeExecutionOrder(calls: readonly ToolCall[]): Result<readonly ToolCall[], QiError>;

  /**
   * Analyze tool dependencies for optimal scheduling
   *
   * @param calls Tool calls to analyze
   * @returns Dependency graph and execution plan
   */
  analyzeDependencies(calls: readonly ToolCall[]): Result<
    {
      readonly concurrent: readonly ToolCall[];
      readonly sequential: readonly ToolCall[];
      readonly dependencies: ReadonlyMap<string, readonly string[]>;
    },
    QiError
  >;

  /**
   * Get performance recommendations for tool usage
   *
   * @param toolNames Tools to analyze
   * @returns Performance optimization suggestions
   */
  getPerformanceRecommendations(toolNames: readonly string[]): Result<
    readonly {
      readonly toolName: string;
      readonly recommendation: string;
      readonly impact: 'low' | 'medium' | 'high';
    }[],
    QiError
  >;
}
