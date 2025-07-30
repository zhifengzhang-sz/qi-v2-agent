// Three-Type Input Classification System - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { ProcessingContext } from './cognitive-patterns.js';

/**
 * Classification method types
 */
export type ClassificationMethod = 'rule-based' | 'llm-based' | 'hybrid' | 'ensemble';

/**
 * Input classification result
 */
export interface InputClassificationResult {
  readonly type: 'command' | 'prompt' | 'workflow';
  readonly confidence: number;
  readonly detectionMethod: ClassificationMethod;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly extractedData: ReadonlyMap<string, unknown>;
  readonly reasoning?: string;
  readonly methodsUsed?: readonly ClassificationMethod[];
}

/**
 * Classification configuration
 */
export interface ClassificationConfig {
  readonly defaultMethod: ClassificationMethod;
  readonly fallbackMethod: ClassificationMethod;
  readonly confidenceThreshold: number;
  readonly ensembleForUncertain: boolean;
  readonly commandPrefix: string;
  readonly promptIndicators: readonly string[];
  readonly workflowIndicators: readonly string[];
  readonly confidenceThresholds: ReadonlyMap<string, number>;
}

/**
 * Multi-method input classifier interface
 */
export interface IInputClassifier {
  classifyInput(
    input: string, 
    method?: ClassificationMethod,
    context?: ProcessingContext
  ): Promise<InputClassificationResult>;
  getSupportedTypes(): readonly string[];
  getSupportedMethods(): readonly ClassificationMethod[];
  updateClassificationRules(config: ClassificationConfig): void;
}

/**
 * Individual classification method interface
 */
export interface IClassificationMethod {
  classify(input: string, context?: ProcessingContext): Promise<InputClassificationResult>;
  getMethodName(): ClassificationMethod;
  getExpectedAccuracy(): number;
  getAverageLatency(): number;
}