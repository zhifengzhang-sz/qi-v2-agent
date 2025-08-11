/**
 * LangChain Function Calling Classification Method (Provider-Agnostic)
 *
 * Automatically detects provider from model name and uses appropriate LLM class:
 * - Ollama models: ChatOllama with local endpoint
 * - OpenRouter models: ChatOpenAI with OpenRouter endpoint
 * - OpenAI models: ChatOpenAI with OpenAI endpoint
 * - Anthropic models: ChatAnthropic
 *
 * Replaces the old ChatOllama-hardcoded implementation with flexible provider support.
 */

import type { ChatAnthropic } from '@langchain/anthropic';
import type { ChatOllama } from '@langchain/ollama';
import type { ChatOpenAI } from '@langchain/openai';
import {
  type ErrorCategory,
  failure,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';
import {
  globalSchemaRegistry,
  type SchemaEntry,
  type SchemaSelectionCriteria,
} from '../schema-registry.js';
import {
  type BaseClassificationErrorContext,
  createClassificationError,
} from '../shared/error-types.js';
import {
  createLLMInstance,
  type DetectedProviderConfig,
  debugProviderDetection,
  validateProviderAvailability,
} from '../shared/provider-map.js';
import { detectCommand } from './command-detection-utils.js';

/**
 * Structured output from LangChain function calling
 */
interface LangChainClassificationOutput {
  type: 'prompt' | 'workflow' | 'command';
  confidence: number;
  reasoning?: string;
  [key: string]: unknown;
}

/**
 * Debug-enhanced classification output
 */
interface DebugLangChainOutput extends LangChainClassificationOutput {
  __debug_timing?: number;
  __debug_method?: string;
  __debug_provider?: string;
}

/**
 * Custom error factory for LangChain function calling classification errors
 */
const createLangChainFunctionCallingError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError =>
  createClassificationError('langchain-function-calling', code, message, category, context);

/**
 * Configuration for LangChain function calling classification method
 */
export interface LangChainFunctionCallingConfig {
  baseUrl?: string;
  modelId?: string;
  apiKey?: string;
  temperature?: number;
  timeout?: number;

  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;

  // Provider override options
  forceProvider?: string;
  enableProviderDebug?: boolean;
}

/**
 * Provider-agnostic LangChain function calling classification method
 */
export class LangChainFunctionCallingClassificationMethod implements IClassificationMethod {
  private llmWithStructuredOutput: ChatOllama | ChatOpenAI | ChatAnthropic | null = null;
  private config: LangChainFunctionCallingConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;
  private detectedProvider: DetectedProviderConfig | null = null;

  constructor(config: LangChainFunctionCallingConfig) {
    this.config = {
      modelId: 'llama3.2:3b', // Default to Ollama model
      temperature: 0.1,
      timeout: 30000,
      ...config,
    };
  }

  private async initializeLLM(): Promise<void> {
    try {
      // Validate required configuration
      if (!this.config.modelId) {
        throw new Error('modelId is required for LangChain function calling method');
      }
      const modelId = this.config.modelId;

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

      // Detect and validate provider
      const validation = validateProviderAvailability(modelId);
      if (!validation.isSupported) {
        throw new Error(`Provider validation failed: ${validation.errors.join(', ')}`);
      }
      if (!validation.provider) {
        throw new Error('Provider detection failed: no provider found');
      }

      this.detectedProvider = validation.provider;

      // Debug output if enabled
      if (this.config.enableProviderDebug) {
        const debug = debugProviderDetection(modelId);
        console.log('🔍 Provider Detection Debug:', JSON.stringify(debug, null, 2));
      }

      // Create LLM instance using provider map
      const llm = await createLLMInstance(modelId, {
        baseUrl: this.config.baseUrl, // Override if provided
        apiKey: this.config.apiKey, // Override if provided
        temperature: this.config.temperature,
        timeout: this.config.timeout,
      });

      // Use function calling method - works across all providers
      // Note: withStructuredOutput is available on all LangChain chat models
      const llmWithStructuredOutputMethod = (llm as any).withStructuredOutput;
      if (llmWithStructuredOutputMethod && typeof llmWithStructuredOutputMethod === 'function') {
        this.llmWithStructuredOutput = llmWithStructuredOutputMethod.call(
          llm,
          this.selectedSchema.schema,
          {
            name: this.selectedSchema.metadata.name,
            method: 'functionCalling',
          }
        ) as ChatOllama | ChatOpenAI | ChatAnthropic;
      } else {
        throw new Error('withStructuredOutput method not available on this LLM instance');
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize LangChain function calling method: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Select schema - explicit error propagation, NO FALLBACKS
   */
  private selectSchema(): Result<SchemaEntry, QiError> {
    if (!this.config.schemaName) {
      return failure(
        createLangChainFunctionCallingError(
          'NO_SCHEMA_SPECIFIED',
          'Schema name must be explicitly provided - no default schema allowed',
          'VALIDATION',
          { operation: 'selectSchema' }
        )
      );
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
      (error: unknown) =>
        createLangChainFunctionCallingError(
          'CLASSIFICATION_FAILED',
          `LangChain function calling classification failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          {
            error: String(error),
            method: 'functionCalling',
            provider: this.detectedProvider?.providerName,
            model: this.config.modelId,
          }
        )
    );

    // Convert Result<T> to ClassificationResult or throw explicit error
    return match(
      (result) => result,
      (error) => {
        throw new Error(`LangChain function calling method failed: ${error.message}`);
      },
      classificationResult
    );
  }

  private async classifyInternal(
    input: string,
    context?: ProcessingContext
  ): Promise<ClassificationResult> {
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
        method: 'langchain-function-calling',
        metadata: new Map([
          ...Array.from(commandResult.metadata || []),
          ['optimizedBy', 'command-detection-shortcut'],
          ['actualMethod', 'rule-based-command-detection'],
          ['skipLLM', 'true'],
          ['provider', this.detectedProvider?.providerName || 'unknown'],
        ]),
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
      return failure(
        createLangChainFunctionCallingError(
          'INVALID_INPUT',
          'Input must be a non-empty string',
          'VALIDATION',
          { input: String(input) }
        )
      );
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(
        createLangChainFunctionCallingError(
          'EMPTY_INPUT',
          'Input cannot be empty or only whitespace',
          'VALIDATION',
          { input }
        )
      );
    }

    if (trimmed.length > 10000) {
      return failure(
        createLangChainFunctionCallingError(
          'INPUT_TOO_LONG',
          'Input exceeds maximum length of 10,000 characters',
          'VALIDATION',
          { length: trimmed.length }
        )
      );
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
      return failure(
        createLangChainFunctionCallingError(
          'PROMPT_BUILD_FAILED',
          `Failed to build classification prompt: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { input, error: String(error) }
        )
      );
    }
  }

  private performClassification(
    prompt: string
  ): Promise<Result<LangChainClassificationOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const startTime = Date.now();

        // DEBUG: Log provider info
        if (this.config.enableProviderDebug) {
          console.log('🔍 PROVIDER INFO:', {
            provider: this.detectedProvider?.providerName,
            model: this.config.modelId,
            endpointType: this.detectedProvider?.endpointType,
            baseUrl: this.detectedProvider?.baseUrl,
          });
          console.log('🔍 PROMPT SENT:', `${prompt.substring(0, 200)}...`);
        }

        // Use function calling method - works across all providers
        const rawResult = await this.llmWithStructuredOutput?.invoke(prompt);

        // Extract structured output from the result
        const result = this.extractStructuredOutput(rawResult);

        // DEBUG: Always log result for debugging
        console.log('✅ LLM FUNCTION CALLING RESULT:', {
          type: result.type || 'MISSING',
          confidence: result.confidence || 'MISSING',
          reasoning: result.reasoning?.substring(0, 100) || 'MISSING',
          fullResult: JSON.stringify(result, null, 2),
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Add debug info
        const debugResult = result as DebugLangChainOutput;
        debugResult.__debug_timing = duration;
        debugResult.__debug_method = 'functionCalling';
        debugResult.__debug_provider = this.detectedProvider?.providerName || 'unknown';

        return result;
      },
      (error: unknown) => {
        // DEBUG: Log detailed error information for debugging
        console.log('🚨 LLM INVOCATION FAILED:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
          provider: this.detectedProvider?.providerName,
          model: this.config.modelId,
          baseUrl: this.detectedProvider?.baseUrl,
        });

        return createLangChainFunctionCallingError(
          'LLM_INVOCATION_FAILED',
          `LLM function calling invocation failed: ${error instanceof Error ? error.message : String(error)}`,
          'NETWORK',
          {
            error: String(error),
            method: 'functionCalling',
            provider: this.detectedProvider?.providerName,
            baseUrl: this.detectedProvider?.baseUrl,
          }
        );
      }
    );
  }

  private processResult(
    result: LangChainClassificationOutput,
    originalInput: string
  ): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(
          createLangChainFunctionCallingError(
            'SCHEMA_NOT_SELECTED',
            'No schema selected for result processing',
            'SYSTEM'
          )
        );
      }

      // Validate required fields from function calling result
      if (!result.type || result.confidence === undefined) {
        return failure(
          createLangChainFunctionCallingError(
            'INVALID_FUNCTION_RESULT',
            'Result missing required fields: type and confidence',
            'VALIDATION',
            { result: JSON.stringify(result) }
          )
        );
      }

      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'unknown'],
        ['provider', this.detectedProvider?.providerName || 'unknown'],
        ['provider_display_name', this.detectedProvider?.displayName || 'Unknown'],
        ['endpoint_type', this.detectedProvider?.endpointType || 'unknown'],
        ['method', 'functionCalling'],
        ['timestamp', new Date().toISOString()],
        ['input_length', originalInput.length.toString()],
        ['schema_used', this.selectedSchema.metadata.name],
        ['schema_complexity', this.selectedSchema.metadata.complexity],
      ]);

      // Add debug timing if available
      const debugResult = result as DebugLangChainOutput;
      if (debugResult.__debug_timing) {
        metadata.set('debug_timing_ms', debugResult.__debug_timing.toString());
      }
      if (debugResult.__debug_method) {
        metadata.set('debug_method', debugResult.__debug_method);
      }
      if (debugResult.__debug_provider) {
        metadata.set('debug_provider', debugResult.__debug_provider);
      }

      const extractedData = new Map<string, unknown>();

      // Extract additional schema-specific data
      if (result.indicators && Array.isArray(result.indicators)) {
        extractedData.set('indicators', result.indicators);
      }

      if (result.complexity_score !== undefined) {
        extractedData.set('complexity_score', result.complexity_score);
      }

      if (result.conversation_context !== undefined) {
        extractedData.set('conversation_context', result.conversation_context);
      }

      if (result.step_count !== undefined) {
        extractedData.set('step_count', result.step_count);
      }

      if (result.requires_coordination !== undefined) {
        extractedData.set('requires_coordination', result.requires_coordination);
      }

      const classificationResult: ClassificationResult = {
        type: result.type,
        confidence:
          typeof result.confidence === 'number'
            ? result.confidence
            : parseFloat(result.confidence) || 0.5,
        method: 'langchain-function-calling',
        reasoning: result.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(
        createLangChainFunctionCallingError(
          'RESULT_PROCESSING_FAILED',
          `Failed to process function calling result: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { error: String(error), result: JSON.stringify(result) }
        )
      );
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
   * Extract structured output from LangChain result (handles AIMessageChunk)
   */
  private extractStructuredOutput(rawResult: unknown): LangChainClassificationOutput {
    // If the result is already structured (direct function calling result)
    const resultObj = rawResult as any;
    if (resultObj && typeof resultObj === 'object' && resultObj.type && resultObj.confidence) {
      return resultObj as LangChainClassificationOutput;
    }

    // Handle AIMessageChunk - extract from tool_calls or content
    if (
      resultObj?.tool_calls &&
      Array.isArray(resultObj.tool_calls) &&
      resultObj.tool_calls.length > 0
    ) {
      const toolCall = resultObj.tool_calls[0];
      if (toolCall?.args) {
        return toolCall.args as LangChainClassificationOutput;
      }
    }

    // Handle content-based result
    if (resultObj?.content && typeof resultObj.content === 'string') {
      try {
        const parsed = JSON.parse(resultObj.content);
        return parsed as LangChainClassificationOutput;
      } catch {
        // Fallback for unparseable content
      }
    }

    // Default fallback
    return {
      type: 'prompt',
      confidence: 0.5,
      reasoning: 'Unable to extract structured output from LLM response',
    };
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
      (error) => console.warn(`Failed to track function calling performance: ${error.message}`),
      trackingResult
    );
  }

  // Interface implementation
  getMethodName(): ClassificationMethod {
    return 'langchain-function-calling';
  }

  getExpectedAccuracy(): number {
    if (this.selectedSchema) {
      return (
        this.selectedSchema.metadata.performance_profile.measured_accuracy ??
        this.selectedSchema.metadata.performance_profile.baseline_accuracy_estimate
      );
    }
    return 0.85;
  }

  getAverageLatency(): number {
    if (this.selectedSchema) {
      return (
        this.selectedSchema.metadata.performance_profile.measured_latency_ms ??
        this.selectedSchema.metadata.performance_profile.baseline_latency_estimate_ms
      );
    }
    return 7200; // 7.2s baseline estimate
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.detectedProvider) {
        if (!this.config.modelId) {
          return false;
        }
        const validation = validateProviderAvailability(this.config.modelId);
        return validation.isSupported && validation.apiKeyAvailable;
      }

      // For Ollama, check if server is running
      if (this.detectedProvider.endpointType === 'ollama') {
        const baseUrl = this.config.baseUrl || this.detectedProvider.baseUrl;
        const response = await fetch(`${baseUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) return false;

        const data = (await response.json()) as { models?: Array<{ name: string }> };
        return data.models?.some((model) => model.name === this.config.modelId) || false;
      }

      // For other providers, just check if API key is available
      return !!process.env[this.detectedProvider.apiKeyEnv];
    } catch (_error) {
      return false;
    }
  }
}

/**
 * Factory function for creating provider-agnostic LangChain function calling classification method
 */
export function createLangChainFunctionCallingClassificationMethod(
  config: LangChainFunctionCallingConfig = {}
): LangChainFunctionCallingClassificationMethod {
  return new LangChainFunctionCallingClassificationMethod(config);
}
