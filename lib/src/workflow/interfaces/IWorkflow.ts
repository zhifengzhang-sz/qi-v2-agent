/**
 * @qi/workflow - Core workflow interfaces
 *
 * Technology-agnostic workflow interfaces following the app architecture pattern
 */

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
  readonly type:
    | 'input'
    | 'processing'
    | 'tool'
    | 'reasoning'
    | 'output'
    | 'decision'
    | 'validation';
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
 * Complete workflow specification
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
 * Workflow state metadata
 */
export interface WorkflowMetadata {
  readonly startTime: number;
  readonly currentStage?: string;
  readonly processingSteps: readonly string[];
  readonly performance: ReadonlyMap<string, number>;
}

/**
 * Workflow execution state
 */
export interface WorkflowState {
  readonly input: string;
  readonly pattern: string; // Simplified from CognitivePattern
  readonly domain: string;
  readonly context: ReadonlyMap<string, unknown>;
  readonly toolResults: readonly ToolResult[];
  readonly reasoningOutput: string;
  readonly output: string;
  readonly metadata: WorkflowMetadata;
}

/**
 * Tool execution result (simplified)
 */
export interface ToolResult {
  readonly toolName: string;
  readonly status: 'success' | 'error' | 'timeout' | 'cancelled';
  readonly data: unknown;
  readonly executionTime: number;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Workflow extraction result
 */
export interface WorkflowExtractionResult {
  readonly success: boolean;
  readonly mode: string;
  readonly pattern: string;
  readonly workflowSpec?: WorkflowSpec;
  readonly confidence: number;
  readonly extractionMethod: 'strategy-based' | 'template-based' | 'llm-based' | 'hybrid';
  readonly error?: string;
  readonly metadata: ReadonlyMap<string, unknown>;
}

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
 * Workflow stream chunk for real-time updates
 */
export interface WorkflowStreamChunk {
  readonly nodeId: string;
  readonly state: WorkflowState;
  readonly isComplete: boolean;
  readonly error?: WorkflowError;
}

/**
 * Workflow error information
 */
export interface WorkflowError {
  readonly nodeId: string;
  readonly error: Error;
  readonly retryable: boolean;
}

/**
 * Processing context for workflow operations
 */
export interface ProcessingContext {
  readonly sessionId: string;
  readonly currentInputType?: 'command' | 'prompt' | 'workflow';
  readonly environmentContext?: ReadonlyMap<string, unknown>;
}
