/**
 * qi-v2-agent Library - Main Entry Point
 *
 * This is the main entry point for the qi-v2-agent library.
 * It exports all public APIs and abstractions with explicit re-exports to avoid conflicts.
 */

// Core Agent Framework
export * from './agent/index.js';

// Input Classification System
export {
  ClassificationConfig,
  ClassificationMethod,
  ClassificationOptions,
  ClassificationResult,
  ClassificationStats,
  ClassificationType,
  createBasicClassifier,
  createClassifier,
  createCompleteClassifier,
  createEnsembleClassifier,
  createHybridClassifier,
  createLLMClassifier,
  createMultiMethodClassifier,
  createRuleBasedClassifier,
  IClassificationMethod,
  IClassifier,
  ProcessingContext as ClassificationProcessingContext,
} from './classifier/index.js';

// Command Processing
export * from './command/index.js';

// Context Management
export {
  AgentSpecialization,
  AppContext,
  ContextAccessAudit,
  ContextManager,
  ContextMessage,
  ConversationContext,
  createContextManager,
  createDefaultAppContext,
  IContextManager,
  IsolatedContext,
  IsolatedContextConfig,
  SecurityBoundaryManager,
  SecurityRestrictions,
} from './context/index.js';

// LLM Integration
export * from './llm/index.js';

// Prompt Processing
export * from './prompt/index.js';

// State Management
export {
  createStateManager as createStateManagerFactory,
  IStateManager as StateManagerInterface,
} from './state/index.js';

// Workflow Processing
export {
  ExecutableWorkflow,
  IWorkflowEngine,
  IWorkflowEngineConfig,
  IWorkflowExtractor,
  IWorkflowExtractorConfig,
  ProcessingContext as WorkflowProcessingContext,
  ToolResult,
  WorkflowCondition,
  WorkflowConditionSpec,
  WorkflowCustomization,
  WorkflowEdge,
  WorkflowEdgeSpec,
  WorkflowError,
  WorkflowExtractionResult,
  WorkflowMetadata,
  WorkflowMode,
  WorkflowNode,
  WorkflowNodeHandler,
  WorkflowNodeSpec,
  WorkflowPerformance,
  WorkflowResult,
  WorkflowSpec,
  WorkflowState,
  WorkflowStreamChunk,
} from './workflow/index.js';
