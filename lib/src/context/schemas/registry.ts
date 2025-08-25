/**
 * Schema Registry and Validation System
 *
 * Provides centralized schema management, validation, and migration
 * capabilities for the context engineering system.
 */

import { create, failure, type QiError, type Result, success } from '@qi/base';
import type { z } from 'zod';
import { createValidator } from './base.js';
import { type Context, ContextSchema } from './context.js';
import {
  type AgentContext,
  AgentContextSchema,
  type ConversationContext,
  ConversationContextSchema,
  type DistributedContext,
  DistributedContextSchema,
  type SystemContext,
  SystemContextSchema,
  type TaskContext,
  TaskContextSchema,
  type WorkflowContext,
  WorkflowContextSchema,
} from './specialized.js';

// =============================================================================
// Schema Migration Types
// =============================================================================

/**
 * Schema transformation function type
 */
export type SchemaTransformer<TFrom = unknown, TTo = unknown> = (data: TFrom) => Promise<TTo> | TTo;

/**
 * Schema migration definition
 */
export interface SchemaMigration {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly description: string;
  readonly transformer: SchemaTransformer;
  readonly backwardCompatible: boolean;
  readonly createdAt: Date;
  appliedCount: number;
  successRate?: number;
}

/**
 * Schema registration information
 */
export interface SchemaRegistration {
  readonly version: string;
  readonly schema: z.ZodSchema;
  readonly description: string;
  readonly isDefault: boolean;
  readonly registeredAt: Date;
  readonly validator: (data: unknown) => Result<unknown, QiError>;
}

// =============================================================================
// Schema Registry Implementation
// =============================================================================

/**
 * Central schema registry for managing context schemas and migrations
 */
export class ContextSchemaRegistry {
  private schemas = new Map<string, SchemaRegistration>();
  private migrations = new Map<string, SchemaMigration>();
  private defaultVersions = new Map<string, string>();

  /**
   * Register a schema with the registry
   */
  register<T>(
    contextType: string,
    version: string,
    schema: z.ZodSchema<T>,
    options: {
      description?: string;
      isDefault?: boolean;
    } = {}
  ): Result<void, QiError> {
    const key = this.createKey(contextType, version);

    if (this.schemas.has(key)) {
      return failure(
        create(
          'SCHEMA_ALREADY_REGISTERED',
          `Schema for ${contextType} version ${version} is already registered`,
          'BUSINESS'
        )
      );
    }

    const registration: SchemaRegistration = {
      version,
      schema,
      description: options.description || `${contextType} context schema v${version}`,
      isDefault: options.isDefault || false,
      registeredAt: new Date(),
      validator: createValidator(schema),
    };

    this.schemas.set(key, registration);

    // Set as default version if specified
    if (options.isDefault) {
      this.defaultVersions.set(contextType, version);
    }

    return success(undefined);
  }

  /**
   * Get a schema registration
   */
  get(contextType: string, version?: string): SchemaRegistration | undefined {
    const resolvedVersion = version || this.defaultVersions.get(contextType);
    if (!resolvedVersion) {
      return undefined;
    }

    const key = this.createKey(contextType, resolvedVersion);
    return this.schemas.get(key);
  }

  /**
   * Get all registered schemas for a context type
   */
  getVersions(contextType: string): SchemaRegistration[] {
    const results: SchemaRegistration[] = [];

    for (const [key, registration] of this.schemas.entries()) {
      if (key.startsWith(`${contextType}:`)) {
        results.push(registration);
      }
    }

    return results.sort((a, b) => a.registeredAt.getTime() - b.registeredAt.getTime());
  }

  /**
   * Validate data against a specific schema
   */
  validate<T>(contextType: string, data: unknown, version?: string): Result<T, QiError> {
    const registration = this.get(contextType, version);

    if (!registration) {
      const resolvedVersion = version || 'default';
      return failure(
        create(
          'SCHEMA_NOT_FOUND',
          `Schema for ${contextType} version ${resolvedVersion} not found`,
          'BUSINESS'
        )
      );
    }

    return registration.validator(data) as Result<T, QiError>;
  }

