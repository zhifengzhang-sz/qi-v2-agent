/**
 * @qi/workflow - Workflow interfaces export
 */

// Research patterns are implemented in ../patterns/ directory
// Strategy system removed in favor of direct pattern usage
export type {
  ProcessingContext,
  ToolResult,
  WorkflowConditionSpec,
  WorkflowContext,
  WorkflowEdgeSpec,
  WorkflowError,
  WorkflowExtractionResult,
  WorkflowMetadata,
  WorkflowMode,
  WorkflowNodeSpec,
  WorkflowPerformance,
  WorkflowResult,
  WorkflowSpec,
  WorkflowState,
  WorkflowStreamChunk,
  WorkflowToolResult,
} from './IWorkflow.js';
export type {
  ExecutableWorkflow,
  IWorkflowEngine,
  IWorkflowEngineConfig,
  WorkflowCondition,
  WorkflowCustomization,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeHandler,
} from './IWorkflowEngine.js';
export type {
  IWorkflowExtractor,
  IWorkflowExtractorConfig,
  WorkflowExtractionMethod,
} from './IWorkflowExtractor.js';
export type {
  IWorkflowHandler,
  PatternConfig,
  PatternExecutionResult,
  WorkflowConfig,
  WorkflowExecutionResult,
} from './IWorkflowHandler.js';
export type {
  InternalPatternResult,
  IWorkflowManager,
  WorkflowExecutionContext,
} from './IWorkflowManager.js';
