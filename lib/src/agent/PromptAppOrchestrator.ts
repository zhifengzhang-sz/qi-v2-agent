/**
 * Prompt App Orchestrator - v-0.6.1 Message-Driven Architecture
 *
 * Implements the same IAgent interface as QiCodeAgent but with simplified 2-category parsing:
 * - Commands (start with /) → route to command handler
 * - Prompts (everything else) → route to prompt handler
 *
 * v-0.6.1 changes:
 * - Removed EventEmitter dependency
 * - Integrated QiAsyncMessageQueue for message coordination
 * - All emit() calls replaced with message enqueuing
 * - Maintains responsive UI through message flow
 */

import type { CommandRequest, ICommandHandler } from '@qi/agent/command';
import type { IContextManager } from '@qi/agent/context';
import {
  type ContextAwarePromptHandler,
  createContextAwarePromptHandler,
} from '@qi/agent/context/utils/ContextAwarePrompting';
import type { IPromptHandler, PromptOptions, PromptResponse } from '@qi/agent/prompt';
import type { IStateManager } from '@qi/agent/state';
import {
  create,
  type ErrorCategory,
  failure,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type { QiAsyncMessageQueue } from '../messaging/impl/QiAsyncMessageQueue.js';
import type { QiMessage } from '../messaging/types/MessageTypes.js';
import { createDebugLogger } from '../utils/DebugLogger.js';
import { createQiLogger } from '../utils/QiCoreLogger.js';
import type {
  IWorkflowHandler,
  WorkflowOptions,
} from '../workflows/interfaces/IWorkflowHandler.js';
import type {
  AgentConfig,
  AgentContext,
  AgentRequest,
  AgentResponse,
  AgentStatus,
  AgentStreamChunk,
  IAgent,
} from './abstractions/index.js';

// Event types for CLI interactions
interface ModelChangeEvent {
  modelName: string;
}

interface ModeChangeEvent {
  mode: string;
}

interface PromptEvent {
  prompt: string;
  context?: AgentContext;
}

interface StatusEvent {
  // Status requests don't need specific data
  [key: string]: unknown;
}

interface CancelEvent {
  // Cancel requests don't need specific data
  [key: string]: unknown;
}

// Event types will be provided by the app layer when instantiating
// This follows the generic framework pattern where app provides the content types

/**
 * Event types emitted by PromptAppOrchestrator for responsive UI
 */
export interface AgentEvents {
  progress: { phase: string; progress: number; details?: string };
  message: { content: string; type: 'status' | 'streaming' | 'complete' | 'error' };
  stateChange: { state: AgentStatus };
  error: { error: QiError; context?: string };
  complete: { result: AgentResponse };
  cancelled: { reason: string };
}

/**
 * PromptAppOrchestrator error factory using QiCore patterns
 */
const createPromptAppError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Record<string, unknown> = {}
): QiError => create(code, message, category, context);

/**
 * Simple Input Parser for PromptApp
 * Routes input based on simple rule:
 * - Starts with `/` → Command
 * - Anything else → Prompt
 */
export type InputType = 'command' | 'workflow' | 'prompt';

export interface ParsedInput {
  type: InputType;
  raw: string;
  content: string; // Input without the leading `/` for commands
}

/**
 * Parse input to determine if it's a command or prompt
 */
export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();

  // Highest precedence: explicit slash commands
  if (trimmed.startsWith('/')) {
    return {
      type: 'command',
      raw: input,
      content: trimmed.slice(1),
    };
  }

  // Next: workflow patterns (e.g., file references like @path/file.ext)
  if (trimmed.includes('@') && (trimmed.includes('.') || trimmed.includes('/'))) {
    return {
      type: 'workflow',
      raw: input,
      content: trimmed,
    };
  }

  // Default: free-form prompt
  return {
    type: 'prompt',
    raw: input,
    content: trimmed,
  };
}

