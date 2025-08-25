# Context Engineering Schema Design

**Document Version**: 1.0  
**Date**: 2025-01-25  
**Status**: Design Phase  
**Target**: v-0.11.x Context Engineering Foundation

## Overview

This document defines the complete Zod schema specifications for context engineering in qi-v2-agent. These schemas provide both compile-time TypeScript types and runtime validation, ensuring type safety and data integrity throughout the context engineering system.

## Core Schema Design Principles

### 1. **Single Source of Truth**
Zod schemas define both TypeScript types and runtime validation rules in a single location.

### 2. **Composition Over Inheritance** 
Build complex schemas by composing smaller, reusable schema components.

### 3. **Progressive Enhancement**
Schemas support optional fields that can be added as the system evolves.

### 4. **Validation at Boundaries**
All data entering the system is validated against appropriate schemas.

## Base Schema Components

### **Common Types**

```typescript
import { z } from 'zod';

// UUID validation
export const UUIDSchema = z.string().uuid('Invalid UUID format');

// Timestamp validation
export const TimestampSchema = z.coerce.date();

// Score validation (0.0 to 1.0)
export const ScoreSchema = z.number().min(0).max(1);

// Priority validation (0 to 10)
export const PrioritySchema = z.number().int().min(0).max(10);

// Non-empty string validation
export const NonEmptyStringSchema = z.string().min(1, 'String cannot be empty');

// JSON object validation
export const JSONObjectSchema = z.record(z.unknown());

// Base64 encoded data
export const Base64Schema = z.string().refine(
  (val) => {
    try {
      return btoa(atob(val)) === val;
    } catch {
      return false;
    }
  },
  'Invalid base64 encoding'
);

// File path validation
export const FilePathSchema = z.string().refine(
  (path) => path.length > 0 && !path.includes('../'),
  'Invalid file path'
);

// Agent ID validation
export const AgentIdSchema = z.string().min(1).max(128);

// Context ID validation  
export const ContextIdSchema = UUIDSchema;
```

### **Enumeration Schemas**

```typescript
// Context types
export const ContextTypeSchema = z.enum([
  'conversation',
  'task', 
  'workflow',
  'distributed',
  'system',
  'user',
  'agent'
], {
  errorMap: () => ({ message: 'Invalid context type' })
});

// Compression levels
export const CompressionLevelSchema = z.enum([
  'none',
  'semantic', 
  'lossless',
  'aggressive'
]);

// MCP service types
export const MCPServiceTypeSchema = z.enum([
  'memory',
  'sqlite', 
  'filesystem',
  'custom'
]);

// Relationship types
export const RelationshipTypeSchema = z.enum([
  'parent',
  'child',
  'sibling',
  'reference',
  'depends-on',
  'related-to',
  'derived-from'
]);

// Isolation boundary types
export const BoundaryTypeSchema = z.enum([
  'public',
  'private',
  'shared',
  'encrypted',
  'temporary'
]);

// Compression algorithms
export const CompressionAlgorithmSchema = z.enum([
  'lz4',
  'gzip',
  'brotli',
  'zstd'
]);
```

## Core Context Schema

### **Context Metadata Schema**

