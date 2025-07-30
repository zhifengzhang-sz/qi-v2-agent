// Workflow Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { ProcessingContext, CognitivePattern } from './cognitive-patterns.js';
import type { ToolResult } from './tools.js';

/**
 * Workflow mode definition
 */
export interface WorkflowMode {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly keywords: readonly string[];
  readonly commonNodes: readonly string[];
  readonly requiredTools: readonly string[];
}

/**
 * Workflow condition specification
 */
export interface WorkflowConditionSpec {
  readonly type: 'always' | 'success' | 'error' | 'custom';
  readonly expression?: string;
  readonly parameters?: ReadonlyMap<string, unknown>;
}

/**
 * Workflow node specification
 */
export interface WorkflowNodeSpec {
  readonly id: string;
  readonly name: string;
  readonly type: 'input' | 'processing' | 'tool' | 'reasoning' | 'output' | 'decision' | 'validation';
  readonly parameters: ReadonlyMap<string, unknown>;
  readonly requiredTools?: readonly string[];
  readonly conditions?: readonly WorkflowConditionSpec[];
  readonly dependencies?: readonly string[];
}

/**
 * Workflow edge specification
 */
export interface WorkflowEdgeSpec {
  readonly from: string;
  readonly to: string;
  readonly condition?: WorkflowConditionSpec;
  readonly priority?: number;
}

/**
 * Workflow specification
 */
export interface WorkflowSpec {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly nodes: readonly WorkflowNodeSpec[];
  readonly edges: readonly WorkflowEdgeSpec[];
  readonly parameters: ReadonlyMap<string, unknown>;
  readonly steps: readonly WorkflowNodeSpec[];
}

/**
 * Workflow extraction result
 */
export interface WorkflowExtractionResult {
  readonly success: boolean;
  readonly mode: string;
  readonly pattern: CognitivePattern;
  readonly workflowSpec?: WorkflowSpec;
  readonly confidence: number;
  readonly extractionMethod: 'template-based' | 'llm-based' | 'hybrid';
  readonly error?: string;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Abstract workflow extractor interface
 */
export interface IWorkflowExtractor {
  extractWorkflow(input: string, context?: ProcessingContext): Promise<WorkflowExtractionResult>;
  getSupportedModes(): readonly WorkflowMode[];
  validateWorkflowSpec(spec: WorkflowSpec): Promise<boolean>;
  getWorkflowTemplates(mode: string): Promise<readonly WorkflowSpec[]>;
}

/**
 * Workflow state (technology-agnostic)
 */
export interface WorkflowState {
  readonly input: string;
  readonly pattern: CognitivePattern;
  readonly domain: string;
  readonly context: ReadonlyMap<string, unknown>;
  readonly toolResults: readonly ToolResult[];
  readonly reasoningOutput: string;
  readonly output: string;
  readonly metadata: WorkflowMetadata;
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  readonly startTime: number;
  readonly currentStage?: string;
  readonly processingSteps: readonly string[];
  readonly performance: ReadonlyMap<string, number>;
}

/**
 * Executable workflow definition
 */
export interface ExecutableWorkflow {
  readonly id: string;
  readonly pattern: CognitivePattern;
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
 * Workflow execution result
 */
export interface WorkflowResult {
  readonly finalState: WorkflowState;
  readonly executionPath: readonly string[];
  readonly performance: WorkflowPerformance;
}

/**
 * Workflow performance metrics
 */
export interface WorkflowPerformance {
  readonly totalTime: number;
  readonly nodeExecutionTimes: ReadonlyMap<string, number>;
  readonly toolExecutionTime: number;
  readonly reasoningTime: number;
}

/**
 * Workflow customization
 */
export interface WorkflowCustomization {
  readonly type: 'add-node' | 'add-edge' | 'conditional-edge' | 'modify-node';
  readonly nodeId?: string;
  readonly edgeDefinition?: WorkflowEdge;
  readonly nodeDefinition?: WorkflowNode;
  readonly condition?: WorkflowCondition;
}

/**
 * Workflow stream chunk
 */
export interface WorkflowStreamChunk {
  readonly nodeId: string;
  readonly state: WorkflowState;
  readonly isComplete: boolean;
  readonly error?: WorkflowError;
}

/**
 * Workflow error
 */
export interface WorkflowError {
  readonly nodeId: string;
  readonly error: Error;
  readonly retryable: boolean;
}

/**
 * Abstract workflow engine interface
 */
export interface IWorkflowEngine {
  createWorkflow(pattern: CognitivePattern, customizations?: WorkflowCustomization[]): ExecutableWorkflow;
  execute(workflow: ExecutableWorkflow, initialState: WorkflowState): Promise<WorkflowResult>;
  stream(workflow: ExecutableWorkflow, initialState: WorkflowState): AsyncIterableIterator<WorkflowStreamChunk>;
  precompileWorkflows(patterns: readonly CognitivePattern[]): Promise<void>;
  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null;
}