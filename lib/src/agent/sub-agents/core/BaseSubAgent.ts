/**
 * Base Sub-Agent Implementation
 *
 * Abstract base class for all sub-agents in the Workflow-Driven Sub-Agent Architecture.
 * Provides common functionality and enforces QiCore Result<T, QiError> patterns.
 */

import { EventEmitter } from 'node:events';
import type { QiError, Result } from '@qi/base';
import { failure, match, success } from '@qi/base';
import { createQiLogger, type SimpleLogger } from '../../../utils/QiCoreLogger.js';
import type {
  ISubAgent,
  IToolExecutor,
  SubAgentArtifact,
  SubAgentCapability,
  SubAgentConfig,
  SubAgentHealth,
  SubAgentProgress,
  SubAgentResult,
  SubAgentTask,
} from './types.js';

/**
 * Creates QiCore-compatible error for sub-agent operations
 */
function createSubAgentError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): QiError {
  return {
    code,
    message,
    category: 'SYSTEM',
    context: context || {},
  } as QiError;
}

export abstract class BaseSubAgent extends EventEmitter implements ISubAgent {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public abstract readonly capabilities: SubAgentCapability[];

  protected toolExecutor?: IToolExecutor;
  protected logger: SimpleLogger;
  protected config: SubAgentConfig | undefined;
  protected isInitialized: boolean = false;
  protected currentTasks: Map<string, SubAgentTask> = new Map();

  constructor(id: string, name: string, version: string) {
    super();
    this.id = id;
    this.name = name;
    this.version = version;
    this.logger = createQiLogger({ name: `SubAgent:${name}` });
  }