  /**
   * Add a schema migration
   */
  addMigration(migration: Omit<SchemaMigration, 'appliedCount'>): Result<void, QiError> {
    const key = `${migration.fromVersion}->${migration.toVersion}`;

    if (this.migrations.has(key)) {
      return failure(
        create(
          'MIGRATION_ALREADY_EXISTS',
          `Migration from ${migration.fromVersion} to ${migration.toVersion} already exists`,
          'BUSINESS'
        )
      );
    }

    this.migrations.set(key, {
      ...migration,
      appliedCount: 0,
    });

    return success(undefined);
  }

  /**
   * Apply schema migration
   */
  async migrate<TFrom, TTo>(
    data: TFrom,
    fromVersion: string,
    toVersion: string
  ): Promise<Result<TTo, QiError>> {
    const migrationPath = this.findMigrationPath(fromVersion, toVersion);

    if (migrationPath.length === 0) {
      return failure(
        create(
          'NO_MIGRATION_PATH',
          `No migration path found from ${fromVersion} to ${toVersion}`,
          'BUSINESS'
        )
      );
    }

    try {
      let currentData: unknown = data;

      for (const migration of migrationPath) {
        currentData = await migration.transformer(currentData);
        migration.appliedCount++;
      }

      return success(currentData as TTo);
    } catch (error) {
      return failure(
        create(
          'MIGRATION_ERROR',
          `Migration failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { error, fromVersion, toVersion }
        )
      );
    }
  }

  /**
   * Find migration path between two versions
   */
  private findMigrationPath(fromVersion: string, toVersion: string): SchemaMigration[] {
    // Simple direct migration lookup
    // In a more complex system, this could implement graph traversal
    // to find multi-step migration paths
    const directKey = `${fromVersion}->${toVersion}`;
    const directMigration = this.migrations.get(directKey);

    return directMigration ? [directMigration] : [];
  }

  /**
   * Create registry key
   */
  private createKey(contextType: string, version: string): string {
    return `${contextType}:${version}`;
  }

  /**
   * Get registry statistics
   */
  getStatistics() {
    return {
      totalSchemas: this.schemas.size,
      totalMigrations: this.migrations.size,
      contextTypes: Array.from(this.defaultVersions.keys()),
      migrations: Array.from(this.migrations.values()).map((m) => ({
        fromVersion: m.fromVersion,
        toVersion: m.toVersion,
        appliedCount: m.appliedCount,
        successRate: m.successRate,
      })),
    };
  }
}

// =============================================================================
// Global Registry Instance
// =============================================================================

/**
 * Global context schema registry instance
 */
export const contextSchemaRegistry = new ContextSchemaRegistry();

// =============================================================================
// Registry Initialization
// =============================================================================

/**
 * Initialize the schema registry with all built-in schemas
 */
export function initializeSchemaRegistry(): Result<void, QiError> {
  try {
    // Register base context schema
    contextSchemaRegistry.register('context', '1.0', ContextSchema, {
      description: 'Base context schema',
      isDefault: true,
    });

    // Register specialized context schemas
    contextSchemaRegistry.register('conversation', '1.0', ConversationContextSchema, {
      description: 'Conversation context schema',
      isDefault: true,
    });

    contextSchemaRegistry.register('task', '1.0', TaskContextSchema, {
      description: 'Task context schema',
      isDefault: true,
    });

    contextSchemaRegistry.register('workflow', '1.0', WorkflowContextSchema, {
      description: 'Workflow context schema',
      isDefault: true,
    });

    contextSchemaRegistry.register('distributed', '1.0', DistributedContextSchema, {
      description: 'Distributed context schema',
      isDefault: true,
    });

    contextSchemaRegistry.register('system', '1.0', SystemContextSchema, {
      description: 'System context schema',
      isDefault: true,
    });

    contextSchemaRegistry.register('agent', '1.0', AgentContextSchema, {
      description: 'Agent context schema',
      isDefault: true,
    });

    return success(undefined);
  } catch (error) {
    return failure(
      create(
        'REGISTRY_INIT_ERROR',
        `Failed to initialize schema registry: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error }
      )
    );
  }
}

// =============================================================================
// Context Type Guards
// =============================================================================

/**
 * Type guard for conversation context
 */
export function isConversationContext(context: Context): context is ConversationContext {
  return context.type === 'conversation';
}

