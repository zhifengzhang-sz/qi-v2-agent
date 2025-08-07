/**
 * LangChain ChatOllama Function Calling Classification Method
 *
 * The ONLY working LangChain withStructuredOutput method with Ollama (empirically verified).
 * Uses ChatOllama with explicit functionCalling method.
 * 
 * Systematic testing showed this is the only method that works:
 * - ChatOllama + jsonMode: Not supported
 * - ChatOllama + jsonSchema: Parse errors
 * - ChatOllama + default: Parse errors
 * - ChatOpenAI + /v1 + any method: All fail
 * - ChatOllama + functionCalling: ✅ WORKS
 */

import { failure, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { 
  globalSchemaRegistry, 
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
 * Custom error factory for ChatOllama function calling classification errors
 */
const createChatOllamaFunctionCallingError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('langchain-ollama-function-calling', code, message, category, context);

/**
 * Configuration for ChatOllama function calling classification method
 */
export interface ChatOllamaFunctionCallingConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  timeout?: number;
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
}

/**
 * ChatOllama-based classification using function calling method (ONLY working method)
 */
export class ChatOllamaFunctionCallingClassificationMethod implements IClassificationMethod {
  private llmWithStructuredOutput: any;
  private config: ChatOllamaFunctionCallingConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;

  constructor(config: ChatOllamaFunctionCallingConfig) {
    this.config = config;
  }

  private async initializeLLM(): Promise<void> {
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
      
      // Import and initialize ChatOllama
      const { ChatOllama } = await import('@langchain/ollama');
      
      const llm = new ChatOllama({
        model: this.config.modelId || 'llama3.2:3b',
        baseUrl: this.config.baseUrl || 'http://localhost:11434',
        temperature: this.config.temperature || 0.1,
        timeout: this.config.timeout || 30000,
        keepAlive: '5m', // Keep model loaded to avoid reload delays
      });

      // Use ONLY function calling method - this is the ONLY working method with Ollama
      this.llmWithStructuredOutput = llm.withStructuredOutput(this.selectedSchema.schema, {
        name: this.selectedSchema.metadata.name,
        method: "functionCalling", // Explicit function calling - ONLY working method
      });
      
    } catch (error) {
      throw new Error(
        `Failed to initialize ChatOllama function calling method: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Select schema - explicit error propagation, NO FALLBACKS
   */
  private selectSchema(): Result<SchemaEntry, QiError> {
    if (!this.config.schemaName) {
      return failure(createChatOllamaFunctionCallingError(
        'NO_SCHEMA_SPECIFIED',
        'Schema name must be explicitly provided - no default schema allowed',
        'VALIDATION',
        { operation: 'selectSchema' }
      ));
    }
    return globalSchemaRegistry.getSchema(this.config.schemaName);
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Initialize if needed - will throw explicit errors if prerequisites fail
    if (!this.initialized) {
      await this.initializeLLM();
      this.initialized = true;
    }

    const classificationResult = await fromAsyncTryCatch(
      async () => {
        return await this.classifyInternal(input, context);
      },
      (error: unknown) => createChatOllamaFunctionCallingError(
        'CLASSIFICATION_FAILED',
        `ChatOllama function calling classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), method: 'functionCalling' }
      )
    );

    // Convert Result<T> to ClassificationResult or throw explicit error
    return match(
      (result) => result,
      (error) => {
        throw new Error(`ChatOllama function calling method failed: ${error.message}`);
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
        method: 'langchain-ollama-function-calling',
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
      return failure(createChatOllamaFunctionCallingError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input) }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createChatOllamaFunctionCallingError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createChatOllamaFunctionCallingError(
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
      return failure(createChatOllamaFunctionCallingError(
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
        console.log('🔍 PROMPT SENT TO CHATOLLAMA:', prompt.substring(0, 200) + '...');
        
        // Use function calling method - ONLY working method for Ollama
        const result = await this.llmWithStructuredOutput.invoke(prompt);
        
        // DEBUG: Log what ChatOllama actually returns
        console.log('🔍 CHATOLLAMA FUNCTION CALLING RESULT:', JSON.stringify(result, null, 2));
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Add debug info
        if (typeof result === 'object' && result !== null) {
          (result as any).__debug_timing = duration;
          (result as any).__debug_method = 'functionCalling';
        }
        
        return result;
      },
      (error: unknown) => createChatOllamaFunctionCallingError(
        'LLM_INVOCATION_FAILED',
        `ChatOllama function calling invocation failed: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK',
        { error: String(error), method: 'functionCalling' }
      )
    );
  }

  private processResult(result: any, originalInput: string): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(createChatOllamaFunctionCallingError(
          'SCHEMA_NOT_SELECTED',
          'No schema selected for result processing',
          'SYSTEM'
        ));
      }

      // Validate required fields from function calling result
      if (!result.type || result.confidence === undefined) {
        return failure(createChatOllamaFunctionCallingError(
          'INVALID_FUNCTION_RESULT',
          'Result missing required fields: type and confidence',
          'VALIDATION',
          { result: JSON.stringify(result) }
        ));
      }

      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'llama3.2:3b'],
        ['provider', 'chatollama'],
        ['method', 'functionCalling'],
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
        confidence: typeof result.confidence === 'number' ? result.confidence : parseFloat(result.confidence) || 0.5,
        method: 'langchain-ollama-function-calling',
        reasoning: result.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createChatOllamaFunctionCallingError(
        'RESULT_PROCESSING_FAILED',
        `Failed to process ChatOllama function calling result: ${error instanceof Error ? error.message : String(error)}`,
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
      success // For function calling, classification success == parsing success
    );

    // Log tracking errors but don't fail
    match(
      () => {}, // Success - do nothing
      (error) => console.warn(`Failed to track ChatOllama function calling performance: ${error.message}`),
      trackingResult
    );
  }

  // Interface implementation
  getMethodName(): ClassificationMethod {
    return 'langchain-ollama-function-calling';
  }

  getExpectedAccuracy(): number {
    if (this.selectedSchema) {
      return this.selectedSchema.metadata.performance_profile.measured_accuracy ?? 
             this.selectedSchema.metadata.performance_profile.baseline_accuracy_estimate;
    }
    return 0.85; // Empirically verified working method
  }

  getAverageLatency(): number {
    if (this.selectedSchema) {
      return this.selectedSchema.metadata.performance_profile.measured_latency_ms ?? 
             this.selectedSchema.metadata.performance_profile.baseline_latency_estimate_ms;
    }
    return 7200; // 7.2s based on systematic testing
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
      const modelId = this.config.modelId || 'llama3.2:3b';
      return data.models?.some((model: any) => model.name === modelId) || false;
    } catch (_error) {
      return false;
    }
  }
}

/**
 * Factory function for creating ChatOllama function calling classification method
 */
export function createChatOllamaFunctionCallingClassificationMethod(
  config: ChatOllamaFunctionCallingConfig = {}
): ChatOllamaFunctionCallingClassificationMethod {
  return new ChatOllamaFunctionCallingClassificationMethod(config);
}