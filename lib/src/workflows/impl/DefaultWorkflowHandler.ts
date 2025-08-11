/**
 * Default implementation of IWorkflowHandler
 *
 * Provides simple user-friendly API while using IWorkflowManager
 * for internal qicore complexity
 */

import { match } from '@qi/base';
import type {
  IWorkflowHandler,
  ToolInfo,
  WorkflowInfo,
  WorkflowOptions,
  WorkflowResponse,
} from '../interfaces/IWorkflowHandler.js';
import type { IWorkflowManager, WorkflowInput } from '../interfaces/IWorkflowManager.js';
import { SimpleWorkflowClass } from '../SimpleWorkflow.js';

export class DefaultWorkflowHandler implements IWorkflowHandler {
  private manager: IWorkflowManager;
  private initialized = false;

  constructor(manager: IWorkflowManager) {
    this.manager = manager;
  }

  /**
   * Initialize the handler with tools and workflows
   */
  async initialize(): Promise<WorkflowResponse> {
    const initResult = await this.manager.initializeTools({
      enableFileContentResolver: true,
      enableProjectStructureScanner: true,
      enableFileReferenceParser: true,
      enableSessionManager: true,
    });

    return match(
      (): WorkflowResponse => {
        this.initialized = true;
        return { success: true, data: 'Workflow handler initialized successfully' };
      },
      (error): WorkflowResponse => ({ success: false, error: error.message }),
      initResult
    );
  }

  /**
   * Execute a workflow with the specified input
   */
  async executeWorkflow(input: string, options: WorkflowOptions = {}): Promise<WorkflowResponse> {
    if (!this.initialized) {
      return { success: false, error: 'Handler not initialized. Call initialize() first.' };
    }

    // Determine workflow type from options or detect from input
    const workflowType = this.determineWorkflowType(input, options.type);

    const workflowInput: WorkflowInput = {
      type: workflowType,
      content: input,
      context: options.context || {},
    };

    const result = await this.manager.executeWorkflow(workflowInput);

    return match(
      (workflowResult): WorkflowResponse => ({
        success: true,
        data: {
          output: workflowResult.output,
          metadata: Object.fromEntries(workflowResult.metadata),
          filesReferenced: workflowResult.filesReferenced,
          contextUsed: workflowResult.contextUsed,
        },
      }),
      (error): WorkflowResponse => ({ success: false, error: error.message }),
      result
    );
  }

  /**
   * Get list of available workflows
   */
  async getAvailableWorkflows(): Promise<WorkflowInfo[]> {
    if (!this.initialized) {
      return [];
    }

    const workflowInfoResult = this.manager.getWorkflowInfo();

    return match(
      (workflowInfos) => {
        return workflowInfos.map((info) => ({
          id: info.id,
          name: info.name,
          description: info.description,
          available: info.initialized,
        }));
      },
      () => [], // Return empty array on error
      workflowInfoResult
    );
  }

  /**
   * Get list of available tools (for /tools command)
   */
  async getAvailableTools(): Promise<ToolInfo[]> {
    if (!this.initialized) {
      return [];
    }

    const toolInfoResult = this.manager.getToolInfo();

    return match(
      (toolInfos) => {
        return toolInfos.map((tool) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          available: tool.initialized,
          category: tool.category,
        }));
      },
      () => [], // Return empty array on error
      toolInfoResult
    );
  }

  /**
   * Check if a specific workflow type is available
   */
  async isWorkflowAvailable(workflowType: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    const workflowClass = this.mapWorkflowTypeToClass(workflowType);
    const availabilityResult = this.manager.isWorkflowAvailable(workflowClass);

    return match(
      (available) => available,
      () => false, // Return false on error
      availabilityResult
    );
  }

  /**
   * Get workflow execution statistics
   */
  async getStats(): Promise<{ totalExecutions: number; successRate: number; averageTime: number }> {
    if (!this.initialized) {
      return { totalExecutions: 0, successRate: 0, averageTime: 0 };
    }

    const statsResult = this.manager.getStats();

    return match(
      (stats) => ({
        totalExecutions: stats.totalExecutions,
        successRate:
          stats.totalExecutions > 0 ? stats.successfulExecutions / stats.totalExecutions : 0,
        averageTime: stats.averageExecutionTime,
      }),
      () => ({ totalExecutions: 0, successRate: 0, averageTime: 0 }),
      statsResult
    );
  }

  // Private helper methods

  private determineWorkflowType(input: string, explicitType?: string): SimpleWorkflowClass {
    if (explicitType) {
      return this.mapWorkflowTypeToClass(explicitType);
    }

    // Auto-detect workflow type based on input patterns
    if (input.includes('@') && (input.includes('.') || input.includes('/'))) {
      return SimpleWorkflowClass.FILE_REFERENCE;
    }

    // Default workflow type
    return SimpleWorkflowClass.FILE_REFERENCE;
  }

  private mapWorkflowTypeToClass(workflowType: string): SimpleWorkflowClass {
    const mapping: Record<string, SimpleWorkflowClass> = {
      FILE_REFERENCE: SimpleWorkflowClass.FILE_REFERENCE,
      file_reference: SimpleWorkflowClass.FILE_REFERENCE,
      file: SimpleWorkflowClass.FILE_REFERENCE,
    };

    return mapping[workflowType] || SimpleWorkflowClass.FILE_REFERENCE;
  }
}
