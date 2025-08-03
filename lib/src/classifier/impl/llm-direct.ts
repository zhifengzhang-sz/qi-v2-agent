/**
 * LLM-Based Classification Method - QiCore Implementation
 *
 * Uses OllamaStructuredWrapper with proper QiCore Result<T> patterns.
 * Provides higher accuracy than rule-based methods with reliable confidence scores.
 * Internal layer implementation - uses proper QiCore Result<T> patterns.
 */

import { create, failure, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { createOllamaStructuredWrapper, type OllamaStructuredWrapper } from '../../llm/index.js';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { detectCommand } from './command-detection-utils.js';
import type {
  IClassificationMethod,
  ClassificationResult,
  ClassificationMethod,
  ProcessingContext
} from '../abstractions/index.js';

// Schema for LLM classification output (using JSON Schema instead of Zod)
const ClassificationSchema = {
  type: "object",
  properties: {
    type: { 
      type: "string", 
      enum: ["command", "prompt", "workflow"],
      description: "The input type classification"
    },
    confidence: { 
      type: "number", 
      minimum: 0, 
      maximum: 1,
      description: "Confidence score from 0.0 to 1.0"
    },
    reasoning: { 
      type: "string",
      description: "Brief explanation of why this classification was chosen"
    },
    indicators: { 
      type: "array", 
      items: { type: "string" },
      description: "Key indicators that led to this classification"
    },
    extracted_data: { 
      type: "object",
      description: "Any extracted data from the input"
    }
  },
  required: ["type", "confidence", "reasoning", "indicators", "extracted_data"]
};

/**
 * Custom error factory for LLM classification errors using standardized error types
 */
const createLLMClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('llm-based', code, message, category, context);

export class LLMClassificationMethod implements IClassificationMethod {
  private wrapper: OllamaStructuredWrapper;

  constructor(config: LLMClassificationConfig) {
    // Use working OllamaStructuredWrapper instead of broken ChatOllama
    this.wrapper = createOllamaStructuredWrapper({
      model: config.modelId || 'qwen2.5:7b',
      baseURL: config.baseUrl || 'http://172.18.144.1:11434',
      temperature: config.temperature || 0.1 // Low temperature for consistent classification
    });
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Use proper fromAsyncTryCatch for exception boundary like other QiCore methods
    const classificationResult = await fromAsyncTryCatch(
      async () => {
        return await this.classifyInternal(input, context);
      },
      (error: unknown) => createLLMClassificationError(
        'LLM_CLASSIFICATION_FAILED',
        `LLM classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK',
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
          // Return command result with updated metadata to show LLM method optimization
          return {
            ...commandResult,
            method: 'llm-based',
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
            const llmResult = await this.performLLMClassificationInternal(prompt, startTime);
            
            return match(
              (llmOutput) => {
                const processedResult = this.processLLMResult(llmOutput, validatedInput, startTime);
                return match(
                  (classification: ClassificationResult) => classification,
                  (error) => { throw new Error(error.message); },
                  processedResult
                );
              },
              (error) => { throw new Error(error.message); },
              llmResult
            );
          },
          async (error) => { throw new Error(error.message); },
          promptResult
        );
      },
      async (error) => { throw new Error(error.message); },
      validationResult
    );
  }

  private validateInputInternal(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createLLMClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input), operation: 'validation' }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createLLMClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input, operation: 'validation' }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createLLMClassificationError(
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
      const prompt = this.buildClassificationPrompt(input, context);
      return success(prompt);
    } catch (error) {
      return failure(createLLMClassificationError(
        'PROMPT_BUILD_FAILED',
        `Failed to build classification prompt: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { input, error: String(error), operation: 'buildPrompt' }
      ));
    }
  }

  private performLLMClassificationInternal(prompt: string, startTime: number): Promise<Result<any, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Use the working OllamaStructuredWrapper instead of broken ChatOllama
        const result = await this.wrapper.generateStructured(prompt, ClassificationSchema) as any;
        return result;
      },
      (error: unknown) => {
        return {
          code: 'LLM_GENERATION_FAILED',
          message: `LLM generation failed: ${error instanceof Error ? error.message : String(error)}`,
          category: 'NETWORK' as const,
          context: { error: String(error), prompt_tokens: this.estimateTokens(prompt).toString() },
        };
      }
    );
  }

  private processLLMResult(
    result: any,
    originalInput: string,
    startTime: number
  ): Result<ClassificationResult, QiError> {
    try {
      const classificationResult: ClassificationResult = {
        type: result.type,
        confidence: result.confidence,
        method: 'llm-based',
        reasoning: result.reasoning,
        extractedData: new Map(Object.entries(result.extracted_data || {})),
        metadata: new Map([
          ['model', 'ollama-structured-wrapper'],
          ['latency', (Date.now() - startTime).toString()],
          ['indicators', JSON.stringify(result.indicators || [])],
          ['prompt_tokens', this.estimateTokens(originalInput).toString()],
          ['timestamp', new Date().toISOString()]
        ])
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createLLMClassificationError(
        'RESULT_PROCESSING_FAILED',
        `Failed to process LLM classification result: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), operation: 'processResult' }
      ));
    }
  }

  private createFallbackResult(errorMessage: string): ClassificationResult {
    return {
      type: 'prompt',
      confidence: 0.0,
      method: 'llm-based',
      reasoning: `LLM classification failed: ${errorMessage}`,
      extractedData: new Map(),
      metadata: new Map([
        ['error', errorMessage],
        ['fallback', 'true'],
        ['timestamp', new Date().toISOString()],
      ]),
    };
  }

  getMethodName(): ClassificationMethod {
    return 'llm-based';
  }

  getExpectedAccuracy(): number {
    return 0.92; // Based on research: 90-95% accuracy for LLM classification
  }

  getAverageLatency(): number {
    return 350; // ~200-500ms average
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Use the wrapper's availability check
      return await this.wrapper.isAvailable();
    } catch (error) {
      // Server not available or connection failed
      return false;
    }
  }

  private buildClassificationPrompt(input: string, context?: ProcessingContext): string {
    const contextInfo = context ? this.formatContext(context) : '';
    
    return `Classify the following user input into one of three categories:

**Categories:**
1. **command** - System commands that start with "/" (e.g., "/help", "/status", "/config")
2. **prompt** - Simple conversational requests or questions (e.g., "hi", "what is recursion?", "write a function")  
3. **workflow** - Complex multi-step tasks that require orchestration (e.g., "fix the bug in auth.js and run tests", "create a new feature with tests and documentation")

**Classification Rules:**
- Commands ALWAYS start with "/" and are system functions
- Prompts are single-step requests, questions, or conversational inputs
- Workflows involve multiple steps, file operations, testing, or complex task orchestration

**User Input:** "${input}"
${contextInfo}

**Instructions:**
- Analyze the input carefully for complexity indicators
- Look for file references, multiple actions, testing requirements
- Consider the user's intent and task complexity
- Provide a confidence score based on how clear the classification is
- Give specific reasoning for your choice`;
  }

  private formatContext(context: ProcessingContext): string {
    if (!context) return '';
    
    const parts: string[] = [];
    if (context.sessionId) parts.push(`Session: ${context.sessionId}`);
    if (context.previousInputs?.length) {
      parts.push(`Recent History: ${context.previousInputs.slice(-3).join(', ')}`);
    }
    
    return parts.length > 0 ? `\n**Context:** ${parts.join(' | ')}` : '';
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

export interface LLMClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}