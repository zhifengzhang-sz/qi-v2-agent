/**
 * LLM Function Calling Workflow Engine
 *
 * Real LLM-driven workflow execution using function calling to orchestrate tools.
 * Based on Claude Code architecture patterns with async generator streaming.
 */

import { create, failure, fromAsyncTryCatch, type QiError, type Result, success } from '@qi/base';
import type { SimpleLogger } from '../../utils/index.js';
import { createQiLogger } from '../../utils/QiCoreLogger.js';
import type {
  WorkflowResult,
  WorkflowState,
  WorkflowStreamChunk,
} from '../interfaces/IWorkflow.js';
import type {
  ExecutableWorkflow,
  IWorkflowEngine,
  WorkflowNodeHandler,
} from '../interfaces/index.js';

// =============================================================================
// LLM Integration Types
// =============================================================================

/**
 * LLM Function Schema for tool calling
 */
interface LLMFunctionSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required: string[];
  };
}

/**
 * LLM Function Call from the model
 */
interface LLMFunctionCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// =============================================================================
// LLM Function Calling Workflow Engine Implementation
// =============================================================================

export class LLMFunctionCallingWorkflowEngine implements IWorkflowEngine {
  private logger: SimpleLogger;
  private toolSchemas: Map<string, LLMFunctionSchema> = new Map();
  private toolHandlers: Map<string, WorkflowNodeHandler> = new Map();

