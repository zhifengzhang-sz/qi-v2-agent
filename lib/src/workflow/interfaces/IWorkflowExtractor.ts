/**
 * @qi/workflow - Workflow extractor interface
 *
 * Abstract interface for extracting workflows from natural language
 */

import type {
  ProcessingContext,
  WorkflowExtractionResult,
  WorkflowMode,
  WorkflowSpec,
} from './IWorkflow.js';

/**
 * Abstract workflow extractor interface
 */
export interface IWorkflowExtractor {
  /**
   * Extract workflow specification from natural language input
   */
  extractWorkflow(input: string, context?: ProcessingContext): Promise<WorkflowExtractionResult>;

  /**
   * Get supported workflow modes
   */
  getSupportedModes(): readonly WorkflowMode[];

  /**
   * Validate a workflow specification
   */
  validateWorkflowSpec(spec: WorkflowSpec): Promise<boolean>;

  /**
   * Get workflow templates for a specific mode
   */
  getWorkflowTemplates(mode: string): Promise<readonly WorkflowSpec[]>;
}

/**
 * Workflow extractor configuration
 */
export interface IWorkflowExtractorConfig {
  readonly supportedModes: readonly WorkflowMode[];
  readonly patternMapping: readonly [string, string][];
  readonly baseUrl?: string;
  readonly modelId?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}
