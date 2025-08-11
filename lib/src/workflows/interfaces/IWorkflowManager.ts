/**
 * @qi/workflows - Internal workflow manager interface
 *
 * Handles qicore complexity, tool management, and workflow orchestration
 * Uses proper qicore Result<T> patterns internally
 */

import type { QiError, Result } from '@qi/base';
import type { SimpleWorkflowClass, WorkflowResult } from '../SimpleWorkflow.js';

export interface WorkflowInput {
  type: SimpleWorkflowClass;
  content: string;
  context?: Record<string, unknown>;
  sessionId?: string;
  projectPath?: string;
}

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  initialized: boolean;
  stats: {
    totalUses: number;
    successCount: number;
    avgExecutionTime: number;
  };
}

export interface WorkflowInfo {
  id: SimpleWorkflowClass;
  name: string;
  description: string;
  initialized: boolean;
  stats: {
    totalExecutions: number;
    successCount: number;
    avgExecutionTime: number;
  };
}

export interface WorkflowManagerStats {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageExecutionTime: number;
  readonly workflowCounts: ReadonlyMap<SimpleWorkflowClass, number>;
  readonly toolCounts: ReadonlyMap<string, number>;
}

export interface ToolInitializationConfig {
  enableFileContentResolver: boolean;
  enableProjectStructureScanner: boolean;
  enableFileReferenceParser: boolean;
  enableSessionManager: boolean;
  sessionConfig?: {
    maxSessions: number;
    sessionTimeout: number;
  };
  scannerConfig?: {
    maxDepth: number;
    excludePatterns: string[];
  };
}

/**
 * Internal workflow manager interface
 * Uses qicore Result<T> patterns for professional error handling
 */
export interface IWorkflowManager {
  /**
   * Initialize all tools and workflows with configuration
   */
  initializeTools(config?: ToolInitializationConfig): Promise<Result<void, QiError>>;

  /**
   * Execute a workflow with the given input
   */
  executeWorkflow(input: WorkflowInput): Promise<Result<WorkflowResult, QiError>>;

  /**
   * Get information about all registered workflows
   */
  getWorkflowInfo(): Result<WorkflowInfo[], QiError>;

  /**
   * Get information about all available tools
   */
  getToolInfo(): Result<ToolInfo[], QiError>;

  /**
   * Check if a specific workflow type is available
   */
  isWorkflowAvailable(workflowClass: SimpleWorkflowClass): Result<boolean, QiError>;

  /**
   * Get detailed execution statistics
   */
  getStats(): Result<WorkflowManagerStats, QiError>;

  /**
   * Register a new workflow (internal use)
   */
  registerWorkflow(workflow: import('../SimpleWorkflow.js').SimpleWorkflow): Result<void, QiError>;

  /**
   * Clean up resources and shutdown
   */
  shutdown(): Promise<Result<void, QiError>>;
}
