/**
 * @qi/tools - Tool Executor Implementation
 *
 * Implements Claude Code's 6-phase execution pipeline with QiCore Result<T> patterns.
 * Provides concurrent execution, security checks, metrics collection, and proper error handling.
 */

import {
  create,
  failure,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
import { createQiLogger } from '../../../utils/QiCoreLogger.js';
import type { ITool, ToolCall, ToolContext, ToolResult } from '../interfaces/ITool.js';
import type {
  BatchExecutionResult,
  ExecutionEvent,
  ExecutionOptions,
  ExecutionProgress,
  ExecutorStats,
  IToolExecutor,
  RetryPolicy,
} from '../interfaces/IToolExecutor.js';
import {
  ExecutionEventType,
  ExecutionPriority,
  ExecutionState,
  ExecutionStrategy,
} from '../interfaces/IToolExecutor.js';
import type { IToolRegistry } from '../interfaces/IToolRegistry.js';

/**
 * Tool execution error with enhanced context
 */
interface ToolExecutionError extends QiError {
  context: {
    toolName?: string;
    callId?: string;
    phase?: string;
    retryAttempt?: number;
    executionTime?: number;
    originalError?: string;
  };
}

const toolExecutionError = (
  code: string,
  message: string,
  category: 'VALIDATION' | 'SYSTEM' | 'NETWORK' | 'BUSINESS',
  context: ToolExecutionError['context'] = {}
): ToolExecutionError => create(code, message, category, context) as ToolExecutionError;

/**
 * Default execution options
 */
const DEFAULT_EXECUTION_OPTIONS: ExecutionOptions = {
  strategy: ExecutionStrategy.ADAPTIVE,
  priority: ExecutionPriority.NORMAL,
  maxConcurrent: 10,
  timeout: 30000, // 30 seconds
  enableMetrics: true,
  enableCaching: false,
  retryPolicy: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    initialDelay: 1000,
    maxDelay: 30000,
    retryableErrors: ['NETWORK_ERROR', 'TIMEOUT_ERROR', 'SYSTEM_ERROR'],
  },
};

/**
 * Core Tool Executor - 6-Phase Pipeline Implementation
 *
 * Phases:
 * 1. Discovery & Tool Resolution
 * 2. Input Validation (Schema + Business Logic)
 * 3. Permission Checks & Security
 * 4. Tool Execution with Timeout
 * 5. Result Processing & Transformation
 * 6. Cleanup, Metrics & Event Emission
 */
export class ToolExecutor implements IToolExecutor {
  private registry: IToolRegistry;
  private defaultOptions: ExecutionOptions;
  private logger: any;

  // Execution tracking
  private activeExecutions = new Map<string, ExecutionProgress>();
  private executionHistory: ToolResult[] = [];