/**
 * Prompt App Orchestrator - v-0.6.1 Pure Message-driven routing
 * No EventEmitter - pure processing with message queue coordination
 */
export class PromptAppOrchestrator implements IAgent {
  private stateManager: IStateManager;
  private contextManager: IContextManager;
  private commandHandler?: ICommandHandler;
  private promptHandler?: IPromptHandler;
  private contextAwarePromptHandler?: ContextAwarePromptHandler;
  private workflowHandler?: IWorkflowHandler;
  private messageQueue?: QiAsyncMessageQueue<QiMessage>; // v-0.6.1: Message coordination
  private debug = createDebugLogger('PromptAppOrchestrator');
  private logger: any; // QiCore logger instance

  // Session to context mapping for context continuation
  private sessionContextMap = new Map<string, string>();

  // Cancellation support
  private abortController?: AbortController;
  private isProcessing = false;

  // QiCore error factory method
  private createQiError(
    code: string,
    message: string,
    category: ErrorCategory,
    context: Record<string, unknown> = {}
  ): QiError {
    return create(code, message, category, context);
  }

  private config: AgentConfig;
  private isInitialized = false;
  private startTime?: Date;
  private requestCount = 0;
  private totalResponseTime = 0;
  private lastActivity?: Date;

  constructor(
    stateManager: IStateManager,
    contextManager: IContextManager,
    config: AgentConfig,
    dependencies: {
      commandHandler?: ICommandHandler;
      promptHandler?: IPromptHandler;
      workflowHandler?: IWorkflowHandler;
      messageQueue?: QiAsyncMessageQueue<QiMessage>; // v-0.6.1: Add message queue
    } = {}
  ) {
    this.stateManager = stateManager;
    this.contextManager = contextManager;
    this.config = config;
    this.commandHandler = dependencies.commandHandler;
    this.promptHandler = dependencies.promptHandler;
    this.workflowHandler = dependencies.workflowHandler;
    this.messageQueue = dependencies.messageQueue; // v-0.6.1: Store message queue

    // Initialize QiCore logger
    this.logger = createQiLogger({
      level: 'info',
      name: 'PromptAppOrchestrator',
      pretty: true,
    });

    // v-0.6.1: Remove CLI event handlers - communication through message queue only
  }

  /**
   * Set message queue for v-0.6.1 communication
   */
  setMessageQueue(messageQueue: QiAsyncMessageQueue<QiMessage>): void {
    this.messageQueue = messageQueue;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.startTime = new Date();

    // Initialize context manager
    await this.contextManager.initialize();

    // Initialize context-aware prompt handler if prompt handler is available
    if (this.promptHandler) {
      this.contextAwarePromptHandler = createContextAwarePromptHandler(
        this.promptHandler,
        this.contextManager
      );
    }

    this.isInitialized = true;
  }

  /**
   * Public interface - maintains backward compatibility
   */
  async process(request: AgentRequest): Promise<AgentResponse> {
    const result = await this.processInternal(request);
    return this.transformToPublicAPI(result);
  }