```typescript
export const ContextMetadataSchema = z.object({
  // Basic metadata
  priority: PrioritySchema.default(5),
  relevanceScore: ScoreSchema.default(0.0),
  compressionLevel: CompressionLevelSchema.default('none'),
  
  // Timestamps
  createdAt: TimestampSchema.default(() => new Date()),
  lastAccessed: TimestampSchema.default(() => new Date()),
  modifiedAt: TimestampSchema.optional(),
  
  // Lifecycle management
  ttl: z.number().int().positive().optional(),
  expiresAt: TimestampSchema.optional(),
  archived: z.boolean().default(false),
  
  // Storage configuration
  mcpStorage: z.object({
    service: MCPServiceTypeSchema,
    location: NonEmptyStringSchema,
    encrypted: z.boolean().default(false),
    compressionEnabled: z.boolean().default(true),
    backupEnabled: z.boolean().default(true)
  }),
  
  // Access control
  owner: AgentIdSchema.optional(),
  permissions: z.array(z.enum(['read', 'write', 'delete', 'share'])).default(['read']),
  
  // Quality metrics
  qualityScore: ScoreSchema.optional(),
  completenessScore: ScoreSchema.optional(),
  accuracyScore: ScoreSchema.optional(),
  
  // Performance metadata
  accessCount: z.number().int().nonnegative().default(0),
  compressionRatio: z.number().positive().optional(),
  storageSizeBytes: z.number().int().nonnegative().optional(),
  
  // Custom metadata
  tags: z.array(NonEmptyStringSchema).default([]),
  customFields: JSONObjectSchema.optional()
});

export type ContextMetadata = z.infer<typeof ContextMetadataSchema>;
```

### **Context Relationship Schema**

```typescript
export const ContextRelationshipSchema = z.object({
  targetId: ContextIdSchema,
  type: RelationshipTypeSchema,
  weight: ScoreSchema.default(0.5),
  bidirectional: z.boolean().default(false),
  
  // Relationship metadata
  createdAt: TimestampSchema.default(() => new Date()),
  createdBy: AgentIdSchema.optional(),
  description: z.string().optional(),
  
  // Relationship properties
  properties: z.record(z.unknown()).optional()
});

export type ContextRelationship = z.infer<typeof ContextRelationshipSchema>;
```

### **Core Context Schema**

```typescript
export const ContextSchema = z.object({
  // Identity
  id: ContextIdSchema,
  type: ContextTypeSchema,
  
  // Content
  content: JSONObjectSchema,
  
  // Metadata
  metadata: ContextMetadataSchema,
  
  // Relationships
  relationships: z.array(ContextRelationshipSchema).default([]),
  
  // Versioning
  version: z.number().int().positive().default(1),
  parentVersion: ContextIdSchema.optional(),
  
  // Validation
  schemaVersion: z.string().default('1.0'),
  checksum: z.string().optional() // For integrity verification
});

export type Context = z.infer<typeof ContextSchema>;
```

## Specialized Context Schemas

### **Conversation Context Schema**

```typescript
export const ConversationTurnSchema = z.object({
  id: UUIDSchema,
  role: z.enum(['user', 'assistant', 'system']),
  content: NonEmptyStringSchema,
  timestamp: TimestampSchema.default(() => new Date()),
  metadata: z.object({
    tokenCount: z.number().int().nonnegative().optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    cost: z.number().nonnegative().optional()
  }).optional()
});

export const ConversationContextSchema = ContextSchema.extend({
  type: z.literal('conversation'),
  content: z.object({
    turns: z.array(ConversationTurnSchema),
    summary: z.string().optional(),
    topics: z.array(NonEmptyStringSchema).default([]),
    language: z.string().default('en'),
    participants: z.array(AgentIdSchema).default([])
  })
});

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type ConversationContext = z.infer<typeof ConversationContextSchema>;
```

### **Task Context Schema**

```typescript
export const TaskStatusSchema = z.enum([
  'pending',
  'in-progress', 
  'completed',
  'failed',
  'cancelled',
  'blocked'
]);

export const TaskContextSchema = ContextSchema.extend({
  type: z.literal('task'),
  content: z.object({
    title: NonEmptyStringSchema,
    description: z.string().default(''),
    status: TaskStatusSchema.default('pending'),
    
    // Task hierarchy
    parentTaskId: ContextIdSchema.optional(),
    subtaskIds: z.array(ContextIdSchema).default([]),
    
    // Execution details
    assignedTo: AgentIdSchema.optional(),
    estimatedDuration: z.number().int().positive().optional(),
    actualDuration: z.number().int().nonnegative().optional(),
    
    // Progress tracking
    completionPercentage: z.number().min(0).max(100).default(0),
    milestones: z.array(z.object({
      id: UUIDSchema,
      title: NonEmptyStringSchema,
      completed: z.boolean().default(false),
      completedAt: TimestampSchema.optional()
    })).default([]),
    
    // Dependencies
    dependencies: z.array(ContextIdSchema).default([]),
    blockers: z.array(z.object({
      id: UUIDSchema,
      description: NonEmptyStringSchema,
      resolved: z.boolean().default(false)
    })).default([]),
    
    // Outputs
    results: JSONObjectSchema.optional(),
    artifacts: z.array(z.object({
      id: UUIDSchema,
      name: NonEmptyStringSchema,
      type: z.string(),
      location: FilePathSchema,
      size: z.number().int().nonnegative().optional()
    })).default([])
  })
});

export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type TaskContext = z.infer<typeof TaskContextSchema>;
```

