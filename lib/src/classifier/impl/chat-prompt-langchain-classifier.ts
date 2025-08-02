/**
 * Chat Prompt Template LangChain Classifier
 * 
 * Uses LangChain's ChatPromptTemplate for conversational context and
 * sophisticated prompt engineering with system/human message patterns.
 */

import { z } from 'zod';
import type { LangChainConfig, ClassifierOptions } from './generic-langchain-classifier.js';

/**
 * Chat context for maintaining conversation state
 */
interface ChatContext {
  sessionId?: string;
  previousInputs?: string[];
  userProfile?: {
    experienceLevel?: 'beginner' | 'intermediate' | 'expert';
    preferences?: string[];
  };
}

/**
 * Chat Prompt Template LangChain classifier using conversation patterns
 */
export class ChatPromptTemplateLangChainClassifier<T> {
  private schema: z.ZodSchema<T>;
  private structuredLlm: any;
  private chatPromptTemplate: any;
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
      name: 'chat_template_classifier',
      temperature: 0.1,
      maxTokens: 1000,
      ...options
    };
  }

  /**
   * Initialize the LangChain model and chat prompt template
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Import LangChain components
      const { ChatOpenAI } = await import('@langchain/openai');
      const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = await import('@langchain/core/prompts');

      // Initialize the LLM
      const llm = new ChatOpenAI({
        model: this.config.modelId || 'qwen3:8b',
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
        configuration: {
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
      });

      // Set up structured output
      this.structuredLlm = llm.withStructuredOutput(this.schema, {
        name: this.options.name
      });

      // Create chat prompt template
      this.chatPromptTemplate = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(`You are an expert input classifier for a development assistant AI.

Your task is to classify user inputs into exactly three categories:

🔧 **COMMAND**: System commands starting with "/" 
   - Examples: "/help", "/status", "/config", "/reset"
   - Pattern: Always starts with "/" followed by a command name
   - Confidence: Should be 1.0 for clear "/" patterns

💬 **PROMPT**: Single-step conversational requests or questions
   - Examples: "hello", "what is recursion?", "write a function", "explain X"
   - Characteristics: Direct questions, greetings, single coding tasks
   - Confidence: 0.8-0.95 depending on clarity

🔄 **WORKFLOW**: Multi-step tasks requiring orchestration
   - Examples: "fix bug in auth.js and run tests", "create API with docs and tests"
   - Characteristics: Contains "and", file references, multiple actions
   - Confidence: 0.8-0.95 depending on complexity indicators

Context information:
- Session: {session_id}
- Previous inputs: {previous_inputs}
- User experience: {experience_level}`),
        
        HumanMessagePromptTemplate.fromTemplate(`Please classify this input:

Input: "{input}"

Consider:
1. Does it start with "/" (command)?
2. Is it a single request/question (prompt)?
3. Does it involve multiple steps (workflow)?

Provide classification with confidence and reasoning.`)
      ]);

      this.initialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize ChatPromptTemplateLangChainClassifier: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Method 1: Standard chat-based classification
   */
  async classify(input: string, context?: ChatContext): Promise<T> {
    await this.initialize();
    
    const formattedPrompt = await this.chatPromptTemplate.formatPromptValue({
      input,
      session_id: context?.sessionId || 'anonymous',
      previous_inputs: context?.previousInputs?.slice(-3).join(', ') || 'none',
      experience_level: context?.userProfile?.experienceLevel || 'unknown'
    });

    return await this.structuredLlm.invoke(formattedPrompt);
  }

  /**
   * Method 2: Classification with conversation history
   */
  async classifyWithHistory(input: string, conversationHistory: string[]): Promise<T> {
    const context: ChatContext = {
      previousInputs: conversationHistory,
      sessionId: `session_${Date.now()}`
    };
    
    return await this.classify(input, context);
  }

  /**
   * Method 3: Classification with user profile
   */
  async classifyWithProfile(
    input: string, 
    userProfile: ChatContext['userProfile']
  ): Promise<T> {
    const context: ChatContext = {
      userProfile,
      sessionId: `profile_${Date.now()}`
    };
    
    return await this.classify(input, context);
  }

  /**
   * Method 4: Multi-turn conversation classification
   */
  async classifyConversation(
    input: string,
    sessionId: string,
    previousInputs: string[] = []
  ): Promise<T> {
    const context: ChatContext = {
      sessionId,
      previousInputs
    };
    
    return await this.classify(input, context);
  }

  /**
   * Method 5: Advanced chat with custom system prompt
   */
  async classifyWithCustomSystem(
    input: string,
    systemPrompt: string,
    context?: ChatContext
  ): Promise<T> {
    await this.initialize();
    
    try {
      const { ChatPromptTemplate, SystemMessagePromptTemplate, HumanMessagePromptTemplate } = await import('@langchain/core/prompts');

      const customChatTemplate = ChatPromptTemplate.fromMessages([
        SystemMessagePromptTemplate.fromTemplate(systemPrompt),
        HumanMessagePromptTemplate.fromTemplate(`Input to classify: "{input}"

Context:
- Session: {session_id}
- Previous: {previous_inputs}`)
      ]);

      const formattedPrompt = await customChatTemplate.formatPromptValue({
        input,
        session_id: context?.sessionId || 'custom',
        previous_inputs: context?.previousInputs?.join(', ') || 'none'
      });

      return await this.structuredLlm.invoke(formattedPrompt);
    } catch (error) {
      throw new Error(`Custom system classification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Method 6: Raw chat response (no structured output)
   */
  async classifyRaw(input: string, context?: ChatContext): Promise<string> {
    await this.initialize();
    
    // Use non-structured LLM
    const { ChatOpenAI } = await import('@langchain/openai');
    const rawLlm = new ChatOpenAI({
      model: this.config.modelId || 'qwen3:8b',
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      configuration: {
        baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
        apiKey: this.config.apiKey || 'ollama',
      },
    });

    const formattedPrompt = await this.chatPromptTemplate.formatPromptValue({
      input,
      session_id: context?.sessionId || 'raw',
      previous_inputs: context?.previousInputs?.join(', ') || 'none',
      experience_level: context?.userProfile?.experienceLevel || 'unknown'
    });

    const response = await rawLlm.invoke(formattedPrompt);
    return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
  }

  /**
   * Method 7: Batch classification with context
   */
  async classifyBatch(
    inputs: string[], 
    sharedContext?: ChatContext
  ): Promise<T[]> {
    await this.initialize();
    
    const promises = inputs.map((input, index) => {
      const context = {
        ...sharedContext,
        sessionId: `batch_${Date.now()}_${index}`
      };
      return this.classify(input, context);
    });
    
    return await Promise.all(promises);
  }

  /**
   * Method 8: Stream classification (for real-time chat)
   */
  async classifyStream(input: string, context?: ChatContext): Promise<AsyncIterable<any>> {
    await this.initialize();
    
    try {
      const formattedPrompt = await this.chatPromptTemplate.formatPromptValue({
        input,
        session_id: context?.sessionId || 'stream',
        previous_inputs: context?.previousInputs?.join(', ') || 'none',
        experience_level: context?.userProfile?.experienceLevel || 'unknown'
      });

      // Note: Streaming with structured output is complex, return regular stream
      const { ChatOpenAI } = await import('@langchain/openai');
      const streamLlm = new ChatOpenAI({
        model: this.config.modelId || 'qwen3:8b',
        temperature: this.options.temperature,
        configuration: {
          baseURL: this.config.baseUrl || 'http://localhost:11434/v1',
          apiKey: this.config.apiKey || 'ollama',
        },
        streaming: true,
      });

      return await streamLlm.stream(formattedPrompt);
    } catch (error) {
      throw new Error(`Stream classification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the current chat prompt template
   */
  getChatTemplate(): any {
    return this.chatPromptTemplate;
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
 * Factory function for creating a chat prompt template classifier
 */
export function createChatPromptTemplateLangChainClassifier<T>(
  config: LangChainConfig,
  schema: z.ZodSchema<T>,
  options?: ClassifierOptions
): ChatPromptTemplateLangChainClassifier<T> {
  return new ChatPromptTemplateLangChainClassifier(config, schema, options);
}

export type { ChatContext };