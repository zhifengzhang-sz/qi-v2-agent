/**
 * @qi/workflow - Workflow extractor interface
 *
 * Abstract interface for extracting workflows from natural language
 */

// Strategy system removed - using direct pattern implementations instead

import type {
  ProcessingContext,
  WorkflowContext,
  WorkflowExtractionResult,
  WorkflowMode,
  WorkflowSpec,
} from './IWorkflow.js';

/**
 * Workflow extraction method specification
 */
export interface WorkflowExtractionMethod {
  readonly method: 'template-based' | 'llm-based' | 'hybrid';
  readonly templateMode?: string; // For template-based
  readonly promptProvider?: any; // LLM provider interface (user-configurable)
}

/**
 * Abstract workflow extractor interface
 */
export interface IWorkflowExtractor {
  /**
   * Extract workflow specification from natural language input
   *
   * @param input Natural language task description
   * @param method How to extract the workflow (template, llm, hybrid)
   * @param context Execution context
   */
  extractWorkflow(
    input: string,
    method: WorkflowExtractionMethod,
    context: WorkflowContext
  ): Promise<WorkflowExtractionResult>;

  /**
   * Get supported workflow modes
   */
  getSupportedModes(): readonly WorkflowMode[];

  /**
   * Validate a workflow specification
   */
  validateWorkflowSpec(spec: WorkflowSpec): Promise<boolean>;

  /**
   * Get supported extraction methods
   */
  getSupportedMethods(): readonly WorkflowExtractionMethod['method'][];
}

/**
 * Workflow extractor configuration
 */
export interface IWorkflowExtractorConfig {
  readonly supportedModes: readonly WorkflowMode[];
  readonly templateModes?: readonly string[]; // Available template modes
  readonly defaultMethod?: WorkflowExtractionMethod; // Default extraction method
  readonly enableLLMExtraction?: boolean; // Enable LLM-based extraction
}
