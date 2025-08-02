/**
 * Schema Registry for Classification Tasks
 * 
 * Provides a centralized registry for Zod schemas used in LangChain classification.
 * Supports multiple schema variants optimized for different use cases and performance requirements.
 * Focuses on prompt vs workflow classification (commands handled separately via rule-based approach).
 */

import { z } from 'zod';
import { create, failure, success, type Result, type QiError } from '@qi/base';

/**
 * Schema complexity levels for different use cases
 */
export type SchemaComplexity = 'minimal' | 'standard' | 'detailed' | 'optimized';

/**
 * Classification types (commands excluded - handled by rule-based classifier)
 */
export type ClassificationType = 'prompt' | 'workflow';

/**
 * Schema metadata for tracking performance and usage
 */
export interface SchemaMetadata {
  name: string;
  complexity: SchemaComplexity;
  description: string;
  version: string;
  recommended_for: string[];
  performance_profile: {
    expected_accuracy: number;
    expected_latency_ms: number;
    parsing_reliability: number;
  };
  created_at: string;
  last_updated: string;
}

/**
 * Schema registry entry containing both the Zod schema and metadata
 */
export interface SchemaEntry {
  schema: z.ZodSchema;
  metadata: SchemaMetadata;
}

/**
 * Performance metrics for schema evaluation
 */
export interface SchemaPerformanceMetrics {
  schema_name: string;
  total_uses: number;
  accuracy: number;
  avg_latency_ms: number;
  parsing_success_rate: number;
  last_measured: string;
}

/**
 * Criteria for dynamic schema selection
 */
export interface SchemaSelectionCriteria {
  model_supports_function_calling?: boolean;
  prioritize_accuracy?: boolean;
  prioritize_speed?: boolean;
  max_latency_ms?: number;
  min_accuracy_threshold?: number;
  use_case?: 'development' | 'testing' | 'production';
}

/**
 * Schema Registry Error
 */
interface SchemaRegistryError extends QiError {
  context: {
    schema_name?: string;
    complexity?: string;
    operation?: string;
  };
}

/**
 * Custom error factory for schema registry errors
 */
const createSchemaRegistryError = (
  code: string,
  message: string,
  context: SchemaRegistryError['context'] = {}
): SchemaRegistryError => create(code, message, 'VALIDATION', context) as SchemaRegistryError;

/**
 * Classification Schema Registry
 * 
 * Centralized management of Zod schemas for LangChain classification tasks.
 * Provides schema selection, performance tracking, and optimization capabilities.
 */
export class ClassificationSchemaRegistry {
  private schemas: Map<string, SchemaEntry> = new Map();
  private performanceMetrics: Map<string, SchemaPerformanceMetrics> = new Map();

  constructor() {
    this.initializeBuiltinSchemas();
  }

