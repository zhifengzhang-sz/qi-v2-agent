/**
 * @qi/workflow - Workflow engine interface
 * 
 * Abstract interface for executing workflows
 */

import type {
  WorkflowState,
  WorkflowResult,
  WorkflowStreamChunk
} from './IWorkflow.js';

/**
 * Executable workflow definition
 */
export interface ExecutableWorkflow {
  readonly id: string;
  readonly pattern: string;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}

/**
 * Workflow node definition
 */
export interface WorkflowNode {
  readonly id: string;
  readonly name: string;
  readonly type: 'input' | 'processing' | 'tool' | 'reasoning' | 'output' | 'decision' | 'validation';
  readonly handler: WorkflowNodeHandler;
}

/**
 * Workflow edge definition
 */
export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: WorkflowCondition;
}

/**
 * Workflow node handler function type
 */
export type WorkflowNodeHandler = (state: WorkflowState) => Promise<WorkflowState>;

/**
 * Workflow condition function type
 */
export type WorkflowCondition = (state: WorkflowState) => boolean;

/**
 * Workflow customization options
 */
export interface WorkflowCustomization {
  readonly type: 'add-node' | 'add-edge' | 'conditional-edge' | 'modify-node';
  readonly nodeId?: string;
  readonly edgeDefinition?: WorkflowEdge;
  readonly nodeDefinition?: WorkflowNode;
  readonly condition?: WorkflowCondition;
}

/**
 * Abstract workflow engine interface
 */
export interface IWorkflowEngine {
  /**
   * Create an executable workflow from a pattern
   */
  createWorkflow(pattern: string, customizations?: WorkflowCustomization[]): ExecutableWorkflow;
  
  /**
   * Execute a workflow
   */
  execute(workflow: ExecutableWorkflow, initialState: WorkflowState): Promise<WorkflowResult>;
  
  /**
   * Stream workflow execution for real-time updates
   */
  stream(workflow: ExecutableWorkflow, initialState: WorkflowState): AsyncIterableIterator<WorkflowStreamChunk>;
  
  /**
   * Precompile workflows for performance
   */
  precompileWorkflows(patterns: readonly string[]): Promise<void>;
  
  /**
   * Get a precompiled workflow
   */
  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null;
}

/**
 * Workflow engine configuration
 */
export interface IWorkflowEngineConfig {
  readonly toolProvider?: any; // Will be properly typed when integrated
  readonly enableCheckpointing?: boolean;
  readonly maxExecutionTime?: number;
  readonly enableStreaming?: boolean;
  readonly persistenceStore?: 'memory' | 'file' | 'database';
}