  /**
   * Initialize the sub-agent
   */
  async initialize(config: SubAgentConfig): Promise<Result<void, QiError>> {
    try {
      this.config = config;
      this.toolExecutor = config.toolProvider;

      // Validate required tools are available
      const validationResult = this.validateToolAccess(
        this.toolExecutor?.getAvailableTools() || []
      );

      match(
        () => undefined,
        (error) => {
          throw error;
        },
        validationResult
      );

      // Perform sub-agent specific initialization
      const initResult = await this.onInitialize(config);
      match(
        () => undefined,
        (error) => {
          throw error;
        },
        initResult
      );

      this.isInitialized = true;
      this.logger.info('Sub-agent initialized successfully', {
        subAgentId: this.id,
        capabilities: this.capabilities.map((c) => c.name),
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createSubAgentError('SUB_AGENT_INIT_FAILED', 'Failed to initialize sub-agent', {
          subAgentId: this.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Check if this sub-agent can handle a specific task
   */
  async canHandle(task: SubAgentTask): Promise<Result<boolean, QiError>> {
    try {
      // Check if initialized
      if (!this.isInitialized) {
        return success(false);
      }

      // Check if we have a capability that matches the task type
      const hasMatchingCapability = this.capabilities.some((capability) => {
        return (
          capability.type === task.type ||
          capability.name === task.type ||
          this.isTaskTypeCompatible(task.type, capability)
        );
      });

      if (!hasMatchingCapability) {
        return success(false);
      }

      // Check tool requirements
      const requiredTools = this.getRequiredToolsForTask(task);
      const hasRequiredTools = requiredTools.every((tool) =>
        task.context.availableTools.includes(tool)
      );

      if (!hasRequiredTools) {
        return success(false);
      }

      // Allow sub-agent specific logic
      const customCheckResult = await this.canHandleCustom(task);
      return customCheckResult;
    } catch (error) {
      return failure(
        createSubAgentError(
          'SUB_AGENT_CAN_HANDLE_FAILED',
          'Failed to check if sub-agent can handle task',
          {
            subAgentId: this.id,
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  /**
   * Execute a task with streaming progress updates
   */
  async *execute(task: SubAgentTask): AsyncGenerator<SubAgentProgress, SubAgentResult> {
    const startTime = Date.now();

    try {
      // Validate we can handle this task
      const canHandleResult = await this.canHandle(task);
      match(
        (canHandle) => {
          if (!canHandle) {
            throw createSubAgentError(
              'SUB_AGENT_CANNOT_HANDLE_TASK',
              'Sub-agent cannot handle this task',
              { subAgentId: this.id, taskId: task.id, taskType: task.type }
            );
          }
        },
        (error) => {
          throw error;
        },
        canHandleResult
      );

      // Register task
      this.currentTasks.set(task.id, task);

      this.logger.info('Starting task execution', {
        subAgentId: this.id,
        taskId: task.id,
        taskType: task.type,
      });

      // Initial progress
      yield {
        taskId: task.id,
        stage: 'starting',
        progress: 0,
        message: `${this.name} starting task: ${task.description}`,
      };

      // Execute the task (implemented by concrete sub-agents)
      const toolsUsed: string[] = [];
      const stagesCompleted: string[] = [];
      let output: unknown;

      try {
        // Delegate to concrete implementation
        const executionGenerator = this.executeTask(task);

        for await (const progress of executionGenerator) {
          // Track tools used and stages completed
          if (
            progress.intermediateResults &&
            typeof progress.intermediateResults === 'object' &&
            progress.intermediateResults !== null &&
            'toolUsed' in progress.intermediateResults
          ) {
            toolsUsed.push(progress.intermediateResults.toolUsed as string);
          }

          stagesCompleted.push(progress.stage);

          yield progress;

          // Store final output if this is the last progress update
          if (progress.progress >= 1.0) {
            output = progress.intermediateResults;
          }
        }

        // Create success result
        const result: SubAgentResult = {
          taskId: task.id,
          success: true,
          output: output || 'Task completed successfully',
          metadata: {
            executionTime: Date.now() - startTime,
            toolsUsed: [...new Set(toolsUsed)],
            stagesCompleted: [...new Set(stagesCompleted)],
            resourcesConsumed: this.getResourceConsumption(),
          },
          artifacts: await this.collectArtifacts(task),
          recommendations: this.generateRecommendations(task, output),
        };

        this.logger.info('Task execution completed successfully', {
          subAgentId: this.id,
          taskId: task.id,
          executionTime: result.metadata.executionTime,
          toolsUsed: result.metadata.toolsUsed,
        });

        this.emit('taskCompleted', { subAgentId: this.id, task, result });

        return result;
      } catch (executionError) {
        // Create failure result
        const result: SubAgentResult = {
          taskId: task.id,
          success: false,
          output: executionError,
          metadata: {
            executionTime: Date.now() - startTime,
            toolsUsed: [...new Set(toolsUsed)],
            stagesCompleted: [...new Set(stagesCompleted)],
            resourcesConsumed: this.getResourceConsumption(),
          },
        };

        this.logger.error('Task execution failed', {
          subAgentId: this.id,
          taskId: task.id,
          error: executionError instanceof Error ? executionError.message : String(executionError),
        });

        this.emit('taskFailed', { subAgentId: this.id, task, result, error: executionError });

        return result;
      }
    } finally {
      // Cleanup
      this.currentTasks.delete(task.id);
    }
  }

  /**
   * Validate that required tools are available
   */
  validateToolAccess(availableTools: string[]): Result<void, QiError> {
    const allRequiredTools = new Set<string>();

    // Collect all required tools from capabilities
    for (const capability of this.capabilities) {
      for (const tool of capability.toolRequirements) {
        allRequiredTools.add(tool);
      }
    }

    const missingTools = Array.from(allRequiredTools).filter(
      (tool) => !availableTools.includes(tool)
    );

    if (missingTools.length > 0) {
      return failure(
        createSubAgentError('SUB_AGENT_MISSING_TOOLS', 'Required tools are not available', {
          subAgentId: this.id,
          missingTools,
          requiredTools: Array.from(allRequiredTools),
        })
      );
    }

    return success(undefined);
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<Result<SubAgentHealth, QiError>> {
    try {
      const issues: string[] = [];

      // Check initialization
      if (!this.isInitialized) {
        issues.push('Sub-agent not initialized');
      }

      // Check tool access
      if (this.toolExecutor) {
        const availableTools = this.toolExecutor.getAvailableTools();
        const validationResult = this.validateToolAccess(availableTools);
        match(
          () => {}, // Tool validation passed
          () => issues.push('Missing required tools'),
          validationResult
        );
      } else {
        issues.push('No tool executor configured');
      }

      // Check active task load
      const activeTaskCount = this.currentTasks.size;
      if (activeTaskCount > 10) {
        // Configurable threshold
        issues.push(`High task load: ${activeTaskCount} active tasks`);
      }

      const status =
        issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'degraded' : 'unhealthy';

      const health: SubAgentHealth = {
        status,
        lastCheck: new Date(),
        issues: issues.length > 0 ? issues : undefined,
        metrics: {
          activeTasks: activeTaskCount,
          totalTasksExecuted: this.getMetric('totalTasksExecuted') || 0,
          averageExecutionTime: this.getMetric('averageExecutionTime') || 0,
        },
      };

      return success(health);
    } catch (error) {
      return failure(
        createSubAgentError('SUB_AGENT_HEALTH_CHECK_FAILED', 'Failed to get sub-agent health', {
          subAgentId: this.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<Result<void, QiError>> {
    try {
      // Cancel any active tasks
      for (const [taskId] of this.currentTasks) {
        this.logger.warn('Cancelling active task during cleanup', {
          subAgentId: this.id,
          taskId,
        });
      }
      this.currentTasks.clear();

      // Perform sub-agent specific cleanup
      const cleanupResult = await this.onCleanup();
      match(
        () => undefined,
        (error) => {
          throw error;
        },
        cleanupResult
      );

      this.isInitialized = false;
      this.removeAllListeners();

      this.logger.info('Sub-agent cleanup completed', { subAgentId: this.id });
      return success(undefined);
    } catch (error) {
      return failure(
        createSubAgentError('SUB_AGENT_CLEANUP_FAILED', 'Failed to cleanup sub-agent', {
          subAgentId: this.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // Abstract methods to be implemented by concrete sub-agents

  /**
   * Execute the actual task logic
   */
  protected abstract executeTask(task: SubAgentTask): AsyncGenerator<SubAgentProgress>;

  /**
   * Sub-agent specific initialization
   */
  protected abstract onInitialize(config: SubAgentConfig): Promise<Result<void, QiError>>;

  /**
   * Sub-agent specific cleanup
   */
  protected abstract onCleanup(): Promise<Result<void, QiError>>;

  /**
   * Custom task handling logic
   */
  protected abstract canHandleCustom(task: SubAgentTask): Promise<Result<boolean, QiError>>;

  // Helper methods

  protected isTaskTypeCompatible(taskType: string, capability: SubAgentCapability): boolean {
    // Check if task type matches capability domains or patterns
    return (
      capability.domains.some((domain) => taskType.includes(domain)) ||
      capability.workflowPatterns?.some((pattern) => taskType.includes(pattern)) ||
      false
    );
  }

  protected getRequiredToolsForTask(_task: SubAgentTask): string[] {
    // Default implementation - return all required tools
    // Concrete sub-agents can override for task-specific requirements
    return this.capabilities.flatMap((cap) => cap.toolRequirements);
  }

  protected async executeToolSafely(
    toolName: string,
    parameters: unknown
  ): Promise<Result<unknown, QiError>> {
    try {
      if (!this.toolExecutor) {
        return failure(
          createSubAgentError('SUB_AGENT_NO_TOOL_EXECUTOR', 'No tool executor available', {
            subAgentId: this.id,
            toolName,
          })
        );
      }

      if (!this.toolExecutor.isToolAvailable(toolName)) {
        return failure(
          createSubAgentError('SUB_AGENT_TOOL_NOT_AVAILABLE', 'Tool is not available', {
            subAgentId: this.id,
            toolName,
          })
        );
      }

      return await this.toolExecutor.executeTool(toolName, parameters);
    } catch (error) {
      return failure(
        createSubAgentError('SUB_AGENT_TOOL_EXECUTION_FAILED', 'Tool execution failed', {
          subAgentId: this.id,
          toolName,
          parameters,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  protected getResourceConsumption(): Record<string, number> {
    // Override in concrete implementations to track resource usage
    return {
      memoryMB: process.memoryUsage().heapUsed / 1024 / 1024,
      cpuTimeMs: process.cpuUsage().user / 1000,
    };
  }

  protected async collectArtifacts(_task: SubAgentTask): Promise<SubAgentArtifact[]> {
    // Override in concrete implementations to collect task artifacts
    return [];
  }

  protected generateRecommendations(_task: SubAgentTask, _output: unknown): string[] {
    // Override in concrete implementations to provide recommendations
    return [];
  }

  private getMetric(_name: string): number | undefined {
    // Placeholder for metrics tracking
    // Would integrate with actual metrics system
    return undefined;
  }
}
