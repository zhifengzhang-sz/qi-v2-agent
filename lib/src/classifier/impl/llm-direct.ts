/**
 * LLM-Based Classification Method - QiCore Implementation
 *
 * Uses QiCorePromptManager for proper LLM handling with Result<T> patterns.
 * Provides higher accuracy than rule-based methods with reliable confidence scores.
 * Internal layer implementation - uses proper QiCore Result<T> patterns.
 */

import { failure, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { createPromptHandler } from '../../prompt/index.js';
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
  private config: LLMClassificationConfig;
  private promptHandler = createPromptHandler();
  private initialized = false;

  constructor(config: LLMClassificationConfig) {
    this.config = config;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    // Use study framework config files
    const configPath = './src/study/classification-config.yaml';
    const schemaPath = './src/study/classification-schema.json';
    
    const result = await this.promptHandler.initialize(configPath, schemaPath);
    if (!result.success) {
      throw new Error(`Failed to initialize prompt handler: ${result.error}`);
    }
    
    this.initialized = true;
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    await this.ensureInitialized();
    
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
      (error) => {
        throw new Error(`LLM classification failed: ${error.message}`);
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
            const llmResult = await this.performLLMClassificationInternal(prompt);
            
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

  private async performLLMClassificationInternal(prompt: string): Promise<Result<any, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Use the prompt module instead of manual HTTP calls
        const response = await this.promptHandler.complete(prompt, {
          provider: 'ollama',
          model: this.config.modelId || 'qwen3:8b',
          temperature: this.config.temperature || 0.1,
          maxTokens: this.config.maxTokens || 1000,
        });

        if (!response.success) {
          throw new Error(`Prompt completion failed: ${response.error}`);
        }

        const responseText = response.data;
        
        // Try to parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          return {
            type: this.extractTypeFromText(responseText),
            confidence: 0.7,
            reasoning: 'Extracted from unstructured response',
            indicators: [],
            extracted_data: {}
          };
        }
        
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return {
            type: this.extractTypeFromText(responseText),
            confidence: 0.6,
            reasoning: 'JSON parsing failed, used text extraction',
            indicators: [],
            extracted_data: {}
          };
        }
      },
      (error: unknown) => createLLMClassificationError(
        'LLM_GENERATION_FAILED',
        `LLM generation failed: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK',
        { error: String(error) }
      )
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
          ['model', this.config.modelId || 'qwen3:8b'],
          ['provider', 'ollama'],
          ['handler', 'QiCorePromptManager'],
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
      await this.ensureInitialized();
      const providers = await this.promptHandler.getAvailableProviders();
      return providers.some(p => p.id === 'ollama' && p.available);
    } catch {
      return false;
    }
  }

  private buildClassificationPrompt(input: string, context?: ProcessingContext): string {
    const contextInfo = context ? this.formatContext(context) : '';
    
    return `Classify the following user input into one of three categories. Return your answer as JSON only.

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

**Required JSON Response Format:**
{
  "type": "command|prompt|workflow",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "indicators": ["key", "indicators"],
  "extracted_data": {}
}

Return only the JSON object, no other text.`;
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

  private extractTypeFromText(text: string): 'command' | 'prompt' | 'workflow' {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('command')) return 'command';
    if (lowerText.includes('workflow')) return 'workflow';
    return 'prompt'; // default
  }
}

export interface LLMClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
}