/**
 * OutputFixingParser LangChain Classification Method - Professional Implementation
 *
 * Uses LangChain OutputFixingParser with proper qicore Result<T> handling
 * for automatic error correction and progressive retry with unreliable models.
 */

import { create, failure, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import { 
  globalSchemaRegistry, 
  selectOptimalClassificationSchema,
  type SchemaSelectionCriteria,
  type SchemaEntry 
} from '../schema-registry.js';
import { getEffectiveAccuracy, getEffectiveLatency, trackClassificationPerformance } from '../shared/performance-tracking.js';
import { createParsingError, type ParsingClassificationErrorContext } from '../shared/error-types.js';
import { detectCommand } from './command-detection-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for output fixing classification errors using standardized error types
 */
const createOutputFixingClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<ParsingClassificationErrorContext> = {}
): QiError => createParsingError('outputfixing-langchain', code, message, category, context);

/**
 * Configuration for OutputFixing LangChain classification method
 */
export interface OutputFixingLangChainClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
  
  // Progressive retry configuration
  maxRetries?: number;
  temperatureIncrement?: number;
  maxFixingAttempts?: number;
  
  // Comparison mode (test both base and fixing parser)
  enableComparison?: boolean;
}

/**
 * Parse attempt result for tracking success/failure
 */
interface ParseAttemptResult {
  success: boolean;
  result?: any;
  error?: string;
  method: 'base-parser' | 'fixing-parser' | 'rule-based-fallback';
  attempts: number;
}

/**
 * OutputFixingParser LangChain-based classification with auto-correction
 * Progressive retry with increasing temperature and rule-based fallback
 */
export class OutputFixingLangChainClassificationMethod implements IClassificationMethod {
  private llm: any;
  private baseParser!: StructuredOutputParser<any>;
  private config: OutputFixingLangChainClassificationConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;

  constructor(config: OutputFixingLangChainClassificationConfig) {
    this.config = {
      maxRetries: 3,
      temperatureIncrement: 0.1,
      maxFixingAttempts: 2,
      enableComparison: false,
      ...config
    };
  }

  private async initializeLLM(): Promise<void> {
    try {
      // Select schema based on configuration or criteria
      const schemaResult = this.selectSchema();
      const selectedSchema = await match(
        async (schema) => schema,
        async (error) => {
          throw new Error(`Schema selection failed: ${error.message}`);
        },
        schemaResult
      );
      this.selectedSchema = selectedSchema;
      
      // Use dynamic imports for better compatibility
      const { ChatOpenAI } = await import('@langchain/openai');
      
      this.llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen2.5:7b',
        temperature: this.config.temperature || 0.1,
        maxTokens: this.config.maxTokens || 1000,
        configuration: {
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Create structured output parser from selected schema
      this.baseParser = StructuredOutputParser.fromZodSchema(this.selectedSchema!.schema);
      
    } catch (error) {
      throw new Error(
        `Failed to initialize OutputFixing LangChain classification: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Select schema based on configuration or automatic criteria
   */
  private selectSchema(): Result<SchemaEntry, QiError> {
    // If explicit schema name provided, use it
    if (this.config.schemaName) {
      return globalSchemaRegistry.getSchema(this.config.schemaName);
    }

    // Use selection criteria if provided
    if (this.config.schemaSelectionCriteria) {
      return selectOptimalClassificationSchema(this.config.schemaSelectionCriteria);
    }

    // Default to minimal schema for fixing parser (simpler = more reliable)
    const defaultCriteria: SchemaSelectionCriteria = {
      use_case: 'production',
      model_supports_function_calling: false, // OutputFixing for unreliable models
      prioritize_accuracy: false,
      prioritize_speed: true
    };

    return selectOptimalClassificationSchema(defaultCriteria);
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Use proper fromAsyncTryCatch for exception boundary
    const classificationResult = await fromAsyncTryCatch(
      async () => {
        // Ensure LLM is initialized
        if (!this.initialized) {
          await this.initializeLLM();
          this.initialized = true;
        }

        return await this.classifyInternal(input, context);
      },
      (error: unknown) => createOutputFixingClassificationError(
        'OUTPUTFIXING_CLASSIFICATION_FAILED',
        `OutputFixing classification failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
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

  /**
   * Classify with progression: base parser -> fixing parser -> rule-based fallback
   */
  async classifyWithProgression(
    input: string, 
    context: ProcessingContext | undefined,
    maxRetries: number
  ): Promise<ClassificationResult> {
    const attempts: ParseAttemptResult[] = [];
    
    // Step 1: Try base parser first
    const baseAttempt = await this.tryBaseParser(input, context, maxRetries);
    attempts.push(baseAttempt);
    
    if (baseAttempt.success) {
      return this.processSuccessfulResult(baseAttempt.result!, input, context, attempts);
    }
    
    // Step 2: Try fixing parser if base parser failed
    const fixingAttempt = await this.tryFixingParser(input, context, this.config.maxFixingAttempts || 2);
    attempts.push(fixingAttempt);
    
    if (fixingAttempt.success) {
      return this.processSuccessfulResult(fixingAttempt.result!, input, context, attempts);
    }
    
    // Step 3: Rule-based fallback
    const fallbackAttempt = this.tryRuleBasedFallback(input);
    attempts.push(fallbackAttempt);
    
    return this.processSuccessfulResult(fallbackAttempt.result!, input, context, attempts);
  }

  private async classifyInternal(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Use flatMap chains for proper error propagation
    const validationResult = this.validateInputInternal(input);
    
    return await match(
      async (validatedInput: string) => {
        // First, check if it's a command using fast rule-based detection
        const commandResult = detectCommand(validatedInput);
        if (commandResult) {
          // Return command result with updated metadata
          return {
            ...commandResult,
            method: 'outputfixing-langchain',
            metadata: new Map([
              ...Array.from(commandResult.metadata || []),
              ['optimizedBy', 'command-detection-shortcut'],
              ['originalMethod', 'rule-based'],
              ['skipLLM', 'true'],
              ['outputfixing_method', 'true']
            ])
          };
        }

        // Use progressive classification with multiple fallback strategies
        return await this.classifyWithProgression(validatedInput, context, this.config.maxRetries || 3);
      },
      async (error) => {
        throw new Error(error.message);
      },
      validationResult
    );
  }

  private async tryBaseParser(
    input: string, 
    context: ProcessingContext | undefined, 
    maxRetries: number
  ): Promise<ParseAttemptResult> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Adjust temperature for retries
        const adjustedTemperature = (this.config.temperature || 0.1) + 
          (attempt * (this.config.temperatureIncrement || 0.1));
        
        if (attempt > 0) {
          this.llm.temperature = Math.min(0.5, adjustedTemperature);
        }

        const prompt = this.buildPrompt(input, context);
        const formatInstructions = this.baseParser.getFormatInstructions();
        
        const rawOutput = await this.llm.invoke(prompt.replace('{format_instructions}', formatInstructions));
        const result = await this.baseParser.parse(rawOutput.content);
        
        return {
          success: true,
          result,
          method: 'base-parser',
          attempts: attempt + 1
        };
        
      } catch (error) {
        if (attempt === maxRetries - 1) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            method: 'base-parser',
            attempts: maxRetries
          };
        }
      }
    }
    
