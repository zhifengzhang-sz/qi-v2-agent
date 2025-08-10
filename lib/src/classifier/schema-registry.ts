/**
 * Schema Registry for Classification Tasks
 *
 * Provides a centralized registry for Zod schemas used in LangChain classification.
 * Supports multiple schema variants optimized for different use cases and performance requirements.
 * Focuses on prompt vs workflow classification (commands handled separately via rule-based approach).
 */

import { create, failure, type QiError, type Result, success } from '@qi/base';
import { z } from 'zod';

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
    // Real measured performance - initially null until measured
    measured_accuracy?: number;
    measured_latency_ms?: number;
    measured_parsing_reliability?: number;

    // Performance tracking metadata
    total_uses: number;
    successful_classifications: number;
    total_latency_ms: number;
    successful_parsing_attempts: number;
    total_parsing_attempts: number;
    last_measured?: string;

    // Baseline estimates for new schemas (conservative defaults)
    baseline_accuracy_estimate: number;
    baseline_latency_estimate_ms: number;
    baseline_parsing_reliability_estimate: number;
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
      type: z
        .enum(['prompt', 'workflow'])
        .describe('Classification: prompt (single-step) or workflow (multi-step)'),
      confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
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
          // No measured performance yet - will be populated through real usage
          total_uses: 0,
          successful_classifications: 0,
          total_latency_ms: 0,
          successful_parsing_attempts: 0,
          total_parsing_attempts: 0,

          // Conservative baseline estimates
          baseline_accuracy_estimate: 0.75, // Lower complexity typically means lower accuracy
          baseline_latency_estimate_ms: 200, // Simple schema should be fast
          baseline_parsing_reliability_estimate: 0.98, // Simple schema is reliable to parse
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp,
      },
    });

    // Standard Schema - balanced accuracy and performance
    const standardSchema = z.object({
      type: z
        .enum(['prompt', 'workflow'])
        .describe(
          'Classification: prompt (single-step task) or workflow (multi-step orchestrated task)'
        ),
      confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
      reasoning: z.string().describe('Brief explanation of why this classification was chosen'),
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
          // No measured performance yet - will be populated through real usage
          total_uses: 0,
          successful_classifications: 0,
          total_latency_ms: 0,
          successful_parsing_attempts: 0,
          total_parsing_attempts: 0,

          // Conservative baseline estimates
          baseline_accuracy_estimate: 0.85, // Standard complexity should have better accuracy
          baseline_latency_estimate_ms: 350, // Moderate latency for additional reasoning field
          baseline_parsing_reliability_estimate: 0.95, // Good parsing reliability
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp,
      },
    });

    // Detailed Schema - high accuracy, more context
    const detailedSchema = z.object({
      type: z
        .enum(['prompt', 'workflow'])
        .describe(
          'Classification: prompt (conversational/single-step) or workflow (complex/multi-step)'
        ),
      confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
      reasoning: z.string().max(200).describe('Detailed explanation of classification decision'),
      indicators: z.array(z.string()).describe('Key indicators that led to this classification'),
      complexity_score: z
        .number()
        .min(1)
        .max(5)
        .describe('Task complexity rating: 1=simple, 5=very complex'),
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
          // No measured performance yet - will be populated through real usage
          total_uses: 0,
          successful_classifications: 0,
          total_latency_ms: 0,
          successful_parsing_attempts: 0,
          total_parsing_attempts: 0,

          // Conservative baseline estimates
          baseline_accuracy_estimate: 0.92, // Higher complexity should provide more accurate results
          baseline_latency_estimate_ms: 500, // More complex schema takes longer
          baseline_parsing_reliability_estimate: 0.88, // Complex schemas may have more parsing issues
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp,
      },
    });

    // Optimized Schema - research-based optimal balance
    const optimizedSchema = z.object({
      type: z
        .enum(['prompt', 'workflow'])
        .describe(
          'Classification: prompt (single-step request) or workflow (multi-step task requiring orchestration)'
        ),
      confidence: z.number().min(0).max(1).describe('Classification confidence from 0.0 to 1.0'),
      reasoning: z.string().min(10).max(100).describe('Concise reasoning for this classification'),
      task_steps: z
        .number()
        .min(1)
        .describe('Estimated number of steps required to complete this task'),
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
          // No measured performance yet - will be populated through real usage
          total_uses: 0,
          successful_classifications: 0,
          total_latency_ms: 0,
          successful_parsing_attempts: 0,
          total_parsing_attempts: 0,

          // Conservative baseline estimates
          baseline_accuracy_estimate: 0.89, // Balanced approach should provide good accuracy
          baseline_latency_estimate_ms: 320, // Optimized for speed while maintaining quality
          baseline_parsing_reliability_estimate: 0.94, // Well-balanced schema should be reliable
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp,
      },
    });

    // Context-Aware Schema - addresses workflow detection issues with conversation context analysis
    const contextAwareSchema = z.object({
      type: z
        .enum(['prompt', 'workflow'])
        .describe('prompt: direct question/request, workflow: requires multiple coordinated steps'),
      confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
      reasoning: z.string().describe('Brief explanation of classification decision'),
      conversation_context: z
        .enum(['greeting', 'question', 'follow_up', 'task_request', 'multi_step'])
        .describe(
          'Context type: greeting/question/follow_up always prompt, task_request/multi_step may be workflow'
        ),
      step_count: z
        .number()
        .min(1)
        .describe('Estimated number of steps needed (1=prompt, 2+=workflow)'),
      requires_coordination: z
        .boolean()
        .describe('Does this require coordinating multiple tools/services?'),
    });

    this.schemas.set('context_aware', {
      schema: contextAwareSchema,
      metadata: {
        name: 'context_aware',
        complexity: 'detailed',
        description:
          'Context-aware schema focusing on conversation context and task complexity analysis',
        version: '1.0.0',
        recommended_for: ['workflow-detection-improvement', 'research', 'conversational-ai'],
        performance_profile: {
          // No measured performance yet - will be populated through real usage
          total_uses: 0,
          successful_classifications: 0,
          total_latency_ms: 0,
          successful_parsing_attempts: 0,
          total_parsing_attempts: 0,

          // Estimated performance based on research findings
          baseline_accuracy_estimate: 0.75, // Target: improve workflow detection from 30% to 60%+
          baseline_latency_estimate_ms: 450, // Slightly higher due to additional context analysis
          baseline_parsing_reliability_estimate: 0.92, // Good structure but more complex fields
        },
        created_at: currentTimestamp,
        last_updated: currentTimestamp,
      },
    });
  }

  /**
   * Get a schema by name
   */
  getSchema(name: string): Result<SchemaEntry, QiError> {
    const entry = this.schemas.get(name);
    if (!entry) {
      return failure(
        createSchemaRegistryError('SCHEMA_NOT_FOUND', `Schema '${name}' not found in registry`, {
          schema_name: name,
          operation: 'getSchema',
        })
      );
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
    return failure(
      createSchemaRegistryError(
        'SCHEMA_COMPLEXITY_NOT_FOUND',
        `No schema found with complexity '${complexity}'`,
        { complexity, operation: 'getSchemaByComplexity' }
      )
    );
  }

  /**
   * Select optimal schema based on criteria
   */
  selectOptimalSchema(criteria: SchemaSelectionCriteria = {}): Result<SchemaEntry, QiError> {
    const availableSchemas = Array.from(this.schemas.values());

    if (availableSchemas.length === 0) {
      return failure(
        createSchemaRegistryError('NO_SCHEMAS_AVAILABLE', 'No schemas available in registry', {
          operation: 'selectOptimalSchema',
        })
      );
    }

    // Apply selection logic based on criteria
    let candidateSchemas = availableSchemas;

    // Filter by use case
    if (criteria.use_case) {
      candidateSchemas = candidateSchemas.filter((entry) =>
        entry.metadata.recommended_for.includes(criteria.use_case!)
      );
    }

    // Filter by latency requirements (use measured if available, baseline otherwise)
    if (criteria.max_latency_ms) {
      candidateSchemas = candidateSchemas.filter((entry) => {
        const latency =
          entry.metadata.performance_profile.measured_latency_ms ??
          entry.metadata.performance_profile.baseline_latency_estimate_ms;
        return latency <= criteria.max_latency_ms!;
      });
    }

    // Filter by accuracy requirements (use measured if available, baseline otherwise)
    if (criteria.min_accuracy_threshold) {
      candidateSchemas = candidateSchemas.filter((entry) => {
        const accuracy =
          entry.metadata.performance_profile.measured_accuracy ??
          entry.metadata.performance_profile.baseline_accuracy_estimate;
        return accuracy >= criteria.min_accuracy_threshold!;
      });
    }

    // If no candidates remain, fall back to all schemas
    if (candidateSchemas.length === 0) {
      candidateSchemas = availableSchemas;
    }

    // Select based on priorities
    let selectedSchema: SchemaEntry;

    if (criteria.prioritize_speed) {
      selectedSchema = candidateSchemas.reduce((fastest, current) => {
        const currentLatency =
          current.metadata.performance_profile.measured_latency_ms ??
          current.metadata.performance_profile.baseline_latency_estimate_ms;
        const fastestLatency =
          fastest.metadata.performance_profile.measured_latency_ms ??
          fastest.metadata.performance_profile.baseline_latency_estimate_ms;
        return currentLatency < fastestLatency ? current : fastest;
      });
    } else if (criteria.prioritize_accuracy) {
      selectedSchema = candidateSchemas.reduce((mostAccurate, current) => {
        const currentAccuracy =
          current.metadata.performance_profile.measured_accuracy ??
          current.metadata.performance_profile.baseline_accuracy_estimate;
        const mostAccurateAccuracy =
          mostAccurate.metadata.performance_profile.measured_accuracy ??
          mostAccurate.metadata.performance_profile.baseline_accuracy_estimate;
        return currentAccuracy > mostAccurateAccuracy ? current : mostAccurate;
      });
    } else {
      // Default to optimized schema or best balanced option
      selectedSchema =
        candidateSchemas.find((entry) => entry.metadata.name === 'optimized') ||
        candidateSchemas.find((entry) => entry.metadata.name === 'standard') ||
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
  registerSchema(
    name: string,
    schema: z.ZodSchema,
    metadata: Omit<SchemaMetadata, 'name'>
  ): Result<void, QiError> {
    if (this.schemas.has(name)) {
      return failure(
        createSchemaRegistryError(
          'SCHEMA_ALREADY_EXISTS',
          `Schema '${name}' already exists in registry`,
          { schema_name: name, operation: 'registerSchema' }
        )
      );
    }

    const fullMetadata: SchemaMetadata = {
      name,
      ...metadata,
    };

    this.schemas.set(name, {
      schema,
      metadata: fullMetadata,
    });

    return success(undefined);
  }

  /**
   * Update performance metrics for a schema
   */
  updatePerformanceMetrics(
    schemaName: string,
    metrics: Omit<SchemaPerformanceMetrics, 'schema_name'>
  ): Result<void, QiError> {
    if (!this.schemas.has(schemaName)) {
      return failure(
        createSchemaRegistryError(
          'SCHEMA_NOT_FOUND',
          `Cannot update metrics for unknown schema '${schemaName}'`,
          { schema_name: schemaName, operation: 'updatePerformanceMetrics' }
        )
      );
    }

    this.performanceMetrics.set(schemaName, {
      schema_name: schemaName,
      ...metrics,
    });

    return success(undefined);
  }

  /**
   * Get performance metrics for a schema
   */
  getPerformanceMetrics(schemaName: string): Result<SchemaPerformanceMetrics, QiError> {
    const metrics = this.performanceMetrics.get(schemaName);
    if (!metrics) {
      return failure(
        createSchemaRegistryError(
          'METRICS_NOT_FOUND',
          `No performance metrics found for schema '${schemaName}'`,
          { schema_name: schemaName, operation: 'getPerformanceMetrics' }
        )
      );
    }
    return success(metrics);
  }

  /**
   * Track performance metrics for a schema usage
   */
  trackSchemaUsage(
    schemaName: string,
    latencyMs: number,
    classificationSuccess: boolean,
    parsingSuccess: boolean
  ): Result<void, QiError> {
    const schemaEntry = this.schemas.get(schemaName);
    if (!schemaEntry) {
      return failure(
        createSchemaRegistryError(
          'SCHEMA_NOT_FOUND',
          `Cannot track performance for unknown schema '${schemaName}'`,
          { schema_name: schemaName, operation: 'trackSchemaUsage' }
        )
      );
    }

    const profile = schemaEntry.metadata.performance_profile;

    // Update tracking counters
    profile.total_uses++;
    profile.total_latency_ms += latencyMs;
    profile.total_parsing_attempts++;

    if (classificationSuccess) {
      profile.successful_classifications++;
    }

    if (parsingSuccess) {
      profile.successful_parsing_attempts++;
    }

    // Calculate new measured values
    profile.measured_accuracy = profile.successful_classifications / profile.total_uses;
    profile.measured_latency_ms = Math.round(profile.total_latency_ms / profile.total_uses);
    profile.measured_parsing_reliability =
      profile.successful_parsing_attempts / profile.total_parsing_attempts;
    profile.last_measured = new Date().toISOString();

    // Update last_updated timestamp
    schemaEntry.metadata.last_updated = new Date().toISOString();

    return success(undefined);
  }

  /**
   * Get effective performance metrics (measured if available, baseline otherwise)
   */
  getEffectivePerformanceMetrics(schemaName: string): Result<
    {
      accuracy: number;
      latency_ms: number;
      parsing_reliability: number;
      is_measured: boolean;
    },
    QiError
  > {
    const schemaEntry = this.schemas.get(schemaName);
    if (!schemaEntry) {
      return failure(
        createSchemaRegistryError(
          'SCHEMA_NOT_FOUND',
          `Cannot get performance metrics for unknown schema '${schemaName}'`,
          { schema_name: schemaName, operation: 'getEffectivePerformanceMetrics' }
        )
      );
    }

    const profile = schemaEntry.metadata.performance_profile;
    const isMeasured = profile.total_uses > 0;

    return success({
      accuracy: profile.measured_accuracy ?? profile.baseline_accuracy_estimate,
      latency_ms: profile.measured_latency_ms ?? profile.baseline_latency_estimate_ms,
      parsing_reliability:
        profile.measured_parsing_reliability ?? profile.baseline_parsing_reliability_estimate,
      is_measured: isMeasured,
    });
  }

  /**
   * Get schema names by complexity
   */
  getSchemaNamesByComplexity(): Record<SchemaComplexity, string[]> {
    const result: Record<SchemaComplexity, string[]> = {
      minimal: [],
      standard: [],
      detailed: [],
      optimized: [],
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
      performance_metrics: metricsConfig,
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
export function selectOptimalClassificationSchema(
  criteria?: SchemaSelectionCriteria
): Result<SchemaEntry, QiError> {
  return globalSchemaRegistry.selectOptimalSchema(criteria);
}

// Type exports are already available through the interface and class exports above
