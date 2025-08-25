/**
 * Specialized Context Schemas
 *
 * Defines specialized context types for conversation, task, workflow,
 * and distributed contexts with their specific content structures.
 */

import { z } from 'zod';
import {
  AgentIdSchema,
  ContextIdSchema,
  createValidator,
  FilePathSchema,
  JSONObjectSchema,
  NonEmptyStringSchema,
  type TaskStatus,
  TaskStatusSchema,
  TimestampSchema,
  UUIDSchema,
} from './base.js';
import { type Context, ContextSchema } from './context.js';

// =============================================================================
// Conversation Context Schema
// =============================================================================

/**
 * Conversation turn schema - represents a single message in a conversation
 */
export const ConversationTurnSchema = z.object({
  id: UUIDSchema,
  role: z.enum(['user', 'assistant', 'system']),
  content: NonEmptyStringSchema,
  timestamp: TimestampSchema.default(() => new Date()),
  metadata: z
    .object({
      tokenCount: z.number().int().nonnegative().optional(),
      model: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      cost: z.number().nonnegative().optional(),
      processingTime: z.number().nonnegative().optional(),
      contextUsed: z.array(ContextIdSchema).default([]),
    })
    .optional(),
});

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

/**
 * Conversation context content schema
 */
export const ConversationContentSchema = z.object({
  turns: z.array(ConversationTurnSchema),
  summary: z.string().optional(),
  topics: z.array(NonEmptyStringSchema).default([]),
  language: z.string().default('en'),
  participants: z.array(AgentIdSchema).default([]),

  // Conversation metadata
  sessionId: z.string().optional(),
  startedAt: TimestampSchema.default(() => new Date()),
  lastActivityAt: TimestampSchema.default(() => new Date()),

  // Analysis metadata
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  complexity: z.number().min(0).max(10).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
});

export type ConversationContent = z.infer<typeof ConversationContentSchema>;

/**
 * Complete conversation context schema
 */
export const ConversationContextSchema = ContextSchema.extend({
  type: z.literal('conversation'),
  content: ConversationContentSchema,
});

export type ConversationContext = z.infer<typeof ConversationContextSchema>;

// =============================================================================
// Task Context Schema
// =============================================================================

/**
 * Task milestone schema
 */
export const TaskMilestoneSchema = z.object({
  id: UUIDSchema,
  title: NonEmptyStringSchema,
  description: z.string().optional(),
  completed: z.boolean().default(false),
  completedAt: TimestampSchema.optional(),
  dueDate: TimestampSchema.optional(),
  priority: z.number().int().min(0).max(10).default(5),
});

export type TaskMilestone = z.infer<typeof TaskMilestoneSchema>;

/**
 * Task blocker schema
 */
export const TaskBlockerSchema = z.object({
  id: UUIDSchema,
  description: NonEmptyStringSchema,
  type: z.enum(['dependency', 'resource', 'approval', 'technical', 'external']),
  resolved: z.boolean().default(false),
  resolvedAt: TimestampSchema.optional(),
  resolvedBy: AgentIdSchema.optional(),
  createdAt: TimestampSchema.default(() => new Date()),
});

export type TaskBlocker = z.infer<typeof TaskBlockerSchema>;

/**
 * Task artifact schema
 */
export const TaskArtifactSchema = z.object({
  id: UUIDSchema,
  name: NonEmptyStringSchema,
  type: z.enum(['file', 'url', 'data', 'report', 'output']),
  location: FilePathSchema,
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
  createdAt: TimestampSchema.default(() => new Date()),
});

export type TaskArtifact = z.infer<typeof TaskArtifactSchema>;

/**
 * Task context content schema
 */
