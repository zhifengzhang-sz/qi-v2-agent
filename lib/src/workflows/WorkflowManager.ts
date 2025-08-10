/**
 * Workflow Manager
 * 
 * Manages simple workflows and routes input to appropriate handlers.
 * Maintains bounded complexity and architectural integrity.
 */

import { SimpleWorkflow, SimpleWorkflowClass, type WorkflowInput, type WorkflowResult } from './SimpleWorkflow.js';
import { FileReferenceWorkflow } from './FileReferenceWorkflow.js';
import type { ToolRegistry } from '../tools/index.js';

/**
 * Workflow execution statistics
 */
export interface WorkflowStats {
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly averageExecutionTime: number;
  readonly workflowCounts: ReadonlyMap<SimpleWorkflowClass, number>;
}

/**
 * Workflow Manager for handling simple workflow orchestration
 */
export class WorkflowManager {
  private workflows = new Map<SimpleWorkflowClass, SimpleWorkflow>();
  private stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalExecutionTime: 0,
    workflowCounts: new Map<SimpleWorkflowClass, number>(),
  };

  constructor(private toolRegistry: ToolRegistry) {
    this.registerDefaultWorkflows();
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: SimpleWorkflow): void {
    const workflowClass = workflow.getWorkflowClass();
    
    if (this.workflows.has(workflowClass)) {
      throw new Error(`Workflow for class '${workflowClass}' is already registered`);
    }

    this.workflows.set(workflowClass, workflow);
  }

  /**
   * Check if a workflow class is supported
   */
  canHandle(workflowClass: SimpleWorkflowClass): boolean {
    return this.workflows.has(workflowClass);
  }

  /**
   * Execute a workflow based on classification
   */
  async executeWorkflow(input: WorkflowInput): Promise<WorkflowResult> {
    const startTime = Date.now();
    
    try {
      const workflow = this.workflows.get(input.classification);
      
      if (!workflow) {
        return this.createUnsupportedResult(input.classification);
      }

      if (!workflow.canHandle(input)) {
        return this.createCannotHandleResult(input.classification);
      }

      const result = await workflow.execute(input);
      
      // Update statistics
      this.updateStats(input.classification, true, Date.now() - startTime);
      
      return result;

    } catch (error) {
      // Update statistics for failure
      this.updateStats(input.classification, false, Date.now() - startTime);
      
      return {
        success: false,
        output: '',
        error: `Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: new Map([
          ['error', error instanceof Error ? error.message : 'Unknown error'],
          ['executionTime', Date.now() - startTime],
        ]),
      };
    }
  }

  /**
   * Get list of supported workflow classes
   */
  getSupportedWorkflows(): SimpleWorkflowClass[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Get workflow descriptions
   */
  getWorkflowDescriptions(): Map<SimpleWorkflowClass, string> {
    const descriptions = new Map<SimpleWorkflowClass, string>();
    
    for (const [workflowClass, workflow] of this.workflows) {
      descriptions.set(workflowClass, workflow.getDescription());
    }
    
    return descriptions;
  }

  /**
   * Get workflow execution statistics
   */
  getStats(): WorkflowStats {
    const averageExecutionTime = this.stats.totalExecutions > 0 
      ? this.stats.totalExecutionTime / this.stats.totalExecutions 
      : 0;

    return {
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      failedExecutions: this.stats.failedExecutions,
      averageExecutionTime,
      workflowCounts: new Map(this.stats.workflowCounts),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0,
      workflowCounts: new Map<SimpleWorkflowClass, number>(),
    };
  }

  /**
   * Register default workflows
   */
  private registerDefaultWorkflows(): void {
    // Register FILE_REFERENCE workflow
    const fileReferenceWorkflow = new FileReferenceWorkflow(this.toolRegistry);
    this.registerWorkflow(fileReferenceWorkflow);
  }

  /**
   * Create result for unsupported workflow class
   */
  private createUnsupportedResult(workflowClass: SimpleWorkflowClass): WorkflowResult {
    return {
      success: false,
      output: '',
      error: `Workflow class '${workflowClass}' is not supported`,
      metadata: new Map([
        ['workflowClass', workflowClass],
        ['supportedWorkflows', Array.from(this.workflows.keys())],
      ]),
    };
  }

  /**
   * Create result for workflow that cannot handle the input
   */
  private createCannotHandleResult(workflowClass: SimpleWorkflowClass): WorkflowResult {
    return {
      success: false,
      output: '',
      error: `Workflow '${workflowClass}' cannot handle the provided input`,
      metadata: new Map([
        ['workflowClass', workflowClass],
        ['reason', 'Input validation failed'],
      ]),
    };
  }

  /**
   * Update execution statistics
   */
  private updateStats(
    workflowClass: SimpleWorkflowClass, 
    success: boolean, 
    executionTime: number
  ): void {
    this.stats.totalExecutions++;
    this.stats.totalExecutionTime += executionTime;
    
    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }

    const currentCount = this.stats.workflowCounts.get(workflowClass) || 0;
    this.stats.workflowCounts.set(workflowClass, currentCount + 1);
  }
}