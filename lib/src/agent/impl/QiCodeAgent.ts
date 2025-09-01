/**
 * Agent Module - QiCode Agent Implementation
 *
 * The main AI coding assistant agent that orchestrates all components.
 * Internal to agent module - other modules cannot access this directly.
 */

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
import type { ClassificationResult, IClassifier } from '../../classifier/index.js';
import type { CommandRequest, ICommandHandler } from '../../command/index.js';
import type { IContextManager } from '../../context/index.js';
import { createContextAwarePromptHandler } from '../../context/utils/ContextAwarePrompting.js';
import type { IPromptHandler, PromptOptions } from '../../prompt/index.js';
import type { IStateManager } from '../../state/index.js';
import type { PermissionManager } from '../../tools/security/PermissionManager.js';
import type { IWorkflowEngine, IWorkflowExtractor } from '../../workflow/index.js';
import type {
  AgentConfig,
  AgentContext,
  AgentRequest,
  AgentResponse,
  AgentStatus,
  AgentStreamChunk,
  IAgent,
  IAgentOrchestrator,
  ISubagentRegistry,
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

  // Subagent integration (optional)
  private subagentRegistry?: ISubagentRegistry;
  private agentOrchestrator?: IAgentOrchestrator;

  // Permission system integration (optional)
  private permissionManager?: PermissionManager;

  // Session to context mapping for context continuation
  private sessionContextMap = new Map<string, string>();

  // QiCore error factory method
  private createQiError(
    code: string,
    message: string,
    category: ErrorCategory,
    context: Record<string, unknown> = {}
  ): QiError {
    return create(code, message, category, context);
  }

  // Timeout utility for operations
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              this.createQiError(
                'OPERATION_TIMEOUT',
                `${operation} timed out after ${timeoutMs}ms`,
                'SYSTEM',
                { timeout: timeoutMs, operation }
              )
            ),
          timeoutMs
        )
      ),
    ]);
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
      classifier?: IClassifier;
      commandHandler?: ICommandHandler;
      promptHandler?: IPromptHandler;
      workflowEngine?: IWorkflowEngine;
      workflowExtractor?: IWorkflowExtractor;
      subagentRegistry?: ISubagentRegistry;
      agentOrchestrator?: IAgentOrchestrator;
      permissionManager?: PermissionManager;
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
    this.subagentRegistry = dependencies.subagentRegistry;
    this.agentOrchestrator = dependencies.agentOrchestrator;
    this.permissionManager = dependencies.permissionManager;
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

  // Public interface - uses QiCore functional patterns throughout
  async process(request: AgentRequest): Promise<AgentResponse> {
    const result = await this.processInternal(request);
    return match(
      (agentResponse: AgentResponse) => agentResponse,
      (error: QiError) => ({
        content: `Agent processing failed: ${error.message}`,
        type: 'command' as const,
        confidence: 0,
        executionTime: 0,
        metadata: new Map([
          ['error', error.message],
          ['errorCode', error.code],
          ['errorCategory', error.category],
          ['errorType', 'agent-processing-error'],
        ]),
        success: false,
        error: error.message,
      }),
      result
    );
  }

  // Internal layer - QiCore functional programming patterns
  private async processInternal(request: AgentRequest): Promise<Result<AgentResponse>> {
    const initResult = await fromAsyncTryCatch(async () => {
      if (!this.isInitialized) {
        throw new Error('Agent not initialized. Call initialize() first.');
      }
      const startTime = Date.now();
      this.requestCount++;
      this.lastActivity = new Date();
      return { ...request, startTime };
    });

    return await match(
      async (initData: any) => {
        const requestWithTime = { ...request, startTime: initData.startTime };

        // Check for state management commands first
        if (this.isStateCommand(requestWithTime.input)) {
          const stateResult = await this.handleStateCommandInternal(requestWithTime.input);
          return match(
            (response: AgentResponse) =>
              success({
                ...response,
                executionTime: Date.now() - requestWithTime.startTime,
              }) as Result<AgentResponse, QiError>,
            (error: QiError) => failure(error) as Result<AgentResponse, QiError>,
            stateResult
          );
        }

        return await this.processClassificationInternal(requestWithTime);
      },
      async (error: QiError) => failure(error) as Result<AgentResponse, QiError>,
      initResult
    );
  }

  private async processClassificationInternal(
    request: AgentRequest & { startTime: number }
  ): Promise<Result<AgentResponse>> {
    if (!this.classifier) {
      return failure(
        this.createQiError(
          'CLASSIFIER_NOT_AVAILABLE',
          'Classifier not available',
          'CONFIGURATION',
          { input: request.input }
        )
      );
    }

    const classificationResult = await fromAsyncTryCatch(async () => {
      const classificationTimeout = this.config.timeouts?.classification ?? 5000; // 5 second default
      if (!this.classifier) {
        throw new Error('Classifier not available');
      }
      return await this.withTimeout(
        this.classifier.classify(request.input),
        classificationTimeout,
        'Classification'
      );
    });

    return await match(
      async (classification: ClassificationResult) => {
        let responseResult: Result<AgentResponse>;

        switch (classification.type) {
          case 'command':
            responseResult = await this.handleCommandInternal(request, classification);
            break;
          case 'prompt':
            responseResult = await this.handlePromptInternal(request, classification);
            break;
          case 'workflow':
            responseResult = await this.handleWorkflowInternal(request, classification);
            break;
          default:
            return failure(
              this.createQiError(
                'UNKNOWN_CLASSIFICATION_TYPE',
                `Unknown classification type: ${classification.type}`,
                'VALIDATION',
                { classificationType: classification.type, input: request.input }
              )
            );
        }

        return match(
          (response: AgentResponse) => {
            const executionTime = Date.now() - request.startTime;
            this.totalResponseTime += executionTime;

            return success({
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
            }) as Result<AgentResponse, QiError>;
          },
          (error: QiError) => failure(error) as Result<AgentResponse, QiError>,
          responseResult
        );
      },
      async (error: QiError) => failure(error) as Result<AgentResponse, QiError>,
      classificationResult
    );
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

    const startTime = Date.now();
    let classificationTime = 0;
    let processingStartTime = 0;

    try {
      // Phase 1: Classification
      yield {
        type: 'classification',
        content: 'Analyzing input type...',
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

      const classificationStart = Date.now();
      const classificationTimeout = this.config.timeouts?.classification ?? 5000;
      const classification = await this.withTimeout(
        this.classifier.classify(request.input),
        classificationTimeout,
        'Classification'
      );
      classificationTime = Date.now() - classificationStart;

      yield {
        type: 'classification',
        content: `Input classified as: ${classification.type}`,
        isComplete: true,
        metadata: new Map([
          ['classificationType', classification.type],
          ['confidence', classification.confidence.toString()],
          ['method', classification.method],
          ['classificationTime', classificationTime.toString()],
        ]),
      };

      // Phase 2: Processing
      processingStartTime = Date.now();
      yield {
        type: 'processing',
        content: `Executing ${classification.type} handler...`,
        isComplete: false,
      };

      // Execute processing (reuse existing internal logic)
      const response = await this.processInternal(request);

      const processingTime = Date.now() - processingStartTime;
      const totalTime = Date.now() - startTime;

      const finalResponse = match(
        (agentResponse: AgentResponse) => agentResponse,
        (error: QiError) => ({
          content: `Processing failed: ${error.message}`,
          type: 'command' as const,
          confidence: 0,
          executionTime: processingTime,
          metadata: new Map([
            ['error', error.message],
            ['errorCode', error.code],
            ['errorCategory', error.category],
          ]),
          success: false,
          error: error.message,
        }),
        response
      );

      yield {
        type: 'processing',
        content: finalResponse.content,
        isComplete: true,
        metadata: finalResponse.metadata,
      };

      // Phase 3: Completion
      yield {
        type: 'completion',
        content: `Processing completed in ${totalTime}ms`,
        isComplete: true,
        metadata: new Map([
          ['success', finalResponse.success.toString()],
          ['executionTime', totalTime.toString()],
          ['classificationTime', classificationTime.toString()],
          ['processingTime', processingTime.toString()],
          ['confidence', (classification.confidence * 100).toFixed(1)],
          ['type', finalResponse.type],
        ]),
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      yield {
        type: 'error',
        content: `Stream processing failed: ${error instanceof Error ? error.message : String(error)}`,
        isComplete: true,
        error: error instanceof Error ? error.message : String(error),
        metadata: new Map([
          ['errorType', 'streaming-error'],
          ['totalTime', totalTime.toString()],
          ['classificationTime', classificationTime.toString()],
        ]),
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

  // Private routing methods - using QiCore Result<T> patterns

  private async handleCommand(
    request: AgentRequest,
    classification: ClassificationResult
  ): Promise<AgentResponse> {
    if (!this.config.enableCommands) {
      return {
        content: 'Command processing is disabled',
        type: 'command',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([['disabled', true]]),
        success: false,
        error: 'Command processing is disabled',
      };
    }

    if (!this.commandHandler) {
      return {
        content: 'Command handler not available',
        type: 'command',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([['errorType', 'component-unavailable']]),
        success: false,
        error: 'Command handler not available',
      };
    }

    const commandRequest: CommandRequest = {
      commandName: this.extractCommandName(request.input),
      parameters: this.extractCommandParameters(request.input),
      rawInput: request.input,
      context: request.context.environmentContext,
    };

    const commandTimeout = this.config.timeouts?.commandExecution ?? 30000; // 30 second default
    const result = await this.withTimeout(
      this.commandHandler.executeCommand(commandRequest),
      commandTimeout,
      'Command execution'
    );

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
      return {
        content: 'Prompt processing is disabled',
        type: 'prompt',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([['disabled', true]]),
        success: false,
        error: 'Prompt processing is disabled',
      };
    }

    if (!this.promptHandler) {
      return {
        content: 'Prompt handler not available',
        type: 'prompt',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([['errorType', 'component-unavailable']]),
        success: false,
        error: 'Prompt handler not available',
      };
    }

    const promptResult = await fromAsyncTryCatch(
      async () => {
        const promptTimeout = this.config.timeouts?.promptProcessing ?? 120000; // 2 minute default

        return await this.withTimeout(
          (async () => {
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
                const contextResult = this.contextManager.createConversationContext('main');

                if (contextResult.tag === 'failure') {
                  throw new Error(
                    `Failed to create conversation context: ${contextResult.error.message}`
                  );
                }

                contextId = contextResult.value.id;
                // Map session to context for future requests
                this.sessionContextMap.set(sessionId, contextId);
              }

              // Verify context still exists (cleanup may have removed it)
              const existingContext = this.contextManager.getConversationContext(contextId);
              if (!existingContext) {
                // Context was cleaned up, create a new one
                const contextResult = this.contextManager.createConversationContext('main');

                if (contextResult.tag === 'failure') {
                  throw new Error(
                    `Failed to create conversation context: ${contextResult.error.message}`
                  );
                }

                contextId = contextResult.value.id;
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
              result = await this.promptHandler?.complete(request.input, promptOptions);

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
                type: 'prompt' as const,
                confidence: classification.confidence,
                executionTime: 0, // Will be set by main process method
                metadata: new Map<string, unknown>([
                  ['promptOptions', JSON.stringify(promptOptions)],
                  ['provider', promptOptions.provider || 'default'],
                  ['contextAware', this.contextAwarePromptHandler ? 'true' : 'false'],
                ]),
                success: true,
              };
            } else {
              // TypeScript knows result.success is false, so result.error exists
              return {
                content: (result as { success: false; error: string }).error,
                type: 'prompt' as const,
                confidence: 0,
                executionTime: 0,
                metadata: new Map([['errorType', 'prompt-processing-error']]),
                success: false,
                error: (result as { success: false; error: string }).error,
              };
            }
          })(),
          promptTimeout,
          'Prompt processing'
        );
      },
      (error) =>
        this.createQiError(
          'PROMPT_PROCESSING_ERROR',
          `Prompt processing failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { input: request.input, sessionId: request.context.sessionId }
        )
    );

    return match(
      (response: AgentResponse) => response,
      (error: QiError) => ({
        content: error.message,
        type: 'prompt',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([
          ['errorType', 'prompt-processing-error'],
          ['errorCode', error.code],
        ]),
        success: false,
        error: error.message,
      }),
      promptResult
    );
  }

  // Internal QiCore implementation
  private async handleWorkflowInternal(
    request: AgentRequest,
    classification: ClassificationResult
  ): Promise<Result<AgentResponse>> {
    if (!this.config.enableWorkflows) {
      return success({
        content: 'Workflow processing is disabled',
        type: 'workflow',
        confidence: 0,
        executionTime: 0,
        metadata: new Map([['disabled', true]]),
        success: false,
        error: 'Workflow processing is disabled',
      });
    }

    if (!this.workflowExtractor || !this.workflowEngine) {
      return failure(
        this.createQiError(
          'WORKFLOW_COMPONENTS_NOT_AVAILABLE',
          'Workflow components not available',
          'CONFIGURATION',
          { input: request.input, classification: classification.type }
        )
      );
    }

    const workflowTimeout = this.config.timeouts?.workflowExecution ?? 600000; // 10 minute default
    const contextResult = await this.createWorkflowExecutionContextInternal(request);

    return await match(
      async (workflowContext: any) => {
        return await this.withTimeout(
          (async () => {
            const extractionResult = await this.extractWorkflowSpecInternal(
              request,
              workflowContext
            );

            return await match(
              async (extractionResultValue: any) => {
                const executionResult = await this.executeWorkflowInternal(
                  request,
                  extractionResultValue,
                  workflowContext,
                  classification
                );

                return await match(
                  async (agentResponse: AgentResponse) => {
                    const cleanupResult =
                      await this.cleanupWorkflowContextInternal(workflowContext);
                    return match(
                      () => success(agentResponse) as Result<AgentResponse, QiError>,
                      (error: QiError) => {
                        this.logWorkflowError(request, error, {
                          classification: classification.type,
                          confidence: classification.confidence,
                          timestamp: new Date().toISOString(),
                        });
                        return failure(error) as Result<AgentResponse, QiError>;
                      },
                      cleanupResult
                    );
                  },
                  async (error: QiError) => {
                    this.logWorkflowError(request, error, {
                      classification: classification.type,
                      confidence: classification.confidence,
                      timestamp: new Date().toISOString(),
                    });
                    return failure(error) as Result<AgentResponse, QiError>;
                  },
                  executionResult
                );
              },
              async (error: QiError) => {
                this.logWorkflowError(request, error, {
                  classification: classification.type,
                  confidence: classification.confidence,
                  timestamp: new Date().toISOString(),
                });
                return failure(error) as Result<AgentResponse, QiError>;
              },
              extractionResult
            );
          })(),
          workflowTimeout,
          'Workflow execution'
        );
      },
      async (error: QiError) => {
        this.logWorkflowError(request, error, {
          classification: classification.type,
          confidence: classification.confidence,
          timestamp: new Date().toISOString(),
        });
        return failure(error) as Result<AgentResponse, QiError>;
      },
      contextResult
    );
  }

  private async createWorkflowExecutionContextInternal(
    request: AgentRequest
  ): Promise<Result<any>> {
    return fromAsyncTryCatch(async () => {
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
    });
  }

  private async extractWorkflowSpecInternal(
    request: AgentRequest,
    workflowContext: any
  ): Promise<Result<any>> {
    return fromAsyncTryCatch(async () => {
      if (!this.workflowExtractor) {
        throw new Error('Workflow extractor not available');
      }
      const extractionResult = await this.workflowExtractor.extractWorkflow(
        request.input,
        { method: 'hybrid', promptProvider: undefined },
        workflowContext
      );

      if (!extractionResult || !extractionResult.success || !extractionResult.workflowSpec) {
        throw new Error(
          `Workflow extraction failed: ${extractionResult?.error || 'Unknown error'}`
        );
      }

      return extractionResult;
    });
  }

  private async executeWorkflowInternal(
    request: AgentRequest,
    extractionResult: any,
    workflowContext: any,
    _classification: ClassificationResult
  ): Promise<Result<AgentResponse>> {
    return fromAsyncTryCatch(async () => {
      const executionConfig = {
        sessionId: request.context.sessionId,
        contextId: workflowContext.id,
        streamingEnabled: true,
        checkpointingEnabled: true,
        progressCallback: (nodeId: string, progress: any) => {
          this.handleWorkflowProgress(nodeId, progress, workflowContext);
        },
      };

      const workflowResult = await this.workflowEngine?.executeWorkflow(
        extractionResult.workflowSpec,
        executionConfig
      );

      // Update conversation context with workflow results
      await this.updateConversationContextWithWorkflow(request, workflowResult, extractionResult);

      // Map execution results back to AgentResponse
      const agentResponse: AgentResponse = {
        content: this.formatWorkflowOutput(workflowResult, extractionResult),
        type: 'workflow',
        confidence: extractionResult?.confidence || 0,
        executionTime: workflowResult?.performance?.totalTime || 0,
        metadata: new Map([
          ['workflowId', extractionResult?.workflowSpec?.id || 'unknown'],
          ['strategy', extractionResult?.workflowSpec?.parameters?.get('strategy') || 'unknown'],
          ['nodeCount', extractionResult?.workflowSpec?.nodes?.length?.toString() || '0'],
          ['executionPath', JSON.stringify(workflowResult?.executionPath || [])],
          ['toolExecutionTime', workflowResult?.performance?.toolExecutionTime?.toString() || '0'],
          ['reasoningTime', workflowResult?.performance?.reasoningTime?.toString() || '0'],
          ['extractionMethod', extractionResult.extractionMethod],
          ['workflowContextId', workflowContext.id],
        ]),
        success: true,
      };

      return agentResponse;
    });
  }

  private async cleanupWorkflowContextInternal(workflowContext: any): Promise<Result<void>> {
    return fromAsyncTryCatch(async () => {
      await this.cleanupWorkflowContext(workflowContext);
    });
  }

  // Internal QiCore handler methods

  private async handleStateCommandInternal(input: string): Promise<Result<AgentResponse>> {
    return await fromAsyncTryCatch(async () => {
      return await this.handleStateCommand(input);
    });
  }

  private async handleCommandInternal(
    request: AgentRequest,
    classification: ClassificationResult
  ): Promise<Result<AgentResponse>> {
    return await fromAsyncTryCatch(async () => {
      return await this.handleCommand(request, classification);
    });
  }

  private async handlePromptInternal(
    request: AgentRequest,
    classification: ClassificationResult
  ): Promise<Result<AgentResponse>> {
    return await fromAsyncTryCatch(async () => {
      return await this.handlePrompt(request, classification);
    });
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

  // Legacy method for backward compatibility
  private async handleSessionCommand(_args: string[]): Promise<AgentResponse> {
    const result = await this.handleSessionCommandInternal(_args);
    return match(
      (success: AgentResponse) => success,
      (error: QiError) => ({
        content: `❌ Failed to get session info: ${error.message}`,
        type: 'command' as const,
        confidence: 0,
        executionTime: 0,
        metadata: new Map([['error', 'session-command-failed']]),
        success: false,
        error: error.message,
      }),
      result
    );
  }

  // Internal QiCore implementation
  private async handleSessionCommandInternal(_args: string[]): Promise<Result<AgentResponse>> {
    return await fromAsyncTryCatch(async () => {
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
        type: 'command' as const,
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([
          ['sessionId', session.id],
          ['historyLength', session.conversationHistory.length.toString()],
        ]),
        success: true,
      };
    });
  }

  private handleWorkflowProgress(_nodeId: string, _progress: any, _workflowContext: any): void {
    // Handle real-time progress updates during workflow execution
    // This could emit events, update UI, or integrate with monitoring systems
    // Implementation can be expanded when progress tracking infrastructure is needed
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
      const messageResult = this.contextManager.addMessageToContext(contextId, {
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

      // Handle potential error when adding message
      match(
        () => {}, // Success - continue
        (_error) => {
          // Message addition failed - workflow still succeeded
          // Error handling can be enhanced with proper monitoring infrastructure
        },
        messageResult
      );
    }
  }

  private async cleanupWorkflowContext(_workflowContext: any): Promise<void> {
    // Clean up workflow execution context and release resources
    // Context cleanup implementation can be expanded when resource management is needed
  }

  private logWorkflowError(
    _request: AgentRequest,
    _error: unknown,
    _additionalContext: Record<string, unknown>
  ): void {
    // Workflow error logging implementation can be enhanced with proper monitoring infrastructure
    // This method provides a hook for future structured error logging integration
  }

  // Helper methods for parameter extraction

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
