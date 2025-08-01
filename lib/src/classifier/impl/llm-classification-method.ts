// LLM-Based Classification Method
//
// Uses LangChain structured output with Zod schemas for accurate input classification
// Provides much higher accuracy than rule-based methods with reliable confidence scores

import { createOllamaStructuredWrapper, type OllamaStructuredWrapper } from '../../llm/index.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';
import { detectCommand } from './command-detection-utils.js';

// Schema for LLM classification output (using JSON Schema instead of Zod)
const ClassificationSchema = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['prompt', 'workflow'],
      description: 'The input type classification (commands handled separately)',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence score from 0.0 to 1.0',
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of why this classification was chosen',
    },
    indicators: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key indicators that led to this classification',
    },
    extracted_data: {
      type: 'object',
      description: 'Any extracted data from the input',
    },
  },
  required: ['type', 'confidence', 'reasoning', 'indicators', 'extracted_data'],
};

export class LLMClassificationMethod implements IClassificationMethod {
  private wrapper: OllamaStructuredWrapper;

  constructor(config: LLMClassificationConfig) {
    // Use working OllamaStructuredWrapper instead of broken ChatOllama
    this.wrapper = createOllamaStructuredWrapper({
      model: config.modelId || 'qwen3:8b',
      baseURL: config.baseUrl || 'http://172.18.144.1:11434',
      temperature: 0.1, // Low temperature for consistent classification
    });
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();

    // CRITICAL: Check for commands first to avoid expensive LLM calls
    const commandResult = detectCommand(input);
    if (commandResult) {
      // Add method-specific metadata
      commandResult.metadata?.set('latency', (Date.now() - startTime).toString());
      commandResult.metadata?.set('avoided_llm_call', 'true');
      return commandResult;
    }

    try {
      const prompt = this.buildClassificationPrompt(input, context);

      // Use the working OllamaStructuredWrapper instead of broken ChatOllama
      const result = (await this.wrapper.generateStructured(prompt, ClassificationSchema)) as {
        type: 'prompt' | 'workflow';
        confidence: number;
        reasoning: string;
        extracted_data?: Record<string, unknown>;
        indicators?: string[];
      };

      return {
        type: result.type,
        confidence: result.confidence,
        method: 'llm-based',
        reasoning: result.reasoning,
        extractedData: new Map(Object.entries(result.extracted_data || {})),
        metadata: new Map([
          ['model', 'ollama-structured-wrapper'],
          ['latency', (Date.now() - startTime).toString()],
          ['indicators', JSON.stringify(result.indicators || [])],
          ['prompt_tokens', this.estimateTokens(prompt).toString()],
          ['timestamp', new Date().toISOString()],
        ]),
      };
    } catch (error) {
      // Throw the actual error instead of masking it with fake results
      throw new Error(`LLM classification failed: ${error instanceof Error ? error.message : String(error)}`);
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
      // Use the wrapper's availability check
      return await this.wrapper.isAvailable();
    } catch (_error) {
      // Server not available or connection failed
      return false;
    }
  }

  private buildClassificationPrompt(input: string, context?: ProcessingContext): string {
    const contextInfo = context ? this.formatContext(context) : '';

    return `Classify the following user input into one of two categories:

**Categories:**
1. **prompt** - Simple conversational requests or questions (e.g., "hi", "what is recursion?", "write a function")  
2. **workflow** - Complex multi-step tasks that require orchestration (e.g., "fix the bug in auth.js and run tests", "create a new feature with tests and documentation")

**Classification Rules:**
- Prompts are single-step requests, questions, or conversational inputs
- Workflows involve multiple steps, file operations, testing, or complex task orchestration
- NOTE: Commands (starting with "/") are handled elsewhere and won't appear in this classification

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
