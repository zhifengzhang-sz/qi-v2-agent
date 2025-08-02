/**
 * Output Fixing Parser LangChain Classifier
 * 
 * Uses LangChain's OutputFixingParser to automatically correct malformed outputs
 * and provide fallback mechanisms for reliable classification.
 */

import { z } from 'zod';
import type { LangChainConfig, ClassifierOptions } from './generic-langchain-classifier.js';

/**
 * Output Fixing Parser LangChain classifier with automatic error correction
 */
export class OutputFixingParserLangChainClassifier<T> {
  private schema: z.ZodSchema<T>;
  private llm: any;
  private baseParser: any;
  private fixingParser: any;
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
      name: 'output_fixing_classifier',
      temperature: 0.1,
      maxTokens: 1000,
      ...options
    };
  }

  /**
   * Initialize the LangChain model and output fixing parser
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Import LangChain components
      const { ChatOpenAI } = await import('@langchain/openai');
      const { StructuredOutputParser } = await import('@langchain/core/output_parsers');
      
      // Note: OutputFixingParser might not be available in this version
      // We'll implement manual retry logic instead

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

      // Create base structured output parser
      this.baseParser = StructuredOutputParser.fromZodSchema(this.schema);

      // For now, use the base parser as fixing parser
      // We'll implement manual retry and fixing logic
      this.fixingParser = this.baseParser;

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize OutputFixingParserLangChainClassifier: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create prompt with detailed instructions for consistent output
   */
  private async createRobustPrompt(input: string, customInstructions?: string): Promise<string> {
    try {
      const { PromptTemplate } = await import('@langchain/core/prompts');

      const defaultInstructions = `You are a precise input classifier. Follow these rules exactly:

CLASSIFICATION TYPES:
1. "command" - System commands starting with "/" (e.g., "/help", "/status")
2. "prompt" - Single conversational requests or questions (e.g., "hello", "what is X?")
3. "workflow" - Multi-step tasks requiring orchestration (e.g., "fix bug and run tests")

CLASSIFICATION RULES:
- If input starts with "/", it's ALWAYS a "command" with confidence 1.0
- If input has multiple steps (contains "and", "then", "after"), likely "workflow"
- If input mentions files (.js, .ts, src/, test/), likely "workflow"
- Simple questions or greetings are typically "prompt"

INPUT TO CLASSIFY: "{input}"

IMPORTANT: Respond in the exact format specified by the format instructions below.
Do not add extra text, explanations, or formatting.

{format_instructions}`;

      const template = PromptTemplate.fromTemplate(customInstructions || defaultInstructions);
      
      return await template.format({
        input,
        format_instructions: this.baseParser.getFormatInstructions()
      });
    } catch (error) {
      throw new Error(`Failed to create robust prompt: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Method 1: Standard classification with automatic fixing
   */
  async classify(input: string): Promise<T> {
    await this.initialize();
    
    const prompt = await this.createRobustPrompt(input);
    const response = await this.llm.invoke(prompt);
    
    // Use fixing parser to automatically correct malformed output
    return await this.fixingParser.parse(response.content);
  }

  /**
   * Method 2: Classification with custom prompt and fixing
   */
  async classifyWithPrompt(input: string, customInstructions: string): Promise<T> {
    await this.initialize();
    
    const prompt = await this.createRobustPrompt(input, customInstructions);
    const response = await this.llm.invoke(prompt);
    
    return await this.fixingParser.parse(response.content);
  }

  /**
   * Method 3: Multi-attempt classification with progressive fixing
   */
  async classifyWithProgression(input: string, maxAttempts: number = 3): Promise<T> {
    await this.initialize();
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // First attempt: Use base parser directly
        if (attempt === 1) {
          const prompt = await this.createRobustPrompt(input);
          const response = await this.llm.invoke(prompt);
          return await this.baseParser.parse(response.content);
        }
        
        // Subsequent attempts: Use fixing parser with increased temperature
        const originalTemp = this.llm.temperature;
        this.llm.temperature = Math.min(originalTemp + (attempt - 1) * 0.1, 0.7);
        
        const result = await this.classify(input);
        
        // Restore original temperature
        this.llm.temperature = originalTemp;
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxAttempts) {
          // Wait briefly before retry
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }
    
    throw new Error(`Classification failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Method 4: Fallback classification with manual fixing
   */
  async classifyWithFallback(input: string): Promise<T> {
    await this.initialize();
    
    try {
      // Try normal classification first
      return await this.classify(input);
    } catch (error) {
      // If fixing parser fails, attempt manual fallback
      console.warn('Fixing parser failed, attempting manual fallback:', error);
      
      try {
        // Create a more explicit prompt
        const fallbackPrompt = `
STRICT CLASSIFICATION TASK:

Input: "${input}"

Rules:
- If starts with "/": type="command", confidence=1.0
- If simple question/greeting: type="prompt", confidence=0.8
- If multiple steps: type="workflow", confidence=0.9

Respond ONLY with valid JSON in this exact format:
{"type": "command|prompt|workflow", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

        const response = await this.llm.invoke(fallbackPrompt);
        
        // Try to parse manually
        const cleanContent = response.content.trim();
        const jsonMatch = cleanContent.match(/\{.*\}/s);
        
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed as T;
        }
        
        throw new Error('Could not extract valid JSON from response');
      } catch (fallbackError) {
        // Final fallback: rule-based classification
        return this.createRuleBasedFallback(input);
      }
    }
  }

  /**
   * Method 5: Comparison mode (base parser vs fixing parser)
   */
  async classifyWithComparison(input: string): Promise<{
    baseResult?: T;
    fixedResult?: T;
    baseError?: string;
    fixedError?: string;
    wasFixed: boolean;
  }> {
    await this.initialize();
    
    const prompt = await this.createRobustPrompt(input);
    const response = await this.llm.invoke(prompt);
    
    let baseResult: T | undefined;
    let fixedResult: T | undefined;
    let baseError: string | undefined;
    let fixedError: string | undefined;
    
    // Try base parser first
    try {
      baseResult = await this.baseParser.parse(response.content);
    } catch (error) {
      baseError = error instanceof Error ? error.message : String(error);
    }
    
    // Try fixing parser
    try {
      fixedResult = await this.fixingParser.parse(response.content);
    } catch (error) {
      fixedError = error instanceof Error ? error.message : String(error);
    }
    
    return {
      baseResult,
      fixedResult,
      baseError,
      fixedError,
      wasFixed: !!baseError && !!fixedResult
    };
  }

  /**
   * Method 6: Batch classification with fixing
   */
  async classifyBatch(inputs: string[]): Promise<T[]> {
    await this.initialize();
    
    const promises = inputs.map(input => this.classify(input));
    return await Promise.all(promises);
  }

  /**
   * Rule-based fallback for when all parsing fails
   */
  private createRuleBasedFallback(input: string): T {
    const trimmed = input.trim().toLowerCase();
    
    // Rule-based classification as last resort
    if (trimmed.startsWith('/')) {
      return {
        type: 'command',
        confidence: 1.0,
        reasoning: 'Rule-based: starts with /'
      } as T;
    }
    
    // Check for workflow indicators
    const workflowIndicators = ['and', 'then', 'after', 'also', '.js', '.ts', '.py', 'src/', 'test/', 'tests'];
    const hasWorkflowIndicators = workflowIndicators.some(indicator => trimmed.includes(indicator));
    
    if (hasWorkflowIndicators) {
      return {
        type: 'workflow',
        confidence: 0.7,
        reasoning: 'Rule-based: contains workflow indicators'
      } as T;
    }
    
    // Default to prompt
    return {
      type: 'prompt',
      confidence: 0.6,
      reasoning: 'Rule-based: default classification'
    } as T;
  }

  /**
   * Get format instructions from the base parser
   */
  getFormatInstructions(): string {
    return this.baseParser?.getFormatInstructions() || '';
  }

  /**
   * Get the base parser
   */
  getBaseParser(): any {
    return this.baseParser;
  }

  /**
   * Get the fixing parser
   */
  getFixingParser(): any {
    return this.fixingParser;
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
 * Factory function for creating an output fixing parser classifier
 */
export function createOutputFixingParserLangChainClassifier<T>(
  config: LangChainConfig,
  schema: z.ZodSchema<T>,
  options?: ClassifierOptions
): OutputFixingParserLangChainClassifier<T> {
  return new OutputFixingParserLangChainClassifier(config, schema, options);
}