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
import { LangChainClassificationMethod } from './impl/structured-output.js';
import { FewShotLangChainClassificationMethod } from './impl/fewshot.js';
import { OutputParserLangChainClassificationMethod } from './impl/output-parser.js';
import { ChatPromptLangChainClassificationMethod } from './impl/chat-prompt.js';
import { OutputFixingLangChainClassificationMethod } from './impl/output-fixing.js';
import { LLMClassificationMethod } from './impl/llm-direct.js';
import { RuleBasedClassificationMethod } from './impl/rule-based.js';

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
    schemaName: string;
    schemaSelectionCriteria: import('./schema-registry.js').SchemaSelectionCriteria;
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
 * Create FewShot LangChain classifier (example-driven learning)
 */
export function createFewShotLangChainClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
    schemaName: string;
    schemaSelectionCriteria: import('./schema-registry.js').SchemaSelectionCriteria;
  }> = {},
  customExamples?: import('./impl/fewshot.js').ClassificationExample[]
): FewShotLangChainClassificationMethod {
  const defaultConfig = {
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'qwen2.5:7b',
    temperature: 0.1,
    maxTokens: 1000,
    apiKey: 'ollama',
    ...config,
  };
  return new FewShotLangChainClassificationMethod(defaultConfig, customExamples);
}

/**
 * Create OutputParser LangChain classifier (legacy model support)
 */
export function createOutputParserLangChainClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
    schemaName: string;
    schemaSelectionCriteria: import('./schema-registry.js').SchemaSelectionCriteria;
    maxRetries: number;
    temperatureIncrement: number;
  }> = {}
): OutputParserLangChainClassificationMethod {
  const defaultConfig = {
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'qwen2.5:7b',
    temperature: 0.1,
    maxTokens: 1000,
    apiKey: 'ollama',
    ...config,
  };
  return new OutputParserLangChainClassificationMethod(defaultConfig);
}

/**
 * Create ChatPrompt LangChain classifier (conversational context)
 */
export function createChatPromptLangChainClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
    schemaName: string;
    schemaSelectionCriteria: import('./schema-registry.js').SchemaSelectionCriteria;
    systemPrompt: string;
    userExperienceLevel: 'beginner' | 'intermediate' | 'expert';
    enableStreaming: boolean;
  }> = {}
): ChatPromptLangChainClassificationMethod {
  const defaultConfig = {
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'qwen2.5:7b',
    temperature: 0.1,
    maxTokens: 1000,
    apiKey: 'ollama',
    ...config,
  };
  return new ChatPromptLangChainClassificationMethod(defaultConfig);
}

/**
 * Create OutputFixing LangChain classifier (auto-correction)
 */
export function createOutputFixingLangChainClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
    maxTokens: number;
    apiKey: string;
    schemaName: string;
    schemaSelectionCriteria: import('./schema-registry.js').SchemaSelectionCriteria;
    maxRetries: number;
    temperatureIncrement: number;
    maxFixingAttempts: number;
    enableComparison: boolean;
  }> = {}
): OutputFixingLangChainClassificationMethod {
  const defaultConfig = {
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'qwen2.5:7b',
    temperature: 0.1,
    maxTokens: 1000,
    apiKey: 'ollama',
    ...config,
  };
  return new OutputFixingLangChainClassificationMethod(defaultConfig);
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
 * const classifier = createInputClassifier({ method: 'llm-based' })
 * const classifier = createInputClassifier({ method: 'langchain-structured' })
 * const classifier = createInputClassifier({ method: 'hybrid' })
 * 
 * // With method-specific config
 * const classifier = createInputClassifier({
 *   method: 'llm-based',
 *   baseUrl: 'http://localhost:11434',
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
    
    // Schema selection options (for LangChain methods)
    schemaName: string;
    schemaSelectionCriteria: import('./schema-registry.js').SchemaSelectionCriteria;
    
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
        schemaName: config.schemaName,
        schemaSelectionCriteria: config.schemaSelectionCriteria,
      });
      return new InputClassifier(langchainMethod);
      
    case 'llm-based':
      const llmMethod = new LLMClassificationMethod({
        baseUrl: config.baseUrl || 'http://localhost:11434',
        modelId: config.modelId,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
      return new InputClassifier(llmMethod);
      
    case 'fewshot-langchain':
      const fewshotMethod = createFewShotLangChainClassifier(config);
      return new InputClassifier(fewshotMethod);
      
    case 'chatprompt-langchain':
      const chatpromptMethod = createChatPromptLangChainClassifier(config);
      return new InputClassifier(chatpromptMethod);
      
    case 'outputparser-langchain':
      const outputparserMethod = createOutputParserLangChainClassifier(config);
      return new InputClassifier(outputparserMethod);
      
    case 'outputfixing-langchain':
      const outputfixingMethod = createOutputFixingLangChainClassifier(config);
      return new InputClassifier(outputfixingMethod);
      
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


// Legacy aliases for demos and backward compatibility
export const createBasicClassifier = createRuleBasedClassifier;
export const createCompleteClassifier = createInputClassifier; // Now points to main factory

// Export implementation classes for demos and testing  
export { 
  RuleBasedClassificationMethod, 
  LangChainClassificationMethod, 
  FewShotLangChainClassificationMethod,
  OutputParserLangChainClassificationMethod,
  ChatPromptLangChainClassificationMethod,
  OutputFixingLangChainClassificationMethod,
  LLMClassificationMethod, 
  InputClassifier 
};

// Export schema registry for advanced usage
export { 
  globalSchemaRegistry, 
  getClassificationSchema, 
  selectOptimalClassificationSchema,
  type SchemaComplexity,
  type SchemaEntry,
  type SchemaMetadata,
  type SchemaSelectionCriteria 
} from './schema-registry.js';

// Export the main factory as default for easy imports
export { createInputClassifier as default };