### **Workflow Context Schema**

```typescript
export const WorkflowStepSchema = z.object({
  id: UUIDSchema,
  name: NonEmptyStringSchema,
  type: z.enum(['action', 'decision', 'parallel', 'loop', 'condition']),
  status: TaskStatusSchema.default('pending'),
  
  // Step configuration
  config: JSONObjectSchema.optional(),
  inputs: JSONObjectSchema.optional(),
  outputs: JSONObjectSchema.optional(),
  
  // Execution details
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  duration: z.number().int().nonnegative().optional(),
  
  // Flow control
  nextSteps: z.array(UUIDSchema).default([]),
  conditions: z.array(z.object({
    condition: NonEmptyStringSchema,
    nextStep: UUIDSchema
  })).default([]),
  
  // Error handling
  onError: z.enum(['retry', 'skip', 'fail', 'rollback']).default('fail'),
  maxRetries: z.number().int().nonnegative().default(0),
  retryCount: z.number().int().nonnegative().default(0)
});

export const WorkflowContextSchema = ContextSchema.extend({
  type: z.literal('workflow'),
  content: z.object({
    name: NonEmptyStringSchema,
    description: z.string().default(''),
    version: z.string().default('1.0'),
    
    // Workflow definition
    steps: z.array(WorkflowStepSchema),
    startStep: UUIDSchema,
    endSteps: z.array(UUIDSchema).default([]),
    
    // Execution state
    currentStep: UUIDSchema.optional(),
    executionHistory: z.array(z.object({
      stepId: UUIDSchema,
      startedAt: TimestampSchema,
      completedAt: TimestampSchema.optional(),
      status: TaskStatusSchema,
      error: z.string().optional()
    })).default([]),
    
    // Workflow metadata
    pattern: z.enum(['sequential', 'parallel', 'react', 'rewoo', 'adapt']).optional(),
    priority: PrioritySchema.default(5),
    timeout: z.number().int().positive().optional(),
    
    // Input/Output
    inputs: JSONObjectSchema.optional(),
    outputs: JSONObjectSchema.optional(),
    
    // State management
    variables: JSONObjectSchema.default({}),
    context: JSONObjectSchema.default({})
  })
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;
```

### **Distributed Context Schema**

```typescript
export const DistributedContextSchema = ContextSchema.extend({
  type: z.literal('distributed'),
  content: z.object({
    // Distribution metadata
    originAgent: AgentIdSchema,
    sharedWith: z.array(AgentIdSchema).default([]),
    replicationLevel: z.enum(['none', 'eventual', 'strong']).default('eventual'),
    
    // Synchronization
    syncVersion: z.number().int().nonnegative().default(0),
    lastSync: TimestampSchema.optional(),
    syncStatus: z.enum(['synced', 'pending', 'conflict', 'error']).default('synced'),
    
    // Conflict resolution
    conflicts: z.array(z.object({
      field: NonEmptyStringSchema,
      localValue: z.unknown(),
      remoteValue: z.unknown(),
      resolvedValue: z.unknown().optional(),
      resolvedBy: AgentIdSchema.optional(),
      resolvedAt: TimestampSchema.optional()
    })).default([]),
    
    // Distribution strategy
    strategy: z.enum(['broadcast', 'gossip', 'leader-follower', 'consensus']).default('broadcast'),
    
    // Access control per agent
    agentPermissions: z.record(
      z.array(z.enum(['read', 'write', 'delete', 'share']))
    ).default({}),
    
    // Payload
    distributedContent: JSONObjectSchema
  })
});

export type DistributedContext = z.infer<typeof DistributedContextSchema>;
```

