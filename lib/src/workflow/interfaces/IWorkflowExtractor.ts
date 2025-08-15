/**
 * @qi/workflow - Workflow extractor interface
 *
 * Abstract interface for extracting workflows from natural language
 */

import type {
  IDecompositionStrategy,
  WorkflowContext,
} from '../strategies/IDecompositionStrategy.js';
import type {
  ProcessingContext,
  WorkflowExtractionResult,
  WorkflowMode,
  WorkflowSpec,
} from './IWorkflow.js';

/**
 * Workflow extraction method specification
 */
export interface WorkflowExtractionMethod {
  readonly method: 'strategy-based' | 'template-based' | 'hybrid';
  readonly strategy?: IDecompositionStrategy; // For strategy-based
  readonly strategyName?: string; // For strategy selection
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
   * @param method How to extract the workflow (strategy, template, hybrid)
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
   * Get available strategies
   */
  getAvailableStrategies(): readonly IDecompositionStrategy[];
}

/**
 * Workflow extractor configuration
 */
export interface IWorkflowExtractorConfig {
  readonly supportedModes: readonly WorkflowMode[];
  readonly strategies: readonly IDecompositionStrategy[]; // Available strategies
  readonly templateModes?: readonly string[]; // Available template modes
  readonly defaultMethod?: WorkflowExtractionMethod; // Default extraction method
}