    return {
      success: false,
      error: 'Base parser failed after all retries',
      method: 'base-parser',
      attempts: maxRetries
    };
  }

  private async tryFixingParser(
    input: string, 
    context: ProcessingContext | undefined, 
    maxAttempts: number
  ): Promise<ParseAttemptResult> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const prompt = this.buildPrompt(input, context);
        const formatInstructions = this.baseParser.getFormatInstructions();
        
        const rawOutput = await this.llm.invoke(prompt.replace('{format_instructions}', formatInstructions));
        
        // Implement simple fixing logic - try to clean up common JSON issues
        let cleanedContent = rawOutput.content.trim();
        
        // Remove common formatting issues
        cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        cleanedContent = cleanedContent.replace(/^\s*[^{]*({.*})[^}]*$/s, '$1');
        
        const result = await this.baseParser.parse(cleanedContent);
        
        return {
          success: true,
          result,
          method: 'fixing-parser',
          attempts: attempt + 1
        };
        
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            method: 'fixing-parser',
            attempts: maxAttempts
          };
        }
        
        // Try with higher temperature on retry
        if (attempt < maxAttempts - 1) {
          this.llm.temperature = Math.min(0.7, (this.llm.temperature || 0.1) + 0.1);
        }
      }
    }
    
    return {
      success: false,
      error: 'Fixing parser failed after all attempts',
      method: 'fixing-parser',
      attempts: maxAttempts
    };
  }

  private tryRuleBasedFallback(input: string): ParseAttemptResult {
    // Simple rule-based classification as final fallback
    const lowerInput = input.toLowerCase();
    
    // Check for workflow indicators
    const workflowIndicators = ['fix', 'create', 'refactor', 'implement', 'debug', 'analyze', 'test', 'deploy'];
    const hasWorkflowIndicators = workflowIndicators.some(indicator => lowerInput.includes(indicator));
    
    // Check for file references
    const hasFileReferences = /\b\w+\.\w+\b/.test(input);
    
    // Check for multi-step indicators
    const hasMultiStepIndicators = /\b(then|after|and|also|next)\b/.test(lowerInput);
    
    const isWorkflow = hasWorkflowIndicators || hasFileReferences || hasMultiStepIndicators;
    
    const result = {
      type: isWorkflow ? 'workflow' : 'prompt',
      confidence: isWorkflow ? 0.6 : 0.7, // Conservative confidence for fallback
      reasoning: `Rule-based fallback classification. Detected ${isWorkflow ? 'workflow' : 'prompt'} indicators.`
    };
    
    return {
      success: true,
      result,
      method: 'rule-based-fallback',
      attempts: 1
    };
  }

  private buildPrompt(input: string, context?: ProcessingContext): string {
    const contextStr = this.formatContext(context);
    
    return `
Classify the following user input into one of two categories with high accuracy:

**Categories:**
1. **prompt** - Single-step requests, questions, or conversational inputs (e.g., "hi", "what is recursion?", "write a function")
2. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix the bug in auth.js and run tests", "create a new feature with tests and documentation")

**Classification Rules:**
- Prompts are single-step requests, questions, or conversational inputs
- Workflows involve multiple steps, file operations, testing, or complex task orchestration
- Look for indicators like: multiple actions, file references, testing requirements, "and then", coordination needs

**User Input:** "${input}"
${contextStr}

**Instructions:**
- Analyze the input carefully for complexity and multi-step indicators
- Consider whether this requires orchestration across multiple tools/steps
- Provide a confidence score based on how clear the classification is
- Give specific reasoning for your choice

{format_instructions}
`;
  }

  private processSuccessfulResult(
    result: any,
    originalInput: string,
    context: ProcessingContext | undefined,
    attempts: ParseAttemptResult[]
  ): ClassificationResult {
    if (!this.selectedSchema) {
      throw new Error('No schema selected for result processing');
    }

    const successfulMethod = attempts.find(a => a.success)?.method || 'unknown';
    const totalAttempts = attempts.reduce((sum, a) => sum + a.attempts, 0);
    
    const metadata = new Map<string, string>([
      ['model', this.config.modelId || 'qwen2.5:7b'],
      ['provider', 'ollama-openai-compatible'],
      ['timestamp', new Date().toISOString()],
      ['input_length', originalInput.length.toString()],
      ['schema_used', this.selectedSchema!.metadata.name],
      ['method', 'outputfixing-langchain'],
      ['successful_parser', successfulMethod],
      ['total_attempts', totalAttempts.toString()],
      ['parse_attempts_summary', JSON.stringify(attempts.map(a => ({
        method: a.method,
        success: a.success,
        attempts: a.attempts
      })))]
    ]);

    const extractedData = new Map<string, unknown>();

    // Extract additional data based on schema structure
    if (result.indicators && Array.isArray(result.indicators)) {
      metadata.set('indicators', JSON.stringify(result.indicators));
    }
    
    if (result.complexity_score) {
      metadata.set('complexity_score', result.complexity_score.toString());
    }
    
    if (result.task_steps) {
      metadata.set('task_steps', result.task_steps.toString());
    }

    if (result.extracted_data && typeof result.extracted_data === 'object') {
      Object.entries(result.extracted_data).forEach(([key, value]) => {
        extractedData.set(key, value);
      });
    }

    // Add parsing-specific extracted data
    extractedData.set('parsing_attempts', attempts);
    extractedData.set('successful_method', successfulMethod);

    const classificationResult: ClassificationResult = {
      type: result.type,
      confidence: result.confidence,
      method: 'outputfixing-langchain',
      reasoning: result.reasoning || 'No reasoning provided',
      extractedData,
      metadata,
    };

    return classificationResult;
  }

  private validateInputInternal(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createOutputFixingClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input), operation: 'validation' }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createOutputFixingClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input, operation: 'validation' }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createOutputFixingClassificationError(
        'INPUT_TOO_LONG',
        'Input exceeds maximum length of 10,000 characters',
        'VALIDATION',
        { length: trimmed.length, operation: 'validation' }
      ));
    }

    return success(trimmed);
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

  private createFallbackResult(errorMessage: string): ClassificationResult {
    return {
      type: 'prompt',
      confidence: 0.0,
      method: 'outputfixing-langchain',
      reasoning: `OutputFixing classification failed: ${errorMessage}`,
      extractedData: new Map(),
      metadata: new Map([
        ['error', errorMessage],
        ['fallback', 'true'],
        ['method', 'outputfixing-langchain'],
        ['timestamp', new Date().toISOString()],
      ]),
    };
  }

  // Interface implementation methods
  getMethodName(): ClassificationMethod {
    return 'outputfixing-langchain';
  }

  getExpectedAccuracy(): number {
    // OutputFixing has variable accuracy due to fallback strategies
    const baseAccuracy = getEffectiveAccuracy(this.selectedSchema, 0.80);
    return Math.max(0.78, baseAccuracy - 0.08);
  }

  getAverageLatency(): number {
    // OutputFixing can have high latency due to multiple attempts
    const baseLatency = getEffectiveLatency(this.selectedSchema, 520);
    return baseLatency + 200;
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
 * Factory function for creating OutputFixing LangChain classification method
 */
export function createOutputFixingLangChainClassificationMethod(
  config: OutputFixingLangChainClassificationConfig = {}
): OutputFixingLangChainClassificationMethod {
  return new OutputFixingLangChainClassificationMethod(config);
}