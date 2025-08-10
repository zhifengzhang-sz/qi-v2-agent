/**
 * Prompt App Orchestrator
 *
 * Implements the same IAgent interface as QiCodeAgent but with simplified 2-category parsing:
 * - Commands (start with /) → route to command handler
 * - Prompts (everything else) → route to prompt handler
 *
 * No classifier, no workflow - just command vs prompt routing.
 *
 * Now includes EventEmitter for responsive UI with progress tracking and cancellation.
 */

import { EventEmitter } from 'node:events';
import type { CommandRequest, ICommandHandler } from '@qi/agent/command';
import type { IContextManager } from '@qi/agent/context';
import {
  type ContextAwarePromptHandler,
  createContextAwarePromptHandler,
} from '@qi/agent/context/utils/ContextAwarePrompting';
import type { IPromptHandler, PromptOptions, PromptResponse } from '@qi/agent/prompt';
import type { IStateManager } from '@qi/agent/state';
import { create, type ErrorCategory, type QiError } from '@qi/base';
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
export type InputType = 'command' | 'prompt';

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

  if (trimmed.startsWith('/')) {
    return {
      type: 'command',
      raw: input,
      content: trimmed.slice(1), // Remove the leading `/`
    };
  }

  return {
    type: 'prompt',
    raw: input,
    content: trimmed,
  };
}

/**
 * Prompt App Orchestrator - Same interface as QiCodeAgent but simplified routing
 * Now extends EventEmitter for responsive UI
 */
