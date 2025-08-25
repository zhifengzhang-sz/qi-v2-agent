/**
 * Context Schemas Index
 *
 * Central export point for all context engineering schemas,
 * validation utilities, and registry functionality.
 */

// =============================================================================
// Base Schema Exports
// =============================================================================

export * from './base.js';
export * from './context.js';
export * from './registry.js';
export * from './specialized.js';

// =============================================================================
// Re-export Common Types for Convenience
// =============================================================================

export type {
  AccessOperation,
  BoundaryType,
  CompressionAlgorithm,
  CompressionLevel,
  ContextType,
  MCPServiceType,
  Permission,
  RelationshipType,
  TaskStatus,
} from './base.js';

export type {
  CompressedContext,
  CompressionStats,
  Context,
  ContextCreationRequest,
  ContextFilter,
  ContextMetadata,
  ContextQuery,
  ContextRelationship,
  ContextUpdateRequest,
  StorageLocation,
} from './context.js';
export type {
  SchemaMigration,
  SchemaRegistration,
  SchemaTransformer,
} from './registry.js';
export type {
  AgentContent,
  AgentContext,
  ContextConflict,
  ConversationContent,
  ConversationContext,
  ConversationTurn,
  DistributedContent,
  DistributedContext,
  SystemContent,
  SystemContext,
  TaskArtifact,
  TaskBlocker,
  TaskContent,
  TaskContext,
  TaskMilestone,
  WorkflowContent,
  WorkflowContext,
  WorkflowExecutionHistory,
  WorkflowStep,
} from './specialized.js';

// =============================================================================
// Re-export Common Validators for Convenience
// =============================================================================

export {
  calculateContextChecksum,
  enrichContext,
  validateCompressedContext,
  validateContext,
  validateContextCreationRequest,
  validateContextFilter,
  validateContextMetadata,
  validateContextQuery,
  validateContextRelationship,
  validateContextUpdateRequest,
  validateStorageLocation,
  verifyContextIntegrity,
} from './context.js';
export {
  contextSchemaRegistry,
  createContextValidator,
  registerMigration,
  validateAndMigrateContext,
  validateContextByType,
  validateContextsBatch,
} from './registry.js';
export {
  createSpecializedContext,
  getContextValidator,
  isAgentContext,
  isConversationContext,
  isDistributedContext,
  isSystemContext,
  isTaskContext,
  isWorkflowContext,
  validateAgentContext,
  validateConversationContext,
  validateDistributedContext,
  validateSystemContext,
  validateTaskContext,
  validateWorkflowContext,
} from './specialized.js';

// =============================================================================
// Schema Utilities
// =============================================================================

export {
  composeSchemas,
  conditionalSchema,
  createValidator,
  validateBatch,
  validateWithEnrichment,
} from './base.js';
