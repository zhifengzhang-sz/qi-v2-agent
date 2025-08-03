/**
 * LangChain Classification Method - Professional Implementation
 *
 * Uses LangChain withStructuredOutput pattern with proper qicore Result<T> handling
 * and flatMap chains. Avoids ChatOllama issues by using OpenAI-compatible API.
 */

import { create, failure, flatMap, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { 
  globalSchemaRegistry, 
  selectOptimalClassificationSchema,
  type SchemaSelectionCriteria,
  type SchemaEntry 
} from '../schema-registry.js';
import { detectCommand } from './command-detection-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

// Dynamic schema selection will replace the hardcoded schema
// This will be determined at runtime based on configuration and performance criteria

// Using standardized error types from shared module

/**
 * Custom error factory for classification errors using standardized error types
 */
const createLangChainClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('langchain-structured', code, message, category, context);

/**
 * Configuration for LangChain classification method
 */
export interface LangChainClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string; // For non-local providers
  
  // Schema selection options
  schemaName?: string; // Explicit schema name to use
  schemaSelectionCriteria?: SchemaSelectionCriteria; // Criteria for automatic schema selection
}

/**
 * LangChain-based classification using withStructuredOutput
 * Implements proper qicore Result<T> patterns with flatMap chains
 */
export class LangChainClassificationMethod implements IClassificationMethod {
  private llmWithStructuredOutput: any;
  private config: LangChainClassificationConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;

  constructor(config: LangChainClassificationConfig) {
    this.config = config;
    // Initialize asynchronously when first used
  }

  private async initializeLLM(): Promise<void> {
    // Use OpenAI-compatible API with Ollama to avoid ChatOllama issues
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
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Use LangChain's withStructuredOutput with dynamically selected schema
      this.llmWithStructuredOutput = llm.withStructuredOutput(this.selectedSchema!.schema, {
        name: this.selectedSchema!.metadata.name,
      });
    } catch (error) {
      throw new Error(
        `Failed to initialize LangChain classification: ${error instanceof Error ? error.message : String(error)}`
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

    // Default to optimized schema for production use
    const defaultCriteria: SchemaSelectionCriteria = {
      use_case: 'production',
      model_supports_function_calling: true, // Assume function calling support
      prioritize_accuracy: false, // Balanced approach
      prioritize_speed: false
    };

    return selectOptimalClassificationSchema(defaultCriteria);
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Use proper fromAsyncTryCatch for exception boundary like prompt module
    const classificationResult = await fromAsyncTryCatch(
      async () => {
        // Ensure LLM is initialized
        if (!this.initialized) {
          await this.initializeLLM();
          this.initialized = true;
        }

        // Use proper flatMap chains for sequential operations
        return await this.classifyInternal(input, context);
      },
      (error: unknown) => createLangChainClassificationError(
        'CLASSIFICATION_FAILED',
        `Classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error) }
      )
    );

    // Convert Result<T> to ClassificationResult for interface layer
    return match(
      (result: ClassificationResult) => result,
      (error) => this.createFallbackResult(error.message),
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
          // Return command result with updated metadata to show LangChain method optimization
          return {
            ...commandResult,
            method: 'langchain-structured',
            metadata: new Map([
              ...Array.from(commandResult.metadata || []),
              ['optimizedBy', 'command-detection-shortcut'],
              ['originalMethod', 'rule-based'],
              ['skipLLM', 'true']
            ])
          };
        }

        const promptResult = this.buildPromptInternal(validatedInput, context);
        
        return await match(
          async (prompt: string) => {
            const llmResult = await this.performClassificationInternal(prompt);
            
            return match(
              (llmOutput) => {
                const processedResult = this.processLangChainResult(llmOutput, validatedInput);
                return match(
                  (classification: ClassificationResult) => {
                    // Track successful classification performance
                    this.trackPerformance(startTime, true, true);
                    return classification;
                  },
                  (error) => {
                    // Track failed classification (parsing failed)
                    this.trackPerformance(startTime, false, false);
                    return this.createFallbackResult(error.message);
                  },
                  processedResult
                );
              },
              (error) => {
                // Track failed classification (LLM failed)
                this.trackPerformance(startTime, false, false);
                return this.createFallbackResult(error.message);
              },
              llmResult
            );
          },
          async (error) => {
            // Track failed classification (prompt building failed)
            this.trackPerformance(startTime, false, false);
            return this.createFallbackResult(error.message);
          },
          promptResult
        );
      },
      async (error) => {
        // Track failed classification (validation failed)
        this.trackPerformance(startTime, false, false);
        return this.createFallbackResult(error.message);
      },
      validationResult
    );
  }

  private validateInputInternal(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createLangChainClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input), operation: 'validation' }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createLangChainClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input, operation: 'validation' }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createLangChainClassificationError(
        'INPUT_TOO_LONG',
        'Input exceeds maximum length of 10,000 characters',
        'VALIDATION',
        { length: trimmed.length, operation: 'validation' }
      ));
    }

    return success(trimmed);
  }

  private buildPromptInternal(input: string, context?: ProcessingContext): Result<string, QiError> {
    try {
      const contextStr = this.formatContext(context);
      
      // Build prompt manually to avoid async template issues
      // Note: Commands are pre-filtered by command detection, so we only handle prompt vs workflow
      const prompt = `Classify the following user input into one of two categories with high accuracy:

**Categories:**
1. **prompt** - Single-step requests, questions, or conversational inputs (e.g., "hi", "what is recursion?", "write a function", "explain this concept")  
2. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix the bug in auth.js and run tests", "create a new feature with tests and documentation", "analyze this codebase and suggest improvements")

**Classification Rules:**
- Prompts are single-step requests, questions, or conversational inputs that can be answered directly
- Workflows involve multiple steps, file operations, testing, analysis, or complex task orchestration
- Look for indicators like: multiple actions, file references, testing requirements, "and then", coordination needs

**User Input:** "${input}"
${contextStr}

**Instructions:**
- Analyze the input carefully for complexity and multi-step indicators
- Consider whether this requires orchestration across multiple tools/steps
- Provide a confidence score based on how clear the classification is
- Give specific reasoning for your choice`;

      return success(prompt);
    } catch (error) {
      return failure(createLangChainClassificationError(
        'PROMPT_BUILD_FAILED',
        `Failed to build classification prompt: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { input, error: String(error), operation: 'buildPrompt' }
      ));
    }
  }