export class PromptAppOrchestrator extends EventEmitter implements IAgent {
  private stateManager: IStateManager;
  private contextManager: IContextManager;
  private commandHandler?: ICommandHandler;
  private promptHandler?: IPromptHandler;
  private contextAwarePromptHandler?: ContextAwarePromptHandler;

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
    } = {}
  ) {
    super(); // Initialize EventEmitter
    this.stateManager = stateManager;
    this.contextManager = contextManager;
    this.config = config;
    this.commandHandler = dependencies.commandHandler;
    this.promptHandler = dependencies.promptHandler;

    // Set up CLI event handlers
    this.setupCLIEventHandlers();
  }

  /**
   * Set up handlers for CLI events (app-specific event-driven communication)
   */
  private setupCLIEventHandlers(): void {
    // Handle model change requests from CLI
    this.on('modelChangeRequested', this.handleModelChangeRequest.bind(this));

    // Handle mode change requests from CLI
    this.on('modeChangeRequested', this.handleModeChangeRequest.bind(this));

    // Handle prompt requests from CLI
    this.on('promptRequested', this.handlePromptRequest.bind(this));

    // Handle status requests from CLI
    this.on('statusRequested', this.handleStatusRequest.bind(this));

    // Handle cancel requests from CLI
    this.on('cancelRequested', this.handleCancelRequest.bind(this));
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
      // Emit start event
      this.emit('progress', { phase: 'parsing', progress: 0.1, details: 'Analyzing input...' });
      this.emit('message', { content: 'Processing request...', type: 'status' });

      // Emit processInput event for toolbox workflow processing
      this.emit('processInput', request.input);

      // Parse input: command vs prompt (2-category, no workflow)
      const parsed = parseInput(request.input);

      // Check for cancellation
      if (this.abortController?.signal.aborted) {
        throw new Error('Request was cancelled');
      }

      this.emit('progress', {
        phase: 'routing',
        progress: 0.2,
        details: `Routing to ${parsed.type} handler...`,
      });

      let response: AgentResponse;

      switch (parsed.type) {
        case 'command':
          this.emit('progress', {
            phase: 'command_processing',
            progress: 0.3,
            details: 'Executing command...',
          });
          response = await this.handleCommand(request, parsed.content);
          break;
        case 'prompt':
          this.emit('progress', {
            phase: 'llm_processing',
            progress: 0.3,
            details: 'Sending to LLM...',
          });
          response = await this.handlePrompt(request, parsed.content);
          break;
        default:
          throw new Error(`Unknown input type: ${parsed.type}`);
      }

      // Check for cancellation after processing
      if (this.abortController?.signal.aborted) {
        throw new Error('Request was cancelled during processing');
      }

      this.emit('progress', {
        phase: 'completing',
        progress: 0.9,
        details: 'Finalizing response...',
      });

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

      // Emit completion events
      this.emit('complete', { result: finalResponse });

      return finalResponse;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      // Check if it was a cancellation
      const wasCancelled = error instanceof Error && error.message.includes('cancelled');

      if (wasCancelled) {
        this.emit('cancelled', { reason: 'user_requested' });
        this.emit('message', { content: 'Request was cancelled', type: 'error' });
      } else {
        // Emit error events
        const qiError =
          error instanceof Error
            ? createAgentError('PROCESSING_FAILED', error.message, 'SYSTEM')
            : createAgentError('UNKNOWN_ERROR', String(error), 'SYSTEM');

        this.emit('error', { error: qiError, context: 'process' });
        this.emit('message', {
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          type: 'error',
        });
      }

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
      this.emit('cancelled', { reason: 'user_requested' });
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

  private async handlePrompt(request: AgentRequest, promptContent: string): Promise<AgentResponse> {
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
        result = await this.contextAwarePromptHandler.completeWithContext(
          promptContent,
          promptOptions,
          contextId,
          true // Include conversation history
        );
      } else {
        // Fallback to basic prompt processing
        result = await this.promptHandler.complete(promptContent, promptOptions);

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
  // CLI Event Handlers (Event-Driven Communication)
  // ===========================================

  /**
   * Handle model change requests from CLI
   */
  private async handleModelChangeRequest(event: ModelChangeEvent): Promise<void> {
    const { modelName } = event;
    const currentModel = this.stateManager.getCurrentModel();

    try {
      // Validate model is available
      const availableModels = this.stateManager.getAvailablePromptModels();
      if (availableModels.length > 0 && !availableModels.includes(modelName)) {
        this.emit('modelChanged', {
          type: 'modelChanged',
          oldModel: currentModel,
          newModel: modelName,
          success: false,
          error: `Model '${modelName}' not available. Available: ${availableModels.join(', ')}`,
          timestamp: new Date(),
        });
        return;
      }

      // Update model via StateManager
      this.stateManager.updatePromptModel(modelName);

      // Emit success event back to CLI
      this.emit('modelChanged', {
        type: 'modelChanged',
        oldModel: currentModel,
        newModel: modelName,
        success: true,
        timestamp: new Date(),
      });
    } catch (error) {
      this.emit('modelChanged', {
        type: 'modelChanged',
        oldModel: currentModel,
        newModel: modelName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle mode change requests from CLI
   * TODO: Implement proper CLI mode to App mode mapping
   * Reason: CLI modes (interactive/command/streaming) are UI behavior states,
   * while App modes (ready/planning/editing/executing/error) are workflow states.
   * Currently just acknowledging the request without proper state management.
   */
  private async handleModeChangeRequest(event: ModeChangeEvent): Promise<void> {
    const { mode } = event;
    // TODO: Implement proper mode handling logic
    // For now, just acknowledge the mode change request

    try {
      // TODO: Determine if CLI modes should map to App workflow modes
      // Current approach: acknowledge but don't change App mode

      // Emit success event back to CLI
      this.emit('modeChanged', {
        type: 'modeChanged',
        oldMode: mode, // TODO: Get actual previous CLI mode
        newMode: mode,
        success: true,
        timestamp: new Date(),
      });
    } catch (_error) {
      this.emit('modeChanged', {
        type: 'modeChanged',
        oldMode: mode,
        newMode: mode,
        success: false,
        timestamp: new Date(),
      });
    }
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
      this.emit('error', {
        type: 'error',
        error: {
          code: 'PROMPT_PROCESSING_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle status requests from CLI
   */
  private async handleStatusRequest(_event: StatusEvent): Promise<void> {
    try {
      const currentModel = this.stateManager.getCurrentModel();
      const currentMode = this.stateManager.getCurrentMode();
      const promptConfig = this.stateManager.getPromptConfig();
      const uptime = Math.floor(process.uptime());
      const _availableModels = this.stateManager.getAvailablePromptModels();

      this.emit('statusResponse', {
        type: 'statusResponse',
        status: {
          model: currentModel,
          mode: currentMode,
          uptime,
          provider: promptConfig?.provider || 'ollama',
          availableCommands: this.commandHandler?.getAvailableCommands().length || 0,
          memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      this.emit('error', {
        type: 'error',
        error: {
          code: 'STATUS_REQUEST_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date(),
      });
    }
  }

  /**
   * Handle cancel requests from CLI
   */
  private async handleCancelRequest(_event: CancelEvent): Promise<void> {
    this.cancel();
  }
}
