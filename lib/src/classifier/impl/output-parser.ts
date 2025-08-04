/**
 * OutputParser LangChain Classification Method - Professional Implementation
 *
 * Uses LangChain StructuredOutputParser with proper qicore Result<T> handling
 * for models that don't support function calling. Works with ANY model.
 */

import { create, failure, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { 
  globalSchemaRegistry, 
  selectOptimalClassificationSchema,
  type SchemaSelectionCriteria,
  type SchemaEntry 
} from '../schema-registry.js';
import { getEffectiveAccuracy, getEffectiveLatency, trackClassificationPerformance } from '../shared/performance-tracking.js';
import { createRetryError, type RetryClassificationErrorContext } from '../shared/error-types.js';
import { detectCommand } from './command-detection-utils.js';
import { composeOpenAIEndpoint, getOllamaBaseUrl } from '../shared/url-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for output parser classification errors using standardized error types
 */
const createOutputParserClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<RetryClassificationErrorContext> = {}
): QiError => createRetryError('outputparser-langchain', code, message, category, context);

/**
 * Configuration for OutputParser LangChain classification method
 */
export interface OutputParserLangChainClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
  
  // Retry configuration
  maxRetries?: number;
  temperatureIncrement?: number;
}

/**
 * OutputParser LangChain-based classification using StructuredOutputParser
 * Works with models that don't support function calling
 */
export class OutputParserLangChainClassificationMethod implements IClassificationMethod {
  private llm: any;
  private parser!: StructuredOutputParser<any>;
  private chain: any;
  private config: OutputParserLangChainClassificationConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;

  constructor(config: OutputParserLangChainClassificationConfig) {
    this.config = {
      maxRetries: 3,
      temperatureIncrement: 0.1,
      ...config
    };
  }

  /**
   * Validate that the model exists (no function calling required for OutputParser)
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

    // OutputParser works with any model - no function calling required
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
      
      this.llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen2.5:7b',
        temperature: this.config.temperature || 0.1,
        maxTokens: this.config.maxTokens || 1000,
        configuration: {
          baseURL: composeOpenAIEndpoint(this.config.baseUrl || 'http://localhost:11434'),
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Create structured output parser from selected schema
      this.parser = StructuredOutputParser.fromZodSchema(this.selectedSchema!.schema);

      // Create the chain: Prompt -> LLM -> Parser
      const prompt = PromptTemplate.fromTemplate(`
Classify the following user input into one of two categories with high accuracy:

**Categories:**
1. **prompt** - Single-step requests, questions, or conversational inputs (e.g., "hi", "what is recursion?", "write a function")
2. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix the bug in auth.js and run tests", "create a new feature with tests and documentation")

**Classification Rules:**
- Prompts are single-step requests, questions, or conversational inputs
- Workflows involve multiple steps, file operations, testing, or complex task orchestration
- Look for indicators like: multiple actions, file references, testing requirements, "and then", coordination needs

**User Input:** "{input}"
{context}

**Instructions:**
- Analyze the input carefully for complexity and multi-step indicators
- Consider whether this requires orchestration across multiple tools/steps
- Provide a confidence score based on how clear the classification is
- Give specific reasoning for your choice

{format_instructions}
`);

      // Create the processing chain
      this.chain = prompt.pipe(this.llm).pipe(this.parser);
      
    } catch (error) {
      throw new Error(
        `Failed to initialize OutputParser LangChain classification: ${error instanceof Error ? error.message : String(error)}`
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

    // Default to standard schema for output parser (reliable parsing)
    const defaultCriteria: SchemaSelectionCriteria = {
      use_case: 'production',
      model_supports_function_calling: false, // OutputParser for non-function-calling models
      prioritize_accuracy: false,
      prioritize_speed: true // Faster parsing
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
      (error: unknown) => createOutputParserClassificationError(
        'OUTPUTPARSER_CLASSIFICATION_FAILED',
        `OutputParser classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error) }
      )
    );

    // Convert Result<T> to ClassificationResult for interface layer
    return match(
      (result: ClassificationResult) => result,
      (error) => { throw new Error("OutputParser classification failed: " + error.message); },
      classificationResult
    );
  }

  private async classifyInternal(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Use flatMap chains for proper error propagation
    const validationResult = this.validateInputInternal(input);
    
    return await match(
      async (validatedInput: string) => {
        // First, check if it's a command using fast rule-based detection
        const commandResult = detectCommand(validatedInput);
        if (commandResult) {
          // Return command result with updated metadata
          return {
            ...commandResult,
            method: 'outputparser-langchain',
            metadata: new Map([
              ...Array.from(commandResult.metadata || []),
              ['optimizedBy', 'command-detection-shortcut'],
              ['originalMethod', 'rule-based'],
              ['skipLLM', 'true'],
              ['outputparser_method', 'true']
            ])
          };
        }

        // Try classification with retry logic
        return await this.classifyWithRetry(validatedInput, context, this.config.maxRetries || 3);
      },
      async (error) => { throw new Error(error.message); },
      validationResult
    );
  }

  /**
   * Classify with automatic retry and temperature adjustment
   */
  async classifyWithRetry(
    input: string, 
    context: ProcessingContext | undefined, 
    maxRetries: number
  ): Promise<ClassificationResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Adjust temperature for retries
        const adjustedTemperature = (this.config.temperature || 0.1) + 
          (attempt * (this.config.temperatureIncrement || 0.1));
        
