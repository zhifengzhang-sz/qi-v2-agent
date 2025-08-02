/**
 * Few-Shot LangChain Classifier
 * 
 * Uses LangChain's FewShotPromptTemplate with examples to improve classification accuracy.
 * Provides examples of each classification type to guide the model's understanding.
 */

import { z } from 'zod';
import type { LangChainConfig, ClassifierOptions } from './generic-langchain-classifier.js';

/**
 * Few-shot example structure for three-type classification
 */
interface ClassificationExample {
  input: string;
  output: {
    type: 'command' | 'prompt' | 'workflow';
    confidence: number;
    reasoning: string;
  };
}

/**
 * Default examples for three-type classification
 */
const DEFAULT_CLASSIFICATION_EXAMPLES: ClassificationExample[] = [
  {
    input: '/help',
    output: {
      type: 'command',
      confidence: 1.0,
      reasoning: 'Starts with "/" - clear system command pattern'
    }
  },
  {
    input: '/status',
    output: {
      type: 'command',
      confidence: 1.0,
      reasoning: 'System command with "/" prefix'
    }
  },
  {
    input: 'hello',
    output: {
      type: 'prompt',
      confidence: 0.9,
      reasoning: 'Simple greeting - conversational prompt'
    }
  },
  {
    input: 'what is recursion?',
    output: {
      type: 'prompt',
      confidence: 0.95,
      reasoning: 'Question asking for information - single-step prompt'
    }
  },
  {
    input: 'write a quicksort function in Python',
    output: {
      type: 'prompt',
      confidence: 0.85,
      reasoning: 'Single coding task - straightforward prompt'
    }
  },
  {
    input: 'fix the bug in auth.js and run tests',
    output: {
      type: 'workflow',
      confidence: 0.9,
      reasoning: 'Multiple steps: fix bug AND run tests - complex workflow'
    }
  },
  {
    input: 'create a new API endpoint with documentation and tests',
    output: {
      type: 'workflow',
      confidence: 0.95,
      reasoning: 'Multi-step task involving creation, documentation, and testing'
    }
  },
  {
    input: 'debug the login issue in src/auth.ts and update the README',
    output: {
      type: 'workflow',
      confidence: 0.9,
      reasoning: 'File-specific debugging plus documentation update - workflow'
    }
  }
];

/**
 * Few-Shot LangChain classifier using examples to improve accuracy
 */
export class FewShotLangChainClassifier<T> {
  private schema: z.ZodSchema<T>;
  private llm: any;
  private examples: ClassificationExample[];
  private config: LangChainConfig;
  private options: ClassifierOptions;
  private initialized: boolean = false;

  constructor(
    config: LangChainConfig,
    schema: z.ZodSchema<T>,
    examples?: ClassificationExample[],
    options: ClassifierOptions = {}
  ) {
    this.config = config;
    this.schema = schema;
    this.examples = examples || DEFAULT_CLASSIFICATION_EXAMPLES;
    this.options = {
      name: 'few_shot_classifier',
      temperature: 0.1,
      maxTokens: 1000,
      ...options
    };
  }

  /**
   * Initialize the LangChain model and prompt template
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Import LangChain components
      const { ChatOpenAI } = await import('@langchain/openai');
      const { FewShotPromptTemplate, PromptTemplate } = await import('@langchain/core/prompts');

      // Initialize the LLM
      this.llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen3:8b',
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
        configuration: {
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize FewShotLangChainClassifier: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create few-shot prompt with examples
   */
  private async createFewShotPrompt(input: string): Promise<string> {
    try {
      const { FewShotPromptTemplate, PromptTemplate } = await import('@langchain/core/prompts');

      // Template for each example
      const exampleTemplate = PromptTemplate.fromTemplate(`
Input: "{input}"
Output: {{"type": "{type}", "confidence": {confidence}, "reasoning": "{reasoning}"}}
`);

      // Main prompt template
      const mainTemplate = PromptTemplate.fromTemplate(`
You are an expert classifier that categorizes user inputs into three types:

1. **command** - System commands starting with "/" (e.g., "/help", "/status")
2. **prompt** - Single-step conversational requests or questions (e.g., "hello", "what is X?")  
3. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix bug and run tests")

Here are examples of correct classifications:

{examples}

Now classify this input following the same format:

Input: "{input}"
Output: `);

      // Create few-shot prompt template
      const fewShotPrompt = new FewShotPromptTemplate({
        examples: this.examples.map(ex => ({
          input: ex.input,
          type: ex.output.type,
          confidence: ex.output.confidence.toString(),
          reasoning: ex.output.reasoning
        })),
        examplePrompt: exampleTemplate,
        prefix: `You are an expert classifier that categorizes user inputs into three types:

1. **command** - System commands starting with "/" (e.g., "/help", "/status")
2. **prompt** - Single-step conversational requests or questions (e.g., "hello", "what is X?")  
3. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix bug and run tests")

Here are examples of correct classifications:
`,
        suffix: `Now classify this input following the same format:

Input: "{input}"
Output: `,
        inputVariables: ['input'],
      });

      // Format the prompt
      const formattedPrompt = await fewShotPrompt.format({ input });
      return formattedPrompt;
    } catch (error) {
      throw new Error(`Failed to create few-shot prompt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Method 1: Few-shot classification with examples
   */
  async classify(input: string): Promise<T> {
    await this.initialize();
    
    const prompt = await this.createFewShotPrompt(input);
    
    // Use withStructuredOutput for reliable parsing
    const structuredLlm = this.llm.withStructuredOutput(this.schema, {
      name: this.options.name
    });
    
    return await structuredLlm.invoke(prompt);
  }

  /**
   * Method 2: Classification with custom examples
   */
  async classifyWithExamples(input: string, customExamples: ClassificationExample[]): Promise<T> {
    const originalExamples = this.examples;
    this.examples = customExamples;
    
    try {
      const result = await this.classify(input);
      return result;
    } finally {
      this.examples = originalExamples;
    }
  }

  /**
   * Method 3: Raw few-shot prompt (without structured output)
   */
  async classifyRaw(input: string): Promise<string> {
    await this.initialize();
    
    const prompt = await this.createFewShotPrompt(input);
    const response = await this.llm.invoke(prompt);
    
    return response.content;
  }

  /**
   * Method 4: Batch classification with examples
   */
  async classifyBatch(inputs: string[]): Promise<T[]> {
    await this.initialize();
    
    const promises = inputs.map(input => this.classify(input));
    return await Promise.all(promises);
  }

  /**
   * Add new examples to the classifier
   */
  addExamples(newExamples: ClassificationExample[]): void {
    this.examples = [...this.examples, ...newExamples];
  }

  /**
   * Replace all examples
   */
  setExamples(examples: ClassificationExample[]): void {
    this.examples = examples;
  }

  /**
   * Get current examples
   */
  getExamples(): ClassificationExample[] {
    return [...this.examples];
  }

  /**
   * Check if the classifier is ready
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Check if the underlying model is available
   */
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
 * Factory function for creating a few-shot LangChain classifier
 */
export function createFewShotLangChainClassifier<T>(
  config: LangChainConfig,
  schema: z.ZodSchema<T>,
  examples?: ClassificationExample[],
  options?: ClassifierOptions
): FewShotLangChainClassifier<T> {
  return new FewShotLangChainClassifier(config, schema, examples, options);
}

export type { ClassificationExample };