## Storage and Compression Schemas

### **Compressed Context Schema**

```typescript
export const CompressionStatsSchema = z.object({
  originalSize: z.number().int().nonnegative(),
  compressedSize: z.number().int().nonnegative(),
  compressionRatio: z.number().positive(),
  algorithm: CompressionAlgorithmSchema,
  compressedAt: TimestampSchema.default(() => new Date()),
  decompressionTime: z.number().nonnegative().optional()
});

export const CompressedContextSchema = z.object({
  contextId: ContextIdSchema,
  algorithm: CompressionAlgorithmSchema,
  data: Base64Schema,
  stats: CompressionStatsSchema,
  
  // Metadata preserved for searching without decompression
  preservedMetadata: z.object({
    type: ContextTypeSchema,
    priority: PrioritySchema,
    relevanceScore: ScoreSchema,
    tags: z.array(NonEmptyStringSchema),
    createdAt: TimestampSchema,
    lastAccessed: TimestampSchema
  }),
  
  // Integrity verification
  checksum: NonEmptyStringSchema,
  verified: z.boolean().default(false)
});

export type CompressionStats = z.infer<typeof CompressionStatsSchema>;
export type CompressedContext = z.infer<typeof CompressedContextSchema>;
```

### **Storage Location Schema**

```typescript
export const StorageLocationSchema = z.object({
  contextId: ContextIdSchema,
  service: MCPServiceTypeSchema,
  path: NonEmptyStringSchema,
  
  // Storage metadata
  storedAt: TimestampSchema.default(() => new Date()),
  storageSize: z.number().int().nonnegative().optional(),
  compressed: z.boolean().default(false),
  encrypted: z.boolean().default(false),
  
  // Access tracking
  lastAccessed: TimestampSchema.optional(),
  accessCount: z.number().int().nonnegative().default(0),
  
  // Backup information
  backupLocations: z.array(z.object({
    service: MCPServiceTypeSchema,
    path: NonEmptyStringSchema,
    backedUpAt: TimestampSchema
  })).default([])
});

export const ArchiveLocationSchema = StorageLocationSchema.extend({
  compressionAlgorithm: CompressionAlgorithmSchema,
  originalSize: z.number().int().nonnegative(),
  compressedSize: z.number().int().nonnegative(),
  archivedAt: TimestampSchema.default(() => new Date())
});

export type StorageLocation = z.infer<typeof StorageLocationSchema>;
export type ArchiveLocation = z.infer<typeof ArchiveLocationSchema>;
```

## Query and Filter Schemas

### **Context Query Schema**

```typescript
export const ContextQuerySchema = z.object({
  // Basic filters
  ids: z.array(ContextIdSchema).optional(),
  type: ContextTypeSchema.optional(),
  types: z.array(ContextTypeSchema).optional(),
  
  // Score filters
  minPriority: PrioritySchema.optional(),
  maxPriority: PrioritySchema.optional(),
  minRelevance: ScoreSchema.optional(),
  maxRelevance: ScoreSchema.optional(),
  
  // Time filters
  createdAfter: TimestampSchema.optional(),
  createdBefore: TimestampSchema.optional(),
  modifiedAfter: TimestampSchema.optional(),
  modifiedBefore: TimestampSchema.optional(),
  
  // Content filters
  tags: z.array(NonEmptyStringSchema).optional(),
  contentContains: NonEmptyStringSchema.optional(),
  
  // Relationship filters
  hasRelationship: RelationshipTypeSchema.optional(),
  relatedTo: ContextIdSchema.optional(),
  
  // Storage filters
  storedIn: MCPServiceTypeSchema.optional(),
  compressed: z.boolean().optional(),
  archived: z.boolean().optional(),
  
  // Result configuration
  limit: z.number().int().positive().default(50),
  offset: z.number().int().nonnegative().default(0),
  sortBy: z.enum(['created', 'modified', 'accessed', 'priority', 'relevance']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Include options
  includeContent: z.boolean().default(true),
  includeRelationships: z.boolean().default(true),
  includeMetadata: z.boolean().default(true)
});

export type ContextQuery = z.infer<typeof ContextQuerySchema>;
```

