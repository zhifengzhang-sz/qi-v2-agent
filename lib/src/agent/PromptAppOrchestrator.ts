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
import { create, type ErrorCategory, type QiError } from '@qi/base';
import { createDebugLogger } from '../utils/DebugLogger.js';
import type { QiAsyncMessageQueue } from '../messaging/impl/QiAsyncMessageQueue.js';
import type { QiMessage } from '../messaging/types/MessageTypes.js';
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
 * Agent error factory using QiCore patterns
 */
const createAgentError = (
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

  // Session to context mapping for context continuation
  private sessionContextMap = new Map<string, string>();

  // Cancellation support
  private abortController?: AbortController;
  private isProcessing = false;

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

  async process(request: AgentRequest): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('PromptApp not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    this.requestCount++;
    this.lastActivity = new Date();
    this.isProcessing = true;

    // Create new abort controller for this request
    this.abortController = new AbortController();

    try {
      // v-0.6.1: Pure processing - classify input explicitly
      const parsed = parseInput(request.input);

      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        throw new Error('Request was cancelled');
      }

      // v-0.6.1: Pure processing only

      let response: AgentResponse;

      switch (parsed.type) {
        case 'command':
          response = await this.handleCommand(request, parsed.content);
          break;
        case 'workflow':
          this.debug.warn(`Input "${parsed.content}" classified as workflow - this should not happen for simple prompts!`);
          response = await this.handleWorkflow(request, parsed.content);
          break;
        case 'prompt':
          this.debug.log(`✅ Input "${parsed.content}" correctly classified as prompt`);
          response = await this.handlePrompt(request, parsed.content);
          break;
        default:
          throw new Error(`Unknown input type: ${parsed.type}`);
      }

      // Check for cancellation after processing
      if (this.abortController?.signal.aborted) {
        throw new Error('Request was cancelled during processing');
      }

      // v-0.6.1: Pure processing

      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      const finalResponse = {
        ...response,
        executionTime,
        metadata: new Map([
          ...Array.from(response.metadata.entries()),
          ['inputType', parsed.type],
          ['parser', '2-category'],
          ['orchestrator', 'PromptApp'],
        ]),
      };

      // v-0.6.1: Pure processing - return response only

      return finalResponse;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      // Check if it was a cancellation
      const wasCancelled = error instanceof Error && error.message.includes('cancelled');

      // v-0.6.1: Pure processing - just return error response

      return {
        content: `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
        type: 'prompt' as const,
        confidence: 0,
        executionTime,
        metadata: new Map([
          ['error', error instanceof Error ? error.message : String(error)],
          ['cancelled', wasCancelled.toString()],
          ['orchestrator', 'PromptApp'],
        ]),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.isProcessing = false;
      this.abortController = undefined;
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
        this.debug.log(`🚀 About to call LLM with contextAwarePromptHandler for: "${promptContent}"`);
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

  // ===========================================
  // v-0.6.1: Removed CLI Event Handlers - Communication through message queue only
  // ===========================================

  /**
   * Handle model change requests from CLI (DEPRECATED in v-0.6.1)
   * @deprecated Use message queue communication instead
   */
  private async handleModelChangeRequest(event: ModelChangeEvent): Promise<void> {
    const { modelName } = event;
    const currentModel = this.stateManager.getCurrentModel();

    try {
      // Validate model is available
      const availableModels = this.stateManager.getAvailablePromptModels();
      if (availableModels.length > 0 && !availableModels.includes(modelName)) {
        // v-0.6.1: No emit - deprecated method
        console.warn(
          `Model '${modelName}' not available. Available: ${availableModels.join(', ')}`
        );
        return;
      }

      // Update model via StateManager
      this.stateManager.updatePromptModel(modelName);

      // v-0.6.1: Enqueue model changed message instead of emit (deprecated)
      // This method is deprecated - model changes should be handled through message queue
    } catch (error) {
      // v-0.6.1: No emit - deprecated method
      console.warn('Model change failed:', error);
    }
  }

  /**
   * Handle mode change requests from CLI (DEPRECATED in v-0.6.1)
   * @deprecated Use message queue communication instead
   */
  private async handleModeChangeRequest(event: ModeChangeEvent): Promise<void> {
    const { mode } = event;
    // v-0.6.1: This method is deprecated - mode changes should be handled through message queue
    console.log(`Mode change request: ${mode} (deprecated)`);
  }

  /**
   * Handle prompt requests from CLI
   */
  private async handlePromptRequest(event: PromptEvent): Promise<void> {
    const { prompt, context } = event;

    try {
      // Create traditional AgentRequest and process it
      const agentRequest: AgentRequest = {
        input: prompt,
        context: {
          sessionId: context?.sessionId || 'cli-session',
          timestamp: new Date(),
          source: 'cli',
        },
      };

      // Process through traditional flow (will emit progress, complete events)
      await this.process(agentRequest);
    } catch (error) {
      // v-0.6.1: No emit - deprecated method
      console.error('Prompt processing failed:', error);
    }
  }

  /**
   * Handle status requests from CLI (DEPRECATED in v-0.6.1)
   * @deprecated Use message queue communication instead
   */
  private async handleStatusRequest(_event: StatusEvent): Promise<void> {
    // v-0.6.1: This method is deprecated - status should be handled through message queue
    console.log('Status request (deprecated)');
  }

  /**
   * Handle cancel requests from CLI
   */
  private async handleCancelRequest(_event: CancelEvent): Promise<void> {
    this.cancel();
  }

  // ===========================================
  // Workflow Processing Methods (Race Condition Fix)
  // ===========================================

  /**
   * Detect if input contains patterns that require workflow processing
   * Currently detects file reference patterns (@file.ext or @path/to/file)
   */
  private detectWorkflowPattern(input: string): boolean {
    return input.includes('@') && (input.includes('.') || input.includes('/'));
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