/**
 * Type guard for task context
 */
export function isTaskContext(context: Context): context is TaskContext {
  return context.type === 'task';
}

/**
 * Type guard for workflow context
 */
export function isWorkflowContext(context: Context): context is WorkflowContext {
  return context.type === 'workflow';
}

/**
 * Type guard for distributed context
 */
export function isDistributedContext(context: Context): context is DistributedContext {
  return context.type === 'distributed';
}

/**
 * Type guard for system context
 */
export function isSystemContext(context: Context): context is SystemContext {
  return context.type === 'system';
}

/**
 * Type guard for agent context
 */
export function isAgentContext(context: Context): context is AgentContext {
  return context.type === 'agent';
}

// =============================================================================
// High-Level Validation Functions
// =============================================================================

/**
 * Validate any context using the registry
 */
export function validateContextByType(context: unknown): Result<Context, QiError> {
  // First, try to determine the context type
  if (typeof context !== 'object' || context === null) {
    return failure(create('INVALID_CONTEXT', 'Context must be an object', 'VALIDATION'));
  }

  const contextObj = context as { type?: string };
  if (!contextObj.type || typeof contextObj.type !== 'string') {
    return failure(
      create('MISSING_CONTEXT_TYPE', 'Context type is required and must be a string', 'VALIDATION')
    );
  }

  // Use registry to validate
  return contextSchemaRegistry.validate<Context>(contextObj.type, context);
}

/**
 * Validate and migrate context to latest version
 */
export async function validateAndMigrateContext(
  context: unknown,
  targetVersion?: string
): Promise<Result<Context, QiError>> {
  // First validate as-is
  const validationResult = validateContextByType(context);
  if (validationResult.tag === 'failure') {
    return validationResult;
  }

  const validContext = validationResult.value;

  // If no target version specified, return as-is
  if (!targetVersion) {
    return success(validContext);
  }

  // Check if migration is needed
  const currentVersion = validContext.schemaVersion || '1.0';
  if (currentVersion === targetVersion) {
    return success(validContext);
  }

  // Attempt migration
  const migrationResult = await contextSchemaRegistry.migrate<Context, Context>(
    validContext,
    currentVersion,
    targetVersion
  );

  if (migrationResult.tag === 'failure') {
    return migrationResult;
  }

  // Validate migrated context
  return validateContextByType(migrationResult.value);
}

/**
 * Batch validate multiple contexts
 */
export function validateContextsBatch(contexts: unknown[]): Result<Context[], QiError[]> {
  const results: Context[] = [];
  const errors: QiError[] = [];

  for (let i = 0; i < contexts.length; i++) {
    const validationResult = validateContextByType(contexts[i]);

    if (validationResult.tag === 'success') {
      results.push(validationResult.value);
    } else {
      const indexedError = create(
        validationResult.error.code,
        `Context ${i}: ${validationResult.error.message}`,
        validationResult.error.category,
        { ...validationResult.error.context, index: i }
      );
      errors.push(indexedError);
    }
  }

  return errors.length === 0 ? success(results) : failure(errors);
}

// =============================================================================
// Schema Registry Utilities
// =============================================================================

/**
 * Create a custom context validator
 */
export function createContextValidator<T extends Context>(contextType: string, version?: string) {
  return (data: unknown): Result<T, QiError> => {
    return contextSchemaRegistry.validate<T>(contextType, data, version);
  };
}

/**
 * Register a custom migration
 */
export function registerMigration(
  fromVersion: string,
  toVersion: string,
  transformer: SchemaTransformer,
  options: {
    description?: string;
    backwardCompatible?: boolean;
  } = {}
): Result<void, QiError> {
  const migration: Omit<SchemaMigration, 'appliedCount'> = {
    fromVersion,
    toVersion,
    description: options.description || `Migration from ${fromVersion} to ${toVersion}`,
    transformer,
    backwardCompatible: options.backwardCompatible || false,
    createdAt: new Date(),
  };

  return contextSchemaRegistry.addMigration(migration);
}

// Initialize the registry on module load
const initResult = initializeSchemaRegistry();
if (initResult.tag === 'failure') {
  console.error('Failed to initialize context schema registry:', initResult.error.message);
}
