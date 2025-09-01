/**
 * @qi/workflow - Workflow Manager Interface (Internal QiCore Layer)
 *
 * Internal interface that uses QiCore Result<T> patterns professionally.
 * This implements the internal layer of the two-layer architecture pattern.
 */

import type { QiError, Result } from '@qi/base';
import type { WorkflowResult, WorkflowStreamChunk, WorkflowToolResult } from './IWorkflow.js';

/**
 * Internal workflow execution context
 */
export interface WorkflowExecutionContext {
  sessionId: string;
  userId?: string;
  domain: string;
  metadata?: ReadonlyMap<string, unknown>;
  timeout?: number;
  enableStreaming?: boolean;
  enableMetrics?: boolean;
}

/**
 * Internal pattern execution result with QiCore types
 */
export interface InternalPatternResult {
  output: string;
  executionTime: number;
  toolResults: WorkflowToolResult[];
  metadata: ReadonlyMap<string, unknown>;
  performance: ReadonlyMap<string, number>;
}

/**
 * Internal workflow manager interface (QiCore Layer)
 *
 * This interface uses QiCore Result<T> patterns throughout and handles all
 * complex workflow orchestration logic. It's used internally by the interface layer.
 */
export interface IWorkflowManager {
  /**
   * Execute workflow with full QiCore error handling
   */
  executeWorkflow(
    pattern: string,
    input: string,
    context: WorkflowExecutionContext
  ): Promise<Result<WorkflowResult, QiError>>;

  /**
   * Execute ReAct pattern with QiCore patterns
   */
  executeReActPattern(
    input: string,
    context: WorkflowExecutionContext,
    maxSteps?: number
  ): Promise<Result<InternalPatternResult, QiError>>;

  /**
   * Execute ReWOO pattern with QiCore patterns
   */
  executeReWOOPattern(
    input: string,
    context: WorkflowExecutionContext
  ): Promise<Result<InternalPatternResult, QiError>>;

  /**
   * Execute ADaPT pattern with QiCore patterns
   */
  executeADaPTPattern(
    input: string,
    context: WorkflowExecutionContext
  ): Promise<Result<InternalPatternResult, QiError>>;

  /**
   * Stream workflow execution with QiCore error handling
   */
  streamWorkflow(
    pattern: string,
    input: string,
    context: WorkflowExecutionContext
  ): AsyncIterable<Result<WorkflowStreamChunk, QiError>>;

  /**
   * Get available patterns with QiCore error handling
   */
  getAvailablePatterns(): Result<readonly string[], QiError>;

  /**
   * Check pattern availability with QiCore error handling
   */
  isPatternAvailable(pattern: string): Result<boolean, QiError>;

  /**
   * Initialize the manager with QiCore patterns
   */
  initialize(): Promise<Result<void, QiError>>;

  /**
   * Cleanup resources with QiCore patterns
   */
  cleanup(): Promise<Result<void, QiError>>;
}
