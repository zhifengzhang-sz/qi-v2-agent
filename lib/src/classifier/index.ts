/**
 * Classifier Module - Public API
 *
 * Independent three-type classification: command, prompt, workflow.
 * No dependency on lib layer - follows app module pattern.
 */

// Export public abstractions
export type {
  ClassificationConfig,
  ClassificationMethod,
  ClassificationOptions,
  ClassificationResult,
  ClassificationStats,
  ClassificationType,
  IClassificationMethod,
  IClassifier,
  ProcessingContext,
} from './abstractions/index.js';

import type { ClassificationConfig, ClassificationMethod } from './abstractions/index.js';
import { InputClassifier } from './impl/input-classifier.js';
import { LangChainClassificationMethod } from './impl/langchain-classification-method.js';
import { RuleBasedClassificationMethod } from './impl/rule-based-classification-method.js';

/**
 * Classifier factory configuration
 */
export interface ClassifierFactoryConfig extends Partial<ClassificationConfig> {
  // Additional factory-specific options if needed
}

/**
 * Create a classifier with rule-based method (LEGACY)
 *
 * Usage:
 * ```typescript
 * const classifier = createClassifier()
 * const result = await classifier.classify('hello world')
 * ```
 */
export function createClassifier(config: ClassifierFactoryConfig = {}): InputClassifier {
  // Use rule-based method by default for backward compatibility
  const method = new RuleBasedClassificationMethod({
    commandPrefix: '/',
    promptIndicators: ['hi', 'hello', 'what', 'how', 'why', 'explain'],
    workflowIndicators: ['fix', 'create', 'refactor', 'implement', 'debug'],
    confidenceThreshold: 0.8,
    ...config,
  });
  return new InputClassifier(method);
}

/**
 * Create simple rule-based classifier (fast, no LLM needed)
 */
export function createRuleBasedClassifier(
  config: Partial<{
    commandPrefix: string;
    promptIndicators: string[];
    workflowIndicators: string[];
    confidenceThreshold: number;
  }> = {}
): InputClassifier {
  const method = new RuleBasedClassificationMethod({
    commandPrefix: config.commandPrefix || '/',
    promptIndicators: config.promptIndicators || ['hi', 'hello', 'what', 'how', 'why', 'explain'],
    workflowIndicators: config.workflowIndicators || ['fix', 'create', 'refactor', 'implement', 'debug'],
    confidenceThresholds: new Map([
      ['command', config.confidenceThreshold || 0.8],
      ['prompt', config.confidenceThreshold || 0.8],
      ['workflow', config.confidenceThreshold || 0.8],
    ]),
  });
  return new InputClassifier(method);
}

/**
 * Create LLM-based classifier (LEGACY - use createLangChainClassifier instead)
 */
export function createLLMClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
  }> = {}
): LangChainClassificationMethod {
  // Redirect to LangChain implementation since LLMClassificationMethod was removed
  return createLangChainClassifier({
    baseUrl: (config.baseUrl || 'http://localhost:11434') + '/v1',
    modelId: config.modelId,
    temperature: config.temperature,
  });
}

/**
 * Create LangChain-based classifier with withStructuredOutput (RECOMMENDED)
 * 
 * Uses proper LangChain patterns with OpenAI-compatible API to avoid ChatOllama issues.
 * Implements full qicore Result<T> patterns with flatMap chains.
 * 
 * Usage:
 * ```typescript
 * const method = createLangChainClassifier({
 *   baseUrl: 'http://localhost:11434/v1',
 *   modelId: 'qwen2.5:7b'
 * })
 * const classifier = new InputClassifier(method)
 * const result = await classifier.classify('hello world')
 * ```
 */
export function createLangChainClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
  }> = {}
): LangChainClassificationMethod {
  const defaultConfig = {
    baseUrl: 'http://localhost:11434/v1', // OpenAI-compatible endpoint
    modelId: 'qwen2.5:7b',
    temperature: 0.1,
    maxTokens: 1000,
    apiKey: 'ollama', // Not needed for Ollama but required by OpenAI client
    ...config,
  };
  return new LangChainClassificationMethod(defaultConfig);
}

/**
 * Create hybrid classifier (rule-based + LLM fallback)
 * Simplified implementation using existing methods
 */
export function createHybridClassifier(
  config: Partial<{
    confidenceThreshold: number;
    baseUrl: string;
    modelId: string;
  }> = {}
): InputClassifier {
  // For now, just return the LangChain method since it's most accurate
  // TODO: Implement actual hybrid logic if needed
  return createInputClassifier({ 
    method: 'langchain-structured',
    ...config 
  });
}

/**
 * Create ensemble classifier (highest accuracy, multiple LLM calls)
 * Simplified implementation using LangChain method
 */
export function createEnsembleClassifier(
  config: Partial<{
    minimumAgreement: number;
  }> = {}
): InputClassifier {
  // For now, just return the LangChain method since ensemble was over-engineered
  // TODO: Implement actual ensemble logic if needed
  return createInputClassifier({ method: 'langchain-structured' });
}

