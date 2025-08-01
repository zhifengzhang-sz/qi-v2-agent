/**
 * LangChain-Based Prompt Handler
 *
 * Implements proper LangChain ChatPromptTemplate and MessagesPlaceholder
 * for structured context-aware prompting
 */

import { AIMessage, type BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import type { ContextMessage, ConversationContext } from '../../context/index.js';
import type {
  IPromptHandler,
  PromptOptions,
  PromptResponse,
  ProviderInfo,
} from '../interfaces/IPromptHandler.js';

/**
 * Enhanced prompt handler using LangChain template system
 */
export class LangChainPromptHandler implements IPromptHandler {
  private baseHandler: IPromptHandler;
  private templates: Map<string, ChatPromptTemplate> = new Map();

  constructor(baseHandler: IPromptHandler) {
    this.baseHandler = baseHandler;
    this.initializeTemplates();
  }

  /**
   * Initialize the handler with configuration (delegates to base handler)
   */
  async initialize(configPath: string, schemaPath: string): Promise<PromptResponse> {
    return await this.baseHandler.initialize(configPath, schemaPath);
  }

  /**
   * Complete prompt with proper LangChain context integration
   */
  async completeWithContext(
    prompt: string,
    context: ConversationContext,
    options: PromptOptions & { templateType?: string } = {}
  ): Promise<PromptResponse> {
    try {
      // Select appropriate template
      const templateType = options.templateType || 'default';
      const template = this.templates.get(templateType);

      if (!template) {
        console.warn(`Template ${templateType} not found, falling back to base handler`);
        return await this.baseHandler.complete(prompt, options);
      }

      // Convert context messages to LangChain format
      const conversationHistory = this.convertContextMessages([...context.messages]);

      // Prepare template variables
      const templateVariables = {
        domain: (options as any).domain || 'software development',
        context_type: context.type || 'general',
        conversation_history: conversationHistory,
        current_input: prompt,
        ...this.extractAdditionalVariables(options),
      };

      // Format the template
      const messages = await template.formatMessages(templateVariables);

      // Convert structured messages back to string for current LLM interface
      // TODO: Future improvement - update multi-llm-ts to accept Message objects directly
      const formattedPrompt = this.messagesToString(messages);

      // Execute with base handler
      const result = await this.baseHandler.complete(formattedPrompt, options);

      // Add metadata about template usage
      if (result.success && typeof result === 'object') {
        (result as any).templateMetadata = {
          templateType,
          messageCount: messages.length,
          hasConversationHistory: conversationHistory.length > 0,
          formattedPromptLength: formattedPrompt.length,
        };
      }

      return result;
    } catch (error) {
      console.error('LangChain template processing failed:', error);
      // Fallback to base handler
      return await this.baseHandler.complete(prompt, options);
    }
  }

  /**
   * Create conversation-aware prompt using default template
   */
  async completeWithHistory(
    prompt: string,
    conversationHistory: ContextMessage[],
    options: PromptOptions = {}
  ): Promise<PromptResponse> {
    const template = this.templates.get('default');
    if (!template) {
      return await this.baseHandler.complete(prompt, options);
    }

    try {
      const messages = await template.formatMessages({
        domain: (options as any).domain || 'general assistance',
        context_type: 'conversation',
        conversation_history: this.convertContextMessages(conversationHistory),
        current_input: prompt,
      });

      const formattedPrompt = this.messagesToString(messages);
      return await this.baseHandler.complete(formattedPrompt, options);
    } catch (error) {
      console.error('History-aware prompting failed:', error);
      return await this.baseHandler.complete(prompt, options);
    }
  }

  /**
   * Standard prompt completion (delegates to base handler)
   */
  async complete(prompt: string, options?: PromptOptions): Promise<PromptResponse> {
    return this.baseHandler.complete(prompt, options);
  }

  /**
   * Get available providers (delegates to base handler)
   */
  async getAvailableProviders(): Promise<ProviderInfo[]> {
    return this.baseHandler.getAvailableProviders();
  }

  /**
   * Validate provider (delegates to base handler)
   */
  async validateProvider(providerId: string): Promise<boolean> {
    return this.baseHandler.validateProvider(providerId);
  }

  /**
   * Get available template types
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Add custom template
   */
  addTemplate(name: string, template: ChatPromptTemplate): void {
    this.templates.set(name, template);
  }

  // Private methods

  /**
   * Initialize built-in templates
   */
  private initializeTemplates(): void {
    // Default context-aware template
    this.templates.set(
      'default',
      ChatPromptTemplate.fromMessages([
        [
          'system',
          'You are a helpful AI assistant specialized in {domain}. Current context: {context_type}',
        ],
        new MessagesPlaceholder('conversation_history'),
        ['user', '{current_input}'],
      ])
    );

    // Coding assistant template
    this.templates.set(
      'coding',
      ChatPromptTemplate.fromMessages([
        [
          'system',
          'You are an expert software developer and coding assistant specialized in {domain}. You provide clear, practical advice and code examples. Current session context: {context_type}',
        ],
        new MessagesPlaceholder('conversation_history'),
        ['user', '{current_input}'],
      ])
    );

    // Problem-solving template
    this.templates.set(
      'problem-solving',
      ChatPromptTemplate.fromMessages([
        [
          'system',
          'You are a problem-solving assistant. Analyze the situation step by step, consider multiple approaches, and provide clear solutions. Domain: {domain}, Context: {context_type}',
        ],
        new MessagesPlaceholder('conversation_history'),
        ['user', 'Problem to solve: {current_input}'],
      ])
    );

    // Learning/educational template
    this.templates.set(
      'educational',
      ChatPromptTemplate.fromMessages([
        [
          'system',
          'You are a patient and knowledgeable teacher specializing in {domain}. Break down complex concepts into understandable parts and provide examples. Context: {context_type}',
        ],
        new MessagesPlaceholder('conversation_history'),
        ['user', "I'd like to learn about: {current_input}"],
      ])
    );

    // Debug/troubleshooting template
    this.templates.set(
      'debugging',
      ChatPromptTemplate.fromMessages([
        [
          'system',
          'You are a debugging expert in {domain}. Help identify issues, provide systematic troubleshooting steps, and suggest fixes. Context: {context_type}',
        ],
        new MessagesPlaceholder('conversation_history'),
        ['user', 'Debug this issue: {current_input}'],
      ])
    );
  }

  /**
   * Convert context messages to LangChain Message objects
   */
  private convertContextMessages(contextMessages: ContextMessage[]): BaseMessage[] {
    return contextMessages.map((msg) => {
      switch (msg.role) {
        case 'user':
          return new HumanMessage({
            content: msg.content,
            additional_kwargs: {
              timestamp: msg.timestamp.toISOString(),
              id: msg.id,
              metadata: Object.fromEntries(msg.metadata || new Map()),
            },
          });
        case 'assistant':
          return new AIMessage({
            content: msg.content,
            additional_kwargs: {
              timestamp: msg.timestamp.toISOString(),
              id: msg.id,
              metadata: Object.fromEntries(msg.metadata || new Map()),
            },
          });
        case 'system':
          return new SystemMessage({
            content: msg.content,
            additional_kwargs: {
              timestamp: msg.timestamp.toISOString(),
              id: msg.id,
              metadata: Object.fromEntries(msg.metadata || new Map()),
            },
          });
        default:
          // Default to HumanMessage for unknown roles
          return new HumanMessage({
            content: msg.content,
            additional_kwargs: {
              timestamp: msg.timestamp.toISOString(),
              id: msg.id,
              role: msg.role,
              metadata: Object.fromEntries(msg.metadata || new Map()),
            },
          });
      }
    });
  }

  /**
   * Convert LangChain messages back to string format
   * TODO: Remove this when multi-llm-ts supports Message objects directly
   */
  private messagesToString(messages: BaseMessage[]): string {
    return messages
      .map((msg) => {
        let role: string;

        if (msg instanceof SystemMessage) {
          role = 'system';
        } else if (msg instanceof HumanMessage) {
          role = 'user';
        } else if (msg instanceof AIMessage) {
          role = 'assistant';
        } else {
          role = 'unknown';
        }

        return `${role}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Extract additional template variables from options
   */
  private extractAdditionalVariables(options: PromptOptions): Record<string, any> {
    const variables: Record<string, any> = {};

    // Extract any custom variables from options
    if (typeof options === 'object') {
      Object.keys(options).forEach((key) => {
        if (key.startsWith('template_')) {
          variables[key.replace('template_', '')] = (options as any)[key];
        }
      });
    }

    return variables;
  }
}

/**
 * Factory function to create LangChain-enhanced prompt handler
 */
export function createLangChainPromptHandler(baseHandler: IPromptHandler): LangChainPromptHandler {
  return new LangChainPromptHandler(baseHandler);
}
