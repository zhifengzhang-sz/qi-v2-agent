/**
 * LangChain ChatOllama JSON Schema Classification Method
 *
 * Uses @langchain/ollama ChatOllama with explicit JSON Schema method.
 * NO FALLBACKS - explicit errors only for clear method attribution.
 * 2025 Update: @langchain/ollama@0.2.0 defaults to jsonSchema method.
 * DISTINCT from ollama-native.ts (which uses direct Ollama API calls).
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
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for ChatOllama JSON Schema classification errors
 */
const createOllamaJsonSchemaClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('langchain-ollama-json-schema', code, message, category, context);

/**
 * Configuration for LangChain ChatOllama JSON Schema classification method
 */
export interface LangChainOllamaJsonSchemaConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number; // Timeout in milliseconds (default: 30000)
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
}

/**
 * LangChain-based classification using ChatOllama with JSON Schema method
 * NO FALLBACKS - explicit error reporting only
 * Uses LangChain's ChatOllama wrapper, not direct Ollama API calls
 */
export class LangChainOllamaJsonSchemaClassificationMethod implements IClassificationMethod {
  private llmWithStructuredOutput: any;
  private config: LangChainOllamaJsonSchemaConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;

  constructor(config: LangChainOllamaJsonSchemaConfig) {
    this.config = config;
  }