  /**
   * Initialize built-in schemas based on research and best practices
   */
  private initializeBuiltinSchemas(): void {
    const currentTimestamp = new Date().toISOString();

    // Minimal Schema - fastest parsing, lowest accuracy
    const minimalSchema = z.object({
      type: z.enum(['prompt', 'workflow'])
        .describe('Classification: prompt (single-step) or workflow (multi-step)'),
      confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score from 0.0 to 1.0')
    });

    this.schemas.set('minimal', {
      schema: minimalSchema,
      metadata: {
        name: 'minimal',
        complexity: 'minimal',
        description: 'Basic type and confidence only - optimized for speed',
        version: '1.0.0',
        recommended_for: ['development', 'high-throughput', 'simple-models'],
        performance_profile: {
          expected_accuracy: 0.75,
          expected_latency_ms: 200,
          parsing_reliability: 0.98
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp
      }
    });

    // Standard Schema - balanced accuracy and performance
    const standardSchema = z.object({
      type: z.enum(['prompt', 'workflow'])
        .describe('Classification: prompt (single-step task) or workflow (multi-step orchestrated task)'),
      confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score from 0.0 to 1.0'),
      reasoning: z.string()
        .max(150)
        .describe('Brief explanation of why this classification was chosen')
    });

    this.schemas.set('standard', {
      schema: standardSchema,
      metadata: {
        name: 'standard',
        complexity: 'standard',
        description: 'Type, confidence, and reasoning - good balance of accuracy and speed',
        version: '1.0.0',
        recommended_for: ['production', 'general-purpose', 'function-calling-models'],
        performance_profile: {
          expected_accuracy: 0.85,
          expected_latency_ms: 350,
          parsing_reliability: 0.95
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp
      }
    });

    // Detailed Schema - high accuracy, more context
    const detailedSchema = z.object({
      type: z.enum(['prompt', 'workflow'])
        .describe('Classification: prompt (conversational/single-step) or workflow (complex/multi-step)'),
      confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score from 0.0 to 1.0'),
      reasoning: z.string()
        .max(200)
        .describe('Detailed explanation of classification decision'),
      indicators: z.array(z.string())
        .describe('Key indicators that led to this classification'),
      complexity_score: z.number()
        .min(1)
        .max(5)
        .describe('Task complexity rating: 1=simple, 5=very complex')
    });

    this.schemas.set('detailed', {
      schema: detailedSchema,
      metadata: {
        name: 'detailed',
        complexity: 'detailed',
        description: 'Comprehensive output with indicators and complexity scoring',
        version: '1.0.0',
        recommended_for: ['analysis', 'debugging', 'research', 'high-accuracy-requirements'],
        performance_profile: {
          expected_accuracy: 0.92,
          expected_latency_ms: 500,
          parsing_reliability: 0.88
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp
      }
    });

    // Optimized Schema - research-based optimal balance
    const optimizedSchema = z.object({
      type: z.enum(['prompt', 'workflow'])
        .describe('Classification: prompt (single-step request) or workflow (multi-step task requiring orchestration)'),
      confidence: z.number()
        .min(0)
        .max(1)
        .describe('Classification confidence from 0.0 to 1.0'),
      reasoning: z.string()
        .min(10)
        .max(100)
        .describe('Concise reasoning for this classification'),
      task_steps: z.number()
        .min(1)
        .describe('Estimated number of steps required to complete this task')
    });

    this.schemas.set('optimized', {
      schema: optimizedSchema,
      metadata: {
        name: 'optimized',
        complexity: 'optimized',
        description: 'Research-optimized schema balancing accuracy, speed, and reliability',
        version: '1.0.0',
        recommended_for: ['production', 'recommended-default', 'balanced-performance'],
        performance_profile: {
          expected_accuracy: 0.89,
          expected_latency_ms: 320,
          parsing_reliability: 0.94
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp
      }
    });
  }

  /**
   * Get a schema by name
   */
  getSchema(name: string): Result<SchemaEntry, QiError> {
    const entry = this.schemas.get(name);
    if (!entry) {
      return failure(createSchemaRegistryError(
        'SCHEMA_NOT_FOUND',
        `Schema '${name}' not found in registry`,
        { schema_name: name, operation: 'getSchema' }
      ));
    }
    return success(entry);
  }

  /**
   * Get schema by complexity level
   */
  getSchemaByComplexity(complexity: SchemaComplexity): Result<SchemaEntry, QiError> {
    for (const [, entry] of this.schemas) {
      if (entry.metadata.complexity === complexity) {
        return success(entry);
      }
    }
    return failure(createSchemaRegistryError(
      'SCHEMA_COMPLEXITY_NOT_FOUND',
      `No schema found with complexity '${complexity}'`,
      { complexity, operation: 'getSchemaByComplexity' }
    ));
  }

  /**
   * Select optimal schema based on criteria
   */
  selectOptimalSchema(criteria: SchemaSelectionCriteria = {}): Result<SchemaEntry, QiError> {
    const availableSchemas = Array.from(this.schemas.values());
    
    if (availableSchemas.length === 0) {
      return failure(createSchemaRegistryError(
        'NO_SCHEMAS_AVAILABLE',
        'No schemas available in registry',
        { operation: 'selectOptimalSchema' }
      ));
    }

    // Apply selection logic based on criteria
    let candidateSchemas = availableSchemas;

    // Filter by use case
    if (criteria.use_case) {
      candidateSchemas = candidateSchemas.filter(entry =>
        entry.metadata.recommended_for.includes(criteria.use_case!)
      );
    }

    // Filter by latency requirements
    if (criteria.max_latency_ms) {
      candidateSchemas = candidateSchemas.filter(entry =>
        entry.metadata.performance_profile.expected_latency_ms <= criteria.max_latency_ms!
      );
    }

    // Filter by accuracy requirements
    if (criteria.min_accuracy_threshold) {
      candidateSchemas = candidateSchemas.filter(entry =>
        entry.metadata.performance_profile.expected_accuracy >= criteria.min_accuracy_threshold!
      );
    }

    // If no candidates remain, fall back to all schemas
    if (candidateSchemas.length === 0) {
      candidateSchemas = availableSchemas;
    }

    // Select based on priorities
    let selectedSchema: SchemaEntry;

    if (criteria.prioritize_speed) {
      selectedSchema = candidateSchemas.reduce((fastest, current) =>
        current.metadata.performance_profile.expected_latency_ms < 
        fastest.metadata.performance_profile.expected_latency_ms ? current : fastest
      );
    } else if (criteria.prioritize_accuracy) {
      selectedSchema = candidateSchemas.reduce((mostAccurate, current) =>
        current.metadata.performance_profile.expected_accuracy > 
        mostAccurate.metadata.performance_profile.expected_accuracy ? current : mostAccurate
      );
    } else {
      // Default to optimized schema or best balanced option
      selectedSchema = candidateSchemas.find(entry => entry.metadata.name === 'optimized') ||
                     candidateSchemas.find(entry => entry.metadata.name === 'standard') ||
                     candidateSchemas[0];
    }

    return success(selectedSchema);
  }

  /**
   * List all available schemas
   */
  listSchemas(): SchemaEntry[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Register a new custom schema
   */
  registerSchema(name: string, schema: z.ZodSchema, metadata: Omit<SchemaMetadata, 'name'>): Result<void, QiError> {
    if (this.schemas.has(name)) {
      return failure(createSchemaRegistryError(
        'SCHEMA_ALREADY_EXISTS',
        `Schema '${name}' already exists in registry`,
        { schema_name: name, operation: 'registerSchema' }
      ));
    }

    const fullMetadata: SchemaMetadata = {
      name,
      ...metadata
    };

    this.schemas.set(name, {
      schema,
      metadata: fullMetadata
    });

    return success(undefined);
  }

  /**
   * Update performance metrics for a schema
   */
  updatePerformanceMetrics(schemaName: string, metrics: Omit<SchemaPerformanceMetrics, 'schema_name'>): Result<void, QiError> {
    if (!this.schemas.has(schemaName)) {
      return failure(createSchemaRegistryError(
        'SCHEMA_NOT_FOUND',
        `Cannot update metrics for unknown schema '${schemaName}'`,
        { schema_name: schemaName, operation: 'updatePerformanceMetrics' }
      ));
    }

    this.performanceMetrics.set(schemaName, {
      schema_name: schemaName,
      ...metrics
    });

    return success(undefined);
  }

  /**
   * Get performance metrics for a schema
   */
  getPerformanceMetrics(schemaName: string): Result<SchemaPerformanceMetrics, QiError> {
    const metrics = this.performanceMetrics.get(schemaName);
    if (!metrics) {
      return failure(createSchemaRegistryError(
        'METRICS_NOT_FOUND',
        `No performance metrics found for schema '${schemaName}'`,
        { schema_name: schemaName, operation: 'getPerformanceMetrics' }
      ));
    }
    return success(metrics);
  }

  /**
   * Get schema names by complexity
   */
  getSchemaNamesByComplexity(): Record<SchemaComplexity, string[]> {
    const result: Record<SchemaComplexity, string[]> = {
      minimal: [],
      standard: [],
      detailed: [],
      optimized: []
    };

    for (const [name, entry] of this.schemas) {
      result[entry.metadata.complexity].push(name);
    }

    return result;
  }

  /**
   * Export registry configuration for persistence
   */
  exportConfiguration(): {
    schemas: Record<string, { metadata: SchemaMetadata }>;
    performance_metrics: Record<string, SchemaPerformanceMetrics>;
  } {
    const schemasConfig: Record<string, { metadata: SchemaMetadata }> = {};
    for (const [name, entry] of this.schemas) {
      schemasConfig[name] = { metadata: entry.metadata };
    }

    const metricsConfig: Record<string, SchemaPerformanceMetrics> = {};
    for (const [name, metrics] of this.performanceMetrics) {
      metricsConfig[name] = metrics;
    }

    return {
      schemas: schemasConfig,
      performance_metrics: metricsConfig
    };
  }
}

/**
 * Global schema registry instance
 */
export const globalSchemaRegistry = new ClassificationSchemaRegistry();

/**
 * Convenience function to get a schema by name
 */
export function getClassificationSchema(name: string): Result<SchemaEntry, QiError> {
  return globalSchemaRegistry.getSchema(name);
}

/**
 * Convenience function to select optimal schema
 */
export function selectOptimalClassificationSchema(criteria?: SchemaSelectionCriteria): Result<SchemaEntry, QiError> {
  return globalSchemaRegistry.selectOptimalSchema(criteria);
}

// Type exports are already available through the interface and class exports above