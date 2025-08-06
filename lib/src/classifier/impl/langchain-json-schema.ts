/**
 * LangChain JSON Schema Classification Method
 *
 * Uses ChatOpenAI with explicit JSON Schema method via withStructuredOutput.
 * NO FALLBACKS - explicit errors only for clear method attribution.
 * 2025 Update: JSON Schema method provides best reliability with Ollama.
 */

import { failure, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { 
  globalSchemaRegistry, 
  selectOptimalClassificationSchema,
  type SchemaSelectionCriteria,
  type SchemaEntry 
} from '../schema-registry.js';
import { detectCommand } from './command-detection-utils.js';
import { composeOpenAIEndpoint } from '../shared/url-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for JSON Schema classification errors
 */
const createJsonSchemaClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('langchain-json-schema', code, message, category, context);

/**
 * Configuration for LangChain JSON Schema classification method
 */
export interface LangChainJsonSchemaConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  timeout?: number; // Timeout in milliseconds (default: 30000)
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
}

/**
 * LangChain-based classification using ChatOpenAI with JSON Schema method
 * NO FALLBACKS - explicit error reporting only
 */
export class LangChainJsonSchemaClassificationMethod implements IClassificationMethod {
  private llmWithStructuredOutput: any;
  private config: LangChainJsonSchemaConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;

  constructor(config: LangChainJsonSchemaConfig) {
    this.config = config;
  }

  /**
   * Validate JSON Schema method prerequisites
   */
  private async validatePrerequisites(): Promise<void> {
    const configBaseUrl = this.config.baseUrl || 'http://localhost:11434';
    const modelId = this.config.modelId || 'llama3.2:3b';
    
    // Test OpenAI compatibility endpoint specifically
    try {
      const openaiEndpoint = composeOpenAIEndpoint(configBaseUrl);
      const testResponse = await fetch(`${openaiEndpoint}/models`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${this.config.apiKey || 'ollama'}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000),
      });
      
      if (!testResponse.ok) {
        throw new Error(`OpenAI-compatible endpoint not available: ${testResponse.status} ${testResponse.statusText}`);
      }

      const models = await testResponse.json();
      const modelExists = models.data?.some((model: any) => 
        model.id === modelId || model.id.startsWith(modelId + ':')
      );
      
