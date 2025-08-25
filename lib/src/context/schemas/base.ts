/**
 * Base Schema Components for Context Engineering
 *
 * Provides fundamental Zod schemas and validation utilities used throughout
 * the context engineering system. These schemas ensure type safety and
 * runtime validation for all context operations.
 */

import { create, failure, type QiError, type Result, success } from '@qi/base';
import { z } from 'zod';

// =============================================================================
// Common Type Schemas
// =============================================================================

/**
 * UUID validation schema
 */
export const UUIDSchema = z.string().uuid('Invalid UUID format');

/**
 * Timestamp validation schema with coercion
 */
export const TimestampSchema = z.coerce.date();

/**
 * Score validation (0.0 to 1.0)
 */
export const ScoreSchema = z.number().min(0).max(1);

/**
 * Priority validation (0 to 10)
 */
export const PrioritySchema = z.number().int().min(0).max(10);

/**
 * Non-empty string validation
 */
export const NonEmptyStringSchema = z.string().min(1, 'String cannot be empty');

/**
 * JSON object validation
 */
export const JSONObjectSchema = z.record(z.unknown());

/**
 * Base64 encoded data validation
 */
export const Base64Schema = z.string().refine((val) => {
  try {
    return btoa(atob(val)) === val;
  } catch {
    return false;
  }
}, 'Invalid base64 encoding');

/**
 * File path validation (security-aware)
 */
export const FilePathSchema = z
  .string()
  .refine(
    (path) => path.length > 0 && !path.includes('../') && !path.includes('..\\'),
    'Invalid file path - path traversal not allowed'
  );

/**
 * Agent ID validation
 */
export const AgentIdSchema = z.string().min(1).max(128);

/**
 * Context ID validation (UUID)
 */
export const ContextIdSchema = UUIDSchema;

// =============================================================================
// Enumeration Schemas
// =============================================================================

/**
 * Context types enumeration
 */
export const ContextTypeSchema = z.enum(
  ['conversation', 'task', 'workflow', 'distributed', 'system', 'user', 'agent'],
  {
    errorMap: () => ({ message: 'Invalid context type' }),
  }
);

/**
 * Compression levels enumeration
 */
export const CompressionLevelSchema = z.enum(['none', 'semantic', 'lossless', 'aggressive']);

/**
 * MCP service types enumeration
 */
export const MCPServiceTypeSchema = z.enum(['memory', 'sqlite', 'filesystem', 'custom']);

/**
 * Relationship types enumeration
 */
export const RelationshipTypeSchema = z.enum([
  'parent',
  'child',
  'sibling',
  'reference',
  'depends-on',
  'related-to',
  'derived-from',
]);

/**
 * Isolation boundary types enumeration
 */
export const BoundaryTypeSchema = z.enum(['public', 'private', 'shared', 'encrypted', 'temporary']);

/**
 * Compression algorithms enumeration
 */
export const CompressionAlgorithmSchema = z.enum(['lz4', 'gzip', 'brotli', 'zstd']);

/**
 * Task status enumeration
 */
export const TaskStatusSchema = z.enum([
  'pending',
  'in-progress',
  'completed',
  'failed',
  'cancelled',
  'blocked',
]);

/**
 * Access permissions enumeration
 */
export const PermissionSchema = z.enum(['read', 'write', 'delete', 'share', 'admin']);

/**
 * Access operations enumeration
 */
export const AccessOperationSchema = z.enum(['read', 'write', 'delete', 'share']);

// =============================================================================
// Type Exports
// =============================================================================

export type ContextType = z.infer<typeof ContextTypeSchema>;
export type CompressionLevel = z.infer<typeof CompressionLevelSchema>;
export type MCPServiceType = z.infer<typeof MCPServiceTypeSchema>;
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
export type BoundaryType = z.infer<typeof BoundaryTypeSchema>;
export type CompressionAlgorithm = z.infer<typeof CompressionAlgorithmSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type AccessOperation = z.infer<typeof AccessOperationSchema>;

// =============================================================================
// Common Utility Schemas
// =============================================================================

/**
 * Storage reference schema for external context storage
 */
export const StorageRefSchema = z.object({
  id: ContextIdSchema,
  type: z.enum(['scratchpad', 'memory', 'state']),
  location: NonEmptyStringSchema,
  createdAt: TimestampSchema.default(() => new Date()),
  expiresAt: TimestampSchema.optional(),
});