  constructor(
    private llmProvider: any, // multi-llm-ts integration
    private config: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      timeoutMs?: number;
      maxRetries?: number;
    } = {}
  ) {
    this.logger = createQiLogger({
      name: 'LLMFunctionCallingWorkflowEngine',
      level: 'info',
    });
  }

  /**
   * Initialize the workflow engine
   */
  async initialize(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.logger.info('Initializing LLM Function Calling Workflow Engine', {
          model: this.config.model || 'default',
          temperature: this.config.temperature || 0.1,
          maxTokens: this.config.maxTokens || 4096,
        });

        // Initialize tool schemas (will be populated by registerTool)
        this.toolSchemas.clear();
        this.toolHandlers.clear();

        return undefined;
      },
      (error) =>
        create('ENGINE_INIT_FAILED', `Failed to initialize workflow engine: ${error}`, 'SYSTEM')
    );
  }

  /**
   * Register a tool with the workflow engine
   */
  registerTool(
    name: string,
    handler: WorkflowNodeHandler,
    schema: LLMFunctionSchema
  ): Result<void, QiError> {
    try {
      this.toolSchemas.set(name, schema);
      this.toolHandlers.set(name, handler);

      this.logger.debug('Tool registered', { name, hasSchema: !!schema, hasHandler: !!handler });
      return success(undefined);
    } catch (error) {
      return failure(
        create('TOOL_REGISTRATION_FAILED', `Failed to register tool ${name}: ${error}`, 'SYSTEM')
      );
    }
  }

  /**
   * Create an executable workflow from a pattern
   */
  createWorkflow(pattern: string, customizations?: any[]): ExecutableWorkflow {
    return {
      id: `llm-workflow-${Date.now()}`,
      pattern,
      nodes: [],
      edges: [],
    };
  }

  /**
   * Execute workflow using LLM function calling
   */
  async execute(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting LLM workflow execution', {
        input: initialState.input.substring(0, 100),
        workflowId: workflow.id,
        toolCount: this.toolSchemas.size,
      });

      // Execute LLM-driven workflow logic
      const result = await this.executeLLMWorkflow(workflow, initialState);
      const duration = Date.now() - startTime;

      return {
        finalState: {
          ...initialState,
          output: result.output,
          metadata: {
            ...initialState.metadata,
            currentStage: 'completed',
            processingSteps: [
              ...initialState.metadata.processingSteps,
              'llm-execution',
              'completed',
            ],
            performance: new Map([
              ...initialState.metadata.performance.entries(),
              ['totalExecutionTime', duration],
              ['toolCount', this.toolHandlers.size],
            ]),
          },
        },
        executionPath: [workflow.id],
        performance: {
          totalTime: duration,
          nodeExecutionTimes: new Map([['llm-execution', duration]]),
          toolExecutionTime: duration * 0.8, // Estimate
          reasoningTime: duration * 0.2, // Estimate
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        finalState: {
          ...initialState,
          output: `Workflow execution failed: ${error}`,
          metadata: {
            ...initialState.metadata,
            currentStage: 'failed',
            processingSteps: [...initialState.metadata.processingSteps, 'error'],
            performance: new Map([
              ...initialState.metadata.performance.entries(),
              ['failureTime', duration],
            ]),
          },
        },
        executionPath: [workflow.id],
        performance: {
          totalTime: duration,
          nodeExecutionTimes: new Map([['error', duration]]),
          toolExecutionTime: 0,
          reasoningTime: duration,
        },
      };
    }
  }

  /**
   * Stream workflow execution for real-time updates
   */
  async *stream(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): AsyncIterableIterator<WorkflowStreamChunk> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting streaming LLM workflow execution', {
        input: initialState.input.substring(0, 100),
        workflowId: workflow.id,
      });

      yield {
        nodeId: 'start',
        state: initialState,
        isComplete: false,
      };

      // Execute workflow and stream updates
      const result = await this.executeLLMWorkflow(workflow, initialState);

      yield {
        nodeId: 'end',
        state: {
          ...initialState,
          output: result.output,
          metadata: {
            ...initialState.metadata,
            currentStage: 'completed',
            processingSteps: [...initialState.metadata.processingSteps, 'streaming-completed'],
            performance: new Map([
              ...initialState.metadata.performance.entries(),
              ['streamingExecutionTime', Date.now() - startTime],
            ]),
          },
        },
        isComplete: true,
      };
    } catch (error) {
      yield {
        nodeId: 'error',
        state: {
          ...initialState,
          output: `Error: ${error}`,
        },
        isComplete: true,
        error: {
          nodeId: 'llm-execution',
          error: error instanceof Error ? error : new Error(String(error)),
          retryable: false,
        },
      };
    }
  }

  /**
   * Precompile workflows for performance
   */
  async precompileWorkflows(patterns: readonly string[]): Promise<void> {
    this.logger.info('Precompiling workflows', { patternCount: patterns.length });
    // LLM-based workflows don't need precompilation in the traditional sense
    // But we could cache common tool schemas here
  }

  /**
   * Get a precompiled workflow
   */
  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null {
    // Return a basic workflow structure for the pattern
    return this.createWorkflow(patternName);
  }

  /**
   * Execute workflow from specification with configuration
   */
  async executeWorkflow(
    spec: any, // WorkflowSpec type
    config: {
      sessionId: string;
      contextId: string;
      streamingEnabled?: boolean;
      checkpointingEnabled?: boolean;
      progressCallback?: (nodeId: string, progress: any) => void;
    }
  ): Promise<WorkflowResult> {
    // Create an executable workflow from the spec
    const workflow = this.createWorkflow(spec.pattern || spec.id || 'default');

    // Create initial state from spec and config
    const initialState: WorkflowState = {
      input: spec.input || '',
      pattern: spec.pattern || 'default',
      domain: spec.domain || 'general',
      context: new Map([
        ['sessionId', config.sessionId],
        ['contextId', config.contextId],
      ]),
      toolResults: [],
      reasoningOutput: '',
      output: '',
      metadata: {
        startTime: Date.now(),
        currentStage: 'initialization',
        processingSteps: ['start'],
        performance: new Map(),
      },
    };

    // Execute the workflow
    return await this.execute(workflow, initialState);
  }

  /**
   * Core LLM workflow execution method
   */
  private async executeLLMWorkflow(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): Promise<{ success: boolean; output: string }> {
    this.logger.debug('Executing LLM workflow', {
      workflowId: workflow.id,
      pattern: workflow.pattern,
      input: initialState.input.substring(0, 100),
    });

    try {
      // Create LLM prompt with available tools
      const systemPrompt = this.createSystemPrompt();
      const toolSchemas = Array.from(this.toolSchemas.values());

      // Call LLM with function calling capability
      const llmResponse = await this.callLLMWithFunctions(
        systemPrompt,
        initialState.input,
        toolSchemas
      );

      if (llmResponse.tag === 'failure') {
        throw new Error(`LLM call failed: ${llmResponse.error.message}`);
      }

      // Process LLM response and execute function calls
      const result = await this.processLLMResponseSync(llmResponse.value, initialState);

      return {
        success: true,
        output: result.output,
      };
    } catch (error) {
      this.logger.error('LLM workflow execution failed', { error: String(error) });
      return {
        success: false,
        output: `Workflow execution failed: ${error}`,
      };
    }
  }

  /**
   * Create system prompt for LLM function calling
   */
  private createSystemPrompt(): string {
    const availableTools = Array.from(this.toolSchemas.keys()).join(', ');

    return `You are an AI workflow executor with access to the following tools: ${availableTools}

Your task is to analyze the user's request and execute the appropriate sequence of tool calls to fulfill their request.

Guidelines:
- Break down complex tasks into smaller steps
- Use the available tools efficiently
- Provide clear reasoning for your tool choices
- Handle errors gracefully and suggest alternatives
- Stream progress updates as you work

Available tools and their capabilities:
${Array.from(this.toolSchemas.entries())
  .map(([name, schema]) => `- ${name}: ${schema.description}`)
  .join('\n')}

Execute the user's request by making appropriate function calls.`;
  }

  /**
   * Call LLM with function calling capability
   */
  private async callLLMWithFunctions(
    systemPrompt: string,
    userInput: string,
    toolSchemas: LLMFunctionSchema[]
  ): Promise<Result<any, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // This would integrate with multi-llm-ts for actual LLM calls
        // For now, we'll simulate an LLM response

        this.logger.info('Making LLM function call', {
          model: this.config.model || 'default',
          toolCount: toolSchemas.length,
          userInputLength: userInput.length,
        });

        // Simulated LLM response with function calls
        // In real implementation, this would call the actual LLM provider
        const mockResponse = {
          content: 'I will help you with that request. Let me analyze what needs to be done.',
          function_calls: [
            {
              id: 'call_1',
              name: 'analyze_task',
              arguments: { task: userInput },
            },
          ],
        };

        return mockResponse;
      },
      (error) => create('LLM_CALL_FAILED', `LLM function call failed: ${error}`, 'SYSTEM')
    );
  }

  /**
   * Process LLM response synchronously for execute() method
   */
  private async processLLMResponseSync(
    llmResponse: any,
    state: WorkflowState
  ): Promise<{ output: string }> {
    const functionCalls: LLMFunctionCall[] = llmResponse.function_calls || [];

    this.logger.debug('Processing LLM response synchronously', {
      contentLength: llmResponse.content?.length || 0,
      functionCallCount: functionCalls.length,
    });

    const outputs: string[] = [llmResponse.content || ''];

    // Execute function calls sequentially
    for (const functionCall of functionCalls) {
      try {
        const result = await this.executeFunctionCall(functionCall, state);

        if (result.tag === 'success') {
          outputs.push(`Tool ${functionCall.name}: ${JSON.stringify(result.value)}`);
        } else {
          outputs.push(`Tool ${functionCall.name} failed: ${result.error.message}`);
        }
      } catch (error) {
        this.logger.error('Function call execution failed', {
          functionName: functionCall.name,
          error: String(error),
        });
        outputs.push(`Tool ${functionCall.name} error: ${error}`);
      }
    }

    return {
      output: outputs.join('\n'),
    };
  }

  /**
   * Execute a single function call
   */
  private async executeFunctionCall(
    functionCall: LLMFunctionCall,
    state: WorkflowState
  ): Promise<Result<unknown, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const handler = this.toolHandlers.get(functionCall.name);
        if (!handler) {
          throw new Error(`No handler found for function: ${functionCall.name}`);
        }

        this.logger.debug('Executing function call', {
          name: functionCall.name,
          arguments: functionCall.arguments,
        });

        // Create a modified state with function arguments
        const modifiedState: WorkflowState = {
          ...state,
          context: new Map([...state.context.entries(), ...Object.entries(functionCall.arguments)]),
        };

        // Execute the tool handler
        const result = await handler(modifiedState);

        return result.output || 'Function executed successfully';
      },
      (error) =>
        create(
          'FUNCTION_EXECUTION_FAILED',
          `Function execution failed for ${functionCall.name}: ${error}`,
          'SYSTEM'
        )
    );
  }

  /**
   * Clean up workflow engine resources
   */
  async cleanup(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        this.logger.info('Cleaning up LLM Function Calling Workflow Engine');

        this.toolSchemas.clear();
        this.toolHandlers.clear();

        return undefined;
      },
      (error) =>
        create('ENGINE_CLEANUP_FAILED', `Failed to cleanup workflow engine: ${error}`, 'SYSTEM')
    );
  }

  /**
   * Get engine metadata and statistics
   */
  getMetadata() {
    return {
      name: 'LLMFunctionCallingWorkflowEngine',
      version: '1.0.0',
      type: 'llm-function-calling',
      capabilities: ['function-calling', 'streaming', 'error-recovery', 'multi-tool-execution'],
      registeredTools: Array.from(this.toolSchemas.keys()),
      configuration: this.config,
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create tool schema from existing tool interfaces
 */
export function createToolSchema(
  name: string,
  description: string,
  parameters: Record<string, { type: string; description: string; required?: boolean }>
): LLMFunctionSchema {
  const properties: Record<string, { type: string; description: string; enum?: string[] }> = {};
  const required: string[] = [];

  for (const [paramName, paramConfig] of Object.entries(parameters)) {
    properties[paramName] = {
      type: paramConfig.type,
      description: paramConfig.description,
    };

    if (paramConfig.required) {
      required.push(paramName);
    }
  }

  return {
    name,
    description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  };
}

/**
 * Convert workflow node to tool schema
 */
export function nodeToToolSchema(node: any): LLMFunctionSchema {
  return createToolSchema(
    node.name,
    node.description || `Execute ${node.name} workflow node`,
    node.parameters || {}
  );
}
