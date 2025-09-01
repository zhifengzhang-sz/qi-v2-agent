/**
 * qi-v2-agent Library - Main Entry Point
 *
 * This is the main entry point for the qi-v2-agent library.
 * It exports all public APIs and abstractions with explicit re-exports to avoid conflicts.
 */

// Core Agent Framework
export * from './agent/index.js';
export type {
  ClassificationConfig,
  ClassificationMethod,
  ClassificationOptions,
  ClassificationResult,
  ClassificationStats,
  ClassificationType,
  IClassificationMethod,
  IClassifier,
  ProcessingContext as ClassificationProcessingContext,
} from './classifier/index.js';
// Input Classification System
export {
  createAccurateClassifier,
  createBasicClassifier,
  createClassifier,
  createCompleteClassifier,
  createFastClassifier,
  createInputClassifier,
  createRuleBasedClassifier,
  getClassificationSchema,
  // Schema registry exports
  globalSchemaRegistry,
  selectOptimalClassificationSchema,
} from './classifier/index.js';
// Command Processing
export * from './command/index.js';
export type {
  AgentSpecialization,
  AppContext,
  ContextAccessAudit,
  ContextMessage,
  ConversationContext,
  IContextManager,
  IsolatedContext,
  IsolatedContextConfig,
  SecurityRestrictions,
} from './context/index.js';
// Context Management
export {
  ContextManager,
  createContextManager,
  createDefaultAppContext,
  SecurityBoundaryManager,
} from './context/index.js';

// MCP Integration System
export * from './mcp/index.js';

// Model Provider System
export * from './models/index.js';
// Prompt Processing
export * from './prompt/index.js';
// Classification Schemas
export {
  ClassificationSchemas,
  type IntentResult,
  IntentSchema,
  type SchemaKey,
  type SchemaResult,
  type SentimentResult,
  SentimentSchema,
  type ThreeTypeResult,
  ThreeTypeSchema,
  type TopicResult,
  TopicSchema,
} from './schemas/ClassificationSchemas.js';
export type { IStateManager as StateManagerInterface } from './state/index.js';
// State Management
export { createStateManager as createStateManagerFactory } from './state/index.js';

// Workflow Processing
export type {
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
