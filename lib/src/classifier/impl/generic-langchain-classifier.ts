/**
 * Generic LangChain Classifier
 * 
 * Professional implementation that accepts schema at construction time
 * and provides multiple classification methods for different use cases.
 */

import { z } from 'zod';
import type { QiError, Result } from '@qi/base';
import { Ok } from '@qi/base';

/**
 * Configuration options for the classifier
 */
export interface ClassifierOptions {
  name?: string;
  method?: 'json_mode' | 'function_calling';
  includeRaw?: boolean;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Configuration for LangChain model initialization
 */
export interface LangChainConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
}

/**
 * Generic LangChain classifier that accepts any Zod schema
 * Schema is set at construction time for optimal performance
 */
export class GenericLangChainClassifier<T> {
  private schema: z.ZodSchema<T>;
  private structuredLlm: any;
  private defaultPromptTemplate?: string;
  private config: LangChainConfig;
  private options: ClassifierOptions;
  private initialized: boolean = false;

  constructor(
    config: LangChainConfig,
    schema: z.ZodSchema<T>,
    defaultPromptTemplate?: string,
    options: ClassifierOptions = {}
  ) {
    this.config = config;
    this.schema = schema;
    this.defaultPromptTemplate = defaultPromptTemplate;
    this.options = {
      name: 'classifier',
      method: 'function_calling',
      includeRaw: false,
      temperature: 0.1,
      maxTokens: 1000,
      ...options
    };
  }

  /**
   * Initialize the LangChain model with structured output
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Use dynamic imports for better compatibility
      const { ChatOpenAI } = await import('@langchain/openai');
      
      const llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen3:8b',
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
        configuration: {
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Set up structured output with the provided schema
      const structuredOptions: any = {
        name: this.options.name
      };
      
      if (this.options.method) {
        structuredOptions.method = this.options.method;
      }
      
      this.structuredLlm = llm.withStructuredOutput(this.schema, structuredOptions);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize GenericLangChainClassifier: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Method 1: Simple classification - just user input
   * LLM uses schema descriptions to understand the task
   */
  async classify(input: string): Promise<T> {
    await this.initialize();
    return await this.structuredLlm.invoke(input);
  }

  /**
   * Method 2: Classification with custom prompt
   * Allows full control over the prompt structure
   */
  async classifyWithPrompt(input: string, prompt: string): Promise<T> {
    await this.initialize();
    const fullPrompt = prompt.replace('{input}', input);
    return await this.structuredLlm.invoke(fullPrompt);
  }

  /**
   * Method 3: Classification with default template
   * Uses the template set at construction time
   */
  async classifyWithTemplate(input: string): Promise<T> {
    if (!this.defaultPromptTemplate) {
      throw new Error('No default template set. Use classifyWithPrompt() or set template in constructor.');
    }
    await this.initialize();
    const fullPrompt = this.defaultPromptTemplate.replace('{input}', input);
    return await this.structuredLlm.invoke(fullPrompt);
  }

  /**
   * Method 4: Raw prompt classification
   * Sends the prompt directly without input substitution
   */
  async classifyRaw(prompt: string): Promise<T> {
    await this.initialize();
    return await this.structuredLlm.invoke(prompt);
  }

  /**
   * Method 5: Batch classification
   * Classify multiple inputs efficiently
   */
  async classifyBatch(inputs: string[]): Promise<T[]> {
    await this.initialize();
    const promises = inputs.map(input => this.classify(input));
    return await Promise.all(promises);
  }

  /**
   * Change the schema at runtime
   * Useful when you need to switch classification tasks
   */
  async setSchema<U>(newSchema: z.ZodSchema<U>, options?: ClassifierOptions): Promise<GenericLangChainClassifier<U>> {
    const newOptions = { ...this.options, ...options };
    
    // Create a new classifier instance with the new schema
    const newClassifier = new GenericLangChainClassifier(
      this.config,
      newSchema,
      this.defaultPromptTemplate,
      newOptions
    );
    
    return newClassifier;
  }

  /**
   * Set a new default prompt template
   */
  setDefaultTemplate(template: string): void {
    this.defaultPromptTemplate = template;
  }

  /**
   * Get the current schema (for debugging/introspection)
   */
  getSchema(): z.ZodSchema<T> {
    return this.schema;
  }

  /**
   * Check if the classifier is ready to use
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
 * Factory function for creating a generic LangChain classifier
 */
export function createGenericLangChainClassifier<T>(
  config: LangChainConfig,
  schema: z.ZodSchema<T>,
  defaultTemplate?: string,
  options?: ClassifierOptions
): GenericLangChainClassifier<T> {
  return new GenericLangChainClassifier(config, schema, defaultTemplate, options);
}