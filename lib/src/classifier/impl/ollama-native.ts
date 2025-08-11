/**
 * Native Ollama JSON Schema Classification Method (Rewritten)
 *
 * Uses prompt module + direct Ollama API for reliable classification.
 * Combines prompt module reliability with direct Ollama control.
 * Follows qicore Result<T> patterns with explicit error handling.
 */

import { JsonOutputParser } from '@langchain/core/output_parsers';
import {
  type ErrorCategory,
  failure,
  fromAsyncTryCatch,
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
import { globalSchemaRegistry, type SchemaEntry } from '../schema-registry.js';
import {
  type BaseClassificationErrorContext,
  createClassificationError,
} from '../shared/error-types.js';
import { detectCommand } from './command-detection-utils.js';

/**
 * Custom error factory for Ollama native classification errors
 */
const createOllamaNativeClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('ollama-native', code, message, category, context);

/**
 * Configuration for Ollama native classification method
 */
export interface OllamaNativeClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  timeout?: number; // Timeout in milliseconds (default: 30000)

  // Schema selection options
  schemaName?: string;
  schemaComplexity?: 'minimal' | 'standard' | 'detailed' | 'optimized';
}

/**
 * Ollama native API response structure
 */
interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
}

/**
 * Native Ollama classification method implementation
 * Uses Ollama's native /api/generate endpoint with JSON schema format
 */
export class OllamaNativeClassificationMethod implements IClassificationMethod {
  private config: OllamaNativeClassificationConfig;
  private selectedSchema?: SchemaEntry;
  private jsonParser: JsonOutputParser;
  private promptTemplate: string;

  // Performance tracking
  private totalClassifications = 0;
  private successfulClassifications = 0;
  private totalLatencyMs = 0;

  constructor(config: Partial<OllamaNativeClassificationConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:11434',
      modelId: config.modelId || 'llama3.2:3b',
      temperature: config.temperature || 0.1,
      timeout: config.timeout || 30000, // Default 30 seconds
      schemaName: config.schemaName || 'minimal',
      schemaComplexity: config.schemaComplexity || 'minimal',
    };

    // Initialize JSON parser
    this.jsonParser = new JsonOutputParser();

    // Select schema once during construction
    const schemaResult = this.selectSchema();
    if (schemaResult.tag === 'success') {
      this.selectedSchema = schemaResult.value;
    }

    // Build prompt template once during construction
    this.promptTemplate = `Classify the following user input into one of two categories:

**Categories:**
1. **prompt** - Single questions, explanations, greetings, or direct requests that can be answered immediately
   Examples: "Hi", "What is recursion?", "Explain machine learning", "How does JavaScript work?", "Write a function"
   
2. **workflow** - Multi-step tasks requiring coordination of multiple actions or tools
   Examples: "Fix bug in auth.js AND run tests", "Create feature WITH validation AND tests", "Analyze codebase AND suggest improvements"

**Key Classification Rules:**
- **prompt**: Simple questions, explanations, single coding requests, greetings, concept explanations
- **workflow**: Contains coordinating words (AND, then, with), multiple file operations, testing + code changes, analysis + recommendations

**Important:** 
- Questions asking "what is X?" or "explain Y" are ALWAYS prompts, even if complex topics
- Only classify as workflow if there are genuinely multiple coordinated steps

**User Input:** "{{INPUT}}"
{{CONTEXT}}

Respond with valid JSON matching the required schema.`;
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();
    this.totalClassifications++;