### **Context Filter Schema**

```typescript
export const ContextFilterSchema = z.object({
  // Field-based filters
  fieldFilters: z.array(z.object({
    field: NonEmptyStringSchema,
    operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith']),
    value: z.unknown()
  })).default([]),
  
  // Logical operators
  logicalOperator: z.enum(['and', 'or']).default('and'),
  
  // Nested filters
  nestedFilters: z.array(z.lazy(() => ContextFilterSchema)).default([]),
  
  // Performance hints
  useIndex: z.boolean().default(true),
  cacheResult: z.boolean().default(true)
});

export type ContextFilter = z.infer<typeof ContextFilterSchema>;
```

## Validation and Transformation Schemas

### **Context Validation Schema**

```typescript
export const ContextValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({
    field: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
    code: NonEmptyStringSchema,
    severity: z.enum(['error', 'warning', 'info'])
  })).default([]),
  warnings: z.array(z.object({
    field: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
    suggestion: z.string().optional()
  })).default([]),
  
  // Quality metrics
  qualityScore: ScoreSchema.optional(),
  completenessScore: ScoreSchema.optional(),
  
  // Performance metrics
  validationTime: z.number().nonnegative(),
  validatedAt: TimestampSchema.default(() => new Date())
});

export type ContextValidationResult = z.infer<typeof ContextValidationResultSchema>;
```

### **Context Transformation Schema**

```typescript
export const ContextTransformationSchema = z.object({
  id: UUIDSchema,
  name: NonEmptyStringSchema,
  description: z.string().optional(),
  
  // Transformation rules
  rules: z.array(z.object({
    id: UUIDSchema,
    condition: NonEmptyStringSchema, // JSONPath or similar
    action: z.enum(['add', 'remove', 'modify', 'rename']),
    target: NonEmptyStringSchema,
    value: z.unknown().optional(),
    
    // Rule metadata
    enabled: z.boolean().default(true),
    priority: PrioritySchema.default(5)
  })),
  
  // Transformation metadata
  version: z.string().default('1.0'),
  createdBy: AgentIdSchema.optional(),
  createdAt: TimestampSchema.default(() => new Date()),
  
  // Execution tracking
  executionCount: z.number().int().nonnegative().default(0),
  successRate: ScoreSchema.optional(),
  averageExecutionTime: z.number().nonnegative().optional()
});

export type ContextTransformation = z.infer<typeof ContextTransformationSchema>;
```

## Configuration and Service Schemas

### **Context Engine Configuration Schema**

