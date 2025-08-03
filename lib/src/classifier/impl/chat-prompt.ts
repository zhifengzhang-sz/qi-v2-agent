/**
 * ChatPromptTemplate LangChain Classification Method - Professional Implementation
 *
 * Uses LangChain ChatPromptTemplate with proper qicore Result<T> handling
 * for conversational AI and chat applications with session awareness.
 */

import { create, failure, flatMap, fromAsyncTryCatch, match, success, type ErrorCategory, type QiError, type Result } from '@qi/base';
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { 
  globalSchemaRegistry, 
  selectOptimalClassificationSchema,
  type SchemaSelectionCriteria,
  type SchemaEntry 
} from '../schema-registry.js';
import { getEffectiveAccuracy, getEffectiveLatency, trackClassificationPerformance } from '../shared/performance-tracking.js';
import { createClassificationError, type BaseClassificationErrorContext } from '../shared/error-types.js';
import { detectCommand } from './command-detection-utils.js';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';

/**
 * Custom error factory for chat prompt classification errors using standardized error types
 */
const createChatPromptClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): QiError => createClassificationError('chatprompt-langchain', code, message, category, context);

/**
 * Configuration for ChatPrompt LangChain classification method
 */
export interface ChatPromptLangChainClassificationConfig {
  baseUrl?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
  
  // Schema selection options
  schemaName?: string;
  schemaSelectionCriteria?: SchemaSelectionCriteria;
  
  // Chat-specific options
  systemPrompt?: string;
  userExperienceLevel?: 'beginner' | 'intermediate' | 'expert';
  enableStreaming?: boolean;
}

/**
 * User profile for personalized classification
 */
export interface UserProfile {
  experienceLevel: 'beginner' | 'intermediate' | 'expert';
  preferences: {
    verboseExplanations: boolean;
    quickResponses: boolean;
    detailedReasoning: boolean;
  };
  domains: string[]; // e.g., ['web-development', 'data-science', 'devops']
}

/**
 * ChatPrompt LangChain-based classification using ChatPromptTemplate
 * Optimized for conversational AI with session and user awareness
 */
export class ChatPromptLangChainClassificationMethod implements IClassificationMethod {
  private llmWithStructuredOutput: any;
  private config: ChatPromptLangChainClassificationConfig;
  private initialized: boolean = false;
  private selectedSchema: SchemaEntry | null = null;
  private chatPromptTemplate!: ChatPromptTemplate;

