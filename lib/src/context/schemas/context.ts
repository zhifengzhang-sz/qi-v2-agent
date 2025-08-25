/**
 * Core Context Schemas
 *
 * Defines the main Context schema and related metadata structures
 * used throughout the context engineering system.
 */

import { z } from 'zod';
import {
  AgentIdSchema,
  type CompressionLevel,
  CompressionLevelSchema,
  ContextIdSchema,
  type ContextType,
  ContextTypeSchema,
  createValidator,
  JSONObjectSchema,
  type MCPServiceType,
  MCPServiceTypeSchema,
  NonEmptyStringSchema,
  type Permission,
  PermissionSchema,
  PrioritySchema,
  type RelationshipType,
  RelationshipTypeSchema,
  ScoreSchema,
  TimestampSchema,
  UUIDSchema,
} from './base.js';

// =============================================================================
// Context Metadata Schema
// =============================================================================

/**
 * MCP storage configuration schema
 */
export const MCPStorageConfigSchema = z.object({
  service: MCPServiceTypeSchema,
  location: NonEmptyStringSchema,
  encrypted: z.boolean().default(false),
  compressionEnabled: z.boolean().default(true),
  backupEnabled: z.boolean().default(true),
});

export type MCPStorageConfig = z.infer<typeof MCPStorageConfigSchema>;

/**
 * Context metadata schema - contains all context management metadata
 */
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
  mcpStorage: MCPStorageConfigSchema,

  // Access control
  owner: AgentIdSchema.optional(),
  permissions: z.array(PermissionSchema).default(['read']),

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
  customFields: JSONObjectSchema.optional(),
});

export type ContextMetadata = z.infer<typeof ContextMetadataSchema>;

// =============================================================================
// Context Relationship Schema
// =============================================================================

/**
 * Context relationship schema - defines relationships between contexts
 */
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
  properties: z.record(z.unknown()).optional(),
});

export type ContextRelationship = z.infer<typeof ContextRelationshipSchema>;

// =============================================================================
// Core Context Schema
// =============================================================================

/**
 * Core Context schema - the fundamental context data structure
 */
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
  checksum: z.string().optional(), // For integrity verification
});

export type Context = z.infer<typeof ContextSchema>;

// =============================================================================
// Compression and Storage Schemas
// =============================================================================

/**
 * Compression statistics schema
 */
export const CompressionStatsSchema = z.object({
  originalSize: z.number().int().nonnegative(),
  compressedSize: z.number().int().nonnegative(),
  compressionRatio: z.number().positive(),
  algorithm: z.enum(['lz4', 'gzip', 'brotli', 'zstd']),
  compressedAt: TimestampSchema.default(() => new Date()),
  decompressionTime: z.number().nonnegative().optional(),
});

export type CompressionStats = z.infer<typeof CompressionStatsSchema>;

/**
 * Compressed context schema
 */
export const CompressedContextSchema = z.object({
  contextId: ContextIdSchema,
  algorithm: z.enum(['lz4', 'gzip', 'brotli', 'zstd']),
  data: z.string(), // Base64 encoded compressed data
  stats: CompressionStatsSchema,

  // Metadata preserved for searching without decompression
  preservedMetadata: z.object({
    type: ContextTypeSchema,
    priority: PrioritySchema,
    relevanceScore: ScoreSchema,
    tags: z.array(NonEmptyStringSchema),
    createdAt: TimestampSchema,
    lastAccessed: TimestampSchema,
  }),

  // Integrity verification
  checksum: NonEmptyStringSchema,
  verified: z.boolean().default(false),
});

export type CompressedContext = z.infer<typeof CompressedContextSchema>;

/**
 * Storage location schema
 */
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
  backupLocations: z
    .array(
      z.object({
        service: MCPServiceTypeSchema,
        path: NonEmptyStringSchema,
        backedUpAt: TimestampSchema,
      })
    )
    .default([]),
});

export type StorageLocation = z.infer<typeof StorageLocationSchema>;

// =============================================================================
// Query and Filter Schemas
// =============================================================================

/**
 * Context query schema for retrieving contexts
 */
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
  includeMetadata: z.boolean().default(true),
});

export type ContextQuery = z.infer<typeof ContextQuerySchema>;

/**
 * Base filter field schema
 */
