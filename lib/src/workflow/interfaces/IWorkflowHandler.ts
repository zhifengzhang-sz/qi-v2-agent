/**
 * @qi/workflow - Workflow Handler Interface Layer
 *
 * User-facing interface that hides QiCore complexity with simple Promise-based APIs.
 * This implements the two-layer architecture pattern used throughout qi-v2-agent.
 */

import type { WorkflowToolResult } from './IWorkflow.js';

/**
 * Simple workflow execution result for user-facing interface
 */
export interface WorkflowExecutionResult {
  output: string;
  executionTime: number;
  toolResults: WorkflowToolResult[];
  success: boolean;
  error?: string;
}

/**
 * Research pattern execution result for user-facing interface
 */
export interface PatternExecutionResult {
  output: string;
  executionTime: number;
  toolResults: WorkflowToolResult[];
  metadata: Record<string, unknown>;
  success: boolean;
  error?: string;
}

/**
 * Simple workflow configuration
 */
export interface WorkflowConfig {
  timeout?: number;
  enableStreaming?: boolean;
  enableMetrics?: boolean;
}

/**
 * Research pattern configuration
 */
export interface PatternConfig {
  maxSteps?: number;
  timeout?: number;
  enableStreaming?: boolean;
}

/**
 * User-facing workflow handler interface (Interface Layer)
 *
 * This interface provides simple Promise-based APIs that hide QiCore Result<T> complexity.
 * All methods return simple types and handle errors via Promise rejection.
 */
export interface IWorkflowHandler {
  /**
   * Execute a workflow pattern with simple configuration
   */
  executeWorkflow(
    pattern: string,
    input: string,
    config?: WorkflowConfig
  ): Promise<WorkflowExecutionResult>;

  /**
   * Execute ReAct pattern with simple configuration
   */
  executeReAct(input: string, config?: PatternConfig): Promise<PatternExecutionResult>;

  /**
   * Execute ReWOO pattern with simple configuration
   */
  executeReWOO(input: string, config?: PatternConfig): Promise<PatternExecutionResult>;

  /**
   * Execute ADaPT pattern with simple configuration
   */
  executeADaPT(input: string, config?: PatternConfig): Promise<PatternExecutionResult>;

  /**
   * Stream workflow execution with simple callback interface
   */
  streamWorkflow(
    pattern: string,
    input: string,
    onProgress: (progress: { stage: string; progress: number; output?: string }) => void,
    config?: WorkflowConfig
  ): Promise<WorkflowExecutionResult>;

  /**
   * Get available workflow patterns
   */
  getAvailablePatterns(): Promise<string[]>;

  /**
   * Check if a pattern is available
   */
  isPatternAvailable(pattern: string): Promise<boolean>;
}
