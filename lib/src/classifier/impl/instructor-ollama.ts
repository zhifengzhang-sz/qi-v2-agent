/**
 * Instructor-based Ollama Classification Method
 *
 * Uses Instructor JavaScript library with Zod schemas for structured output.
 * Provides Pydantic-like validation and automatic retries for TypeScript.
 * Alternative to Native Ollama JSON Schema method with enhanced validation.
 */

import { failure, fromAsyncTryCatch, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import Instructor, { type Mode } from '@instructor-ai/instructor';
import OpenAI from 'openai';
import { z } from 'zod';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { detectCommand } from './command-detection-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for Instructor classification errors
 */
const createInstructorClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('instructor-ollama', code, message, category, context);

/**
 * Configuration for Instructor-based classification method
 */
export interface InstructorOllamaClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxRetries?: number;
  timeout?: number;
  mode?: Mode;
}

/**
 * Zod schema for classification results
 */
const ClassificationResponseSchema = z.object({
  type: z.enum(['prompt', 'workflow']).describe('Classification: prompt (single-step) or workflow (multi-step)'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  reasoning: z.string().optional().describe('Brief explanation of the classification decision'),
});

type ClassificationResponseType = z.infer<typeof ClassificationResponseSchema>;

/**
 * Instructor-based Ollama classification method implementation
 * Uses Instructor library with Zod for structured validation and automatic retries
 */
export class InstructorOllamaClassificationMethod implements IClassificationMethod {
  private config: InstructorOllamaClassificationConfig;
  private client: any; // Instructor client
  
  // Performance tracking
  private totalClassifications = 0;
  private totalLatencyMs = 0;
  private successfulClassifications = 0;

  constructor(config: Partial<InstructorOllamaClassificationConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl?.includes('/v1') ? config.baseUrl : (config.baseUrl || 'http://localhost:11434') + '/v1',
      modelId: config.modelId || 'llama3.2:3b',
      temperature: config.temperature || 0.1,
      maxRetries: config.maxRetries || 2,
      timeout: config.timeout || 30.0,
      mode: config.mode || 'JSON' as Mode,
    };

    // Initialize Instructor client
    const openai = new OpenAI({
      apiKey: 'ollama', // Required but unused for Ollama
      baseURL: this.config.baseUrl,
    });

    this.client = Instructor({
      client: openai,
      mode: this.config.mode as Mode,
    });
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();
    this.totalClassifications++;

    try {
      // Pre-filter commands using existing detection logic
      const commandResult = detectCommand(input, { commandPrefix: '/' });
      if (commandResult !== null) {
        const duration = Date.now() - startTime;
        this.totalLatencyMs += duration;
        this.successfulClassifications++;

        // Add timing metadata to the existing result
        const metadata = new Map(commandResult.metadata);
        metadata.set('duration_ms', duration.toString());
        metadata.set('provider', 'instructor-ollama');

        return {
          ...commandResult,
          method: 'instructor-ollama' as ClassificationMethod,
          metadata,
        };
      }

      // For non-commands, use Instructor structured output
      const classificationResult = await this.performInstructorClassification(input, context);
      
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
      return classificationResult.value;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.totalLatencyMs += duration;
      
      throw new Error(
        `Instructor-Ollama classification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getMethodName(): ClassificationMethod {
    return 'instructor-ollama' as ClassificationMethod;
  }

  getExpectedAccuracy(): number {
    return 0.92; // Expected 92%+ accuracy with Instructor validation
  }

  getAverageLatency(): number {
    return this.totalClassifications > 0 
      ? Math.round(this.totalLatencyMs / this.totalClassifications)
      : 0;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if Ollama is running by hitting the base URL
      const baseUrl = this.config.baseUrl?.replace('/v1', '') || 'http://localhost:11434';
      const response = await fetch(`${baseUrl}/api/tags`);
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.models?.some((model: any) => model.name === this.config.modelId) || false;
    } catch {
      return false;
    }
  }

  // Private methods

  private async performInstructorClassification(
    input: string, 
    context?: ProcessingContext
  ): Promise<Result<ClassificationResult, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Build classification prompt
        const prompt = this.buildClassificationPrompt(input, context);

        // Use Instructor to get structured output
        const response: ClassificationResponseType = await this.client.chat.completions.create({
          model: this.config.modelId,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_model: {
            schema: ClassificationResponseSchema,
            name: 'ClassificationResponse',
          },
          max_retries: this.config.maxRetries,
          timeout: this.config.timeout,
          temperature: this.config.temperature,
        });

        // Convert Instructor response to ClassificationResult
        return this.convertToClassificationResult(response, input);
      },
      (error: unknown) => createInstructorClassificationError(
        'CLASSIFICATION_FAILED',
        `Instructor classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'NETWORK',
        { error: String(error) }
      )
    );
  }

  private buildClassificationPrompt(input: string, context?: ProcessingContext): string {
    const contextStr = this.formatContext(context);
    
    return `You are a classification expert. Classify the following user input into one of two categories and respond with valid JSON.

**Categories:**
1. **prompt** - Single questions, explanations, greetings, or direct requests
2. **workflow** - Multi-step tasks requiring coordination of multiple actions

**User Input:** "${input}"
${contextStr}

You must respond with JSON containing:
- "type": either "prompt" or "workflow"
- "confidence": a number between 0.0 and 1.0
- "reasoning": brief explanation (optional)

Examples:
- "What is recursion?" → {"type": "prompt", "confidence": 0.95, "reasoning": "Simple question"}
- "Fix bug and run tests" → {"type": "workflow", "confidence": 0.9, "reasoning": "Multiple coordinated steps"}

Respond only with valid JSON:`;
  }

  private convertToClassificationResult(
    response: ClassificationResponseType,
    originalInput: string
  ): ClassificationResult {
    // Create metadata
    const metadata = new Map<string, string>([
      ['model', this.config.modelId || 'unknown'],
      ['provider', 'instructor-ollama'],
      ['timestamp', new Date().toISOString()],
      ['input_length', originalInput.length.toString()],
      ['validation_library', 'instructor-zod'],
      ['mode', this.config.mode?.toString() || 'JSON_SCHEMA'],
    ]);

    // Create result
    const classificationResult: ClassificationResult = {
      type: response.type,
      confidence: response.confidence,
      method: 'instructor-ollama' as ClassificationMethod,
      reasoning: response.reasoning || 'No reasoning provided',
      extractedData: new Map<string, unknown>(),
      metadata,
    };

    return classificationResult;
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
 * Factory function to create Instructor-based Ollama classification method
 */
export function createInstructorOllamaClassificationMethod(
  config: Partial<InstructorOllamaClassificationConfig> = {}
): InstructorOllamaClassificationMethod {
  return new InstructorOllamaClassificationMethod(config);
}