  /**
   * Internal QiCore implementation with functional composition
   */
  private async processInternal(request: AgentRequest): Promise<Result<AgentResponse, QiError>> {
    const startTime = Date.now();
    this.requestCount++;
    this.lastActivity = new Date();
    this.isProcessing = true;

    // Create new abort controller for this request
    this.abortController = new AbortController();

    return fromAsyncTryCatch(
      async () => {
        // Validation chain using QiCore functional composition
        const validatedRequest = await this.validateRequest(request);

        return match(
          async (req: AgentRequest) => {
            const parsedInput = this.parseInput(req);

            return match(
              async (parsed: ParsedInput) => {
                // Check cancellation using QiCore patterns
                const cancellationCheck = this.checkCancellation();

                return match(
                  async () => {
                    // Route to appropriate handler using functional composition
                    const handlerResult = await this.routeToHandler(request, parsed);

                    return match(
                      async (response: AgentResponse) => {
                        // Final cancellation check and response enrichment
                        const finalCancellationCheck = this.checkCancellation();

                        return match(
                          () => {
                            const enriched = this.enrichResponse(response, startTime, parsed.type);
                            return match(
                              (finalResponse: AgentResponse) => finalResponse,
                              (error: QiError) => {
                                // Allow error to propagate to fromAsyncTryCatch wrapper
                                throw error;
                              },
                              enriched
                            );
                          },
                          (error: QiError) => {
                            // Allow error to propagate to fromAsyncTryCatch wrapper
                            throw error;
                          },
                          finalCancellationCheck
                        );
                      },
                      (error: QiError) => {
                        // Allow error to propagate to fromAsyncTryCatch wrapper
                        throw error;
                      },
                      handlerResult
                    );
                  },
                  (error: QiError) => {
                    // Allow error to propagate to fromAsyncTryCatch wrapper
                    throw error;
                  },
                  cancellationCheck
                );
              },
              (error: QiError) => {
                // Allow error to propagate to fromAsyncTryCatch wrapper
                throw error;
              },
              parsedInput
            );
          },
          (error: QiError) => {
            // Allow error to propagate to fromAsyncTryCatch wrapper
            throw error;
          },
          validatedRequest
        );
      },
      (error: unknown) => {
        // Robust error message extraction to handle test serialization issues
        let errorMessage: string;
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String((error as any).message);
        } else {
          errorMessage = String(error);
        }

        // Additional safety check to prevent "[object Object]" issues
        if (errorMessage === '[object Object]') {
          if (error instanceof Error) {
            errorMessage = error.toString();
          } else {
            errorMessage = 'Unknown error occurred';
          }
        }

        // Transform traditional errors to QiError with proper categorization
        if (errorMessage.includes('cancelled')) {
          return createPromptAppError(
            'REQUEST_CANCELLED',
            'Request was cancelled by user or timeout',
            'BUSINESS',
            { requestId: request.context?.sessionId, startTime }
          );
        }
        if (errorMessage.includes('not initialized')) {
          return createPromptAppError(
            'INITIALIZATION_ERROR',
            'PromptApp not initialized. Call initialize() first.',
            'CONFIGURATION',
            { requestId: request.context?.sessionId }
          );
        }
        return createPromptAppError(
          'PROCESSING_ERROR',
          `Processing failed: ${errorMessage}`,
          'SYSTEM',
          { requestId: request.context?.sessionId, originalError: errorMessage, startTime }
        );
      }
    ).finally(() => {
      this.isProcessing = false;
      this.abortController = undefined;
    });
  }

  /**
   * Transform QiCore Result<T> to public API response
   */
  private transformToPublicAPI(result: Result<AgentResponse, QiError>): AgentResponse {
    return match(
      (response: AgentResponse) => response,
      (error: QiError) => {
        const executionTime = Date.now() - ((error.context?.startTime as number) || Date.now());
        this.totalResponseTime += executionTime;

        // Check if it was a cancellation for metadata
        const wasCancelled = error.code === 'REQUEST_CANCELLED';

        // Transform QiError to AgentResponse for backward compatibility
        // Handle special cases for test expectations
        let errorMessage = error.message;

        // For cancellation errors, use 'cancelled' as expected by tests
        if (wasCancelled) {
          errorMessage = 'cancelled';
        }

        return {
          content: `Processing failed: ${error.message}`,
          type: 'prompt' as const,
          confidence: 0,
          executionTime,
          metadata: new Map([
            ['error', error.message],
            ['errorCode', error.code],
            ['errorCategory', error.category],
            ['cancelled', wasCancelled.toString()],
            ['orchestrator', 'PromptApp'],
          ]),
          success: false,
          error: errorMessage,
        };
      },
      result
    );
  }

  /**
   * QiCore helper methods for functional composition
   */

  private async validateRequest(request: AgentRequest): Promise<Result<AgentRequest, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        if (!this.isInitialized) {
          throw new Error('PromptApp not initialized. Call initialize() first.');
        }
        if (!request || !request.input) {
          throw new Error('Invalid request: missing input');
        }
        return request;
      },
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createPromptAppError('REQUEST_VALIDATION_ERROR', errorMessage, 'VALIDATION', {
          requestInput: request?.input,
        });
      }
    );
  }

  private parseInput(request: AgentRequest): Result<ParsedInput, QiError> {
    try {
      const parsed = parseInput(request.input);
      return success(parsed);
    } catch (error) {
      return failure(
        createPromptAppError(
          'INPUT_PARSING_ERROR',
          `Failed to parse input: ${error instanceof Error ? error.message : String(error)}`,
          'VALIDATION',
          { input: request.input }
        )
      );
    }
  }

  private checkCancellation(): Result<void, QiError> {
    if (this.abortController?.signal.aborted) {
      return failure(
        createPromptAppError('REQUEST_CANCELLED', 'Request was cancelled', 'BUSINESS', {
          aborted: true,
        })
      );
    }
    return success(undefined);
  }

  private async routeToHandler(
    request: AgentRequest,
    parsed: ParsedInput
  ): Promise<Result<AgentResponse, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        let response: AgentResponse;

        switch (parsed.type) {
          case 'command':
            response = await this.handleCommand(request, parsed.content);
            break;
          case 'workflow':
            this.debug.warn(
              `Input "${parsed.content}" classified as workflow - this should not happen for simple prompts!`
            );
            response = await this.handleWorkflow(request, parsed.content);
            break;
          case 'prompt':
            this.debug.log(`✅ Input "${parsed.content}" correctly classified as prompt`);
            response = await this.handlePrompt(request, parsed.content);
            break;
          default:
            throw new Error(`Unknown input type: ${parsed.type}`);
        }

        return response;
      },
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createPromptAppError(
          'HANDLER_EXECUTION_ERROR',
          `Handler execution failed: ${errorMessage}`,
          'SYSTEM',
          { inputType: parsed.type, content: parsed.content, originalError: errorMessage }
        );
      }
    );
  }

  private enrichResponse(
    response: AgentResponse,
    startTime: number,
    inputType: InputType
  ): Result<AgentResponse, QiError> {
    try {
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      const finalResponse = {
        ...response,
        executionTime,
        metadata: new Map([
          ...Array.from(response.metadata.entries()),
          ['inputType', inputType],
          ['parser', '2-category'],
          ['orchestrator', 'PromptApp'],
        ]),
      };

      return success(finalResponse);
    } catch (error) {
      return failure(
        createPromptAppError(
          'RESPONSE_ENRICHMENT_ERROR',
          `Failed to enrich response: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { startTime, inputType, originalError: error }
        )
      );
    }
  }

  /**
   * Cancel the current request if one is in progress
   */
  cancel(): void {
    if (this.isProcessing && this.abortController) {
      this.abortController.abort();
      // v-0.6.1: Pure processing - no message creation
    }
  }

  /**
   * Check if a request is currently being processed
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  async *stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk> {
    // Parse and yield classification
    const parsed = parseInput(request.input);

    yield {
      type: 'classification',
      content: `Parsed as ${parsed.type}`,
      isComplete: false,
      metadata: new Map([
        ['inputType', parsed.type],
        ['parser', '2-category'],
      ]),
    };

    // Processing phase
    yield {
      type: 'processing',
      content: `Processing ${parsed.type}...`,
      isComplete: false,
    };

    try {
      // Route and execute
      const response = await this.process(request);

      yield {
        type: 'result',
        content: response.content,
        isComplete: true,
        metadata: response.metadata,
      };
    } catch (error) {
      yield {
        type: 'error',
        content: `Stream processing failed: ${error instanceof Error ? error.message : String(error)}`,
        isComplete: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getStatus(): AgentStatus {
    return {
      isInitialized: this.isInitialized,
      domain: this.config.domain,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      requestsProcessed: this.requestCount,
      averageResponseTime: this.requestCount > 0 ? this.totalResponseTime / this.requestCount : 0,
      lastActivity: this.lastActivity,
    };
  }

  async shutdown(): Promise<void> {
    // Shutdown context manager
    await this.contextManager.shutdown();

    // Clear session context mapping
    this.sessionContextMap.clear();

    this.isInitialized = false;
  }

  // Private routing methods

  private async handleCommand(
    request: AgentRequest,
    commandContent: string
  ): Promise<AgentResponse> {
    if (!this.config.enableCommands) {
      return this.createDisabledResponse('command', 'Command processing is disabled');
    }

    if (!this.commandHandler) {
      return this.createErrorResponse('command', 'Command handler not available');
    }

    // Parse command name and parameters
    const parts = commandContent.trim().split(/\s+/);
    const commandName = parts[0];
    const parameters = new Map<string, unknown>();

    // Simple parameter parsing (can be enhanced later)
    for (let i = 1; i < parts.length; i++) {
      parameters.set(`arg${i}`, parts[i]);
    }

    // Handle PromptApp-specific commands first
    if (commandName === 'status' || commandName === 's') {
      return await this.handleStatusCommand();
    }

    if (commandName === 'maxTokens' || commandName === 'maxtokens' || commandName === 'tokens') {
      return await this.handleMaxTokensCommand(parts.slice(1));
    }

    // Fall back to standard command handler for basic CLI commands
    const commandRequest: CommandRequest = {
      commandName,
      parameters,
      rawInput: request.input,
      context: request.context.environmentContext,
    };

    const result = await this.commandHandler.executeCommand(commandRequest);

    return {
      content: result.content,
      type: 'command',
      confidence: 1.0, // Commands are deterministic
      executionTime: 0, // Will be set by main process method
      metadata: new Map([
        ...Array.from(result.metadata.entries()),
        ['commandName', result.commandName],
        ['commandStatus', result.status],
      ]),
      success: result.success,
      error: result.error,
    };
  }

  private async handleWorkflow(request: AgentRequest, content: string): Promise<AgentResponse> {
    this.debug.warn(`handleWorkflow called with: "${content}" - WHY IS THIS A WORKFLOW?`);

    if (!this.workflowHandler) {
      return this.createDisabledResponse('workflow', 'Workflow processing is disabled');
    }

    // Execute the workflow first; if it yields enhanced content, treat that as a prompt
    const wf = await this.processWorkflow(content);
    if (!wf.success) {
      return this.createErrorResponse('workflow', wf.error);
    }

    const enhanced = wf.data.output ?? content;

    // Check if this was a passthrough (no actual workflow processing)
    if (wf.data.output === content || (wf.data as any).metadata?.passthrough) {
      // This was passthrough - route directly to prompt handler without re-classification
      return this.handlePrompt(request, enhanced);
    }

    // Route to prompt handler with the enhanced content, preserving context
    return this.handlePrompt(request, enhanced);
  }

  private async handlePrompt(request: AgentRequest, promptContent: string): Promise<AgentResponse> {
    this.debug.log(`🔍 handlePrompt called with: "${promptContent}"`);

    if (!this.config.enablePrompts) {
      return this.createDisabledResponse('prompt', 'Prompt processing is disabled');
    }

    if (!this.promptHandler) {
      return this.createErrorResponse('prompt', 'Prompt handler not available');
    }

    try {
      // Extract prompt options from context if available
      const promptOptions = this.extractPromptOptions(request.context);

      let result: PromptResponse;

      // Use context-aware prompting if available
      if (this.contextAwarePromptHandler) {
        // Get or create conversation context for this session
        const sessionId = request.context.sessionId;
        let contextId = this.sessionContextMap.get(sessionId);

        if (!contextId) {
          // Create new conversation context for this session
          const newContext = this.contextManager.createConversationContext('main');
          contextId = newContext.id;
          this.sessionContextMap.set(sessionId, contextId);
        }

        // Verify context still exists (cleanup may have removed it)
        const existingContext = this.contextManager.getConversationContext(contextId);
        if (!existingContext) {
          // Context was cleaned up, create a new one
          const newContext = this.contextManager.createConversationContext('main');
          contextId = newContext.id;
          this.sessionContextMap.set(sessionId, contextId);
        }

        // Execute with context continuation
        this.debug.log(
          `🚀 About to call LLM with contextAwarePromptHandler for: "${promptContent}"`
        );
        const startTime = Date.now();
        result = await this.contextAwarePromptHandler.completeWithContext(
          promptContent,
          promptOptions,
          contextId,
          true // Include conversation history
        );
        const duration = Date.now() - startTime;
        this.debug.log(`⚡ LLM call completed in ${duration}ms`);
      } else {
        // Fallback to basic prompt processing
        this.debug.log(`🚀 About to call LLM with basic promptHandler for: "${promptContent}"`);
        const startTime = Date.now();
        result = await this.promptHandler.complete(promptContent, promptOptions);
        const duration = Date.now() - startTime;
        this.debug.log(`⚡ LLM call completed in ${duration}ms`);

        // Manually update state manager for fallback
        this.stateManager.addConversationEntry({
          type: 'user_input',
          content: promptContent,
          metadata: new Map([['inputType', 'prompt']]),
        });

        if (result.success) {
          this.stateManager.addConversationEntry({
            type: 'agent_response',
            content: result.data,
            metadata: new Map([['responseType', 'prompt']]),
          });
        }
      }

      if (result.success) {
        return {
          content: result.data,
          type: 'prompt',
          confidence: 0.95, // High confidence for successful prompts
          executionTime: 0, // Will be set by main process method
          metadata: new Map([
            ['promptOptions', JSON.stringify(promptOptions)],
            ['provider', promptOptions.provider || 'default'],
            ['contextAware', this.contextAwarePromptHandler ? 'true' : 'false'],
          ]),
          success: true,
        };
      } else {
        return this.createErrorResponse('prompt', result.error);
      }
    } catch (error) {
      return this.createErrorResponse(
        'prompt',
        `Prompt processing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Helper methods (same as QiCodeAgent)

  private createDisabledResponse(
    type: 'command' | 'prompt' | 'workflow',
    message: string
  ): AgentResponse {
    return {
      content: message,
      type: type,
      confidence: 0,
      executionTime: 0,
      metadata: new Map([['status', 'disabled']]),
      success: false,
      error: message,
    };
  }

  private createErrorResponse(
    type: 'command' | 'prompt' | 'workflow',
    message: string
  ): AgentResponse {
    return {
      content: `Error: ${message}`,
      type: type,
      confidence: 0,
      executionTime: 0,
      metadata: new Map([['status', 'error']]),
      success: false,
      error: message,
    };
  }

  private extractPromptOptions(_context: AgentContext): PromptOptions {
    // Extract prompt options from request context
    // This can be enhanced to support model selection, temperature, etc.
    const currentModel = this.stateManager.getCurrentModel();
    const promptConfig = this.stateManager.getPromptConfig();
    return {
      provider: promptConfig?.provider || 'ollama',
      model: currentModel || 'qwen3:8b',
      temperature: promptConfig?.temperature || 0.1,
      maxTokens: promptConfig?.maxTokens || 1000,
    };
  }

  private async handleStatusCommand(): Promise<AgentResponse> {
    const promptConfig = this.stateManager.getPromptConfig();
    const currentModel = promptConfig?.model || this.stateManager.getCurrentModel();
    const availableModels = this.stateManager.getAvailablePromptModels();

    let statusContent = '📊 Status:\n';
    statusContent += `Provider: ${promptConfig?.provider || 'ollama'}\n`;
    statusContent += `Model: ${currentModel || 'qwen3:0.6b'}\n`;
    statusContent += `Temperature: ${promptConfig?.temperature || 0.1}\n`;
    statusContent += `Max Tokens: ${promptConfig?.maxTokens || 1000}\n`;

    if (availableModels.length > 0) {
      statusContent += `\nAvailable Models: ${availableModels.join(', ')}`;
    }

    const orchestratorStatus = this.getStatus();
    statusContent += `\n\nSession: ${orchestratorStatus.requestsProcessed} requests processed`;
    if (orchestratorStatus.lastActivity) {
      const timeSince = Math.floor((Date.now() - orchestratorStatus.lastActivity.getTime()) / 1000);
      statusContent += `, last active ${timeSince}s ago`;
    }

    return {
      content: statusContent,
      type: 'command',
      confidence: 1.0,
      executionTime: 0,
      metadata: new Map([
        ['commandName', 'status'],
        ['provider', promptConfig?.provider || 'ollama'],
        ['currentModel', currentModel || 'qwen3:0.6b'],
      ]),
      success: true,
    };
  }

  private async handleMaxTokensCommand(args: string[]): Promise<AgentResponse> {
    const promptConfig = this.stateManager.getPromptConfig();
    const currentMaxTokens = promptConfig?.maxTokens || 1000;

    if (args.length === 0) {
      // Show current max tokens
      return {
        content: `Current max tokens: ${currentMaxTokens}\n\nUse '/tokens <number>' to change (1-32768)`,
        type: 'command',
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([
          ['commandName', 'maxTokens'],
          ['action', 'view'],
          ['currentMaxTokens', currentMaxTokens.toString()],
        ]),
        success: true,
      };
    }

    const newMaxTokens = parseInt(args[0], 10);

    if (Number.isNaN(newMaxTokens)) {
      return {
        content: `❌ Invalid number: ${args[0]}\nUse a number between 1 and 32768`,
        type: 'command',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([
          ['commandName', 'maxTokens'],
          ['action', 'set'],
          ['error', 'invalid_number'],
        ]),
        success: false,
        error: 'Invalid number',
      };
    }

    try {
      this.stateManager.updatePromptMaxTokens(newMaxTokens);

      return {
        content: `✅ Max tokens updated: ${newMaxTokens} (was ${currentMaxTokens})`,
        type: 'command',
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([
          ['commandName', 'maxTokens'],
          ['action', 'set'],
          ['newMaxTokens', newMaxTokens.toString()],
          ['previousMaxTokens', currentMaxTokens.toString()],
        ]),
        success: true,
      };
    } catch (error) {
      return {
        content: `❌ Failed to update max tokens: ${error instanceof Error ? error.message : String(error)}`,
        type: 'command',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([
          ['commandName', 'maxTokens'],
          ['action', 'set'],
          ['error', error instanceof Error ? error.message : String(error)],
        ]),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Process workflow synchronously and return enhanced content
   * This replaces the async event-based workflow processing to fix race conditions
   */
  private async processWorkflow(
    input: string
  ): Promise<
    | { success: true; data: { output: string; filesReferenced?: readonly string[] } }
    | { success: false; error: string }
  > {
    if (!this.workflowHandler) {
      return { success: false, error: 'Workflow handler not available' };
    }

    try {
      // Check for cancellation before starting workflow
      if (this.abortController?.signal.aborted) {
        throw new Error('Request was cancelled');
      }

      // Execute workflow with current session context (let handler determine type)
      const workflowOptions: WorkflowOptions = {
        // Don't force a specific type - let the handler detect the correct workflow
        context: { sessionId: 'main' }, // Use main session or get from context
        timeout: 10000, // 10 second timeout
      };

      const result = await this.workflowHandler.executeWorkflow(input, workflowOptions);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}
