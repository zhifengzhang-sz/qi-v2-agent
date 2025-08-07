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
import { OllamaNativeClassificationMethod } from './impl/ollama-native.js';
import { ChatOllamaFunctionCallingClassificationMethod } from './impl/langchain-ollama-function-calling.js';
import { LangChainFunctionCallingClassificationMethod } from './impl/langchain-function-calling.js';
import { PythonLangChainMCPClassificationMethod } from './impl/python-langchain-mcp.js';
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
 * Create Native Ollama classifier with JSON schema format (FASTEST & MOST RELIABLE)
 * 
 * Uses Ollama's native /api/generate endpoint with JSON schema format parameter.
 * Direct communication with Ollama - no LangChain overhead or compatibility issues.
 * Expected: 90%+ accuracy, <5 second latency, explicit error handling.
 * 
 * Usage:
 * ```typescript
 * const method = createOllamaNativeClassifier({
 *   baseUrl: 'http://localhost:11434',
 *   modelId: 'llama3.2:3b'
 * })
 * const classifier = new InputClassifier(method)
 * const result = await classifier.classify('hello world')
 * ```
 */
export function createOllamaNativeClassifier(
  config: Partial<{
    baseUrl: string;
    modelId: string;
    temperature: number;
    schemaName: string;
    schemaComplexity: 'minimal' | 'standard' | 'detailed' | 'optimized';
  }> = {}
): OllamaNativeClassificationMethod {
  const defaultConfig = {
    baseUrl: 'http://localhost:11434', // Native Ollama endpoint
    modelId: 'llama3.2:3b',
    temperature: 0.1,
    schemaName: 'minimal',
    schemaComplexity: 'minimal' as const,
    ...config,
  };
  return new OllamaNativeClassificationMethod(defaultConfig);
}

// All broken LangChain methods removed - keeping only working implementations

/**
 * Create an input classifier with configurable method (RECOMMENDED)
 * 
 * Only includes methods that actually work - no broken implementations.
 * Provides simple API that hides qicore complexity.
 * 
 * Usage:
 * ```typescript
 * // Default (ollama-native - best reliability)
 * const classifier = createInputClassifier()
 * 
 * // Specify method explicitly
 * const classifier = createInputClassifier({ method: 'rule-based' }) // Fast, no LLM needed
 * const classifier = createInputClassifier({ method: 'ollama-native' }) // Direct API, reliable
 * const classifier = createInputClassifier({ method: 'langchain-ollama-function-calling' }) // Only working LangChain method
 * 
 * // With method-specific config
 * const classifier = createInputClassifier({
 *   method: 'ollama-native',
 *   baseUrl: 'http://localhost:11434',
 *   modelId: 'llama3.2:3b'
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
    timeout: number;
    
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
  const method = config.method || 'ollama-native'; // Default to reliable native method
  
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

    case 'ollama-native':
      const ollamaNativeMethod = createOllamaNativeClassifier({
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        temperature: config.temperature,
        schemaName: config.schemaName,
      });
      return new InputClassifier(ollamaNativeMethod);

    case 'langchain-ollama-function-calling':
      // Original working ChatOllama implementation
      const ollamaFunctionCallingMethod = new ChatOllamaFunctionCallingClassificationMethod({
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        temperature: config.temperature,
        timeout: config.timeout,
        schemaName: config.schemaName,
        schemaSelectionCriteria: config.schemaSelectionCriteria,
      });
      return new InputClassifier(ollamaFunctionCallingMethod);
      
    case 'langchain-function-calling':
      // New provider-agnostic function calling method
      const functionCallingMethod = new LangChainFunctionCallingClassificationMethod({
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        apiKey: config.apiKey,
        temperature: config.temperature,
        timeout: config.timeout,
        schemaName: config.schemaName,
        schemaSelectionCriteria: config.schemaSelectionCriteria,
      });
      return new InputClassifier(functionCallingMethod);

    case 'python-langchain-mcp':
      const pythonMcpMethod = new PythonLangChainMCPClassificationMethod({
        baseUrl: config.baseUrl,
        modelId: config.modelId,
        temperature: config.temperature,
        timeout: config.timeout,
        schemaName: config.schemaName,
        schemaSelectionCriteria: config.schemaSelectionCriteria,
      });
      return new InputClassifier(pythonMcpMethod);
      
    default:
      throw new Error(`Invalid classification method: "${method}". Valid methods are: rule-based, ollama-native, langchain-ollama-function-calling, langchain-function-calling, python-langchain-mcp`);
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
    schemaName: string;
  }> = {}
): InputClassifier {
  return createInputClassifier({ method: 'ollama-native', ...config });
}


// Legacy aliases for demos and backward compatibility
export const createBasicClassifier = createRuleBasedClassifier;
export const createCompleteClassifier = createInputClassifier; // Now points to main factory

// Export only working implementation classes
export { 
  RuleBasedClassificationMethod, 
  OllamaNativeClassificationMethod,
  ChatOllamaFunctionCallingClassificationMethod, // Legacy - kept for backward compatibility
  LangChainFunctionCallingClassificationMethod, // New provider-agnostic implementation
  PythonLangChainMCPClassificationMethod,
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