```typescript
export const ContextEngineConfigSchema = z.object({
  // Service configurations
  services: z.object({
    memory: z.object({
      maxSize: z.string().default('1GB'),
      evictionPolicy: z.enum(['LRU', 'LFU', 'FIFO']).default('LRU'),
      defaultTTL: z.number().int().positive().default(3600),
      enabled: z.boolean().default(true)
    }),
    
    sqlite: z.object({
      databasePath: FilePathSchema.default('./data/context-index.db'),
      journalMode: z.enum(['DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'WAL', 'OFF']).default('WAL'),
      cacheSize: z.number().int().positive().default(10000),
      enabled: z.boolean().default(true)
    }),
    
    filesystem: z.object({
      basePath: FilePathSchema.default('./data/contexts'),
      compressionEnabled: z.boolean().default(true),
      defaultAlgorithm: CompressionAlgorithmSchema.default('lz4'),
      maxFileSize: z.string().default('100MB'),
      enabled: z.boolean().default(true)
    })
  }),
  
  // Strategy configurations
  strategies: z.object({
    write: z.object({
      defaultStorage: MCPServiceTypeSchema.default('memory'),
      compressionThreshold: z.number().int().positive().default(1024 * 10), // 10KB
      backupEnabled: z.boolean().default(true)
    }),
    
    select: z.object({
      maxResults: z.number().int().positive().default(100),
      relevanceThreshold: ScoreSchema.default(0.1),
      useSemanticSearch: z.boolean().default(false)
    }),
    
    compress: z.object({
      defaultAlgorithm: CompressionAlgorithmSchema.default('lz4'),
      compressionLevel: z.number().int().min(1).max(9).default(6),
      autoCompress: z.boolean().default(true)
    }),
    
    isolate: z.object({
      defaultBoundary: BoundaryTypeSchema.default('private'),
      encryptionEnabled: z.boolean().default(false),
      auditEnabled: z.boolean().default(true)
    })
  }),
  
  // Performance settings
  performance: z.object({
    cacheEnabled: z.boolean().default(true),
    batchSize: z.number().int().positive().default(10),
    maxConcurrency: z.number().int().positive().default(5),
    timeoutMs: z.number().int().positive().default(30000)
  }),
  
  // Monitoring settings
  monitoring: z.object({
    metricsEnabled: z.boolean().default(true),
    loggingLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    healthCheckInterval: z.number().int().positive().default(60000)
  })
});

export type ContextEngineConfig = z.infer<typeof ContextEngineConfigSchema>;
```

## Schema Validation Utilities

### **Schema Validation Functions**

```typescript
// Validation function factory
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): Result<T, QiError> => {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return success(result.data);
    } else {
      const errorMessage = result.error.errors
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join('; ');
        
      return failure(create(
        'SCHEMA_VALIDATION_ERROR',
        `Validation failed: ${errorMessage}`,
        'VALIDATION',
        { errors: result.error.errors }
      ));
    }
  };
}

// Pre-built validators
export const validateContext = createValidator(ContextSchema);
export const validateContextQuery = createValidator(ContextQuerySchema);
export const validateCompressedContext = createValidator(CompressedContextSchema);
export const validateContextEngineConfig = createValidator(ContextEngineConfigSchema);

// Async validation with side effects
export async function validateAndEnrichContext(
  data: unknown,
  enrichmentOptions?: {
    generateId?: boolean;
    setTimestamps?: boolean;
    calculateChecksum?: boolean;
  }
): Promise<Result<Context, QiError>> {
  // Basic validation
  const validationResult = validateContext(data);
  if (validationResult.tag === 'failure') {
    return validationResult;
  }
  
  let context = validationResult.value;
  const options = { 
    generateId: false,
    setTimestamps: false,
    calculateChecksum: false,
    ...enrichmentOptions 
  };
  
  // Enrichment
  if (options.generateId && !context.id) {
    context = { ...context, id: crypto.randomUUID() };
  }
  
  if (options.setTimestamps) {
    const now = new Date();
    context = {
      ...context,
      metadata: {
        ...context.metadata,
        createdAt: context.metadata.createdAt || now,
        lastAccessed: now
      }
    };
  }
  
  if (options.calculateChecksum) {
    const contentHash = await calculateChecksum(context.content);
    context = { ...context, checksum: contentHash };
  }
  
  // Final validation after enrichment
  return validateContext(context);
}

// Checksum calculation
async function calculateChecksum(content: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(content, Object.keys(content).sort()));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### **Schema Evolution and Migration**

```typescript
// Schema migration support
export const SchemaMigrationSchema = z.object({
  fromVersion: z.string(),
  toVersion: z.string(),
  transformations: z.array(ContextTransformationSchema),
  backward_compatible: z.boolean(),
  
  // Migration metadata
  createdAt: TimestampSchema.default(() => new Date()),
  appliedCount: z.number().int().nonnegative().default(0),
  successRate: ScoreSchema.optional()
});