  private performClassificationInternal(prompt: string): Promise<Result<any, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Use the prompt string directly - LangChain withStructuredOutput expects a string
        const result = await this.llmWithStructuredOutput.invoke(prompt);
        return result; // Dynamic schema output type
      },
      (error: unknown) => {
        return {
          code: 'CLASSIFICATION_FAILED',
          message: `LangChain classification failed: ${error instanceof Error ? error.message : String(error)}`,
          category: 'NETWORK' as const,
          context: { error: String(error) },
        };
      }
    );
  }

  private processLangChainResult(
    result: any,
    originalInput: string
  ): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(createLangChainClassificationError(
          'SCHEMA_NOT_SELECTED',
          'No schema selected for result processing',
          'SYSTEM',
          { operation: 'processResult' }
        ));
      }

      // Create mutable maps for metadata and extracted data
      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'qwen2.5:7b'],
        ['provider', 'ollama-openai-compatible'],
        ['timestamp', new Date().toISOString()],
        ['input_length', originalInput.length.toString()],
        ['schema_used', this.selectedSchema!.metadata.name],
        ['schema_complexity', this.selectedSchema!.metadata.complexity],
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
        method: 'langchain-structured',
        reasoning: result.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createLangChainClassificationError(
        'RESULT_PROCESSING_FAILED',
        `Failed to process classification result: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), operation: 'processResult' }
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

  private createFallbackResult(errorMessage: string): ClassificationResult {
    return {
      type: 'prompt',
      confidence: 0.0,
      method: 'langchain-structured',
      reasoning: `Classification failed: ${errorMessage}`,
      extractedData: new Map(),
      metadata: new Map([
        ['error', errorMessage],
        ['fallback', 'true'],
        ['timestamp', new Date().toISOString()],
      ]),
    };
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
    return 'langchain-structured';
  }

  getExpectedAccuracy(): number {
    if (this.selectedSchema) {
      // Use measured performance if available, baseline otherwise
      return this.selectedSchema.metadata.performance_profile.measured_accuracy ?? 
             this.selectedSchema.metadata.performance_profile.baseline_accuracy_estimate;
    }
    return 0.89; // Default estimate for LangChain structured output
  }

  getAverageLatency(): number {
    if (this.selectedSchema) {
      // Use measured performance if available, baseline otherwise
      return this.selectedSchema.metadata.performance_profile.measured_latency_ms ?? 
             this.selectedSchema.metadata.performance_profile.baseline_latency_estimate_ms;
    }
    return 320; // Default estimate for LangChain structured output
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
 * Factory function for creating LangChain classification method
 */
export function createLangChainClassificationMethod(
  config: LangChainClassificationConfig = {}
): LangChainClassificationMethod {
  return new LangChainClassificationMethod(config);
}