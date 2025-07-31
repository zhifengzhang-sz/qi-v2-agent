/**
 * Classifier Module - Public API
 * 
 * Independent three-type classification: command, prompt, workflow.
 * No dependency on lib layer - follows app module pattern.
 */

// Export public abstractions
export type {
  ClassificationMethod,
  ClassificationType,
  ProcessingContext,
  ClassificationResult,
  ClassificationConfig,
  ClassificationStats,
  ClassificationOptions,
  IClassifier,
  IClassificationMethod
} from './abstractions/index.js';

// Export factory function (not implementation class)
import { RuleBasedClassifier } from './impl/RuleBasedClassifier.js';
import { InputClassifier } from './impl/input-classifier.js';
import { MultiMethodInputClassifier } from './impl/multi-method-input-classifier.js';
import { RuleBasedClassificationMethod } from './impl/rule-based-classification-method.js';
import { LLMClassificationMethod } from './impl/llm-classification-method.js';
import { HybridClassificationMethod } from './impl/hybrid-classification-method.js';
import { EnsembleClassificationMethod } from './impl/ensemble-classification-method.js';
import type { ClassificationConfig } from './abstractions/index.js';

/**
 * Classifier factory configuration
 */
export interface ClassifierFactoryConfig extends Partial<ClassificationConfig> {
  // Additional factory-specific options if needed
}

/**
 * Create a classifier with default rule-based implementation
 * 
 * Usage:
 * ```typescript
 * const classifier = createClassifier({
 *   defaultMethod: 'rule-based',
 *   confidenceThreshold: 0.8
 * })
 * 
 * const result = await classifier.classify('hello world', {
 *   includeReasoning: true
 * })
 * ```
 */
export function createClassifier(config: ClassifierFactoryConfig = {}): InputClassifier {
  return new InputClassifier(config);
}

/**
 * Create simple rule-based classifier (original implementation)
 */
export function createRuleBasedClassifier(config: ClassifierFactoryConfig = {}): RuleBasedClassifier {
  return new RuleBasedClassifier(config);
}

/**
 * Create multi-method classifier with multiple classification strategies
 */
export function createMultiMethodClassifier(config: ClassifierFactoryConfig = {}): MultiMethodInputClassifier {
  return new MultiMethodInputClassifier(config);
}

/**
 * Create LLM-based classifier (requires Ollama)
 */
export function createLLMClassifier(config: Partial<{
  baseUrl: string;
  modelId: string;
  temperature: number;
}> = {}): LLMClassificationMethod {
  const defaultConfig = {
    baseUrl: 'http://localhost:11434',
    modelId: 'qwen2.5:7b',
    temperature: 0.1,
    ...config
  };
  return new LLMClassificationMethod(defaultConfig);
}

/**
 * Create hybrid classifier (rule-based + LLM fallback)
 */
export function createHybridClassifier(config: Partial<{
  confidenceThreshold: number;
}> = {}): HybridClassificationMethod {
  const defaultConfig = {
    confidenceThreshold: 0.8,
    ruleBasedConfig: {
      commandPrefix: '/',
      promptIndicators: ['hi', 'hello', 'what', 'how', 'why', 'explain'],
      workflowIndicators: ['fix', 'create', 'refactor', 'implement', 'debug']
    },
    llmConfig: {
      baseUrl: 'http://localhost:11434',
      modelId: 'qwen2.5:7b'
    },
    ...config
  };
  return new HybridClassificationMethod(defaultConfig);
}

/**
 * Create ensemble classifier (highest accuracy, multiple LLM calls)
 */
export function createEnsembleClassifier(config: Partial<{
  minimumAgreement: number;
}> = {}): EnsembleClassificationMethod {
  const defaultConfig = {
    minimumAgreement: 0.6,
    llmConfig: {
      baseUrl: 'http://localhost:11434',
      modelId: 'qwen2.5:7b'
    },
    ...config
  };
  return new EnsembleClassificationMethod(defaultConfig);
}

// Legacy aliases for demos
export const createBasicClassifier = createRuleBasedClassifier;
export const createCompleteClassifier = createMultiMethodClassifier;