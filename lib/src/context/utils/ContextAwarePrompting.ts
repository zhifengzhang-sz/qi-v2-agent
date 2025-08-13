/**
 * Context-Aware Prompting Utilities
 *
 * Enables context continuation in prompt processing without workflows
 * Now uses LangChain ChatPromptTemplate for proper message structure
 */

import { LangChainPromptHandler } from '../../prompt/impl/LangChainPromptHandler.js';
import type { IPromptHandler, PromptOptions, PromptResponse } from '../../prompt/index.js';
import { isDebugEnabled } from '../../utils/DebugLogger.js';
import type { ConversationContext, IContextManager } from '../abstractions/index.js';

/**
 * Enhanced prompt handler with context continuation support
 * Now uses LangChain templates for proper message structure
 */
export class ContextAwarePromptHandler {
  private langChainHandler: LangChainPromptHandler;

  constructor(
    private baseHandler: IPromptHandler,
    private contextManager: IContextManager
  ) {
    this.langChainHandler = new LangChainPromptHandler(baseHandler);
  }

  /**
   * Execute prompt with context continuation using LangChain templates
   */
  async completeWithContext(
    prompt: string,
    options: PromptOptions = {},
    contextId: string,
    includeHistory: boolean = true
  ): Promise<PromptResponse> {
    try {
      // Get conversation context
      const context = this.contextManager.getConversationContext(contextId);
      if (!context) {
        // Fallback to regular prompt processing
        return await this.baseHandler.complete(prompt, options);
      }

      let result: PromptResponse;

      if (includeHistory && context.messages.length > 0) {
        // Use LangChain template system for context-aware prompting
        const templateOptions = {
          ...options,
          templateType: this.selectTemplateType(prompt, options),
          domain: (options as any).domain || this.inferDomain(prompt, context),
        };

        if (isDebugEnabled()) {
          console.log(`🔍 [DEBUG] Calling LangChain with context - originalPrompt: "${prompt}"`);
          console.log(`🔍 [DEBUG] Context messages count: ${context.messages.length}`);
          console.log(`🔍 [DEBUG] Template options:`, templateOptions);
        }
        result = await this.langChainHandler.completeWithContext(prompt, context, templateOptions);
      } else {
        // No history to include, use base handler
        result = await this.baseHandler.complete(prompt, options);
      }

      // Update context with new interaction
      if (result.success) {
        this.contextManager.addMessageToContext(contextId, {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: prompt,
          timestamp: new Date(),
          metadata: new Map([
            ['enhanced', includeHistory.toString()],
            ['usedLangChain', (includeHistory && context.messages.length > 0).toString()],
            ['templateType', (result as any).templateMetadata?.templateType || 'none'],
          ]),
        });

        this.contextManager.addMessageToContext(contextId, {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: result.data,
          timestamp: new Date(),
          metadata: new Map([
            ['contextId', contextId],
            ['messageCount', (result as any).templateMetadata?.messageCount?.toString() || '0'],
            [
              'hadHistory',
              (result as any).templateMetadata?.hasConversationHistory?.toString() || 'false',
            ],
          ]),
        });
      }

      return result;
    } catch (error) {
      console.error('Context-aware prompting failed:', error);
      // Fallback to basic prompting
      try {
        return await this.baseHandler.complete(prompt, options);
      } catch (_fallbackError) {
        return {
          success: false,
          error: `Context-aware prompting failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  }

  /**
   * Create isolated context for sub-conversation
   */
  async createSubConversation(
    parentContextId: string,
    task: string,
    timeLimit: number = 300000 // 5 minutes
  ): Promise<string> {
    const subContext = this.contextManager.createConversationContext('sub-agent', parentContextId);

    // Add task description as system message
    this.contextManager.addMessageToContext(subContext.id, {
      id: `msg_${Date.now()}_system`,
      role: 'system',
      content: `Sub-conversation started for task: ${task}`,
      timestamp: new Date(),
      metadata: new Map([
        ['task', task],
        ['parentContext', parentContextId],
        ['timeLimit', timeLimit.toString()],
      ]),
    });

    return subContext.id;
  }

  /**
   * Continue conversation in existing context
   */
  async continueConversation(
    contextId: string,
    prompt: string,
    options: PromptOptions = {}
  ): Promise<PromptResponse> {
    return this.completeWithContext(prompt, options, contextId, true);
  }

  /**
   * Get conversation summary for context
   */
  async getConversationSummary(contextId: string, maxMessages: number = 10): Promise<string> {
    const context = this.contextManager.getConversationContext(contextId);
    if (!context || context.messages.length === 0) {
      return 'No conversation history available.';
    }

    const recentMessages = context.messages.slice(-maxMessages);
    let summary = `Conversation Summary (${recentMessages.length} messages):\n\n`;

    for (const message of recentMessages) {
      const timestamp = message.timestamp.toLocaleString();
      const content =
        message.content.length > 100 ? `${message.content.substring(0, 100)}...` : message.content;
      summary += `[${timestamp}] ${message.role}: ${content}\n`;
    }

    return summary;
  }

  /**
   * Select appropriate template based on prompt content and options
   */
  private selectTemplateType(prompt: string, options: PromptOptions): string {
    // Check if template type is explicitly specified
    if (options && typeof options === 'object' && 'templateType' in options) {
      return (options as any).templateType || 'default';
    }

    // Smart template selection based on prompt content
    const lowerPrompt = prompt.toLowerCase();

    // Coding-related keywords
    if (
      lowerPrompt.includes('code') ||
      lowerPrompt.includes('function') ||
      lowerPrompt.includes('class') ||
      lowerPrompt.includes('debug') ||
      lowerPrompt.includes('implementation') ||
      lowerPrompt.includes('typescript') ||
      lowerPrompt.includes('javascript') ||
      lowerPrompt.includes('programming')
    ) {
      return 'coding';
    }

    // Problem-solving keywords
    if (
      lowerPrompt.includes('problem') ||
      lowerPrompt.includes('issue') ||
      lowerPrompt.includes('error') ||
      lowerPrompt.includes('fix') ||
      lowerPrompt.includes('solve') ||
      lowerPrompt.includes('troubleshoot')
    ) {
      return 'problem-solving';
    }

    // Learning/educational keywords
    if (
      lowerPrompt.includes('explain') ||
      lowerPrompt.includes('learn') ||
      lowerPrompt.includes('understand') ||
      lowerPrompt.includes('what is') ||
      lowerPrompt.includes('how does') ||
      lowerPrompt.includes('teach me')
    ) {
      return 'educational';
    }

    // Debug keywords
    if (
      lowerPrompt.includes('debug') ||
      lowerPrompt.includes('why') ||
      lowerPrompt.includes('not working') ||
      lowerPrompt.includes('failing')
    ) {
      return 'debugging';
    }

    return 'default';
  }

  /**
   * Infer domain from prompt and conversation context
   */
  private inferDomain(prompt: string, context: ConversationContext): string {
    // Check recent messages for domain clues
    const recentMessages = context.messages.slice(-3);
    const allText = `${prompt} ${recentMessages.map((m) => m.content).join(' ')}`.toLowerCase();

    // Programming languages and technologies
    if (
      allText.includes('typescript') ||
      allText.includes('javascript') ||
      allText.includes('node.js')
    ) {
      return 'TypeScript/JavaScript';
    }
    if (allText.includes('python') || allText.includes('django') || allText.includes('flask')) {
      return 'Python';
    }
    if (allText.includes('java') || allText.includes('spring') || allText.includes('maven')) {
      return 'Java';
    }
    if (allText.includes('react') || allText.includes('vue') || allText.includes('angular')) {
      return 'Frontend Development';
    }
    if (allText.includes('database') || allText.includes('sql') || allText.includes('mongodb')) {
      return 'Database Development';
    }
    if (
      allText.includes('devops') ||
      allText.includes('docker') ||
      allText.includes('kubernetes')
    ) {
      return 'DevOps';
    }

    return 'software development';
  }

  /**
   * Transfer context between conversations
   */
  async transferContext(
    fromContextId: string,
    toContextId: string,
    includeMessages: boolean = true
  ): Promise<boolean> {
    try {
      const fromContext = this.contextManager.getConversationContext(fromContextId);
      const toContext = this.contextManager.getConversationContext(toContextId);

      if (!fromContext || !toContext) {
        return false;
      }

      if (includeMessages) {
        // Copy messages to target context
        for (const message of fromContext.messages) {
          this.contextManager.addMessageToContext(toContextId, {
            ...message,
            id: `transferred_${message.id}`,
            metadata: new Map([
              ...(message.metadata || new Map()),
              ['transferredFrom', fromContextId],
              ['transferredAt', new Date().toISOString()],
            ]),
          });
        }
      }

      // Add transfer notification
      this.contextManager.addMessageToContext(toContextId, {
        id: `transfer_${Date.now()}`,
        role: 'system',
        content: `Context transferred from ${fromContextId}`,
        timestamp: new Date(),
        metadata: new Map([
          ['transferType', 'context-transfer'],
          ['sourceContext', fromContextId],
        ]),
      });

      return true;
    } catch (error) {
      console.error('Context transfer failed:', error);
      return false;
    }
  }
}

/**
 * Factory function to create context-aware prompt handler
 */
export function createContextAwarePromptHandler(
  baseHandler: IPromptHandler,
  contextManager: IContextManager
): ContextAwarePromptHandler {
  return new ContextAwarePromptHandler(baseHandler, contextManager);
}