export type SchemaMigration = z.infer<typeof SchemaMigrationSchema>;

// Schema registry for version management
export class SchemaRegistry {
  private schemas = new Map<string, z.ZodSchema>();
  private migrations = new Map<string, SchemaMigration>();
  
  register<T>(version: string, schema: z.ZodSchema<T>): void {
    this.schemas.set(version, schema);
  }
  
  get(version: string): z.ZodSchema | undefined {
    return this.schemas.get(version);
  }
  
  addMigration(migration: SchemaMigration): void {
    const key = `${migration.fromVersion}->${migration.toVersion}`;
    this.migrations.set(key, migration);
  }
  
  getMigrationPath(fromVersion: string, toVersion: string): SchemaMigration[] {
    // Simple implementation - could be enhanced for complex migration paths
    const directPath = this.migrations.get(`${fromVersion}->${toVersion}`);
    return directPath ? [directPath] : [];
  }
}

// Global schema registry instance
export const contextSchemaRegistry = new SchemaRegistry();

// Register current schemas
contextSchemaRegistry.register('1.0', ContextSchema);
contextSchemaRegistry.register('1.0-conversation', ConversationContextSchema);
contextSchemaRegistry.register('1.0-task', TaskContextSchema);
contextSchemaRegistry.register('1.0-workflow', WorkflowContextSchema);
contextSchemaRegistry.register('1.0-distributed', DistributedContextSchema);
```

## Testing Schema Validation

### **Schema Test Utilities**

```typescript
// Test data generators
export function generateTestContext(overrides: Partial<Context> = {}): Context {
  const base: Context = {
    id: crypto.randomUUID(),
    type: 'conversation',
    content: {
      message: 'Test content',
      data: { test: true }
    },
    metadata: {
      priority: 5,
      relevanceScore: 0.8,
      compressionLevel: 'none',
      createdAt: new Date(),
      lastAccessed: new Date(),
      mcpStorage: {
        service: 'memory',
        location: 'test-location',
        encrypted: false,
        compressionEnabled: false,
        backupEnabled: false
      },
      permissions: ['read', 'write'],
      accessCount: 0,
      tags: ['test']
    },
    relationships: [],
    version: 1,
    schemaVersion: '1.0'
  };
  
  return { ...base, ...overrides };
}

// Schema validation tests
export function createSchemaTests<T>(
  schema: z.ZodSchema<T>,
  validExamples: unknown[],
  invalidExamples: Array<{ data: unknown; expectedError: string }>
) {
  return {
    testValidExamples: () => {
      for (const example of validExamples) {
        const result = schema.safeParse(example);
        if (!result.success) {
          throw new Error(`Expected valid example to pass: ${JSON.stringify(result.error.errors)}`);
        }
      }
    },
    
    testInvalidExamples: () => {
      for (const { data, expectedError } of invalidExamples) {
        const result = schema.safeParse(data);
        if (result.success) {
          throw new Error(`Expected invalid example to fail: ${JSON.stringify(data)}`);
        }
        
        const hasExpectedError = result.error.errors.some(err => 
          err.message.includes(expectedError)
        );
        
        if (!hasExpectedError) {
          throw new Error(`Expected error containing "${expectedError}", got: ${JSON.stringify(result.error.errors)}`);
        }
      }
    }
  };
}
```

## Next Steps

1. **Strategy Implementation**: Use these schemas in Write, Select, Compress, Isolate strategy implementations
2. **MCP Integration**: Apply schemas to MCP service data validation
3. **Multi-Agent Coordination**: Leverage distributed context schemas for agent communication
4. **Performance Testing**: Validate schema performance with large context collections
5. **Migration Testing**: Test schema evolution and migration capabilities

---

**References**:
- [Zod Documentation](https://zod.dev/)
- [JSON Schema Specification](https://json-schema.org/)
- [TypeScript Type System](https://www.typescriptlang.org/docs/)