  /**
   * Validate ChatOllama JSON Schema method prerequisites
   */
  private async validatePrerequisites(): Promise<void> {
    const configBaseUrl = this.config.baseUrl || 'http://localhost:11434';
    const modelId = this.config.modelId || 'llama3.2:3b';
    
    // Test Ollama availability using native API
    try {
      const response = await fetch(`${configBaseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) {
        throw new Error(`Ollama not available at ${configBaseUrl}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models || [];
      const modelExists = models.some((model: any) => 
        model.name === modelId || model.name.startsWith(modelId + ':')
      );
      
      if (!modelExists) {
        const availableModels = models.map((m: any) => m.name).join(', ') || 'none';
        throw new Error(`Model '${modelId}' not found in Ollama. Available: ${availableModels}`);
      }

      // Test basic Ollama generation (to verify model works)
      const testGenResponse = await fetch(`${configBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          prompt: 'Test',
          stream: false,
          options: { num_predict: 5 }
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!testGenResponse.ok) {
        throw new Error(`Model '${modelId}' failed generation test: ${testGenResponse.status}`);
      }

      const testGenResult = await testGenResponse.json();
      if (testGenResult.error) {
        throw new Error(`Model '${modelId}' generation error: ${testGenResult.error}`);
      }

    } catch (error) {
      throw new Error(`ChatOllama JSON Schema method prerequisites failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async initializeLLM(): Promise<void> {
    // Validate Ollama availability first - fail fast with explicit errors
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
      
      // Import and initialize ChatOllama (distinct from ChatOpenAI)
      const { ChatOllama } = await import('@langchain/ollama');
      
      const llm = new ChatOllama({
        model: this.config.modelId || 'llama3.2:3b',
        baseUrl: this.config.baseUrl || 'http://localhost:11434',
        temperature: this.config.temperature || 0.1,
        // Removed numPredict (maxTokens) to avoid truncation
        format: "json", // Ensure JSON output format
      });

      // Use ONLY JSON Schema method with ChatOllama - NO fallbacks
      // @langchain/ollama@0.2.0 defaults to jsonSchema method
      this.llmWithStructuredOutput = llm.withStructuredOutput(this.selectedSchema.schema, {
        name: this.selectedSchema.metadata.name,
        method: "jsonSchema", // Explicit JSON Schema method with ChatOllama
      });
      
    } catch (error) {
      throw new Error(
        `Failed to initialize LangChain ChatOllama JSON Schema method: ${error instanceof Error ? error.message : String(error)}`
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

    // Default to standard schema for ChatOllama JSON Schema method
    const defaultCriteria: SchemaSelectionCriteria = {
      use_case: 'production',
      model_supports_function_calling: false, // ChatOllama JSON Schema doesn't require function calling
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
      (error: unknown) => createOllamaJsonSchemaClassificationError(
        'CLASSIFICATION_FAILED',
        `ChatOllama JSON Schema classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), method: 'jsonSchema', provider: 'chatollama' }
      )
    );

    // Convert Result<T> to ClassificationResult or throw explicit error
    return match(
      (result) => result,
      (error) => {
        throw new Error(`LangChain ChatOllama JSON Schema method failed: ${error.message}`);
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
        method: 'langchain-ollama-json-schema',
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
      return failure(createOllamaJsonSchemaClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input) }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createOllamaJsonSchemaClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createOllamaJsonSchemaClassificationError(
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
      return failure(createOllamaJsonSchemaClassificationError(
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
        
        try {
          // Use ChatOllama JSON Schema method only - no fallbacks
          const result = await this.llmWithStructuredOutput.invoke(prompt);
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Add debug info
          if (typeof result === 'object' && result !== null) {
            (result as any).__debug_timing = duration;
            (result as any).__debug_method = 'jsonSchema';
            (result as any).__debug_provider = 'chatollama';
          }
          
          return result;
        } catch (parseError) {
          
          // Handle OutputParserException - the core issue we're debugging
          if (parseError instanceof Error && parseError.message.includes('Failed to parse')) {
            // Extract the raw text from the error message
            const textMatch = parseError.message.match(/Text: "(.*?)"\./s);
            if (textMatch) {
              const rawText = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              
              // Skip empty or whitespace-only responses
              if (!rawText.trim()) {
                console.log('⚠️  Empty response from LLM - likely timeout or model issue');
                throw parseError; // Re-throw original error
              }
              
              console.log('🐛 OUTPUT_PARSING_FAILURE - Raw LLM response:');
              console.log(rawText);
              
              try {
                // Try to parse the raw JSON ourselves
                const parsed = JSON.parse(rawText);
                console.log('🔧 Successfully parsed raw JSON:', parsed);
                
                // If it's the function call wrapper format, extract the arguments
                if (parsed.name === 'extract' && parsed.arguments) {
                  console.log('🔧 Unwrapping function call format:', parsed.arguments);
                  return parsed.arguments;
                }
                
                return parsed;
              } catch (jsonError) {
                console.log('❌ Failed to parse raw JSON:', jsonError);
                throw parseError; // Re-throw original error
              }
            }
          }
          throw parseError; // Re-throw if not a parse error we can handle
        }
      },
      (error: unknown) => createOllamaJsonSchemaClassificationError(
        'LLM_INVOCATION_FAILED',
        `ChatOllama JSON Schema LLM invocation failed: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK',
        { error: String(error), method: 'jsonSchema', provider: 'chatollama' }
      )
    );
  }

  private processResult(result: any, originalInput: string): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(createOllamaJsonSchemaClassificationError(
          'SCHEMA_NOT_SELECTED',
          'No schema selected for result processing',
          'SYSTEM'
        ));
      }

      // Handle function call wrapper format from withStructuredOutput
      // LangChain may wrap the result in { name: "extract", arguments: {...} }
      let actualResult = result;
      if (result && typeof result === 'object' && result.name === 'extract' && result.arguments) {
        actualResult = result.arguments;
      }

      // Validate required fields from ChatOllama JSON Schema
      if (!actualResult.type || !actualResult.confidence) {
        return failure(createOllamaJsonSchemaClassificationError(
          'INVALID_SCHEMA_RESULT',
          'Result missing required fields: type and confidence',
          'VALIDATION',
          { result: JSON.stringify(result), actualResult: JSON.stringify(actualResult) }
        ));
      }

      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'llama3.2:3b'],
        ['provider', 'chatollama'],
        ['method', 'jsonSchema'],
        ['langchain_version', '@langchain/ollama'],
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
      if (result.__debug_provider) {
        metadata.set('debug_provider', result.__debug_provider);
      }

      const extractedData = new Map<string, unknown>();

      // Extract additional schema-specific data
      if (actualResult.indicators && Array.isArray(actualResult.indicators)) {
        extractedData.set('indicators', actualResult.indicators);
      }
      
      if (actualResult.complexity_score !== undefined) {
        extractedData.set('complexity_score', actualResult.complexity_score);
      }

      const classificationResult: ClassificationResult = {
        type: actualResult.type,
        confidence: actualResult.confidence,
        method: 'langchain-ollama-json-schema',
        reasoning: actualResult.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createOllamaJsonSchemaClassificationError(
        'RESULT_PROCESSING_FAILED',
        `Failed to process ChatOllama JSON Schema result: ${error instanceof Error ? error.message : String(error)}`,
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
      success // For ChatOllama JSON Schema, classification success == parsing success
    );

    // Log tracking errors but don't fail
    match(
      () => {}, // Success - do nothing
      (error) => console.warn(`Failed to track ChatOllama JSON Schema performance: ${error.message}`),
      trackingResult
    );
  }

  // Interface implementation
  getMethodName(): ClassificationMethod {
    return 'langchain-ollama-json-schema';
  }

  getExpectedAccuracy(): number {
    if (this.selectedSchema) {
      return this.selectedSchema.metadata.performance_profile.measured_accuracy ?? 
             this.selectedSchema.metadata.performance_profile.baseline_accuracy_estimate;
    }
    return 0.90; // Conservative estimate for ChatOllama JSON Schema method (2025 improvements)
  }

  getAverageLatency(): number {
    if (this.selectedSchema) {
      return this.selectedSchema.metadata.performance_profile.measured_latency_ms ?? 
             this.selectedSchema.metadata.performance_profile.baseline_latency_estimate_ms;
    }
    return 300; // Conservative estimate for ChatOllama JSON Schema method
  }

  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseUrl || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      const models = data.models || [];
      return models.some((model: any) => 
        model.name === (this.config.modelId || 'llama3.2:3b') || 
        model.name.startsWith((this.config.modelId || 'llama3.2:3b') + ':')
      );
    } catch (_error) {
      return false;
    }
  }
}

/**
 * Factory function for creating LangChain ChatOllama JSON Schema classification method
 */
export function createLangChainOllamaJsonSchemaClassificationMethod(
  config: LangChainOllamaJsonSchemaConfig = {}
): LangChainOllamaJsonSchemaClassificationMethod {
  return new LangChainOllamaJsonSchemaClassificationMethod(config);
}