const FilterFieldSchema = z.object({
  field: NonEmptyStringSchema,
  operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith']),
  value: z.unknown(),
});

/**
 * Context filter type (defined before schema for recursive reference)
 */
export type ContextFilter = {
  fieldFilters: Array<{
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
    value?: unknown; // Make optional to match Zod default behavior
  }>;
  logicalOperator: 'and' | 'or';
  nestedFilters: ContextFilter[];
  useIndex: boolean;
  cacheResult: boolean;
};

/**
 * Context filter schema for complex filtering
 */
export const ContextFilterSchema: z.ZodType<ContextFilter> = z.lazy(() =>
  z.object({
    // Field-based filters
    fieldFilters: z.array(FilterFieldSchema).default([]),

    // Logical operators
    logicalOperator: z.enum(['and', 'or']).default('and'),

    // Nested filters (lazy evaluation for recursive structure)
    nestedFilters: z.array(ContextFilterSchema).default([]),

    // Performance hints
    useIndex: z.boolean().default(true),
    cacheResult: z.boolean().default(true),
  })
);

// =============================================================================
// Context Operations Schemas
// =============================================================================

/**
 * Context creation request schema
 */
export const ContextCreationRequestSchema = z.object({
  type: ContextTypeSchema,
  content: JSONObjectSchema,
  metadata: ContextMetadataSchema.partial().optional(),
  relationships: z.array(ContextRelationshipSchema).default([]),
});

export type ContextCreationRequest = z.infer<typeof ContextCreationRequestSchema>;

/**
 * Context update request schema
 */
export const ContextUpdateRequestSchema = z.object({
  id: ContextIdSchema,
  content: JSONObjectSchema.optional(),
  metadata: ContextMetadataSchema.partial().optional(),
  relationships: z.array(ContextRelationshipSchema).optional(),
  incrementVersion: z.boolean().default(true),
});

export type ContextUpdateRequest = z.infer<typeof ContextUpdateRequestSchema>;

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Pre-built validators for common schemas
 */
export const validateContext = createValidator(ContextSchema);
export const validateContextMetadata = createValidator(ContextMetadataSchema);
export const validateContextRelationship = createValidator(ContextRelationshipSchema);
export const validateCompressedContext = createValidator(CompressedContextSchema);
export const validateStorageLocation = createValidator(StorageLocationSchema);
export const validateContextQuery = createValidator(ContextQuerySchema);
export const validateContextFilter = createValidator(ContextFilterSchema);
export const validateContextCreationRequest = createValidator(ContextCreationRequestSchema);
export const validateContextUpdateRequest = createValidator(ContextUpdateRequestSchema);

/**
 * Context enrichment function - adds missing fields and calculates derived values
 */
export async function enrichContext(context: Partial<Context>): Promise<Context> {
  const now = new Date();

  // Generate ID if missing
  const id = context.id || crypto.randomUUID();

  // Default metadata
  const defaultMetadata: ContextMetadata = {
    priority: 5,
    relevanceScore: 0.0,
    compressionLevel: 'none',
    createdAt: now,
    lastAccessed: now,
    archived: false,
    mcpStorage: {
      service: 'memory',
      location: `context-${id}`,
      encrypted: false,
      compressionEnabled: true,
      backupEnabled: true,
    },
    permissions: ['read'],
    accessCount: 0,
    tags: [],
  };

  // Merge metadata
  const metadata: ContextMetadata = {
    ...defaultMetadata,
    ...context.metadata,
  };

  // Calculate checksum if content is provided
  let checksum: string | undefined;
  if (context.content) {
    checksum = await calculateContextChecksum(context.content);
  }

  return {
    id,
    type: context.type || 'system',
    content: context.content || {},
    metadata,
    relationships: context.relationships || [],
    version: context.version || 1,
    parentVersion: context.parentVersion,
    schemaVersion: context.schemaVersion || '1.0',
    checksum,
  };
}

/**
 * Calculate checksum for context content
 */
export async function calculateContextChecksum(content: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(content, Object.keys(content as object).sort()));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify context integrity using checksum
 */
export async function verifyContextIntegrity(context: Context): Promise<boolean> {
  if (!context.checksum) {
    return true; // No checksum to verify
  }

  const calculatedChecksum = await calculateContextChecksum(context.content);
  return calculatedChecksum === context.checksum;
}