/**
 * Create an input classifier with configurable method (RECOMMENDED)
 * 
 * Follows the same pattern as prompt module's createPromptHandler().
 * Provides simple API that hides qicore and LangChain complexity.
 * 
 * Usage:
 * ```typescript
 * // Default (LangChain-based - best accuracy)
 * const classifier = createInputClassifier()
 * 
 * // Specify method explicitly
 * const classifier = createInputClassifier({ method: 'rule-based' })
 * const classifier = createInputClassifier({ method: 'langchain-structured' })
 * const classifier = createInputClassifier({ method: 'hybrid' })
 * 
 * // With method-specific config
 * const classifier = createInputClassifier({
 *   method: 'langchain-structured',
 *   baseUrl: 'http://localhost:11434/v1',
 *   modelId: 'qwen2.5:7b'
 * })
 * ```
 */
export function createInputClassifier(
  config: Partial<{
    // Method selection
    method: ClassificationMethod;
    
    // LangChain/LLM-specific config
    baseUrl: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
    
    // Rule-based specific config  
    commandPrefix: string;
    promptIndicators: string[];
    workflowIndicators: string[];
    confidenceThreshold: number;
    
    // Hybrid-specific config
    fallbackMethod: ClassificationMethod;
  }> = {}
): InputClassifier {
  const method = config.method || 'langchain-structured'; // Default to best method
  
  switch (method) {
    case 'rule-based':
      const ruleMethod = new RuleBasedClassificationMethod({
        commandPrefix: config.commandPrefix || '/',
        promptIndicators: config.promptIndicators || ['hi', 'hello', 'what', 'how', 'why', 'explain'],
        workflowIndicators: config.workflowIndicators || ['fix', 'create', 'refactor', 'implement', 'debug'],
        confidenceThresholds: new Map([
          ['command', config.confidenceThreshold || 0.8],
          ['prompt', config.confidenceThreshold || 0.8],
          ['workflow', config.confidenceThreshold || 0.8],
        ]),
      });
      return new InputClassifier(ruleMethod);
      
    case 'langchain-structured':
      const langchainMethod = createLangChainClassifier({
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        apiKey: config.apiKey,
      });
      return new InputClassifier(langchainMethod);
      
    case 'llm-based':
      // Redirect to LangChain since LLM method was removed
      const llmMethod = createLangChainClassifier({
        baseUrl: (config.baseUrl || 'http://localhost:11434') + '/v1',
        modelId: config.modelId,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        apiKey: config.apiKey,
      });
      return new InputClassifier(llmMethod);
      
    case 'hybrid':
    case 'ensemble':
      // Simplified: just use LangChain method for now
      const simplifiedMethod = createLangChainClassifier({
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        apiKey: config.apiKey,
      });
      return new InputClassifier(simplifiedMethod);
      
    default:
      // Fallback to LangChain method
      const defaultMethod = createLangChainClassifier(config);
      return new InputClassifier(defaultMethod);
  }
}

/**
 * Create a fast rule-based classifier (no LLM needed)
 * Perfect for development, testing, or when you need instant responses
 */
export function createFastClassifier(
  config: Partial<{
    commandPrefix: string;
    promptIndicators: string[];
    workflowIndicators: string[];
    confidenceThreshold: number;
  }> = {}
): InputClassifier {
  return createInputClassifier({ method: 'rule-based', ...config });
}

/**
 * Create an accurate LLM-based classifier (requires Ollama)
 * Best accuracy but slower due to LLM inference
 */
export function createAccurateClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
  }> = {}
): InputClassifier {
  return createInputClassifier({ method: 'langchain-structured', ...config });
}

/**
 * Create a balanced hybrid classifier (rule-based + LLM fallback)
 * Fast for simple cases, accurate for complex ones
 */
export function createBalancedClassifier(
  config: Partial<{
    confidenceThreshold: number;
    baseUrl: string;
    modelId: string;
  }> = {}
): InputClassifier {
  return createInputClassifier({ method: 'hybrid', ...config });
}

// Legacy aliases for demos and backward compatibility
export const createBasicClassifier = createRuleBasedClassifier;
export const createCompleteClassifier = createInputClassifier; // Now points to main factory

// Export implementation classes for demos and testing  
export { RuleBasedClassificationMethod, LangChainClassificationMethod };
export { LLMClassificationMethod } from './impl/llm-classification-method.js';

// Export new LangChain classifiers
export { GenericLangChainClassifier } from './impl/generic-langchain-classifier.js';
export { FewShotLangChainClassifier } from './impl/few-shot-langchain-classifier.js';
export { OutputParserLangChainClassifier } from './impl/output-parser-langchain-classifier.js';
export { ChatPromptTemplateLangChainClassifier } from './impl/chat-prompt-langchain-classifier.js';
export { OutputFixingParserLangChainClassifier } from './impl/output-fixing-langchain-classifier.js';

// Export the main factory as default for easy imports
export { createInputClassifier as default };
