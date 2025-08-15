/**
 * Agent Module - QiCode Agent Implementation
 *
 * The main AI coding assistant agent that orchestrates all components.
 * Internal to agent module - other modules cannot access this directly.
 */

import { create, type ErrorCategory, type QiError } from '@qi/base';
import type { ClassificationResult, IClassifier } from '../../classifier/index.js';
import type { CommandRequest, ICommandHandler } from '../../command/index.js';
import type { IContextManager } from '../../context/index.js';
import { createContextAwarePromptHandler } from '../../context/utils/ContextAwarePrompting.js';
import type { IPromptHandler, PromptOptions } from '../../prompt/index.js';
import type { IStateManager } from '../../state/index.js';
import type { IWorkflowEngine, IWorkflowExtractor } from '../../workflow/index.js';
import type {
  AgentConfig,
  AgentContext,
  AgentRequest,
  AgentResponse,
  AgentStatus,
  AgentStreamChunk,
  IAgent,
} from '../abstractions/index.js';

/**
 * QiCode Agent error factory using QiCore patterns
 */
const _createQiCodeAgentError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Record<string, unknown> = {}
): QiError => create(code, message, category, context);

/**
 * QiCode Agent - Main orchestrator with StateManager integration
 */
export class QiCodeAgent implements IAgent {
  private stateManager: IStateManager;
  private contextManager: IContextManager;
  private classifier?: IClassifier;
  private commandHandler?: ICommandHandler;
  private promptHandler?: IPromptHandler;
  private contextAwarePromptHandler?: unknown; // Will be initialized in initialize()
  private workflowEngine?: IWorkflowEngine;
  private workflowExtractor?: IWorkflowExtractor;

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
      classifier?: IClassifier;
      commandHandler?: ICommandHandler;
      promptHandler?: IPromptHandler;
      workflowEngine?: IWorkflowEngine;
      workflowExtractor?: IWorkflowExtractor;
    } = {}
  ) {
    this.stateManager = stateManager;
    this.contextManager = contextManager;
    this.config = config;
    this.classifier = dependencies.classifier;
    this.commandHandler = dependencies.commandHandler;
    this.promptHandler = dependencies.promptHandler;
    this.workflowEngine = dependencies.workflowEngine;
    this.workflowExtractor = dependencies.workflowExtractor;
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

    // Initialize other components that need initialization
    // Each component handles its own initialization

    this.isInitialized = true;
  }

  async process(request: AgentRequest): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    this.requestCount++;
    this.lastActivity = new Date();

    try {
      // Step 1: Check for state management commands first
      if (this.isStateCommand(request.input)) {
        const response = await this.handleStateCommand(request.input);
        const executionTime = Date.now() - startTime;
        this.totalResponseTime += executionTime;
        return {
          ...response,
          executionTime,
        };
      }

      // Step 2: Classify input
      if (!this.classifier) {
        throw new Error('Classifier not available');
      }

      const classification = await this.classifier.classify(request.input);

      // Step 3: Route based on classification
      let response: AgentResponse;

      switch (classification.type) {
        case 'command':
          response = await this.handleCommand(request, classification);
          break;
        case 'prompt':
          response = await this.handlePrompt(request, classification);
          break;
        case 'workflow':
          response = await this.handleWorkflow(request, classification);
          break;
        default:
          throw new Error(`Unknown classification type: ${classification.type}`);
      }

      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      return {
        ...response,
        executionTime,
        metadata: new Map([
          ...Array.from(response.metadata.entries()),
          [
            'classification',
            JSON.stringify({
              type: classification.type,
              confidence: classification.confidence,
              method: classification.method,
            }),
          ],
          ['agentProcessingTime', executionTime.toString()],
        ]),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;

      return {
        content: `Agent processing failed: ${error instanceof Error ? error.message : String(error)}`,
        type: 'command' as const, // Default type for errors
        confidence: 0,
        executionTime,
        metadata: new Map([
          ['error', error instanceof Error ? error.message : String(error)],
          ['errorType', 'agent-processing-error'],
        ]),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk> {
    if (!this.isInitialized) {
      yield {
        type: 'error',
        content: 'Agent not initialized. Call initialize() first.',
        isComplete: true,
        metadata: new Map([
          ['errorCode', 'AGENT_NOT_INITIALIZED'],
          ['errorType', 'validation'],
        ]),
      };
      return;
    }

    try {
      // Classification phase
      yield {
        type: 'classification',
        content: 'Classifying input...',
        isComplete: false,
      };

      if (!this.classifier) {
        yield {
          type: 'error',
          content: 'Classifier not available',
          isComplete: true,
          metadata: new Map([
            ['errorCode', 'CLASSIFIER_NOT_AVAILABLE'],
            ['errorType', 'system'],
          ]),
        };
        return;
      }

      const classification = await this.classifier.classify(request.input);

      yield {
        type: 'classification',
        content: `Classified as: ${classification.type} (${(classification.confidence * 100).toFixed(1)}% confidence)`,
        isComplete: true,
        metadata: new Map([['classification', classification]]),
      };

      // Processing phase
      yield {
        type: 'processing',
        content: `Processing ${classification.type}...`,
        isComplete: false,
      };

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

    // Cleanup resources if needed
    this.isInitialized = false;
  }

  // Private routing methods

  private async handleCommand(
    request: AgentRequest,
    classification: ClassificationResult
  ): Promise<AgentResponse> {
    if (!this.config.enableCommands) {
      return this.createDisabledResponse('command', 'Command processing is disabled');
    }

    if (!this.commandHandler) {
      return this.createErrorResponse('command', 'Command handler not available');
    }

    const commandRequest: CommandRequest = {
      commandName: this.extractCommandName(request.input),
      parameters: this.extractCommandParameters(request.input),
      rawInput: request.input,
      context: request.context.environmentContext,
    };

    const result = await this.commandHandler.executeCommand(commandRequest);

    return {
      content: result.content,
      type: 'command',
      confidence: classification.confidence,
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
    classification: ClassificationResult
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

          // Map session to context for future requests
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
        result = await (this.contextAwarePromptHandler as any).completeWithContext(
          request.input,
          promptOptions,
          contextId,
          true // Include conversation history
        );
      } else {
        // Fallback to basic prompt processing
        result = await this.promptHandler.complete(request.input, promptOptions);

        // Manually update state manager for fallback
        this.stateManager.addConversationEntry({
          type: 'user_input',
          content: request.input,
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
          confidence: classification.confidence,
          executionTime: 0, // Will be set by main process method
          metadata: new Map([
            ['promptOptions', JSON.stringify(promptOptions)],
            ['provider', promptOptions.provider || 'default'],
            ['contextAware', this.contextAwarePromptHandler ? 'true' : 'false'],
          ]),
          success: true,
        };
      } else {
        // TypeScript knows result.success is false, so result.error exists
        return this.createErrorResponse(
          'prompt',
          (result as { success: false; error: string }).error
        );
      }
    } catch (error) {
      return this.createErrorResponse(
        'prompt',
        `Prompt processing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleWorkflow(
    request: AgentRequest,
    classification: ClassificationResult
  ): Promise<AgentResponse> {
    if (!this.config.enableWorkflows) {
      return this.createDisabledResponse('workflow', 'Workflow processing is disabled');
    }

    if (!this.workflowExtractor || !this.workflowEngine) {
      return this.createErrorResponse('workflow', 'Workflow components not available');
    }

    try {
      // 1. Create workflow execution context with proper isolation
      const workflowContext = await this.createWorkflowExecutionContext(request);

      // 2. Extract workflow specification using strategy selection
      const extractionResult = await this.workflowExtractor.extractWorkflow(
        request.input,
        { method: 'hybrid', promptProvider: undefined },
        workflowContext
      );

      if (!extractionResult.success || !extractionResult.workflowSpec) {
        return this.createErrorResponse(
          'workflow',
          `Workflow extraction failed: ${extractionResult.error || 'Unknown error'}`
        );
      }

      // 3. Execute workflow using LangGraph engine with streaming
      const executionConfig = {
        sessionId: request.context.sessionId,
        contextId: workflowContext.id,
        streamingEnabled: true,
        checkpointingEnabled: true,
        progressCallback: (nodeId: string, progress: any) => {
          // Handle real-time progress updates
          this.handleWorkflowProgress(nodeId, progress, workflowContext);
        },
      };

      const workflowResult = await this.workflowEngine.executeWorkflow(
        extractionResult.workflowSpec,
        executionConfig
      );

      // 4. Map execution results back to AgentResponse
      const agentResponse: AgentResponse = {
        content: this.formatWorkflowOutput(workflowResult, extractionResult),
        type: 'workflow',
        confidence: extractionResult.confidence,
        executionTime: workflowResult.performance.totalTime,
        metadata: new Map([
          ['workflowId', extractionResult.workflowSpec.id],
          ['strategy', extractionResult.workflowSpec.parameters.get('strategy') || 'unknown'],
          ['nodeCount', extractionResult.workflowSpec.nodes.length.toString()],
          ['executionPath', JSON.stringify(workflowResult.executionPath)],
          ['toolExecutionTime', workflowResult.performance.toolExecutionTime.toString()],
          ['reasoningTime', workflowResult.performance.reasoningTime.toString()],
          ['extractionMethod', extractionResult.extractionMethod],
          ['workflowContextId', workflowContext.id],
        ]),
        success: true,
      };

      // 5. Update conversation context with workflow results
      await this.updateConversationContextWithWorkflow(request, workflowResult, extractionResult);

      // 6. Clean up workflow execution context
      await this.cleanupWorkflowContext(workflowContext);

      return agentResponse;
    } catch (error) {
      // Comprehensive error handling and recovery strategy
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log error for debugging with structured context
      this.logWorkflowError(request, error, {
        classification: classification.type,
        confidence: classification.confidence,
        timestamp: new Date().toISOString(),
      });

      return this.createErrorResponse('workflow', `Workflow execution failed: ${errorMessage}`);
    }
  }

  // State Management Methods

  private isStateCommand(input: string): boolean {
    const trimmed = input.trim().toLowerCase();
    const stateCommands = ['/model', '/status', '/config', '/mode', '/session'];
    return stateCommands.some((cmd) => trimmed.startsWith(cmd));
  }

  private async handleStateCommand(input: string): Promise<AgentResponse> {
    const _trimmed = input.trim().toLowerCase();
    const parts = input.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
      if (command === '/model') {
        return this.handleModelCommand(args);
      } else if (command === '/status') {
        return this.handleStatusCommand();
      } else if (command === '/config') {
        return this.handleConfigCommand(args);
      } else if (command === '/mode') {
        return this.handleModeCommand(args);
      } else if (command === '/session') {
        return this.handleSessionCommand(args);
      } else {
        return {
          content: `Unknown state command: ${command}`,
          type: 'command',
          confidence: 0,
          executionTime: 0,
          metadata: new Map([['error', 'unknown-state-command']]),
          success: false,
          error: `Unknown state command: ${command}`,
        };
      }
    } catch (error) {
      return {
        content: `State command error: ${error instanceof Error ? error.message : String(error)}`,
        type: 'command',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([['error', 'state-command-error']]),
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private handleModelCommand(args: string[]): AgentResponse {
    if (args.length === 0) {
      // Show current model and available models
      const currentModel = this.stateManager.getCurrentModel();
      const currentModelInfo = this.stateManager.getModelInfo(currentModel);
      const availableModels = this.stateManager.getAvailableModels();

      let content = `📋 Current Model: ${currentModel}`;
      if (currentModelInfo) {
        content += ` (${currentModelInfo.name})`;
      }

      content += '\n\nAvailable Models:';
      for (const model of availableModels) {
        const status = model.available ? '✅' : '❌';
        content += `\n  ${status} ${model.id} - ${model.name}`;
        if (model.description) {
          content += ` - ${model.description}`;
        }
      }

      return {
        content,
        type: 'command',
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([
          ['currentModel', currentModel],
          ['availableModels', availableModels.length.toString()],
        ]),
        success: true,
      };
    } else {
      // Set model
      const modelId = args[0];
      try {
        this.stateManager.setCurrentModel(modelId);
        const modelInfo = this.stateManager.getModelInfo(modelId);
        const content = `✅ Model changed to: ${modelId}${modelInfo ? ` (${modelInfo.name})` : ''}`;

        return {
          content,
          type: 'command',
          confidence: 1.0,
          executionTime: 0,
          metadata: new Map([['newModel', modelId]]),
          success: true,
        };
      } catch (error) {
        return {
          content: `❌ Failed to change model: ${error instanceof Error ? error.message : String(error)}`,
          type: 'command',
          confidence: 0,
          executionTime: 0,
          metadata: new Map([['error', 'model-change-failed']]),
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  private handleStatusCommand(): AgentResponse {
    const state = this.stateManager.getState();
    const currentModelInfo = this.stateManager.getModelInfo(state.currentModel);

    let content = '📊 Agent Status:\n';
    content += `  Model: ${state.currentModel}`;
    if (currentModelInfo) {
      content += ` (${currentModelInfo.name})`;
    }
    content += `\n  Mode: ${state.currentMode}`;
    content += `\n  Session: ${state.session.id}`;
    content += `\n  Conversation History: ${state.session.conversationHistory.length} entries`;
    content += `\n  Requests Processed: ${this.requestCount}`;
    content += `\n  Average Response Time: ${this.requestCount > 0 ? Math.round(this.totalResponseTime / this.requestCount) : 0}ms`;
    if (this.lastActivity) {
      content += `\n  Last Activity: ${this.lastActivity.toISOString()}`;
    }

    return {
      content,
      type: 'command',
      confidence: 1.0,
      executionTime: 0,
      metadata: new Map([
        ['model', state.currentModel],
        ['mode', state.currentMode],
        ['sessionId', state.session.id],
        ['historyLength', state.session.conversationHistory.length.toString()],
      ]),
      success: true,
    };
  }

  private handleConfigCommand(_args: string[]): AgentResponse {
    const config = this.stateManager.getConfig();

    let content = '⚙️ Configuration:\n';
    content += `  Version: ${config.version}\n`;
    content += `  Default Model: ${config.defaultModel}\n`;
    content += `  Debug Mode: ${config.enableDebugMode ? 'enabled' : 'disabled'}\n`;
    content += `  Max History: ${config.maxHistorySize}\n`;
    content += `  Session Timeout: ${Math.round(config.sessionTimeout / 60000)}min\n`;
    content += `  Available Models: ${config.availableModels.join(', ')}`;

    return {
      content,
      type: 'command',
      confidence: 1.0,
      executionTime: 0,
      metadata: new Map([
        ['version', config.version],
        ['debugMode', config.enableDebugMode.toString()],
      ]),
      success: true,
    };
  }

  private handleModeCommand(args: string[]): AgentResponse {
    if (args.length === 0) {
      const currentMode = this.stateManager.getCurrentMode();
      return {
        content: `📍 Current Mode: ${currentMode}\n\nAvailable modes: ready, planning, editing, executing, error`,
        type: 'command',
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([['currentMode', currentMode]]),
        success: true,
      };
    } else {
      const mode = args[0] as any; // We'll validate below
      const validModes = ['ready', 'planning', 'editing', 'executing', 'error'];

      if (validModes.includes(mode)) {
        this.stateManager.setCurrentMode(mode);
        return {
          content: `✅ Mode changed to: ${mode}`,
          type: 'command',
          confidence: 1.0,
          executionTime: 0,
          metadata: new Map([['newMode', mode]]),
          success: true,
        };
      } else {
        return {
          content: `❌ Invalid mode: ${mode}\nAvailable modes: ${validModes.join(', ')}`,
          type: 'command',
          confidence: 0,
          executionTime: 0,
          metadata: new Map([['error', 'invalid-mode']]),
          success: false,
          error: `Invalid mode: ${mode}`,
        };
      }
    }
  }

  private handleSessionCommand(_args: string[]): AgentResponse {
    const session = this.stateManager.getCurrentSession();

    let content = '💾 Session Information:\n';
    content += `  ID: ${session.id}\n`;
    content += `  Created: ${session.createdAt.toISOString()}\n`;
    content += `  Last Active: ${session.lastActiveAt.toISOString()}\n`;
    content += `  Conversation History: ${session.conversationHistory.length} entries`;

    if (session.conversationHistory.length > 0) {
      content += '\n\nRecent entries:';
      const recent = session.conversationHistory.slice(-3);
      for (const entry of recent) {
        content += `\n  ${entry.timestamp.toLocaleTimeString()} [${entry.type}]: ${entry.content.substring(0, 50)}${entry.content.length > 50 ? '...' : ''}`;
      }
    }

    return {
      content,
      type: 'command',
      confidence: 1.0,
      executionTime: 0,
      metadata: new Map([
        ['sessionId', session.id],
        ['historyLength', session.conversationHistory.length.toString()],
      ]),
      success: true,
    };
  }

  // Workflow Integration Methods

  private async createWorkflowExecutionContext(request: AgentRequest): Promise<any> {
    // Create workflow execution context with proper isolation
    // This would use WorkflowExecutionContextFactory in full implementation
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: workflowId,
      sessionId: request.context.sessionId,
      environmentContext: request.context.environmentContext,
      availableTools: ['reasoning', 'search', 'general_tool'], // Simplified for now
      resourceLimits: {
        maxExecutionTime: 600000, // 10 minutes
        maxMemoryUsage: 200 * 1024 * 1024, // 200MB
        maxToolCalls: 50,
        maxNodes: 20,
      },
      preferences: {
        speedVsAccuracy: 'balanced',
        allowParallelExecution: true,
        allowIterativeExecution: true,
      },
    };
  }

  private handleWorkflowProgress(nodeId: string, progress: any, workflowContext: any): void {
    // Handle real-time progress updates during workflow execution
    // This could emit events, update UI, or log progress
    console.log(`Workflow progress - Node: ${nodeId}, Progress:`, progress);
  }

  private formatWorkflowOutput(workflowResult: any, extractionResult: any): string {
    const output = workflowResult.finalState?.output || 'Workflow completed successfully';
    const executionSummary =
      `\n\n--- Workflow Execution Summary ---\n` +
      `Strategy: ${extractionResult.workflowSpec?.parameters?.get('strategy') || 'Unknown'}\n` +
      `Execution Path: ${workflowResult.executionPath?.join(' → ') || 'N/A'}\n` +
      `Total Time: ${workflowResult.performance?.totalTime || 0}ms\n` +
      `Tool Execution Time: ${workflowResult.performance?.toolExecutionTime || 0}ms\n` +
      `Reasoning Time: ${workflowResult.performance?.reasoningTime || 0}ms\n` +
      `Extraction Method: ${extractionResult.extractionMethod || 'unknown'}`;

    return output + executionSummary;
  }

  private async updateConversationContextWithWorkflow(
    request: AgentRequest,
    workflowResult: any,
    extractionResult: any
  ): Promise<void> {
    const sessionId = request.context.sessionId;
    const contextId = this.sessionContextMap.get(sessionId);

    if (contextId) {
      // Add workflow execution as conversation entry
      this.contextManager.addMessageToContext(contextId, {
        id: `workflow_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: workflowResult.finalState?.output || 'Workflow completed',
        timestamp: new Date(),
        metadata: new Map([
          ['type', 'workflow_result'],
          ['workflowId', extractionResult.workflowSpec?.id || 'unknown'],
          ['strategy', extractionResult.workflowSpec?.parameters?.get('strategy') || 'unknown'],
          ['executionPath', JSON.stringify(workflowResult.executionPath || [])],
          ['executionTime', (workflowResult.performance?.totalTime || 0).toString()],
        ]),
      });
    }
  }

  private async cleanupWorkflowContext(workflowContext: any): Promise<void> {
    // Clean up workflow execution context and release resources
    // In full implementation, this would use WorkflowExecutionContextFactory.cleanupWorkflowContext
    console.log(`Cleaning up workflow context: ${workflowContext.id}`);
  }

  private logWorkflowError(
    request: AgentRequest,
    error: unknown,
    additionalContext: Record<string, unknown>
  ): void {
    // Use QiCore logging patterns for structured error logging
    console.error('Workflow execution error:', {
      sessionId: request.context.sessionId,
      input: request.input.substring(0, 200),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      ...additionalContext,
    });
  }

  // Helper methods

  private createDisabledResponse(
    type: 'command' | 'prompt' | 'workflow',
    message: string
  ): AgentResponse {
    return {
      content: message,
      type,
      confidence: 0,
      executionTime: 0,
      metadata: new Map([['disabled', true]]),
      success: false,
      error: message,
    };
  }

  private createErrorResponse(
    type: 'command' | 'prompt' | 'workflow',
    message: string
  ): AgentResponse {
    return {
      content: message,
      type,
      confidence: 0,
      executionTime: 0,
      metadata: new Map([['errorType', 'component-unavailable']]),
      success: false,
      error: message,
    };
  }

  private extractCommandName(input: string): string {
    const trimmed = input.trim();
    if (trimmed.startsWith('/')) {
      return trimmed.slice(1).split(' ')[0];
    }
    return '';
  }

  private extractCommandParameters(input: string): ReadonlyMap<string, unknown> {
    const trimmed = input.trim();
    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(' ').slice(1);
      const params = new Map<string, unknown>();
      parts.forEach((part, index) => {
        params.set(index.toString(), part);
      });
      return params;
    }
    return new Map();
  }

  private extractPromptOptions(context: AgentContext): PromptOptions {
    // Extract prompt options from agent context
    const currentModel = this.stateManager.getCurrentModel();
    const config = this.stateManager.getConfig();

    // Extract LLM config from context environment if available
    const llmConfig = context.environmentContext?.get('llmConfig') as any;

    return {
      provider: 'ollama', // Default provider since not in AppConfig
      model: currentModel || config.defaultModel,
      temperature: llmConfig?.temperature || 0.7,
      maxTokens: llmConfig?.maxTokens || 2048,
    };
  }
}