  constructor(config: ChatPromptLangChainClassificationConfig) {
    this.config = config;
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
      
      const llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen2.5:7b',
        temperature: this.config.temperature || 0.1,
        maxTokens: this.config.maxTokens || 1000,
        streaming: this.config.enableStreaming || false,
        configuration: {
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Use LangChain's withStructuredOutput with dynamically selected schema
      this.llmWithStructuredOutput = llm.withStructuredOutput(this.selectedSchema!.schema, {
        name: this.selectedSchema!.metadata.name,
      });

      // Create chat prompt template
      this.chatPromptTemplate = this.createChatPromptTemplate();
      
    } catch (error) {
      throw new Error(
        `Failed to initialize ChatPrompt LangChain classification: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Create the chat prompt template with system and human messages
   */
  private createChatPromptTemplate(): ChatPromptTemplate {
    const systemPrompt = this.config.systemPrompt || `You are an intelligent input classifier for a conversational AI system. Your job is to classify user inputs into categories to help route them to the appropriate handlers.

You have extensive experience in understanding user intent and can distinguish between:
- Simple conversational prompts and questions
- Complex multi-step workflows that require orchestration

Always provide thoughtful analysis and clear reasoning for your classifications.`;

    const systemMessage = SystemMessagePromptTemplate.fromTemplate(systemPrompt);

    const humanMessage = HumanMessagePromptTemplate.fromTemplate(`
Please classify the following user input into one of two categories:

**Categories:**
1. **prompt** - Single-step requests, questions, or conversational inputs (e.g., "hi", "what is recursion?", "write a function", "explain this concept")
2. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix the bug in auth.js and run tests", "create a new feature with tests and documentation", "analyze this codebase and suggest improvements")

**Classification Context:**
- User Experience Level: {experience_level}
- Session ID: {session_id}
- Previous Inputs: {previous_inputs}
{user_context}

**User Input:** "{input}"

**Instructions:**
- Consider the user's experience level when classifying complexity
- Use conversation history to understand context and intent
- Analyze for multi-step indicators, file references, testing requirements
- Provide confidence score based on clarity of classification
- Give specific reasoning that considers conversational context

Please provide your classification with detailed reasoning.`);

    return ChatPromptTemplate.fromMessages([systemMessage, humanMessage]);
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

    // Default to detailed schema for chat applications (more context needed)
    const defaultCriteria: SchemaSelectionCriteria = {
      use_case: 'production',
      model_supports_function_calling: true,
      prioritize_accuracy: true, // Chat needs high accuracy
      prioritize_speed: false
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
      (error: unknown) => createChatPromptClassificationError(
        'CHATPROMPT_CLASSIFICATION_FAILED',
        `ChatPrompt classification failed: ${error instanceof Error ? error.message : String(error)}`,
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
   * Classify with conversation context and session awareness
   */
  async classifyConversation(
    input: string,
    sessionId: string,
    previousInputs: string[] = [],
    userProfile?: UserProfile
  ): Promise<ClassificationResult> {
    const conversationContext: ProcessingContext = {
      sessionId,
      timestamp: new Date(),
      source: 'conversation',
      previousInputs,
      userPreferences: userProfile ? new Map([
        ['experienceLevel', userProfile.experienceLevel],
        ['verboseExplanations', String(userProfile.preferences.verboseExplanations)],
        ['quickResponses', String(userProfile.preferences.quickResponses)],
        ['detailedReasoning', String(userProfile.preferences.detailedReasoning)],
        ['domains', userProfile.domains.join(',')]
      ]) : undefined
    };

    return this.classify(input, conversationContext);
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
          // Return command result with updated metadata
          return {
            ...commandResult,
            method: 'chatprompt-langchain',
            metadata: new Map([
              ...Array.from(commandResult.metadata || []),
              ['optimizedBy', 'command-detection-shortcut'],
              ['originalMethod', 'rule-based'],
              ['skipLLM', 'true'],
              ['chatprompt_method', 'true'],
              ['session_id', context?.sessionId || 'unknown']
            ])
          };
        }

        const promptResult = this.buildChatPromptInternal(validatedInput, context);
        
        return await match(
          async (formattedPrompt: any) => {
            const llmResult = await this.performChatClassificationInternal(formattedPrompt);
            
            return match(
              (llmOutput) => {
                const processedResult = this.processChatPromptResult(llmOutput, validatedInput, context);
                return match(
                  (classification: ClassificationResult) => {
                    // Track successful classification performance
                    trackClassificationPerformance(this.selectedSchema, startTime, true, true);
                    return classification;
                  },
                  (error) => {
                    // Track failed classification (parsing failed)
                    trackClassificationPerformance(this.selectedSchema, startTime, false, false);
                    return this.createFallbackResult(error.message);
                  },
                  processedResult
                );
              },
              (error) => {
                // Track failed classification (LLM failed)
                trackClassificationPerformance(this.selectedSchema, startTime, false, false);
                return this.createFallbackResult(error.message);
              },
              llmResult
            );
          },
          async (error) => {
            // Track failed classification (prompt building failed)
            trackClassificationPerformance(this.selectedSchema, startTime, false, false);
            return this.createFallbackResult(error.message);
          },
          promptResult
        );
      },
      async (error) => {
        // Track failed classification (validation failed)
        trackClassificationPerformance(this.selectedSchema, startTime, false, false);
        return this.createFallbackResult(error.message);
      },
      validationResult
    );
  }

  private validateInputInternal(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(createChatPromptClassificationError(
        'INVALID_INPUT',
        'Input must be a non-empty string',
        'VALIDATION',
        { input: String(input), operation: 'validation' }
      ));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(createChatPromptClassificationError(
        'EMPTY_INPUT',
        'Input cannot be empty or only whitespace',
        'VALIDATION',
        { input, operation: 'validation' }
      ));
    }

    if (trimmed.length > 10000) {
      return failure(createChatPromptClassificationError(
        'INPUT_TOO_LONG',
        'Input exceeds maximum length of 10,000 characters',
        'VALIDATION',
        { length: trimmed.length, operation: 'validation' }
      ));
    }

    return success(trimmed);
  }

  private buildChatPromptInternal(input: string, context?: ProcessingContext): Result<any, QiError> {
    try {
      const experienceLevel = context?.userPreferences?.get('experienceLevel') || this.config.userExperienceLevel || 'intermediate';
      const sessionId = context?.sessionId || 'unknown';
      const previousInputs = context?.previousInputs?.slice(-3).join(', ') || 'None';
      
      let userContext = '';
      if (context?.userPreferences) {
        const domains = context.userPreferences.get('domains') || '';
        const verboseExplanations = context.userPreferences.get('verboseExplanations') || false;
        userContext = `
- User Domains: ${domains}
- Prefers Verbose Explanations: ${String(verboseExplanations)}`;
      }

      const formattedPrompt = this.chatPromptTemplate.formatPromptValue({
        input,
        experience_level: experienceLevel,
        session_id: sessionId,
        previous_inputs: previousInputs,
        user_context: userContext
      });

      return success(formattedPrompt);
    } catch (error) {
      return failure(createChatPromptClassificationError(
        'CHATPROMPT_BUILD_FAILED',
        `Failed to build chat prompt: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { input, error: String(error), operation: 'buildChatPrompt' }
      ));
    }
  }

  private performChatClassificationInternal(formattedPrompt: any): Promise<Result<any, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const result = await this.llmWithStructuredOutput.invoke(formattedPrompt);
        return result;
      },
      (error: unknown) => {
        return {
          code: 'CHATPROMPT_CLASSIFICATION_FAILED',
          message: `ChatPrompt LangChain classification failed: ${error instanceof Error ? error.message : String(error)}`,
          category: 'NETWORK' as const,
          context: { error: String(error) },
        };
      }
    );
  }

  private processChatPromptResult(
    result: any,
    originalInput: string,
    context?: ProcessingContext
  ): Result<ClassificationResult, QiError> {
    try {
      if (!this.selectedSchema) {
        return failure(createChatPromptClassificationError(
          'SCHEMA_NOT_SELECTED',
          'No schema selected for result processing',
          'SYSTEM',
          { operation: 'processChatPromptResult' }
        ));
      }

      const metadata = new Map<string, string>([
        ['model', this.config.modelId || 'qwen2.5:7b'],
        ['provider', 'ollama-openai-compatible'],
        ['timestamp', new Date().toISOString()],
        ['input_length', originalInput.length.toString()],
        ['schema_used', this.selectedSchema!.metadata.name],
        ['method', 'chatprompt-langchain'],
        ['session_id', context?.sessionId || 'unknown'],
        ['experience_level', String(context?.userPreferences?.get('experienceLevel') || 'intermediate')],
        ['conversation_history_length', (context?.previousInputs?.length || 0).toString()],
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

      // Add conversation-specific extracted data
      if (context?.sessionId) {
        extractedData.set('session_id', context.sessionId);
      }
      if (context?.previousInputs?.length) {
        extractedData.set('conversation_context', context.previousInputs.slice(-3));
      }

      const classificationResult: ClassificationResult = {
        type: result.type,
        confidence: result.confidence,
        method: 'chatprompt-langchain',
        reasoning: result.reasoning || 'No reasoning provided',
        extractedData,
        metadata,
      };

      return success(classificationResult);
    } catch (error) {
      return failure(createChatPromptClassificationError(
        'CHATPROMPT_RESULT_PROCESSING_FAILED',
        `Failed to process chat prompt classification result: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM',
        { error: String(error), operation: 'processChatPromptResult' }
      ));
    }
  }

  private createFallbackResult(errorMessage: string): ClassificationResult {
    return {
      type: 'prompt',
      confidence: 0.0,
      method: 'chatprompt-langchain',
      reasoning: `ChatPrompt classification failed: ${errorMessage}`,
      extractedData: new Map(),
      metadata: new Map<string, string>([
        ['error', errorMessage],
        ['fallback', 'true'],
        ['method', 'chatprompt-langchain'],
        ['timestamp', new Date().toISOString()],
      ]),
    };
  }

  // Interface implementation methods
  getMethodName(): ClassificationMethod {
    return 'chatprompt-langchain';
  }

  getExpectedAccuracy(): number {
    // ChatPrompt generally has high accuracy due to conversational context
    const baseAccuracy = getEffectiveAccuracy(this.selectedSchema, 0.91);
    return Math.min(0.96, baseAccuracy + 0.03);
  }

  getAverageLatency(): number {
    // ChatPrompt may have slightly higher latency due to longer prompts  
    const baseLatency = getEffectiveLatency(this.selectedSchema, 400);
    return baseLatency + 80;
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
 * Factory function for creating ChatPrompt LangChain classification method
 */
export function createChatPromptLangChainClassificationMethod(
  config: ChatPromptLangChainClassificationConfig = {}
): ChatPromptLangChainClassificationMethod {
  return new ChatPromptLangChainClassificationMethod(config);
}