/**
 * @qi/workflow - Workflow Tool Executor Service
 *
 * Integrates the tool execution system with workflow nodes for v-0.8.0
 * Provides a bridge between workflow requirements and the core tool system
 */

import { failure, fromAsyncTryCatch, type QiError, type Result, success } from '@qi/base';
import type {
  ITool,
  ToolCall,
  ToolContext,
  ToolResult,
} from '../../tools/core/interfaces/ITool.js';
import type { IToolExecutor } from '../../tools/core/interfaces/IToolExecutor.js';
import type { IToolRegistry } from '../../tools/core/interfaces/IToolRegistry.js';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type { WorkflowToolResult } from '../interfaces/index.js';

/**
 * Tool execution request for workflow nodes
 */
export interface WorkflowToolExecutionRequest {
  toolName: string;
  input: Record<string, unknown>;
  nodeId: string;
  workflowId: string;
  sessionId: string;
}

/**
 * Configuration for workflow tool executor
 */
export interface WorkflowToolExecutorConfig {
  registry: IToolRegistry;
  executor: IToolExecutor;
  defaultTimeout?: number;
  maxConcurrentTools?: number;
  enableToolMetrics?: boolean;
}

/**
 * Workflow-specific tool execution service
 *
 * This service bridges the gap between workflow nodes and the core tool system,
 * handling tool execution in the context of workflow processing
 */
export class WorkflowToolExecutor {
  private registry: IToolRegistry;
  private executor: IToolExecutor;
  private config: WorkflowToolExecutorConfig;
  private logger: SimpleLogger;

  constructor(config: WorkflowToolExecutorConfig) {
    this.registry = config.registry;
    this.executor = config.executor;
    this.config = {
      defaultTimeout: 30000,
      maxConcurrentTools: 5,
      enableToolMetrics: true,
      ...config,
    };

    this.logger = createQiLogger({
      name: 'WorkflowToolExecutor',
      level: 'info',
    });
  }

  /**
   * Execute a single tool within a workflow node context
   */
  async executeTool(
    request: WorkflowToolExecutionRequest
  ): Promise<Result<WorkflowToolResult, QiError>> {
    this.logger.info('🔧 Executing workflow tool', undefined, {
      component: 'WorkflowToolExecutor',
      method: 'executeTool',
      toolName: request.toolName,
      nodeId: request.nodeId,
      workflowId: request.workflowId,
    });

    // Check if tool exists
    const toolResult = this.registry.get(request.toolName);
    if (toolResult.tag === 'failure') {
      return failure(toolResult.error);
    }

    const tool = toolResult.value;

    // Create tool context for workflow execution
    const toolContext = this.createWorkflowToolContext(request);

    // Create tool call
    const toolCall: ToolCall = {
      toolName: request.toolName,
      input: request.input,
      callId: `${request.workflowId}-${request.nodeId}-${Date.now()}`,
      timestamp: Date.now(),
      context: toolContext,
    };

    // Use QiCore fromAsyncTryCatch pattern for proper error handling
    return fromAsyncTryCatch(
      async (): Promise<WorkflowToolResult> => {
        // Execute tool with timeout
        const executionResults: ToolResult[] = [];

        for await (const result of this.executor.execute(toolCall, {
          timeout: this.config.defaultTimeout,
          enableMetrics: this.config.enableToolMetrics,
        })) {
          if (result.tag === 'success') {
            const value = result.value;
            // Collect ToolResult (final results)
            if (value && 'success' in value && 'callId' in value) {
              executionResults.push(value as ToolResult);
            }
            // ExecutionProgress updates are logged but not collected
          } else {
            throw new Error(`Tool execution step failed: ${result.error.message}`);
          }
        }

        // Get the final result
        const finalResult = executionResults[executionResults.length - 1];
        if (!finalResult) {
          throw new Error(`Tool execution completed but no final result was returned`);
        }

        if (!finalResult.success) {
          const errorMsg =
            finalResult.error?.message || 'Tool execution failed without specific error';
          throw new Error(errorMsg);
        }

        // Convert to WorkflowToolResult
        const workflowResult: WorkflowToolResult = {
          toolName: request.toolName,
          input: request.input,
          output: finalResult.output || {},
          success: finalResult.success,
          executionTime: finalResult.metrics.endTime - finalResult.metrics.startTime,
          metadata: new Map(finalResult.metadata.entries()),
          callId: finalResult.callId,
        };

        this.logger.info('✅ Workflow tool executed successfully', undefined, {
          component: 'WorkflowToolExecutor',
          method: 'executeTool',
          toolName: request.toolName,
          nodeId: request.nodeId,
          executionTime: workflowResult.executionTime,
        });

        return workflowResult;
      },
      (error: unknown): QiError => {
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.logger.error('❌ Workflow tool execution failed', undefined, {
          component: 'WorkflowToolExecutor',
          method: 'executeTool',
          toolName: request.toolName,
          nodeId: request.nodeId,
          errorMessage,
        });

        return {
          code: 'TOOL_EXECUTION_ERROR',
          message: `Tool execution error: ${errorMessage}`,
          category: 'SYSTEM',
          context: {
            toolName: request.toolName,
            nodeId: request.nodeId,
            originalError: errorMessage,
          },
        };
      }
    );
  }