export const TaskContentSchema = z.object({
  title: NonEmptyStringSchema,
  description: z.string().default(''),
  status: TaskStatusSchema.default('pending'),

  // Task hierarchy
  parentTaskId: ContextIdSchema.optional(),
  subtaskIds: z.array(ContextIdSchema).default([]),

  // Execution details
  assignedTo: AgentIdSchema.optional(),
  estimatedDuration: z.number().int().positive().optional(), // minutes
  actualDuration: z.number().int().nonnegative().optional(), // minutes
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  dueDate: TimestampSchema.optional(),

  // Progress tracking
  completionPercentage: z.number().min(0).max(100).default(0),
  milestones: z.array(TaskMilestoneSchema).default([]),

  // Dependencies and blockers
  dependencies: z.array(ContextIdSchema).default([]),
  blockers: z.array(TaskBlockerSchema).default([]),

  // Execution context
  parameters: JSONObjectSchema.optional(),
  environment: JSONObjectSchema.optional(),

  // Outputs and results
  results: JSONObjectSchema.optional(),
  artifacts: z.array(TaskArtifactSchema).default([]),

  // Quality metrics
  successCriteria: z.array(NonEmptyStringSchema).default([]),
  qualityGates: z
    .array(
      z.object({
        name: NonEmptyStringSchema,
        condition: NonEmptyStringSchema,
        passed: z.boolean().optional(),
        checkedAt: TimestampSchema.optional(),
      })
    )
    .default([]),
});

export type TaskContent = z.infer<typeof TaskContentSchema>;

/**
 * Complete task context schema
 */
export const TaskContextSchema = ContextSchema.extend({
  type: z.literal('task'),
  content: TaskContentSchema,
});

export type TaskContext = z.infer<typeof TaskContextSchema>;

// =============================================================================
// Workflow Context Schema
// =============================================================================

/**
 * Workflow step schema
 */