    try {
      // Pre-filter commands using existing detection logic
      const commandResult = detectCommand(input, {
        commandPrefix: '/',
        fileReferencePrefix: '',
        extendedThinkingTriggers: [],
        conversationControlFlags: [],
      });
      if (commandResult !== null) {
        const duration = Date.now() - startTime;
        this.totalLatencyMs += duration;
        this.successfulClassifications++;

        // Add timing metadata to the existing result
        const metadata = new Map(commandResult.metadata);
        metadata.set('duration_ms', duration.toString());
        metadata.set('provider', 'ollama-native');

        return {
          ...commandResult,
          method: 'ollama-native' as ClassificationMethod,
          metadata,
        };
      }

      // For non-commands, use Ollama native structured output
      const classificationResult = await this.performOllamaClassification(input, context);

      // Handle Result<T> pattern properly
      if (classificationResult.tag === 'failure') {
        const duration = Date.now() - startTime;
        this.totalLatencyMs += duration;
        throw new Error(`Classification failed: ${classificationResult.error.message}`);
      }

      // Success case - extract the ClassificationResult
      const duration = Date.now() - startTime;
      this.totalLatencyMs += duration;
      this.successfulClassifications++;

      // Performance tracking removed to prevent global state contamination

      return classificationResult.value;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.totalLatencyMs += duration;

      // Performance tracking removed to prevent global state contamination

      throw new Error(
        `Ollama native classification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getMethodName(): ClassificationMethod {
    return 'ollama-native' as ClassificationMethod;
  }

  getExpectedAccuracy(): number {
    return 0.9; // Expected 90%+ accuracy based on direct model testing
  }

  getAverageLatency(): number {
    return this.totalClassifications > 0
      ? Math.round(this.totalLatencyMs / this.totalClassifications)
      : 0;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) return false;

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      return data.models?.some((model) => model.name === this.config.modelId) || false;
    } catch {
      return false;
    }
  }

  // Private methods

  private async performOllamaClassification(
    input: string,
    context?: ProcessingContext
  ): Promise<Result<ClassificationResult, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Build prompt
        const promptResult = this.buildPrompt(input, context);
        if (promptResult.tag === 'failure') {
          throw new Error(`Prompt building failed: ${promptResult.error.message}`);
        }
        const prompt = promptResult.value;

        // Create JSON schema for Ollama format parameter
        const jsonSchemaResult = this.createOllamaJsonSchema();
        if (jsonSchemaResult.tag === 'failure') {
          throw new Error(`Schema creation failed: ${jsonSchemaResult.error.message}`);
        }
        const jsonSchema = jsonSchemaResult.value;

        // Call Ollama native API
        const ollamaResponse = await this.callOllamaNativeAPI(prompt, jsonSchema);

        // Parse and validate response
        return await this.processOllamaResponse(ollamaResponse, input);
      },
      (error: unknown) =>
        createOllamaNativeClassificationError(
          'CLASSIFICATION_FAILED',
          `Ollama native classification failed: ${error instanceof Error ? error.message : String(error)}`,
          'NETWORK',
          { error: String(error) }
        )
    );
  }

  private selectSchema(): Result<SchemaEntry, QiError> {
    try {
      // 🔧 REAL FIX: Don't use adaptive schema selection at all!
      // Just get the explicitly configured schema by name to ensure deterministic behavior
      return globalSchemaRegistry.getSchema(this.config.schemaName || 'minimal');
    } catch (error) {
      return failure(
        createOllamaNativeClassificationError(
          'SCHEMA_SELECTION_FAILED',
          `Schema selection failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { error: String(error) }
        )
      );
    }
  }

  private buildPrompt(input: string, context?: ProcessingContext): Result<string, QiError> {
    try {
      const contextStr = this.formatContext(context);

      // Use pre-built template with simple string replacement
      const prompt = this.promptTemplate
        .replace('{{INPUT}}', input)
        .replace('{{CONTEXT}}', contextStr);

      return success(prompt);
    } catch (error) {
      return failure(
        createOllamaNativeClassificationError(
          'PROMPT_BUILD_FAILED',
          `Failed to build classification prompt: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { input, error: String(error) }
        )
      );
    }
  }

  private createOllamaJsonSchema(): Result<object, QiError> {
    if (!this.selectedSchema) {
      return failure(
        createOllamaNativeClassificationError(
          'NO_SCHEMA_SELECTED',
          'Schema must be explicitly selected - no default schema available',
          'SYSTEM'
        )
      );
    }

    const schemaName = this.selectedSchema.metadata.name;

    if (schemaName === 'minimal') {
      return success({
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['prompt', 'workflow'],
            description: 'Classification: prompt (single-step) or workflow (multi-step)',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score from 0.0 to 1.0',
          },
        },
        required: ['type', 'confidence'],
      });
    } else if (schemaName === 'standard') {
      return success({
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['prompt', 'workflow'],
            description: 'Classification: prompt (single-step) or workflow (multi-step)',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score from 0.0 to 1.0',
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of the classification decision',
          },
        },
        required: ['type', 'confidence', 'reasoning'],
      });
    } else if (schemaName === 'context_aware') {
      return success({
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['prompt', 'workflow'],
            description:
              'prompt: direct question/request, workflow: requires multiple coordinated steps',
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score from 0.0 to 1.0',
          },
          reasoning: {
            type: 'string',
            description: 'Brief explanation of classification decision',
          },
          conversation_context: {
            type: 'string',
            enum: ['greeting', 'question', 'follow_up', 'task_request', 'multi_step'],
            description:
              'Context type: greeting/question/follow_up always prompt, task_request/multi_step may be workflow',
          },
          step_count: {
            type: 'integer',
            minimum: 1,
            description: 'Estimated number of steps needed (1=prompt, 2+=workflow)',
          },
          requires_coordination: {
            type: 'boolean',
            description: 'Does this require coordinating multiple tools/services?',
          },
        },
        required: [
          'type',
          'confidence',
          'reasoning',
          'conversation_context',
          'step_count',
          'requires_coordination',
        ],
      });
    } else {
      return failure(
        createOllamaNativeClassificationError(
          'UNSUPPORTED_SCHEMA',
          `Schema '${schemaName}' is not supported by ollama-native method. Supported schemas: minimal, standard, context_aware`,
          'SYSTEM',
          {
            requested_schema: schemaName,
            supported_schemas: ['minimal', 'standard', 'context_aware'],
          }
        )
      );
    }
  }

  private async callOllamaNativeAPI(
    prompt: string,
    jsonSchema: object
  ): Promise<OllamaGenerateResponse> {
    // For now, keep direct fetch approach but with better error handling and retry logic
    const requestBody = {
      model: this.config.modelId,
      prompt: prompt,
      format: jsonSchema,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: 500, // Limit response length for classification
      },
    };

    const controller = new AbortController();
    const timeoutMs = this.config.timeout || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let lastError: Error | null = null;

    // Add retry logic for better reliability (like prompt module would provide)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(
            `Ollama API error: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        const result = (await response.json()) as OllamaGenerateResponse;

        // Validate response structure
        if (!result || typeof result.response !== 'string') {
          throw new Error(`Invalid Ollama response structure: missing response field`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (error instanceof Error && error.name === 'AbortError') {
          clearTimeout(timeoutId);
          throw new Error(`Ollama API timeout after ${timeoutMs / 1000} seconds`);
        }

        // If this isn't the last attempt, wait before retrying
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          console.warn(`Ollama API attempt ${attempt} failed, retrying...`, lastError.message);
        }
      }
    }

    clearTimeout(timeoutId);
    throw lastError || new Error('All retry attempts failed');
  }

  private async processOllamaResponse(
    ollamaResponse: OllamaGenerateResponse,
    originalInput: string
  ): Promise<ClassificationResult> {
    try {
      // Use LangChain JsonOutputParser
      const parsedResult = await this.jsonParser.parse(ollamaResponse.response);

      // Validate and sanitize required fields
      if (!parsedResult || typeof parsedResult !== 'object') {
        throw new Error('Response is not a valid object');
      }

      // Validate type field
      if (!parsedResult.type || !['prompt', 'workflow', 'command'].includes(parsedResult.type)) {
        throw new Error(
          `Invalid type field: ${parsedResult.type}. Must be 'prompt', 'workflow', or 'command'`
        );
      }

      // Validate and sanitize confidence
      let confidence = parsedResult.confidence;
      if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
        console.warn(`Invalid confidence value: ${confidence}, defaulting to 0.5`);
        confidence = 0.5;
      }
      confidence = Math.max(0, Math.min(1, confidence)); // Clamp to [0,1]

      // Create metadata with enhanced debugging info
      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'unknown'],
        ['provider', 'ollama-native'],
        ['timestamp', new Date().toISOString()],
        ['input_length', originalInput.length.toString()],
        ['schema_used', this.selectedSchema?.metadata.name || 'minimal'],
        ['total_duration_ms', ollamaResponse.total_duration?.toString() || '0'],
        ['eval_duration_ms', ollamaResponse.eval_duration?.toString() || '0'],
        ['raw_response_length', ollamaResponse.response.length.toString()],
        ['response_preview', ollamaResponse.response.substring(0, 100)],
      ]);

      // Extract additional data if present
      const extractedData = new Map<string, unknown>();
      if (parsedResult.indicators && Array.isArray(parsedResult.indicators)) {
        extractedData.set('indicators', parsedResult.indicators);
      }
      if (parsedResult.complexity_score !== undefined) {
        extractedData.set('complexity_score', parsedResult.complexity_score);
      }

      // Create result
      const classificationResult: ClassificationResult = {
        type: parsedResult.type,
        confidence: confidence,
        method: 'ollama-native' as ClassificationMethod,
        reasoning: parsedResult.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return classificationResult;
    } catch (error) {
      throw new Error(
        `Failed to process Ollama response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private formatContext(context?: ProcessingContext): string {
    if (!context) return '';

    const contextParts: string[] = [];

    if (context.previousInputs && context.previousInputs.length > 0) {
      contextParts.push(`\n**Previous Context:** ${context.previousInputs.slice(-3).join(', ')}`);
    }

    if (context.source) {
      contextParts.push(`**Source:** ${context.source}`);
    }

    return contextParts.length > 0 ? contextParts.join('\n') : '';
  }
}

/**
 * Factory function to create Ollama native classification method
 */
export function createOllamaNativeClassificationMethod(
  config: Partial<OllamaNativeClassificationConfig> = {}
): OllamaNativeClassificationMethod {
  return new OllamaNativeClassificationMethod(config);
}