  /**
   * Execute multiple tools in sequence within a workflow node
   */
  async executeToolSequence(
    requests: WorkflowToolExecutionRequest[]
  ): Promise<Result<WorkflowToolResult[], QiError>> {
    const results: WorkflowToolResult[] = [];

    this.logger.info('🔗 Executing workflow tool sequence', undefined, {
      component: 'WorkflowToolExecutor',
      method: 'executeToolSequence',
      toolCount: requests.length,
      workflowId: requests[0]?.workflowId,
    });

    for (const request of requests) {
      const result = await this.executeTool(request);

      if (result.tag === 'failure') {
        return failure(result.error);
      }

      results.push(result.value);
    }

    return success(results);
  }

  /**
   * Execute multiple tools concurrently where possible within a workflow node
   */
  async executeToolBatch(
    requests: WorkflowToolExecutionRequest[]
  ): Promise<Result<WorkflowToolResult[], QiError>> {
    this.logger.info('⚡ Executing workflow tool batch', undefined, {
      component: 'WorkflowToolExecutor',
      method: 'executeToolBatch',
      toolCount: requests.length,
      workflowId: requests[0]?.workflowId,
    });

    // Analyze which tools can be run concurrently
    const concurrentRequests: WorkflowToolExecutionRequest[] = [];
    const sequentialRequests: WorkflowToolExecutionRequest[] = [];

    for (const request of requests) {
      const toolResult = this.registry.get(request.toolName);
      if (toolResult.tag === 'success' && toolResult.value.isConcurrencySafe) {
        concurrentRequests.push(request);
      } else {
        sequentialRequests.push(request);
      }
    }

    const results: WorkflowToolResult[] = [];

    // Execute concurrent tools in parallel
    if (concurrentRequests.length > 0) {
      const concurrentPromises = concurrentRequests.map((request) => this.executeTool(request));
      const concurrentResults = await Promise.allSettled(concurrentPromises);

      for (const result of concurrentResults) {
        if (result.status === 'fulfilled') {
          if (result.value.tag === 'success') {
            results.push(result.value.value);
          } else {
            return failure(result.value.error);
          }
        } else {
          return failure({
            code: 'CONCURRENT_EXECUTION_FAILED',
            message: `Concurrent tool execution failed: ${result.reason}`,
            category: 'SYSTEM',
            context: { phase: 'concurrent_batch' },
          });
        }
      }
    }

    // Execute sequential tools one by one
    for (const request of sequentialRequests) {
      const result = await this.executeTool(request);
      if (result.tag === 'failure') {
        return failure(result.error);
      }
      results.push(result.value);
    }

    this.logger.info('✅ Workflow tool batch completed', undefined, {
      component: 'WorkflowToolExecutor',
      method: 'executeToolBatch',
      totalTools: requests.length,
      concurrentTools: concurrentRequests.length,
      sequentialTools: sequentialRequests.length,
      successfulResults: results.length,
    });

    return success(results);
  }

  /**
   * Check if a tool is available for workflow execution
   */
  isToolAvailable(toolName: string): boolean {
    return this.registry.has(toolName);
  }

  /**
   * Get available tools for workflows
   */
  getAvailableTools(): string[] {
    return this.registry.listAll().map((meta) => meta.name);
  }

  /**
   * Get tool metadata for workflow planning
   */
  getToolMetadata(toolName: string): Result<
    {
      name: string;
      description: string;
      category: string;
      isReadOnly: boolean;
      isConcurrencySafe: boolean;
    },
    QiError
  > {
    const metadataResult = this.registry.getMetadata(toolName);
    if (metadataResult.tag === 'failure') {
      return failure(metadataResult.error);
    }

    const toolResult = this.registry.get(toolName);
    if (toolResult.tag === 'failure') {
      return failure(toolResult.error);
    }

    const metadata = metadataResult.value;
    const tool = toolResult.value;

    return success({
      name: metadata.name,
      description: metadata.description,
      category: metadata.category,
      isReadOnly: tool.isReadOnly,
      isConcurrencySafe: tool.isConcurrencySafe,
    });
  }

  /**
   * Create tool context for workflow execution
   */
  private createWorkflowToolContext(request: WorkflowToolExecutionRequest): ToolContext {
    return {
      sessionId: request.sessionId,
      userId: undefined, // Could be extracted from workflow context if needed
      currentDirectory: process.cwd(),
      environment: new Map([
        ['NODE_ENV', process.env.NODE_ENV || 'development'],
        ['WORKFLOW_ID', request.workflowId],
        ['NODE_ID', request.nodeId],
      ]),
      permissions: {
        readFiles: true,
        writeFiles: false, // Conservative default for workflows
        executeCommands: false, // Conservative default
        networkAccess: true,
        systemAccess: false,
        manageProcesses: false,
        allowedPaths: [], // Could be configured per workflow
        deniedPaths: [],
      },
      metadata: new Map([
        ['workflowId', request.workflowId],
        ['nodeId', request.nodeId],
        ['executionContext', 'workflow'],
        ['timestamp', new Date().toISOString()],
      ]),
    };
  }
}