  // Statistics (mutable internal version)
  private stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    concurrentExecutions: 0,
    activeCalls: 0,
    toolStats: new Map<string, { count: number; avgTime: number; successRate: number }>(),
  };

  // Event system
  private eventListeners: Array<(event: ExecutionEvent) => void> = [];

  constructor(registry: IToolRegistry, options?: Partial<ExecutionOptions>) {
    this.registry = registry;
    this.defaultOptions = { ...DEFAULT_EXECUTION_OPTIONS, ...options };

    this.logger = createQiLogger({
      name: 'ToolExecutor',
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      pretty: process.env.NODE_ENV === 'development',
    });
  }

  /**
   * Execute a single tool call with 6-phase pipeline
   */
  async *execute<TOutput>(
    call: ToolCall,
    options?: Partial<ExecutionOptions>
  ): AsyncGenerator<Result<ExecutionProgress | ToolResult<TOutput>, QiError>, void, unknown> {
    const executionOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    // Initialize execution progress (mutable for internal use)
    const progress = {
      callId: call.callId,
      toolName: call.toolName,
      state: ExecutionState.PENDING,
      startTime,
      progress: 0,
      metadata: new Map(),
      message: undefined as string | undefined,
    };

    this.activeExecutions.set(call.callId, progress);
    this.stats.activeCalls++;

    try {
      // === PHASE 1: Discovery & Tool Resolution ===
      yield* this.executePhase1Discovery(call, progress);

      // === PHASE 2: Input Validation ===
      const tool = yield* this.executePhase2Validation(call, progress);
      if (!tool) return; // Error already yielded

      // === PHASE 3: Permission Checks & Security ===
      yield* this.executePhase3Security(call, tool, progress);

      // === PHASE 4: Tool Execution ===
      const result = yield* this.executePhase4Execution(call, tool, progress, executionOptions);
      if (!result) return; // Error already yielded

      // === PHASE 5: Result Processing ===
      const processedResult = yield* this.executePhase5Processing(call, result, progress);

      // === PHASE 6: Cleanup & Metrics ===
      yield* this.executePhase6Cleanup(call, processedResult, progress, startTime);

      // Final result
      yield success(processedResult as ToolResult<TOutput>);
    } catch (error) {
      // Transform traditional error to QiError using QiCore patterns
      const qiError = this.transformToQiError(call, error, progress, startTime);
      yield failure(qiError);
    } finally {
      this.activeExecutions.delete(call.callId);
      this.stats.activeCalls--;
    }
  }

  /**
   * Transform traditional errors to QiError using QiCore patterns
   */
  private transformToQiError(
    call: ToolCall,
    error: unknown,
    progress: ExecutionProgress,
    startTime: number
  ): QiError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const executionTime = Date.now() - startTime;

    // Categorize errors appropriately
    if (errorMessage.includes('timeout') || errorMessage.includes('cancelled')) {
      return toolExecutionError(
        'EXECUTION_TIMEOUT',
        `Tool execution timed out: ${errorMessage}`,
        'SYSTEM',
        {
          toolName: call.toolName,
          callId: call.callId,
          phase: progress.state,
          executionTime,
          originalError: errorMessage,
        }
      );
    }

    if (errorMessage.includes('permission') || errorMessage.includes('access denied')) {
      return toolExecutionError(
        'PERMISSION_DENIED',
        `Tool execution permission denied: ${errorMessage}`,
        'VALIDATION',
        {
          toolName: call.toolName,
          callId: call.callId,
          phase: progress.state,
          executionTime,
          originalError: errorMessage,
        }
      );
    }

    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return toolExecutionError(
        'VALIDATION_ERROR',
        `Tool execution validation failed: ${errorMessage}`,
        'VALIDATION',
        {
          toolName: call.toolName,
          callId: call.callId,
          phase: progress.state,
          executionTime,
          originalError: errorMessage,
        }
      );
    }

    // Default to system error
    return toolExecutionError(
      'EXECUTION_ERROR',
      `Tool execution failed: ${errorMessage}`,
      'SYSTEM',
      {
        toolName: call.toolName,
        callId: call.callId,
        phase: progress.state,
        executionTime,
        originalError: errorMessage,
      }
    );
  }

  /**
   * Phase 1: Discovery & Tool Resolution
   */
  private async *executePhase1Discovery(
    call: ToolCall,
    progress: any
  ): AsyncGenerator<Result<ExecutionProgress, QiError>, ITool | null, unknown> {
    progress.state = ExecutionState.RUNNING;
    progress.progress = 0.1;
    progress.message = 'Discovering tool';

    yield success(progress);
    this.emitEvent(ExecutionEventType.EXECUTION_STARTED, call, progress);

    const toolResult = this.registry.get(call.toolName);

    if (toolResult.tag === 'failure') {
      const error = toolExecutionError(
        'TOOL_NOT_FOUND',
        `Tool '${call.toolName}' not found in registry`,
        'VALIDATION',
        { toolName: call.toolName, callId: call.callId, phase: 'discovery' }
      );
      yield failure(error);
      return null;
    }

    const tool = toolResult.value;
    progress.progress = 0.2;
    progress.message = 'Tool discovered';
    yield success(progress);

    return tool;
  }

  /**
   * Phase 2: Input Validation (Schema + Business Logic)
   */
  private async *executePhase2Validation(
    call: ToolCall,
    progress: any
  ): AsyncGenerator<Result<ExecutionProgress, QiError>, ITool | null, unknown> {
    progress.progress = 0.3;
    progress.message = 'Validating input';
    yield success(progress);

    const toolResult = this.registry.get(call.toolName);
    if (toolResult.tag === 'failure') {
      const error = toolExecutionError(
        'TOOL_NOT_FOUND',
        `Tool '${call.toolName}' not found in registry`,
        'VALIDATION',
        { toolName: call.toolName, callId: call.callId, phase: 'validation' }
      );
      yield failure(error);
      return null;
    }

    const tool = toolResult.value;

    // Schema validation
    const schemaValidation = tool.inputSchema.safeParse(call.input);
    if (!schemaValidation.success) {
      const error = toolExecutionError(
        'SCHEMA_VALIDATION_FAILED',
        `Input validation failed: ${schemaValidation.error.message}`,
        'VALIDATION',
        { toolName: call.toolName, callId: call.callId, phase: 'validation' }
      );
      yield failure(error);
      return null;
    }

    // Business logic validation
    const businessValidation = tool.validate(call.input);
    if (businessValidation.tag === 'failure') {
      const error = toolExecutionError(
        'BUSINESS_VALIDATION_FAILED',
        `Business validation failed: ${businessValidation.error.message}`,
        'VALIDATION',
        { toolName: call.toolName, callId: call.callId, phase: 'validation' }
      );
      yield failure(error);
      return null;
    }

    progress.progress = 0.4;
    progress.message = 'Input validated';
    yield success(progress);

    return tool;
  }

  /**
   * Phase 3: Permission Checks & Security
   */
  private async *executePhase3Security(
    call: ToolCall,
    tool: ITool,
    progress: any
  ): AsyncGenerator<Result<ExecutionProgress, QiError>, void, unknown> {
    progress.progress = 0.5;
    progress.message = 'Checking permissions';
    yield success(progress);

    const permissionResult = tool.checkPermissions(call.input, call.context);

    if (permissionResult.tag === 'failure') {
      const error = toolExecutionError(
        'PERMISSION_CHECK_FAILED',
        `Permission check failed: ${permissionResult.error.message}`,
        'VALIDATION',
        { toolName: call.toolName, callId: call.callId, phase: 'security' }
      );
      yield failure(error);
      return;
    }

    if (!permissionResult.value.allowed) {
      const error = toolExecutionError(
        'PERMISSION_DENIED',
        `Permission denied: ${permissionResult.value.reason || 'Access not allowed'}`,
        'VALIDATION',
        { toolName: call.toolName, callId: call.callId, phase: 'security' }
      );
      yield failure(error);
      return;
    }

    progress.progress = 0.6;
    progress.message = 'Permissions verified';
    yield success(progress);
  }

  /**
   * Phase 4: Tool Execution with Timeout & Retry
   */
  private async *executePhase4Execution<TOutput>(
    call: ToolCall,
    tool: ITool,
    progress: any,
    options: ExecutionOptions
  ): AsyncGenerator<Result<ExecutionProgress, QiError>, ToolResult<TOutput> | null, unknown> {
    progress.progress = 0.7;
    progress.message = 'Executing tool';
    yield success(progress);

    const retryPolicy = options.retryPolicy!;
    let lastError: QiError | null = null;

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        const executionPromise = tool.execute(call.input, call.context);
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Execution timeout')), options.timeout);
        });

        const result = await Promise.race([executionPromise, timeoutPromise]);

        if (result.tag === 'success') {
          // Success - create tool result
          const toolResult: ToolResult<TOutput> = {
            callId: call.callId,
            toolName: call.toolName,
            success: true,
            output: result.value as TOutput,
            metrics: {
              startTime: progress.startTime,
              endTime: Date.now(),
              success: true,
              retryCount: attempt - 1,
            },
            metadata: new Map([['attempt', attempt.toString()]]),
          };

          progress.progress = 0.8;
          progress.message = 'Tool executed successfully';
          yield success(progress);

          return toolResult;
        } else {
          lastError = result.error;

          // Check if error is retryable
          if (attempt < retryPolicy.maxAttempts && this.isRetryableError(lastError, retryPolicy)) {
            const delay = Math.min(
              retryPolicy.initialDelay * retryPolicy.backoffMultiplier ** (attempt - 1),
              retryPolicy.maxDelay
            );

            progress.message = `Retrying in ${delay}ms (attempt ${attempt + 1}/${retryPolicy.maxAttempts})`;
            yield success(progress);

            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            // No more retries or non-retryable error
            break;
          }
        }
      } catch (error) {
        lastError = systemError(error instanceof Error ? error.message : String(error));
        if (attempt < retryPolicy.maxAttempts && this.isRetryableError(lastError, retryPolicy)) {
          continue;
        }
        break;
      }
    }

    // All attempts failed
    const error = toolExecutionError(
      'EXECUTION_FAILED',
      `Tool execution failed after ${retryPolicy.maxAttempts} attempts: ${lastError?.message}`,
      'SYSTEM',
      { toolName: call.toolName, callId: call.callId, phase: 'execution' }
    );
    yield failure(error);
    return null;
  }

  /**
   * Phase 5: Result Processing & Transformation
   */
  private async *executePhase5Processing<TOutput>(
    _call: ToolCall,
    result: ToolResult<TOutput>,
    progress: any
  ): AsyncGenerator<Result<ExecutionProgress, QiError>, ToolResult<TOutput>, unknown> {
    progress.progress = 0.9;
    progress.message = 'Processing result';
    yield success(progress);

    // Add execution metadata
    const mutableMetadata = new Map(result.metadata.entries());
    mutableMetadata.set('executorVersion', '1.0.0');
    mutableMetadata.set('executionTime', (Date.now() - progress.startTime).toString());
    mutableMetadata.set('timestamp', new Date().toISOString());

    const enhancedResult = {
      ...result,
      metadata: mutableMetadata,
    };

    progress.progress = 0.95;
    progress.message = 'Result processed';
    yield success(progress);

    return enhancedResult;
  }

  /**
   * Phase 6: Cleanup, Metrics & Event Emission
   */
  private async *executePhase6Cleanup<TOutput>(
    call: ToolCall,
    result: ToolResult<TOutput>,
    progress: any,
    startTime: number
  ): AsyncGenerator<Result<ExecutionProgress, QiError>, void, unknown> {
    progress.state = ExecutionState.COMPLETED;
    progress.progress = 1.0;
    progress.message = 'Execution completed';

    // Update statistics
    this.updateExecutionStats(call.toolName, result.success, Date.now() - startTime);

    // Store in history
    this.executionHistory.push(result);
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-500); // Keep last 500
    }

    // Emit completion event
    this.emitEvent(ExecutionEventType.EXECUTION_COMPLETED, call, progress, result);

    // Log execution
    this.logger.info('Tool execution completed', {
      component: 'ToolExecutor',
      method: 'execute',
      toolName: call.toolName,
      callId: call.callId,
      success: result.success,
      executionTime: Date.now() - startTime,
      retryCount: result.metrics.retryCount,
    });

    yield success(progress);
  }

  /**
   * Execute multiple tools according to strategy
   */
  async *executeBatch(
    calls: readonly ToolCall[],
    options?: Partial<ExecutionOptions>
  ): AsyncGenerator<Result<ExecutionProgress | BatchExecutionResult, QiError>, void, unknown> {
    const executionOptions = { ...this.defaultOptions, ...options };
    const startTime = Date.now();

    const successful: ToolResult[] = [];
    const failed: ToolResult[] = [];
    const cancelled: ToolResult[] = [];

    let concurrentCount = 0;
    let sequentialCount = 0;

    // Analyze tools for execution strategy
    const analysis = this.analyzeConcurrency(calls);

    // Execute concurrent-safe tools in parallel
    if (analysis.concurrent.length > 0) {
      const concurrentPromises = analysis.concurrent.map(async (call) => {
        const results: (ExecutionProgress | ToolResult)[] = [];
        for await (const result of this.execute(call, executionOptions)) {
          if (result.tag === 'success') {
            results.push(result.value);
          }
        }
        return results[results.length - 1] as ToolResult; // Last result is final
      });

      concurrentCount = analysis.concurrent.length;
      const concurrentResults = await Promise.allSettled(concurrentPromises);

      for (const result of concurrentResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            successful.push(result.value);
          } else {
            failed.push(result.value);
          }
        } else {
          // Create failed result for rejected promise
          const failedResult: ToolResult = {
            callId: 'unknown',
            toolName: 'unknown',
            success: false,
            error: systemError(result.reason),
            metrics: { startTime, endTime: Date.now(), success: false, retryCount: 0 },
            metadata: new Map(),
          };
          failed.push(failedResult);
        }
      }
    }

    // Execute sequential tools one by one
    sequentialCount = analysis.sequential.length;
    for (const call of analysis.sequential) {
      const results: (ExecutionProgress | ToolResult)[] = [];
      for await (const result of this.execute(call, executionOptions)) {
        if (result.tag === 'success') {
          if (result.value && 'success' in result.value) {
            // This is a ToolResult
            results.push(result.value);
          } else {
            // This is ExecutionProgress
            yield success(result.value);
          }
        } else {
          yield failure(result.error);
        }
      }

      const finalResult = results[results.length - 1] as ToolResult;
      if (finalResult) {
        if (finalResult.success) {
          successful.push(finalResult);
        } else {
          failed.push(finalResult);
        }
      }
    }

    const batchResult: BatchExecutionResult = {
      successful,
      failed,
      cancelled,
      totalTime: Date.now() - startTime,
      concurrentCount,
      sequentialCount,
    };

    yield success(batchResult);
  }

  /**
   * Cancel a running execution
   */
  async cancel(callId: string): Promise<Result<void, QiError>> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      return failure(validationError(`No active execution found for call ID: ${callId}`));
    }

    // Update execution state (create mutable copy)
    const mutableExecution = { ...execution, state: ExecutionState.CANCELLED };
    this.activeExecutions.set(callId, mutableExecution);
    this.activeExecutions.delete(callId);
    this.stats.activeCalls--;

    this.emitEvent(
      ExecutionEventType.EXECUTION_CANCELLED,
      {
        callId,
        toolName: execution.toolName,
        context: {} as ToolContext,
        input: {},
        timestamp: Date.now(),
      },
      execution
    );

    return success(undefined);
  }

  /**
   * Cancel all running executions
   */
  async cancelAll(): Promise<Result<number, QiError>> {
    const count = this.activeExecutions.size;

    for (const [callId] of this.activeExecutions) {
      await this.cancel(callId);
    }

    return success(count);
  }

  /**
   * Get execution status
   */
  getExecutionStatus(callId: string): Result<ExecutionProgress, QiError> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      return failure(validationError(`No execution found for call ID: ${callId}`));
    }
    return success(execution);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): readonly ExecutionProgress[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get executor statistics
   */
  getStats(): ExecutorStats {
    return {
      ...this.stats,
      toolStats: new Map(this.stats.toolStats), // Copy to prevent mutation
    };
  }

  /**
   * Set default execution options
   */
  setDefaultOptions(options: Partial<ExecutionOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Subscribe to execution events
   */
  onExecutionEvent(listener: (event: ExecutionEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  private isRetryableError(error: QiError, policy: RetryPolicy): boolean {
    if (!policy.retryableErrors) return true;
    return policy.retryableErrors.includes(error.code);
  }

  private updateExecutionStats(toolName: string, success: boolean, executionTime: number): void {
    this.stats.totalExecutions++;

    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }

    // Update average execution time
    const totalTime =
      this.stats.averageExecutionTime * (this.stats.totalExecutions - 1) + executionTime;
    this.stats.averageExecutionTime = totalTime / this.stats.totalExecutions;

    // Update tool-specific stats
    const toolStats = this.stats.toolStats.get(toolName) || {
      count: 0,
      avgTime: 0,
      successRate: 0,
    };
    const newCount = toolStats.count + 1;
    const newAvgTime = (toolStats.avgTime * toolStats.count + executionTime) / newCount;
    const newSuccessRate = success
      ? (toolStats.successRate * toolStats.count + 1) / newCount
      : (toolStats.successRate * toolStats.count) / newCount;

    this.stats.toolStats.set(toolName, {
      count: newCount,
      avgTime: newAvgTime,
      successRate: newSuccessRate,
    });
  }

  private analyzeConcurrency(calls: readonly ToolCall[]): {
    concurrent: ToolCall[];
    sequential: ToolCall[];
  } {
    const concurrent: ToolCall[] = [];
    const sequential: ToolCall[] = [];

    for (const call of calls) {
      const toolResult = this.registry.get(call.toolName);
      if (toolResult.tag === 'success' && toolResult.value.isConcurrencySafe) {
        concurrent.push(call);
      } else {
        sequential.push(call);
      }
    }

    return { concurrent, sequential };
  }

  private emitEvent(
    type: ExecutionEventType,
    call: ToolCall,
    progress?: ExecutionProgress,
    result?: ToolResult,
    error?: QiError
  ): void {
    const event: ExecutionEvent = {
      type,
      callId: call.callId,
      toolName: call.toolName,
      timestamp: Date.now(),
      data: result || progress,
      error,
    };

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn('Event listener error', { error });
      }
    }
  }
}
