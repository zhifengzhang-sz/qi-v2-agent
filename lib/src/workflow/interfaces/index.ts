/**
 * @qi/workflow - Workflow interfaces export
 */

// Strategy interfaces
export type {
  IDecompositionStrategy,
  IStrategyRegistry,
  StrategyScore,
  TaskAnalysis,
  WorkflowContext,
} from '../strategies/IDecompositionStrategy.js';
export type {
  ProcessingContext,
  ToolResult,
  WorkflowConditionSpec,
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
