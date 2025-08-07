/**
 * Prompt App Orchestrator
 *
 * Implements the same IAgent interface as QiCodeAgent but with simplified 2-category parsing:
 * - Commands (start with /) → route to command handler
 * - Prompts (everything else) → route to prompt handler
 * 
 * No classifier, no workflow - just command vs prompt routing.
 */

import type { IContextManager } from '@qi/agent/context';
import { createContextAwarePromptHandler } from '@qi/agent/context/utils/ContextAwarePrompting';
import type { IPromptHandler, PromptOptions } from '@qi/agent/prompt';
import type { IStateManager } from '@qi/agent/state';
import type { ICommandHandler, CommandRequest } from '@qi/agent/command';
import type {
  AgentConfig,
  AgentRequest,
  AgentResponse,
  AgentStatus,
  AgentStreamChunk,
  IAgent,
} from '@qi/agent/abstractions';

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
      content: trimmed.slice(1) // Remove the leading `/`
    };
  }
  
  return {
    type: 'prompt',
    raw: input,
    content: trimmed
  };
}

/**
 * Prompt App Orchestrator - Same interface as QiCodeAgent but simplified routing
 */
export class PromptAppOrchestrator implements IAgent {
  private stateManager: IStateManager;
  private contextManager: IContextManager;
  private commandHandler?: ICommandHandler;
  private promptHandler?: IPromptHandler;
  private contextAwarePromptHandler?: any;

  // Session to context mapping for context continuation
  private sessionContextMap = new Map<string, string>();

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
    this.stateManager = stateManager;
    this.contextManager = contextManager;
    this.config = config;
    this.commandHandler = dependencies.commandHandler;
    this.promptHandler = dependencies.promptHandler;
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

    try {
      // Parse input: command vs prompt (2-category, no workflow)
      const parsed = parseInput(request.input);

      let response: AgentResponse;

      switch (parsed.type) {
        case 'command':
          response = await this.handleCommand(request, parsed.content);
          break;
        case 'prompt':
          response = await this.handlePrompt(request, parsed.content);
          break;
        default:
          throw new Error(`Unknown input type: ${parsed.type}`);
      }

      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      return {
        ...response,
        executionTime,
        metadata: new Map([
          ...Array.from(response.metadata.entries()),
          ['inputType', parsed.type],
          ['parser', '2-category'],
          ['orchestrator', 'PromptApp']
        ]),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      return {
        content: `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
        type: 'error',
        confidence: 0,
        executionTime,
        metadata: new Map([
          ['error', error instanceof Error ? error.message : String(error)],
          ['orchestrator', 'PromptApp']
        ]),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *processStream(request: AgentRequest): AsyncGenerator<AgentStreamChunk> {
    // Parse and yield classification
    const parsed = parseInput(request.input);
    
    yield {
      type: 'classification',
      content: `Parsed as ${parsed.type}`,
      isComplete: false,
      metadata: new Map([
        ['inputType', parsed.type],
        ['parser', '2-category']
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
    if (commandName === 'model' || commandName === 'm') {
      return await this.handleModelCommand(parts.slice(1));
    }
    
    if (commandName === 'status' || commandName === 's') {
      return await this.handleStatusCommand();
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

  private async handlePrompt(
    request: AgentRequest,
    promptContent: string
  ): Promise<AgentResponse> {
    if (!this.config.enablePrompts) {
      return this.createDisabledResponse('prompt', 'Prompt processing is disabled');
    }

    if (!this.promptHandler) {
      return this.createErrorResponse('prompt', 'Prompt handler not available');
    }

    try {
      // Extract prompt options from context if available
      const promptOptions = this.extractPromptOptions(request.context);

      let result: any;

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

  private createDisabledResponse(type: string, message: string): AgentResponse {
    return {
      content: message,
      type: type as any,
      confidence: 0,
      executionTime: 0,
      metadata: new Map([['status', 'disabled']]),
      success: false,
      error: message,
    };
  }

  private createErrorResponse(type: string, message: string): AgentResponse {
    return {
      content: `Error: ${message}`,
      type: type as any,
      confidence: 0,
      executionTime: 0,
      metadata: new Map([['status', 'error']]),
      success: false,
      error: message,
    };
  }

  private extractPromptOptions(context: any): PromptOptions {
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

  private async handleModelCommand(args: string[]): Promise<AgentResponse> {
    const currentModel = this.stateManager.getCurrentModel();
    const promptConfig = this.stateManager.getPromptConfig();
    
    if (args.length === 0) {
      // Show current model
      return {
        content: `Current model: ${currentModel || 'qwen3:8b'}\nProvider: ${promptConfig?.provider || 'ollama'}`,
        type: 'command',
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([
          ['commandName', 'model'],
          ['action', 'view'],
          ['currentModel', currentModel || 'qwen3:8b']
        ]),
        success: true,
      };
    }

    const newModel = args[0];
    const previousModel = currentModel;
    
    try {
      // Switch model using state manager
      this.stateManager.setCurrentModel(newModel);
      
      return {
        content: `✅ Switched to model: ${newModel}`,
        type: 'command',
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([
          ['commandName', 'model'],
          ['action', 'switch'],
          ['newModel', newModel],
          ['previousModel', previousModel || 'qwen3:8b']
        ]),
        success: true,
      };
    } catch (error) {
      return {
        content: `❌ Failed to switch model: ${error instanceof Error ? error.message : String(error)}`,
        type: 'command',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([
          ['commandName', 'model'],
          ['action', 'switch'],
          ['error', error instanceof Error ? error.message : String(error)]
        ]),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleStatusCommand(): Promise<AgentResponse> {
    const orchestratorStatus = this.getStatus();
    const currentModel = this.stateManager.getCurrentModel();
    const promptConfig = this.stateManager.getPromptConfig();
    const currentMode = this.stateManager.getCurrentMode();
    
    let statusContent = '📊 PromptApp Status:\n';
    statusContent += `   Initialized: ${orchestratorStatus.isInitialized}\n`;
    statusContent += `   Domain: ${orchestratorStatus.domain}\n`;
    statusContent += `   Mode: ${currentMode}\n`;
    statusContent += `   Uptime: ${Math.floor(orchestratorStatus.uptime / 1000)}s\n`;
    statusContent += `   Requests Processed: ${orchestratorStatus.requestsProcessed}\n`;
    statusContent += `   Average Response Time: ${Math.floor(orchestratorStatus.averageResponseTime)}ms\n`;
    
    if (orchestratorStatus.lastActivity) {
      statusContent += `   Last Activity: ${orchestratorStatus.lastActivity.toLocaleTimeString()}\n`;
    }
    
    statusContent += '\n🔧 Configuration:\n';
    statusContent += `   Current Model: ${currentModel || 'qwen3:8b'}\n`;
    statusContent += `   Provider: ${promptConfig?.provider || 'ollama'}\n`;
    statusContent += `   Temperature: ${promptConfig?.temperature || 0.1}\n`;
    statusContent += `   Context Aware: ${this.contextAwarePromptHandler ? 'enabled' : 'disabled'}\n`;
    statusContent += `   Active Sessions: ${this.sessionContextMap.size}`;
    
    return {
      content: statusContent,
      type: 'command',
      confidence: 1.0,
      executionTime: 0,
      metadata: new Map([
        ['commandName', 'status'],
        ['uptime', orchestratorStatus.uptime.toString()],
        ['requestsProcessed', orchestratorStatus.requestsProcessed.toString()],
        ['currentModel', currentModel || 'qwen3:8b']
      ]),
      success: true,
    };
  }
}