        if (attempt > 0) {
          // Update LLM temperature for retry
          this.llm.temperature = Math.min(0.7, adjustedTemperature);
        }

        const result = await this.performOutputParserClassification(input, context, attempt);
        
        return await match(
          async (classification: ClassificationResult) => classification,
          async (error) => { throw new Error(error.message); },
          result
        );
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === maxRetries) {
          // Final attempt failed, throw error
          throw lastError;
        }
        
        // Log retry attempt (in production, use proper logging)
        console.warn(`OutputParser classification attempt ${attempt + 1} failed, retrying...`);
      }
    }
    
    throw lastError || new Error('Classification failed after all retries');
  }

  private async performOutputParserClassification(
    input: string, 
    context: ProcessingContext | undefined,
    attempt: number
  ): Promise<Result<ClassificationResult, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const contextStr = this.formatContext(context);
        const formatInstructions = this.parser.getFormatInstructions();
        
        const result = await this.chain.invoke({
          input,
          context: contextStr,
          format_instructions: formatInstructions
        });

        return this.processOutputParserResult(result, input, attempt);
      },
      (error: unknown) => createOutputParserClassificationError(
        'OUTPUTPARSER_GENERATION_FAILED',
        `OutputParser generation failed: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK',
        { 
          error: String(error),
          retry_count: attempt
        }
      )
    );
  }

  private processOutputParserResult(
    result: any,
    originalInput: string,
    attempt: number
  ): ClassificationResult {
    if (!this.selectedSchema) {
      throw new Error('No schema selected for result processing');
    }

    const metadata = new Map<string, string>([
      ['model', this.config.modelId || 'qwen2.5:7b'],
      ['provider', 'ollama-openai-compatible'],
      ['timestamp', new Date().toISOString()],
      ['input_length', originalInput.length.toString()],
      ['schema_used', this.selectedSchema!.metadata.name],
      ['method', 'outputparser-langchain'],
      ['retry_attempts', attempt.toString()],
      ['final_temperature', this.llm.temperature?.toString() || '0.1'],
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
      method: 'outputparser-langchain',
      reasoning: result.reasoning || 'No reasoning provided',
      extractedData,
      metadata,
    };

    return classificationResult;
  }

  private validateInputInternal(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createOutputParserClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input), operation: 'validation' }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createOutputParserClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input, operation: 'validation' }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createOutputParserClassificationError(
        'INPUT_TOO_LONG',
        'Input exceeds maximum length of 10,000 characters',
        'VALIDATION',
        { length: trimmed.length, operation: 'validation' }
      ));
    }

    return success(trimmed);
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


  // Interface implementation methods
  getMethodName(): ClassificationMethod {
    return 'outputparser-langchain';
  }

  getExpectedAccuracy(): number {
    // OutputParser typically has slightly lower accuracy due to parsing challenges
    const baseAccuracy = getEffectiveAccuracy(this.selectedSchema, 0.82);
    return Math.max(0.75, baseAccuracy - 0.05);
  }

  getAverageLatency(): number {
    // OutputParser may have variable latency due to retries
    const baseLatency = getEffectiveLatency(this.selectedSchema, 370);
    return baseLatency + 50;
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
 * Factory function for creating OutputParser LangChain classification method
 */
export function createOutputParserLangChainClassificationMethod(
  config: OutputParserLangChainClassificationConfig = {}
): OutputParserLangChainClassificationMethod {
  return new OutputParserLangChainClassificationMethod(config);
}