export type StorageRef = z.infer<typeof StorageRefSchema>;

/**
 * Error schema for structured error handling
 */
export const ContextErrorSchema = z.object({
  code: NonEmptyStringSchema,
  message: NonEmptyStringSchema,
  field: z.string().optional(),
  details: JSONObjectSchema.optional(),
});

export type ContextError = z.infer<typeof ContextErrorSchema>;

/**
 * Validation result schema
 */
export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(ContextErrorSchema).default([]),
  warnings: z
    .array(
      z.object({
        field: NonEmptyStringSchema,
        message: NonEmptyStringSchema,
        suggestion: z.string().optional(),
      })
    )
    .default([]),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

// =============================================================================
// Schema Validation Utilities
// =============================================================================

/**
 * Generic validation function factory
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): Result<T, QiError> => {
    const result = schema.safeParse(data);

    if (result.success) {
      return success(result.data);
    } else {
      const errorMessage = result.error.errors
        .map((err) => `${err.path.join('.')}: ${err.message}`)
        .join('; ');

      return failure(
        create('SCHEMA_VALIDATION_ERROR', `Validation failed: ${errorMessage}`, 'VALIDATION', {
          errors: result.error.errors,
          input: data,
        })
      );
    }
  };
}

/**
 * Async validation with enrichment support
 */
export async function validateWithEnrichment<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  enrichmentFn?: (data: T) => Promise<T> | T
): Promise<Result<T, QiError>> {
  const validationResult = createValidator(schema)(data);

  if (validationResult.tag === 'failure') {
    return validationResult;
  }

  let validatedData = validationResult.value;

  // Apply enrichment if provided
  if (enrichmentFn) {
    try {
      validatedData = await enrichmentFn(validatedData);

      // Re-validate after enrichment
      const revalidationResult = createValidator(schema)(validatedData);
      if (revalidationResult.tag === 'failure') {
        return failure(
          create(
            'ENRICHMENT_VALIDATION_ERROR',
            'Data failed validation after enrichment',
            'VALIDATION',
            { originalData: data, enrichedData: validatedData }
          )
        );
      }

      return success(revalidationResult.value);
    } catch (error) {
      return failure(
        create(
          'ENRICHMENT_ERROR',
          `Enrichment failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { error }
        )
      );
    }
  }

  return success(validatedData);
}

/**
 * Batch validation utility
 */
export function validateBatch<T>(
  schema: z.ZodSchema<T>,
  dataArray: unknown[]
): Result<T[], QiError[]> {
  const validator = createValidator(schema);
  const results: T[] = [];
  const errors: QiError[] = [];

  for (let i = 0; i < dataArray.length; i++) {
    const result = validator(dataArray[i]);

    if (result.tag === 'success') {
      results.push(result.value);
    } else {
      // Add index information to error
      const indexedError = create(
        result.error.code,
        `Item ${i}: ${result.error.message}`,
        result.error.category,
        { ...result.error.context, index: i }
      );
      errors.push(indexedError);
    }
  }

  return errors.length === 0 ? success(results) : failure(errors);
}

/**
 * Schema composition utility for building complex schemas
 */
export function composeSchemas<T, U>(
  baseSchema: z.ZodSchema<T>,
  extensionSchema: z.ZodSchema<U>
): z.ZodSchema<T & U> {
  return z.intersection(baseSchema, extensionSchema);
}

/**
 * Conditional schema utility
 */
export function conditionalSchema<T>(
  condition: (data: unknown) => boolean,
  trueSchema: z.ZodSchema<T>,
  falseSchema: z.ZodSchema<T>
): z.ZodSchema<T> {
  return z.union([
    z.any().refine(condition).pipe(trueSchema),
    z
      .any()
      .refine((data) => !condition(data))
      .pipe(falseSchema),
  ]);
}

// =============================================================================
// Pre-built Common Validators
// =============================================================================

export const validateUUID = createValidator(UUIDSchema);
export const validateTimestamp = createValidator(TimestampSchema);
export const validateScore = createValidator(ScoreSchema);
export const validatePriority = createValidator(PrioritySchema);
export const validateContextType = createValidator(ContextTypeSchema);
export const validateAgentId = createValidator(AgentIdSchema);
export const validateFilePath = createValidator(FilePathSchema);
export const validateStorageRef = createValidator(StorageRefSchema);
