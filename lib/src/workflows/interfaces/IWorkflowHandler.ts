/**
 * @qi/workflows - User-facing interface for workflow handling
 *
 * Provides a simple, user-friendly API for workflow execution
 * without exposing qicore complexity
 */

export interface WorkflowOptions {
  type?: string;
  context?: Record<string, unknown>;
  timeout?: number;
}

export interface WorkflowData {
  output: string;
  metadata?: Record<string, unknown>;
  filesReferenced?: readonly string[];
  contextUsed?: readonly string[];
}

export type WorkflowResponse =
  | { success: true; data: WorkflowData }
  | { success: false; error: string };

export interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
  available: boolean;
}

export interface ToolInfo {
  id: string;
  name: string;
  description: string;
  available: boolean;
  category: string;
}

/**
 * User-facing workflow handler interface
 * Simple promise-based API, no qicore Result<T> patterns exposed
 */
export interface IWorkflowHandler {
  /**
   * Initialize the handler with tools and workflows
   */
  initialize(): Promise<WorkflowResponse>;

  /**
   * Execute a workflow with the specified input
   */
  executeWorkflow(input: string, options?: WorkflowOptions): Promise<WorkflowResponse>;

  /**
   * Get list of available workflows
   */
  getAvailableWorkflows(): Promise<WorkflowInfo[]>;

  /**
   * Get list of available tools (for /tools command)
   */
  getAvailableTools(): Promise<ToolInfo[]>;

  /**
   * Check if a specific workflow type is available
   */
  isWorkflowAvailable(workflowType: string): Promise<boolean>;

  /**
   * Get workflow execution statistics
   */
  getStats(): Promise<{ totalExecutions: number; successRate: number; averageTime: number }>;
}
