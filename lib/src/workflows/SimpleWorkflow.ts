/**
 * Simple Workflow Architecture
 *
 * Bounded workflow classes for qi-prompt extension capabilities.
 * Maintains architectural integrity while adding specific workflow support.
 */

import type { ToolRegistry } from '../tools/index.js';

/**
 * Simple workflow classification types
 */
export enum SimpleWorkflowClass {
  FILE_REFERENCE = 'file-reference',
  // Future extensions:
  // MULTI_FILE = 'multi-file',
  // PROJECT_CONTEXT = 'project-context',
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  readonly success: boolean;
  readonly output: string;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly error?: string;
  readonly filesReferenced?: readonly string[];
  readonly contextUsed?: readonly string[];
}

/**
 * Simple workflow input
 */
export interface WorkflowInput {
  readonly originalInput: string;
  readonly classification: SimpleWorkflowClass;
  readonly sessionId?: string;
  readonly projectPath?: string;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Abstract base class for simple workflows
 */
export abstract class SimpleWorkflow {
  protected toolRegistry: ToolRegistry;
  protected maxComplexity: number;

  constructor(toolRegistry: ToolRegistry, maxComplexity: number = 3) {
    this.toolRegistry = toolRegistry;
    this.maxComplexity = maxComplexity;
  }

  /**
   * Get the workflow class this handles
   */
  abstract getWorkflowClass(): SimpleWorkflowClass;

  /**
   * Get workflow description
   */
  abstract getDescription(): string;

  /**
   * Check if this workflow can handle the input
   */
  abstract canHandle(input: WorkflowInput): boolean;

  /**
   * Execute the workflow with bounded complexity
   */
  abstract execute(input: WorkflowInput): Promise<WorkflowResult>;

  /**
   * Validate workflow complexity (max 3 operations)
   */
  protected validateComplexity(operationCount: number): void {
    if (operationCount > this.maxComplexity) {
      throw new Error(
        `Workflow exceeds complexity limit: ${operationCount} > ${this.maxComplexity}`
      );
    }
  }

  /**
   * Create success result
   */
  protected createSuccessResult(
    output: string,
    metadata?: Map<string, unknown>,
    filesReferenced?: string[],
    contextUsed?: string[]
  ): WorkflowResult {
    return {
      success: true,
      output,
      metadata: metadata || new Map(),
      filesReferenced,
      contextUsed,
    };
  }

  /**
   * Create error result
   */
  protected createErrorResult(error: string, metadata?: Map<string, unknown>): WorkflowResult {
    return {
      success: false,
      output: '',
      error,
      metadata: metadata || new Map(),
    };
  }
}