export const WorkflowStepSchema = z.object({
  id: UUIDSchema,
  name: NonEmptyStringSchema,
  type: z.enum(['action', 'decision', 'parallel', 'loop', 'condition', 'human-in-loop']),
  status: TaskStatusSchema.default('pending'),

  // Step configuration
  config: JSONObjectSchema.optional(),
  inputs: JSONObjectSchema.optional(),
  outputs: JSONObjectSchema.optional(),

  // Execution details
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  duration: z.number().int().nonnegative().optional(), // milliseconds
  assignedTo: AgentIdSchema.optional(),

  // Flow control
  nextSteps: z.array(UUIDSchema).default([]),
  conditions: z
    .array(
      z.object({
        condition: NonEmptyStringSchema,
        nextStep: UUIDSchema,
        description: z.string().optional(),
      })
    )
    .default([]),

  // Error handling
  onError: z.enum(['retry', 'skip', 'fail', 'rollback']).default('fail'),
  maxRetries: z.number().int().nonnegative().default(0),
  retryCount: z.number().int().nonnegative().default(0),
  retryDelay: z.number().int().nonnegative().default(1000), // milliseconds

  // Parallel execution
  parallelBranches: z
    .array(
      z.object({
        branchId: UUIDSchema,
        steps: z.array(UUIDSchema),
        joinCondition: z.enum(['all', 'any', 'first']).default('all'),
      })
    )
    .default([]),

  // Loop configuration
  loopCondition: z.string().optional(),
  loopCounter: z.number().int().nonnegative().default(0),
  maxIterations: z.number().int().positive().optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * Workflow execution history schema
 */
export const WorkflowExecutionHistorySchema = z.object({
  stepId: UUIDSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
  status: TaskStatusSchema,
  executionTime: z.number().int().nonnegative().optional(),
  inputs: JSONObjectSchema.optional(),
  outputs: JSONObjectSchema.optional(),
  error: z.string().optional(),
  retryCount: z.number().int().nonnegative().default(0),
});

export type WorkflowExecutionHistory = z.infer<typeof WorkflowExecutionHistorySchema>;

/**
 * Workflow context content schema
 */
export const WorkflowContentSchema = z.object({
  name: NonEmptyStringSchema,
  description: z.string().default(''),
  version: z.string().default('1.0'),

  // Workflow definition
  steps: z.array(WorkflowStepSchema),
  startStep: UUIDSchema,
  endSteps: z.array(UUIDSchema).default([]),

  // Execution state
  currentStep: UUIDSchema.optional(),
  executionHistory: z.array(WorkflowExecutionHistorySchema).default([]),

  // Workflow metadata
  pattern: z.enum(['sequential', 'parallel', 'react', 'rewoo', 'adapt']).optional(),
  priority: z.number().int().min(0).max(10).default(5),
  timeout: z.number().int().positive().optional(), // milliseconds

  // Input/Output schema
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),

  // Actual input/output values
  inputs: JSONObjectSchema.optional(),
  outputs: JSONObjectSchema.optional(),

  // State management
  variables: JSONObjectSchema.default({}),
  context: JSONObjectSchema.default({}),

  // Monitoring
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  executionTime: z.number().int().nonnegative().optional(),

  // Workflow triggers and scheduling
  triggers: z
    .array(
      z.object({
        type: z.enum(['manual', 'scheduled', 'event', 'webhook']),
        config: JSONObjectSchema.optional(),
        enabled: z.boolean().default(true),
      })
    )
    .default([]),

  // Resource requirements
  resources: z
    .object({
      cpu: z.number().positive().optional(),
      memory: z.string().optional(), // e.g., "512MB"
      storage: z.string().optional(), // e.g., "1GB"
      timeout: z.number().int().positive().optional(), // milliseconds
    })
    .optional(),
});

export type WorkflowContent = z.infer<typeof WorkflowContentSchema>;

/**
 * Complete workflow context schema
 */
export const WorkflowContextSchema = ContextSchema.extend({
  type: z.literal('workflow'),
  content: WorkflowContentSchema,
});

export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;

// =============================================================================
// Distributed Context Schema
// =============================================================================

/**
 * Context conflict schema for distributed synchronization
 */
export const ContextConflictSchema = z.object({
  field: NonEmptyStringSchema,
  localValue: z.unknown(),
  remoteValue: z.unknown(),
  resolvedValue: z.unknown().optional(),
  resolvedBy: AgentIdSchema.optional(),
  resolvedAt: TimestampSchema.optional(),
  resolution: z.enum(['manual', 'automatic', 'latest-wins', 'merge']).optional(),
});

export type ContextConflict = z.infer<typeof ContextConflictSchema>;

/**
 * Distributed context content schema
 */
export const DistributedContentSchema = z.object({
  // Distribution metadata
  originAgent: AgentIdSchema,
  sharedWith: z.array(AgentIdSchema).default([]),
  replicationLevel: z.enum(['none', 'eventual', 'strong']).default('eventual'),

  // Synchronization
  syncVersion: z.number().int().nonnegative().default(0),
  lastSync: TimestampSchema.optional(),
  syncStatus: z.enum(['synced', 'pending', 'conflict', 'error']).default('synced'),

  // Conflict resolution
  conflicts: z.array(ContextConflictSchema).default([]),

  // Distribution strategy
  strategy: z.enum(['broadcast', 'gossip', 'leader-follower', 'consensus']).default('broadcast'),

  // Access control per agent
  agentPermissions: z.record(z.array(z.enum(['read', 'write', 'delete', 'share']))).default({}),

  // Distribution settings
  distributionSettings: z
    .object({
      autoSync: z.boolean().default(true),
      syncInterval: z.number().int().positive().default(30000), // milliseconds
      conflictResolution: z.enum(['manual', 'latest-wins', 'merge']).default('manual'),
      encryptInTransit: z.boolean().default(false),
      compressionEnabled: z.boolean().default(true),
    })
    .optional(),

  // Network topology
  topology: z
    .object({
      nodes: z
        .array(
          z.object({
            agentId: AgentIdSchema,
            address: z.string(),
            status: z.enum(['online', 'offline', 'unreachable']),
            lastSeen: TimestampSchema.optional(),
          })
        )
        .default([]),
      connections: z
        .array(
          z.object({
            from: AgentIdSchema,
            to: AgentIdSchema,
            latency: z.number().nonnegative().optional(),
            bandwidth: z.number().nonnegative().optional(),
          })
        )
        .default([]),
    })
    .optional(),

  // Payload - the actual distributed content
  distributedContent: JSONObjectSchema,
});

export type DistributedContent = z.infer<typeof DistributedContentSchema>;

/**
 * Complete distributed context schema
 */
export const DistributedContextSchema = ContextSchema.extend({
  type: z.literal('distributed'),
  content: DistributedContentSchema,
});

export type DistributedContext = z.infer<typeof DistributedContextSchema>;

// =============================================================================
// System and Agent Context Schemas
// =============================================================================

/**
 * System context content schema for system-level information
 */
export const SystemContentSchema = z.object({
  systemName: NonEmptyStringSchema,
  version: z.string(),
  configuration: JSONObjectSchema.default({}),
  status: z.enum(['starting', 'running', 'stopping', 'stopped', 'error']),
  metrics: z
    .object({
      uptime: z.number().nonnegative(),
      memoryUsage: z.number().nonnegative(),
      cpuUsage: z.number().min(0).max(100),
      activeContexts: z.number().int().nonnegative(),
    })
    .optional(),
  capabilities: z.array(NonEmptyStringSchema).default([]),
  lastHealthCheck: TimestampSchema.optional(),
});

export type SystemContent = z.infer<typeof SystemContentSchema>;

/**
 * System context schema
 */
export const SystemContextSchema = ContextSchema.extend({
  type: z.literal('system'),
  content: SystemContentSchema,
});

export type SystemContext = z.infer<typeof SystemContextSchema>;

/**
 * Agent context content schema for agent-specific information
 */
export const AgentContentSchema = z.object({
  agentId: AgentIdSchema,
  agentType: NonEmptyStringSchema,
  capabilities: z.array(NonEmptyStringSchema).default([]),
  status: z.enum(['idle', 'busy', 'error', 'offline']),
  currentTask: ContextIdSchema.optional(),
  preferences: JSONObjectSchema.default({}),
  performance: z
    .object({
      tasksCompleted: z.number().int().nonnegative().default(0),
      averageResponseTime: z.number().nonnegative().optional(),
      successRate: z.number().min(0).max(1).optional(),
      lastActive: TimestampSchema.optional(),
    })
    .optional(),
});

export type AgentContent = z.infer<typeof AgentContentSchema>;

/**
 * Agent context schema
 */
export const AgentContextSchema = ContextSchema.extend({
  type: z.literal('agent'),
  content: AgentContentSchema,
});

export type AgentContext = z.infer<typeof AgentContextSchema>;

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Pre-built validators for specialized schemas
 */
export const validateConversationTurn = createValidator(ConversationTurnSchema);
export const validateConversationContext = createValidator(ConversationContextSchema);
export const validateTaskMilestone = createValidator(TaskMilestoneSchema);
export const validateTaskContext = createValidator(TaskContextSchema);
export const validateWorkflowStep = createValidator(WorkflowStepSchema);
export const validateWorkflowContext = createValidator(WorkflowContextSchema);
export const validateDistributedContext = createValidator(DistributedContextSchema);
export const validateSystemContext = createValidator(SystemContextSchema);
export const validateAgentContext = createValidator(AgentContextSchema);

/**
 * Context type discriminator function
 */
export function getContextValidator(type: string) {
  switch (type) {
    case 'conversation':
      return validateConversationContext;
    case 'task':
      return validateTaskContext;
    case 'workflow':
      return validateWorkflowContext;
    case 'distributed':
      return validateDistributedContext;
    case 'system':
      return validateSystemContext;
    case 'agent':
      return validateAgentContext;
    default:
      return null;
  }
}

/**
 * Create context factory function
 */
export function createSpecializedContext<T extends Context>(
  type: T['type'],
  content: T['content'],
  metadata?: Partial<T['metadata']>
): Omit<T, 'id' | 'metadata'> & { metadata: Partial<T['metadata']> } {
  return {
    type,
    content,
    metadata: metadata || {},
    relationships: [],
    version: 1,
    schemaVersion: '1.0',
  } as any; // Simplified type assertion to resolve conversion issues
}

// =============================================================================
// Type Guard Functions
// =============================================================================

/**
 * Type guard for conversation contexts
 */
export function isConversationContext(context: Context): context is ConversationContext {
  return context.type === 'conversation';
}

/**
 * Type guard for task contexts
 */
export function isTaskContext(context: Context): context is TaskContext {
  return context.type === 'task';
}

/**
 * Type guard for workflow contexts
 */
export function isWorkflowContext(context: Context): context is WorkflowContext {
  return context.type === 'workflow';
}

/**
 * Type guard for distributed contexts
 */
export function isDistributedContext(context: Context): context is DistributedContext {
  return context.type === 'distributed';
}

/**
 * Type guard for system contexts
 */
export function isSystemContext(context: Context): context is SystemContext {
  return context.type === 'system';
}

/**
 * Type guard for agent contexts
 */
export function isAgentContext(context: Context): context is AgentContext {
  return context.type === 'agent';
}
