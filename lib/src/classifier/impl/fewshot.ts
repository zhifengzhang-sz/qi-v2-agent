/**
 * FewShot LangChain Classification Method - Professional Implementation
 *
 * Uses LangChain FewShotPromptTemplate with proper qicore Result<T> handling
 * and examples to improve classification accuracy through example-driven learning.
 */

import { create, failure, flatMap, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { FewShotPromptTemplate, PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { 
  globalSchemaRegistry, 
  selectOptimalClassificationSchema,
  type SchemaSelectionCriteria,
  type SchemaEntry 
} from '../schema-registry.js';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { composeOpenAIEndpoint, getOllamaBaseUrl } from '../shared/url-utils.js';
import { detectCommand } from './command-detection-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for few-shot classification errors using standardized error types
 */
const createFewShotClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('fewshot-langchain', code, message, category, context);

/**
 * Configuration for FewShot LangChain classification method
 */
export interface FewShotLangChainClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
  
  // Custom examples (optional)
  customExamples?: ClassificationExample[];
}

/**
 * Classification example for few-shot learning
 */
export interface ClassificationExample {
  input: string;
  output: {
    type: 'prompt' | 'workflow';
    confidence: number;
    reasoning: string;
  };
}

/**
 * Built-in examples for few-shot classification
 */
const DEFAULT_EXAMPLES: ClassificationExample[] = [
  {
    input: 'hi',
    output: { type: 'prompt', confidence: 1.0, reasoning: 'Simple greeting, conversational input' }
  },
  {
    input: 'what is recursion?',
    output: { type: 'prompt', confidence: 0.9, reasoning: 'Single question about a concept' }
  },
  {
    input: 'write a function to sort an array',
    output: { type: 'prompt', confidence: 0.8, reasoning: 'Single-step coding request' }
  },
  {
    input: 'explain how React hooks work',
    output: { type: 'prompt', confidence: 0.9, reasoning: 'Educational explanation request' }
  },
  {
    input: 'fix the bug in auth.js and run tests',
    output: { type: 'workflow', confidence: 0.9, reasoning: 'Multi-step task: fix + test' }
  },
  {
    input: 'create a new API endpoint with validation and documentation',
    output: { type: 'workflow', confidence: 0.95, reasoning: 'Complex multi-step development task' }
  },
  {
    input: 'analyze this codebase and suggest improvements',
    output: { type: 'workflow', confidence: 0.9, reasoning: 'Analysis task requiring multiple steps' }
  },
  {
    input: 'refactor the user service, update tests, and deploy',
    output: { type: 'workflow', confidence: 0.95, reasoning: 'Clear multi-step workflow: refactor + test + deploy' }
  }
];

/**
 * FewShot LangChain-based classification using FewShotPromptTemplate
 * Implements proper qicore Result<T> patterns with examples for better accuracy
 */
export class FewShotLangChainClassificationMethod implements IClassificationMethod {
  private llmWithStructuredOutput: any;
  private config: FewShotLangChainClassificationConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;
  private examples: ClassificationExample[];

  constructor(config: FewShotLangChainClassificationConfig, customExamples?: ClassificationExample[]) {
    this.config = config;
    this.examples = customExamples || DEFAULT_EXAMPLES;
  }

  /**
   * Validate that the model exists and supports function calling
   */
  private async validatePrerequisites(): Promise<void> {
    const baseUrl = this.config.baseUrl || 'http://localhost:11434';
    const modelId = this.config.modelId || 'qwen2.5:7b';

    // Check if model exists
    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to connect to Ollama at ${baseUrl}: ${response.status}`);
      }

      const data = await response.json();
      const models = data.models || [];
      const modelExists = models.some((model: any) => model.name === modelId || model.name.startsWith(modelId + ':'));
      
      if (!modelExists) {
        const availableModels = models.map((m: any) => m.name).join(', ');
        throw new Error(`Model '${modelId}' not found. Available models: ${availableModels}`);
      }
    } catch (error) {
      throw new Error(`Model validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check function calling support
    try {
      const testResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Test' }],
          tools: [{ type: 'function', function: { name: 'test', parameters: {} } }]
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      const testResult: any = await testResponse.json();
      
      if (testResult.error && testResult.error.message && testResult.error.message.includes('does not support tools')) {
        throw new Error(`Model '${modelId}' does not support function calling, which is required for FewShot classification`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('does not support tools')) {
        throw error;
      }
      // Other errors (network, timeout) are not function calling issues
      console.warn(`Function calling test failed (${error}), proceeding with assumption of support`);
    }
  }

  private async initializeLLM(): Promise<void> {
    // Validate prerequisites first
    await this.validatePrerequisites();
    
    try {
      // Select schema based on configuration or criteria
      const schemaResult = this.selectSchema();
      const selectedSchema = await match(
        async (schema) => schema,
        async (error) => {
          throw new Error(`Schema selection failed: ${error.message}`);
        },
        schemaResult
      );
      this.selectedSchema = selectedSchema;
      
      // Use dynamic imports for better compatibility
      const { ChatOpenAI } = await import('@langchain/openai');
      
      const llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen2.5:7b',
        temperature: this.config.temperature || 0.1,
        maxTokens: this.config.maxTokens || 1000,
        configuration: {
          baseURL: composeOpenAIEndpoint(this.config.baseUrl || 'http://localhost:11434'),
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Use LangChain's withStructuredOutput with dynamically selected schema
      this.llmWithStructuredOutput = llm.withStructuredOutput(this.selectedSchema!.schema, {
        name: this.selectedSchema!.metadata.name,
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize FewShot LangChain classification: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Select schema based on configuration or automatic criteria
   */
  private selectSchema(): Result<SchemaEntry, QiError> {
    // If explicit schema name provided, use it
    if (this.config.schemaName) {
      return globalSchemaRegistry.getSchema(this.config.schemaName);
    }

    // Use selection criteria if provided
    if (this.config.schemaSelectionCriteria) {
      return selectOptimalClassificationSchema(this.config.schemaSelectionCriteria);
    }

    // Default to standard schema for few-shot learning
    const defaultCriteria: SchemaSelectionCriteria = {
      use_case: 'production',
      model_supports_function_calling: true,
      prioritize_accuracy: true, // Few-shot prioritizes accuracy
      prioritize_speed: false
    };

    return selectOptimalClassificationSchema(defaultCriteria);
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Validate prerequisites first - these should fail fast, not fallback
    if (!this.initialized) {
      await this.initializeLLM(); // This will throw if prerequisites aren't met
      this.initialized = true;
    }

    // Use proper fromAsyncTryCatch for classification errors only (not validation errors)
    const classificationResult = await fromAsyncTryCatch(
      async () => {
        return await this.classifyInternal(input, context);
      },
      (error: unknown) => createFewShotClassificationError(
        'FEWSHOT_CLASSIFICATION_FAILED',
        `FewShot classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error) }
      )
    );

    // Convert Result<T> to ClassificationResult for interface layer
    return match(
      (result: ClassificationResult) => result,
      (error) => {
        throw new Error("FewShot classification failed: " + error.message);
      },
      classificationResult
    );
  }

  private async classifyInternal(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    // Use flatMap chains for proper error propagation
    const validationResult = this.validateInputInternal(input);
    
    return await match(
      async (validatedInput: string) => {
        // First, check if it's a command using fast rule-based detection
        const commandResult = detectCommand(validatedInput);
        if (commandResult) {
          // Track performance for command detection (no schema involved)
          return {
            ...commandResult,
            method: 'fewshot-langchain',
            metadata: new Map([
              ...Array.from(commandResult.metadata || []),
              ['optimizedBy', 'command-detection-shortcut'],
              ['originalMethod', 'rule-based'],
              ['skipLLM', 'true'],
              ['fewshot_method', 'true']
            ])
          };
        }

        const promptResult = await this.buildFewShotPromptInternal(validatedInput, context);
        
        return await match(
          async (prompt: string) => {
            const llmResult = await this.performClassificationInternal(prompt);
            
            return match(
              (llmOutput) => {
                const processedResult = this.processFewShotResult(llmOutput, validatedInput);
                return match(
                  (classification: ClassificationResult) => {
                    // Track successful classification performance
                    this.trackPerformance(startTime, true, true);
                    return classification;
                  },
                  (error) => {
                    // Track failed classification (parsing failed)
                    this.trackPerformance(startTime, false, false);
                    throw new Error("FewShot classification failed: " + error.message);
                  },
                  processedResult
                );
              },
              (error) => {
                // Track failed classification (LLM failed)
                this.trackPerformance(startTime, false, false);
                throw new Error("FewShot classification failed: " + error.message);
              },
              llmResult
            );
          },
          async (error) => {
            // Track failed classification (prompt building failed)
            this.trackPerformance(startTime, false, false);
            throw new Error("FewShot classification failed: " + error.message);
          },
          promptResult
        );
      },
      async (error) => {
        // Track failed classification (validation failed)
        this.trackPerformance(startTime, false, false);
        throw new Error("FewShot classification failed: " + error.message);
      },
      validationResult
    );
  }

  private validateInputInternal(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createFewShotClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input), operation: 'validation' }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createFewShotClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input, operation: 'validation' }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createFewShotClassificationError(
        'INPUT_TOO_LONG',
        'Input exceeds maximum length of 10,000 characters',
        'VALIDATION',
        { length: trimmed.length, operation: 'validation' }
      ));
    }

    return success(trimmed);
  }

  private async buildFewShotPromptInternal(input: string, context?: ProcessingContext): Promise<Result<string, QiError>> {
    try {
      const contextStr = this.formatContext(context);
      
      // Create example template - escape JSON braces for LangChain
      const exampleTemplate = new PromptTemplate({
        inputVariables: ['input', 'output_type', 'confidence', 'reasoning'],
        template: `Input: "{input}"
Output: {{"type": "{output_type}", "confidence": {confidence}, "reasoning": "{reasoning}"}}`
      });

      // Create few-shot prompt template
      const fewShotPrompt = new FewShotPromptTemplate({
        examples: this.examples.map(ex => ({
          input: ex.input,
          output_type: ex.output.type,
          confidence: ex.output.confidence.toString(),
          reasoning: ex.output.reasoning
        })),
        examplePrompt: exampleTemplate,
        prefix: `Classify the following user input into one of two categories based on these examples:

**Categories:**
1. **prompt** - Single-step requests, questions, or conversational inputs
2. **workflow** - Multi-step tasks requiring orchestration

**Examples:**`,
        suffix: `Input: "{input}"
${contextStr}

**Instructions:**
- Follow the pattern shown in the examples
- Analyze the input for complexity and multi-step indicators
- Provide accurate confidence score based on clarity
- Give specific reasoning for your classification

Output:`,
        inputVariables: ['input']
      });

      const prompt = await fewShotPrompt.format({ input });
      return success(prompt);
    } catch (error) {
      return failure(createFewShotClassificationError(
        'FEWSHOT_PROMPT_BUILD_FAILED',
        `Failed to build few-shot prompt: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { input, error: String(error), operation: 'buildFewShotPrompt' }
      ));
    }
  }

  private performClassificationInternal(prompt: string): Promise<Result<any, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const result = await this.llmWithStructuredOutput.invoke(prompt);
        return result;
      },
      (error: unknown) => {
        return {
          code: 'FEWSHOT_CLASSIFICATION_FAILED',
          message: `FewShot LangChain classification failed: ${error instanceof Error ? error.message : String(error)}`,
          category: 'NETWORK' as const,
          context: { error: String(error) },
        };
      }
    );
  }

  private processFewShotResult(
    result: any,
    originalInput: string
  ): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(createFewShotClassificationError(
          'SCHEMA_NOT_SELECTED',
          'No schema selected for result processing',
          'SYSTEM',
          { operation: 'processFewShotResult' }
        ));
      }

      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'qwen2.5:7b'],
        ['provider', 'ollama-openai-compatible'],
        ['timestamp', new Date().toISOString()],
        ['input_length', originalInput.length.toString()],
        ['schema_used', this.selectedSchema!.metadata.name],
        ['method', 'fewshot-langchain'],
        ['examples_count', this.examples.length.toString()],
      ]);

      const extractedData = new Map<string, unknown>();

      // Extract additional data based on schema structure
      if (result.indicators && Array.isArray(result.indicators)) {
        metadata.set('indicators', JSON.stringify(result.indicators));
      }
      
      if (result.complexity_score) {
        metadata.set('complexity_score', result.complexity_score.toString());
      }
      
      if (result.task_steps) {
        metadata.set('task_steps', result.task_steps.toString());
      }

      if (result.extracted_data && typeof result.extracted_data === 'object') {
        Object.entries(result.extracted_data).forEach(([key, value]) => {
          extractedData.set(key, value);
        });
      }

      const classificationResult: ClassificationResult = {
        type: result.type,
        confidence: result.confidence,
        method: 'fewshot-langchain',
        reasoning: result.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createFewShotClassificationError(
        'FEWSHOT_RESULT_PROCESSING_FAILED',
        `Failed to process few-shot classification result: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), operation: 'processFewShotResult' }
      ));
    }
  }

  private formatContext(context?: ProcessingContext): string {
    if (!context) return '';

    const parts: string[] = [];
    if (context.sessionId) parts.push(`Session: ${context.sessionId}`);
    if (context.previousInputs?.length) {
      parts.push(`Recent History: ${context.previousInputs.slice(-3).join(', ')}`);
    }

    return parts.length > 0 ? `**Context:** ${parts.join(' | ')}` : '';
  }


  /**
   * Track performance metrics for this classification attempt
   */
  private trackPerformance(startTime: number, classificationSuccess: boolean, parsingSuccess: boolean): void {
    if (!this.selectedSchema) {
      return; // Can't track without schema
    }

    const latencyMs = Date.now() - startTime;
    const trackingResult = globalSchemaRegistry.trackSchemaUsage(
      this.selectedSchema.metadata.name,
      latencyMs,
      classificationSuccess,
      parsingSuccess
    );

    // Log tracking errors for debugging but don't fail the classification
    match(
      () => {}, // Success - do nothing
      (error) => console.warn(`Failed to track schema performance: ${error.message}`),
      trackingResult
    );
  }

  // Interface implementation methods
  getMethodName(): ClassificationMethod {
    return 'fewshot-langchain';
  }

  getExpectedAccuracy(): number {
    if (this.selectedSchema) {
      // Use measured performance if available, baseline otherwise
      const baseAccuracy = this.selectedSchema.metadata.performance_profile.measured_accuracy ?? 
                          this.selectedSchema.metadata.performance_profile.baseline_accuracy_estimate;
      // Few-shot generally improves accuracy by 3-5%
      return Math.min(0.95, baseAccuracy + 0.04);
    }
    return 0.93; // Higher than base LangChain due to examples
  }

  getAverageLatency(): number {
    if (this.selectedSchema) {
      // Use measured performance if available, baseline otherwise
      const baseLatency = this.selectedSchema.metadata.performance_profile.measured_latency_ms ?? 
                         this.selectedSchema.metadata.performance_profile.baseline_latency_estimate_ms;
      // Few-shot adds some overhead due to longer prompts
      return baseLatency + 100;
    }
    return 420; // Slightly higher than base method
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || 'http://localhost:11434/v1';
      const response = await fetch(`${baseUrl.replace('/v1', '')}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }
}

/**
 * Factory function for creating FewShot LangChain classification method
 */
export function createFewShotLangChainClassificationMethod(
  config: FewShotLangChainClassificationConfig = {},
  customExamples?: ClassificationExample[]
): FewShotLangChainClassificationMethod {
  return new FewShotLangChainClassificationMethod(config, customExamples);
}