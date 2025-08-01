/**
 * Classifier Module - Abstract Interfaces
 *
 * Technology-agnostic classification interfaces independent of lib layer.
 * Follows three-type classification system: command/prompt/workflow.
 */

/**
 * Classification method types
 */
export type ClassificationMethod = 'rule-based' | 'llm-based' | 'hybrid' | 'ensemble';

/**
 * Three input types for classification
 */
export type ClassificationType = 'command' | 'prompt' | 'workflow';

/**
 * Processing context for classification
 */
export interface ProcessingContext {
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly previousInputs?: readonly string[];
  readonly environmentContext?: ReadonlyMap<string, unknown>;
  readonly userPreferences?: ReadonlyMap<string, unknown>;
}

/**
 * Classification result
 */
export interface ClassificationResult {
  readonly type: ClassificationType;
  readonly confidence: number;
  readonly method: ClassificationMethod;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly extractedData: ReadonlyMap<string, unknown>;
  readonly reasoning?: string;
  readonly alternativeTypes?: readonly {
    type: ClassificationType;
    confidence: number;
  }[];
}

/**
 * LLM configuration for classification
 */
export interface LLMConfig {
  readonly provider: string;
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly baseURL?: string;
}

/**
 * Classification configuration
 */
export interface ClassificationConfig {
  readonly defaultMethod: ClassificationMethod;
  readonly fallbackMethod?: ClassificationMethod;
  readonly confidenceThreshold: number;
  readonly enableDebugMode?: boolean;
  readonly commandPrefix: string;
  readonly promptIndicators: readonly string[];
  readonly workflowIndicators: readonly string[];
  readonly complexityThresholds: ReadonlyMap<string, number>;
  readonly llmConfig?: LLMConfig;
}

/**
 * Classification statistics
 */
export interface ClassificationStats {
  readonly totalClassifications: number;
  readonly averageConfidence: number;
  readonly averageProcessingTime: number;
  readonly typeDistribution: ReadonlyMap<ClassificationType, number>;
  readonly methodUsage: ReadonlyMap<ClassificationMethod, number>;
  readonly accuracyMetrics?: ReadonlyMap<string, number>;
}

/**
 * Classification options
 */
export interface ClassificationOptions {
  readonly method?: ClassificationMethod;
  readonly context?: ProcessingContext;
  readonly includeMetadata?: boolean;
  readonly includeReasoning?: boolean;
  readonly includeAlternatives?: boolean;
}

/**
 * Main classifier interface
 */
export interface IClassifier {
  /**
   * Classify input text into command/prompt/workflow
   */
  classify(input: string, options?: ClassificationOptions): Promise<ClassificationResult>;

  /**
   * Configure classifier behavior
   */
  configure(config: Partial<ClassificationConfig>): void;

  /**
   * Get supported classification types
   */
  getSupportedTypes(): readonly ClassificationType[];

  /**
   * Get supported classification methods
   */
  getSupportedMethods(): readonly ClassificationMethod[];

  /**
   * Get classification statistics
   */
  getStats(): ClassificationStats;

  /**
   * Reset statistics
   */
  resetStats(): void;

  /**
   * Validate configuration
   */
  validateConfig(config: ClassificationConfig): boolean;
}

/**
 * Individual classification method interface
 */
export interface IClassificationMethod {
  /**
   * Classify using this specific method
   */
  classify(input: string, context?: ProcessingContext): Promise<ClassificationResult>;

  /**
   * Get method identifier
   */
  getMethodName(): ClassificationMethod;

  /**
   * Get expected accuracy for this method
   */
  getExpectedAccuracy(): number;

  /**
   * Get average processing latency
   */
  getAverageLatency(): number;

  /**
   * Check if method is available/ready
   */
  isAvailable(): Promise<boolean>;
}