      if (!modelExists) {
        const availableModels = models.data?.map((m: any) => m.id).join(', ') || 'none';
        throw new Error(`Model '${modelId}' not available via OpenAI endpoint. Available: ${availableModels}`);
      }
    } catch (error) {
      throw new Error(`JSON Schema method prerequisites failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async initializeLLM(): Promise<void> {
    // Validate prerequisites first - fail fast with explicit errors
    await this.validatePrerequisites();
    
    try {
      // Select schema - explicit error if selection fails
      const schemaResult = this.selectSchema();
      const selectedSchema = await match(
        async (schema) => schema,
        async (error) => {
          throw new Error(`Schema selection failed: ${error.message}`);
        },
        schemaResult
      );
      this.selectedSchema = selectedSchema;
      
      // Import and initialize ChatOpenAI
      const { ChatOpenAI } = await import('@langchain/openai');
      
      const llm = new ChatOpenAI({
        model: this.config.modelId || 'llama3.2:3b',
        temperature: this.config.temperature || 0.1,
        // Removed maxTokens to avoid truncation - let model use defaults
        configuration: {
          baseURL: composeOpenAIEndpoint(this.config.baseUrl || 'http://localhost:11434'),
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Use ONLY JSON Schema method - NO fallbacks
      this.llmWithStructuredOutput = llm.withStructuredOutput(this.selectedSchema.schema, {
        name: this.selectedSchema.metadata.name,
        method: "jsonSchema", // Explicit JSON Schema method only
      });
      
    } catch (error) {
      throw new Error(
        `Failed to initialize LangChain JSON Schema method: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Select schema - explicit error propagation
   */
  private selectSchema(): Result<SchemaEntry, QiError> {
    if (this.config.schemaName) {
      return globalSchemaRegistry.getSchema(this.config.schemaName);
    }

    if (this.config.schemaSelectionCriteria) {
      return selectOptimalClassificationSchema(this.config.schemaSelectionCriteria);
    }

    // Default to standard schema for JSON Schema method
    const defaultCriteria: SchemaSelectionCriteria = {
      use_case: 'production',
      model_supports_function_calling: false, // JSON Schema doesn't require function calling
      prioritize_accuracy: true,
      prioritize_speed: false
    };

    return selectOptimalClassificationSchema(defaultCriteria);
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Initialize if needed - will throw explicit errors if prerequisites fail
    if (!this.initialized) {
      await this.initializeLLM();
      this.initialized = true;
    }

    // Use fromAsyncTryCatch only for classification errors, not validation
    const classificationResult = await fromAsyncTryCatch(
      async () => {
        return await this.classifyInternal(input, context);
      },
      (error: unknown) => createJsonSchemaClassificationError(
        'CLASSIFICATION_FAILED',
        `JSON Schema classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), method: 'jsonSchema' }
      )
    );

    // Convert Result<T> to ClassificationResult or throw explicit error
    return match(
      (result) => result,
      (error) => {
        throw new Error(`LangChain JSON Schema method failed: ${error.message}`);
      },
      classificationResult
    );
  }

  private async classifyInternal(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    // Validate input - explicit errors
    const validationResult = this.validateInput(input);
    const validatedInput = await match(
      async (input) => input,
      async (error) => {
        throw new Error(`Input validation failed: ${error.message}`);
      },
      validationResult
    );

    // Check for commands first (optimization)
    const commandResult = detectCommand(validatedInput);
    if (commandResult) {
      return {
        ...commandResult,
        method: 'langchain-json-schema',
        metadata: new Map([
          ...Array.from(commandResult.metadata || []),
          ['optimizedBy', 'command-detection-shortcut'],
          ['actualMethod', 'rule-based-command-detection'],
          ['skipLLM', 'true']
        ])
      };
    }

    // Build prompt - explicit errors
    const promptResult = this.buildPrompt(validatedInput, context);
    const prompt = await match(
      async (prompt) => prompt,
      async (error) => {
        throw new Error(`Prompt building failed: ${error.message}`);
      },
      promptResult
    );

    // Perform classification - explicit errors
    const llmResult = await this.performClassification(prompt);
    const llmOutput = await match(
      async (output) => output,
      async (error) => {
        throw new Error(`LLM classification failed: ${error.message}`);
      },
      llmResult
    );

    // Process result - explicit errors
    const processedResult = this.processResult(llmOutput, validatedInput);
    const finalResult = await match(
      async (result) => result,
      async (error) => {
        throw new Error(`Result processing failed: ${error.message}`);
      },
      processedResult
    );

    // Track performance
    this.trackPerformance(startTime, true);
    
    return finalResult;
  }

  private validateInput(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createJsonSchemaClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input) }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createJsonSchemaClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createJsonSchemaClassificationError(
        'INPUT_TOO_LONG',
        'Input exceeds maximum length of 10,000 characters',
        'VALIDATION',
        { length: trimmed.length }
      ));
    }

    return success(trimmed);
  }

  private buildPrompt(input: string, context?: ProcessingContext): Result<string, QiError> {
    try {
      const contextStr = this.formatContext(context);
      
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
      return failure(createJsonSchemaClassificationError(
        'PROMPT_BUILD_FAILED',
        `Failed to build classification prompt: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { input, error: String(error) }
      ));
    }
  }

  private performClassification(prompt: string): Promise<Result<any, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const startTime = Date.now();
        
        // DEBUG: Log what prompt is actually being sent
        console.log('🔍 PROMPT SENT TO LANGCHAIN:', prompt);
        
        // Use JSON Schema method only - no fallbacks
        const result = await this.llmWithStructuredOutput.invoke(prompt);
        
        // DEBUG: Log what LangChain actually returns
        console.log('🔍 LANGCHAIN RAW RESULT:', JSON.stringify(result, null, 2));
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Add debug info
        if (typeof result === 'object' && result !== null) {
          (result as any).__debug_timing = duration;
          (result as any).__debug_method = 'jsonSchema';
        }
        
        return result;
      },
      (error: unknown) => createJsonSchemaClassificationError(
        'LLM_INVOCATION_FAILED',
        `JSON Schema LLM invocation failed: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK',
        { error: String(error), method: 'jsonSchema' }
      )
    );
  }

  private processResult(result: any, originalInput: string): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(createJsonSchemaClassificationError(
          'SCHEMA_NOT_SELECTED',
          'No schema selected for result processing',
          'SYSTEM'
        ));
      }

      // Validate required fields from JSON Schema
      if (!result.type || !result.confidence) {
        return failure(createJsonSchemaClassificationError(
          'INVALID_SCHEMA_RESULT',
          'Result missing required fields: type and confidence',
          'VALIDATION',
          { result: JSON.stringify(result) }
        ));
      }

      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'llama3.2:3b'],
        ['provider', 'openai-compatible'],
        ['method', 'jsonSchema'],
        ['timestamp', new Date().toISOString()],
        ['input_length', originalInput.length.toString()],
        ['schema_used', this.selectedSchema.metadata.name],
        ['schema_complexity', this.selectedSchema.metadata.complexity],
      ]);

      // Add debug timing if available
      if (result.__debug_timing) {
        metadata.set('debug_timing_ms', result.__debug_timing.toString());
      }
      if (result.__debug_method) {
        metadata.set('debug_method', result.__debug_method);
      }

      const extractedData = new Map<string, unknown>();

      // Extract additional schema-specific data
      if (result.indicators && Array.isArray(result.indicators)) {
        extractedData.set('indicators', result.indicators);
      }
      
      if (result.complexity_score !== undefined) {
        extractedData.set('complexity_score', result.complexity_score);
      }

      const classificationResult: ClassificationResult = {
        type: result.type,
        confidence: result.confidence,
        method: 'langchain-json-schema',
        reasoning: result.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createJsonSchemaClassificationError(
        'RESULT_PROCESSING_FAILED',
        `Failed to process JSON Schema result: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), result: JSON.stringify(result) }
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

  private trackPerformance(startTime: number, success: boolean): void {
    if (!this.selectedSchema) return;

    const latencyMs = Date.now() - startTime;
    const trackingResult = globalSchemaRegistry.trackSchemaUsage(
      this.selectedSchema.metadata.name,
      latencyMs,
      success,
      success // For JSON Schema, classification success == parsing success
    );

    // Log tracking errors but don't fail
    match(
      () => {}, // Success - do nothing
      (error) => console.warn(`Failed to track JSON Schema performance: ${error.message}`),
      trackingResult
    );
  }

  // Interface implementation
  getMethodName(): ClassificationMethod {
    return 'langchain-json-schema';
  }

  getExpectedAccuracy(): number {
    if (this.selectedSchema) {
      return this.selectedSchema.metadata.performance_profile.measured_accuracy ?? 
             this.selectedSchema.metadata.performance_profile.baseline_accuracy_estimate;
    }
    return 0.92; // Conservative estimate for JSON Schema method
  }

  getAverageLatency(): number {
    if (this.selectedSchema) {
      return this.selectedSchema.metadata.performance_profile.measured_latency_ms ?? 
             this.selectedSchema.metadata.performance_profile.baseline_latency_estimate_ms;
    }
    return 280; // Conservative estimate for JSON Schema method
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || 'http://localhost:11434';
      const openaiEndpoint = composeOpenAIEndpoint(baseUrl);
      const response = await fetch(`${openaiEndpoint}/models`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${this.config.apiKey || 'ollama'}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }
}

/**
 * Factory function for creating LangChain JSON Schema classification method
 */
export function createLangChainJsonSchemaClassificationMethod(
  config: LangChainJsonSchemaConfig = {}
): LangChainJsonSchemaClassificationMethod {
  return new LangChainJsonSchemaClassificationMethod(config);
}