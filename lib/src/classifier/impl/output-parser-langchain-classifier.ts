/**
 * Output Parser LangChain Classifier
 * 
 * Uses LangChain's output parsers (PydanticOutputParser, StructuredOutputParser)
 * for structured classification without relying on function calling.
 */

import { z } from 'zod';
import type { LangChainConfig, ClassifierOptions } from './generic-langchain-classifier.js';

/**
 * Output Parser LangChain classifier using traditional parsing approach
 */
export class OutputParserLangChainClassifier<T> {
  private schema: z.ZodSchema<T>;
  private llm: any;
  private parser: any;
  private config: LangChainConfig;
  private options: ClassifierOptions;
  private initialized: boolean = false;

  constructor(
    config: LangChainConfig,
    schema: z.ZodSchema<T>,
    options: ClassifierOptions = {}
  ) {
    this.config = config;
    this.schema = schema;
    this.options = {
      name: 'output_parser_classifier',
      temperature: 0.1,
      maxTokens: 1000,
      ...options
    };
  }

  /**
   * Initialize the LangChain model and output parser
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Import LangChain components
      const { ChatOpenAI } = await import('@langchain/openai');
      const { StructuredOutputParser } = await import('@langchain/core/output_parsers');
      const { PromptTemplate } = await import('@langchain/core/prompts');

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

      // Create structured output parser from Zod schema
      this.parser = StructuredOutputParser.fromZodSchema(this.schema);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize OutputParserLangChainClassifier: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create prompt with format instructions
   */
  private async createPromptWithInstructions(input: string, customPrompt?: string): Promise<string> {
    try {
      const { PromptTemplate } = await import('@langchain/core/prompts');

      const defaultPrompt = `You are an expert classifier that categorizes user inputs into three types:

1. **command** - System commands starting with "/" (e.g., "/help", "/status", "/config")
2. **prompt** - Single-step conversational requests or questions (e.g., "hello", "what is recursion?", "write a function")
3. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix bug in auth.js and run tests", "create API with docs and tests")

Classify this input and provide your reasoning:

Input: "{input}"

{format_instructions}`;

      const template = PromptTemplate.fromTemplate(customPrompt || defaultPrompt);
      
      const prompt = await template.format({
        input,
        format_instructions: this.parser.getFormatInstructions()
      });

      return prompt;
    } catch (error) {
      throw new Error(`Failed to create prompt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Method 1: Standard output parser classification
   */
  async classify(input: string): Promise<T> {
    await this.initialize();
    
    const prompt = await this.createPromptWithInstructions(input);
    const response = await this.llm.invoke(prompt);
    
    // Parse the response using the output parser
    return await this.parser.parse(response.content) as T;
  }

  /**
   * Method 2: Classification with custom prompt template
   */
  async classifyWithPrompt(input: string, promptTemplate: string): Promise<T> {
    await this.initialize();
    
    const prompt = await this.createPromptWithInstructions(input, promptTemplate);
    const response = await this.llm.invoke(prompt);
    
    return await this.parser.parse(response.content) as T;
  }

  /**
   * Method 3: Raw classification (returns unparsed response)
   */
  async classifyRaw(input: string): Promise<string> {
    await this.initialize();
    
    const prompt = await this.createPromptWithInstructions(input);
    const response = await this.llm.invoke(prompt);
    
    return response.content;
  }

  /**
   * Method 4: Classification with retry on parse failure
   */
  async classifyWithRetry(input: string, maxRetries: number = 3): Promise<T> {
    await this.initialize();
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.classify(input);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          // Adjust temperature for retry
          const originalTemp = this.llm.temperature;
          this.llm.temperature = Math.min(originalTemp + 0.1, 0.8);
          
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          
          // Restore original temperature
          this.llm.temperature = originalTemp;
        }
      }
    }
    
    throw new Error(`Classification failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Method 5: Batch classification
   */
  async classifyBatch(inputs: string[]): Promise<T[]> {
    await this.initialize();
    
    const promises = inputs.map(input => this.classify(input));
    return await Promise.all(promises);
  }

  /**
   * Method 6: Classification with chain (prompt -> llm -> parser)
   */
  async classifyWithChain(input: string): Promise<T> {
    await this.initialize();
    
    try {
      const { PromptTemplate } = await import('@langchain/core/prompts');

      // Create a chain: prompt -> llm -> parser
      const promptTemplate = PromptTemplate.fromTemplate(`
Classify this user input into one of three categories:
- command: System commands starting with "/"
- prompt: Conversational requests or questions
- workflow: Multi-step tasks requiring orchestration

Input: "{input}"

{format_instructions}`);

      // Create the chain
      const chain = promptTemplate.pipe(this.llm).pipe(this.parser);
      
      // Execute the chain
      return await chain.invoke({
        input,
        format_instructions: this.parser.getFormatInstructions()
      }) as T;
    } catch (error) {
      throw new Error(`Chain classification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get format instructions from the parser
   */
  getFormatInstructions(): string {
    return this.parser?.getFormatInstructions() || '';
  }

  /**
   * Get the underlying parser
   */
  getParser(): any {
    return this.parser;
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
 * Alternative implementation using PydanticOutputParser (when available)
 */
export class PydanticOutputParserClassifier<T> {
  private schema: z.ZodSchema<T>;
  private llm: any;
  private parser: any;
  private config: LangChainConfig;
  private options: ClassifierOptions;
  private initialized: boolean = false;

  constructor(
    config: LangChainConfig,
    schema: z.ZodSchema<T>,
    options: ClassifierOptions = {}
  ) {
    this.config = config;
    this.schema = schema;
    this.options = {
      name: 'pydantic_parser_classifier',
      temperature: 0.1,
      maxTokens: 1000,
      ...options
    };
  }

  /**
   * Initialize with PydanticOutputParser (requires Pydantic model conversion)
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Import LangChain components
      const { ChatOpenAI } = await import('@langchain/openai');
      
      // For now, fall back to StructuredOutputParser since PydanticOutputParser
      // requires Python Pydantic models, not Zod schemas
      const { StructuredOutputParser } = await import('@langchain/core/output_parsers');

      this.llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen3:8b',
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
        configuration: {
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Use StructuredOutputParser as fallback
      this.parser = StructuredOutputParser.fromZodSchema(this.schema);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize PydanticOutputParserClassifier: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Classify using Pydantic-style parsing
   */
  async classify(input: string): Promise<T> {
    await this.initialize();
    
    const { PromptTemplate } = await import('@langchain/core/prompts');

    const template = PromptTemplate.fromTemplate(`
You are a classification expert. Analyze the input and classify it precisely.

Classification Rules:
- command: System commands starting with "/" 
- prompt: Single conversational requests or questions
- workflow: Complex multi-step tasks

Input to classify: "{input}"

Please respond in the following format:
{format_instructions}`);

    const prompt = await template.format({
      input,
      format_instructions: this.parser.getFormatInstructions()
    });

    const response = await this.llm.invoke(prompt);
    return await this.parser.parse(response.content) as T;
  }

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
 * Factory functions
 */
export function createOutputParserLangChainClassifier<T>(
  config: LangChainConfig,
  schema: z.ZodSchema<T>,
  options?: ClassifierOptions
): OutputParserLangChainClassifier<T> {
  return new OutputParserLangChainClassifier(config, schema, options);
}

export function createPydanticOutputParserClassifier<T>(
  config: LangChainConfig,
  schema: z.ZodSchema<T>,
  options?: ClassifierOptions
): PydanticOutputParserClassifier<T> {
  return new PydanticOutputParserClassifier(config, schema, options);
}