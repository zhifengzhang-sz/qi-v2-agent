/**
 * QiCore-based implementation of IWorkflowManager
 *
 * Uses proper qicore Result<T> patterns for professional error handling
 * Encapsulates all tools internally following the prompt module pattern
 */

import { create, failure, type QiError, type Result, success } from '@qi/base';
// Internal tool imports - hidden from external users
import {
  FileContentResolver,
  FileReferenceParser,
  ProjectStructureScanner,
  SessionManager,
  type ToolMetadata,
  ToolRegistry,
} from '../../tools/index.js';
import { FileReferenceWorkflow } from '../FileReferenceWorkflow.js';
import type {
  IWorkflowManager,
  ToolInfo,
  ToolInitializationConfig,
  WorkflowInfo,
  WorkflowInput,
  WorkflowManagerStats,
} from '../interfaces/IWorkflowManager.js';
import {
  type SimpleWorkflow,
  SimpleWorkflowClass,
  type WorkflowResult,
} from '../SimpleWorkflow.js';

interface WorkflowManagerError extends QiError {
  context: {
    workflowType?: string;
    operation?: string;
    toolCount?: number;
    error?: string;
  };
}

const workflowError = (
  code: string,
  message: string,
  category: 'VALIDATION' | 'SYSTEM' | 'NETWORK' | 'BUSINESS',
  context: WorkflowManagerError['context'] = {}
): WorkflowManagerError => create(code, message, category, context) as WorkflowManagerError;

export class QiCoreWorkflowManager implements IWorkflowManager {
  // Internal tool management - completely hidden from external users
  private toolRegistry: ToolRegistry;
  private fileResolver: FileContentResolver | null = null;
  private projectScanner: ProjectStructureScanner | null = null;
  private referenceParser: FileReferenceParser | null = null;
  private sessionManager: SessionManager | null = null;

  // Workflow management
  private workflows = new Map<SimpleWorkflowClass, SimpleWorkflow>();
  private initialized = false;

  // Statistics tracking
  private stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalExecutionTime: 0,
    workflowCounts: new Map<SimpleWorkflowClass, number>(),
    toolCounts: new Map<string, number>(),
  };

  constructor() {
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Initialize all tools and workflows with configuration
   */
  async initializeTools(
    config: ToolInitializationConfig = {
      enableFileContentResolver: true,
      enableProjectStructureScanner: true,
      enableFileReferenceParser: true,
      enableSessionManager: true,
    }
  ): Promise<Result<void, QiError>> {
    try {
      // Initialize internal tools based on configuration
      const initResults: Result<void, QiError>[] = [];

      if (config.enableFileContentResolver) {
        const resolverResult = this.initializeFileContentResolver();
        initResults.push(resolverResult);
      }

      if (config.enableProjectStructureScanner) {
        const scannerResult = this.initializeProjectStructureScanner(config.scannerConfig);
        initResults.push(scannerResult);
      }

      if (config.enableFileReferenceParser) {
        const parserResult = this.initializeFileReferenceParser();
        initResults.push(parserResult);
      }

      if (config.enableSessionManager) {
        const sessionResult = this.initializeSessionManager(config.sessionConfig);
        initResults.push(sessionResult);
      }

      // Check if any initialization failed
      for (const result of initResults) {
        if (result.tag === 'failure') {
          return result;
        }
      }

      // Register workflows
      const workflowResult = this.registerDefaultWorkflows();
      if (workflowResult.tag === 'failure') {
        return workflowResult;
      }

      this.initialized = true;
      return success(undefined);
    } catch (error) {
      return failure(
        workflowError(
          'INITIALIZATION_FAILED',
          `Tool initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { operation: 'initializeTools', error: String(error) }
        )
      );
    }
  }

  /**
   * Execute a workflow with the given input
   */
  async executeWorkflow(input: WorkflowInput): Promise<Result<WorkflowResult, QiError>> {
    if (!this.initialized) {
      return failure(
        workflowError(
          'NOT_INITIALIZED',
          'WorkflowManager not initialized. Call initializeTools() first.',
          'SYSTEM',
          { operation: 'executeWorkflow' }
        )
      );
    }

    const validationResult = this.validateWorkflowInput(input);
    if (validationResult.tag === 'failure') {
      return validationResult;
    }

    const startTime = Date.now();

    try {
      const workflow = this.workflows.get(input.type);
      if (!workflow) {
        return failure(
          workflowError(
            'WORKFLOW_NOT_FOUND',
            `Workflow type '${input.type}' is not supported`,
            'VALIDATION',
            {
              workflowType: input.type,
              operation: 'executeWorkflow',
            }
          )
        );
      }

      // Convert new WorkflowInput format to legacy format for existing workflows
      const legacyInput = {
        originalInput: input.content,
        classification: input.type,
        sessionId: input.sessionId,
        projectPath: input.projectPath,
        metadata: new Map(Object.entries(input.context || {})),
      };

      if (!workflow.canHandle(legacyInput)) {
        return failure(
          workflowError(
            'WORKFLOW_CANNOT_HANDLE',
            `Workflow '${input.type}' cannot handle the provided input`,
            'VALIDATION',
            { workflowType: input.type, operation: 'canHandle' }
          )
        );
      }

      const result = await workflow.execute(legacyInput);

      // Update statistics
      const executionTime = Date.now() - startTime;
      this.updateStats(input.type, result.success, executionTime);

      if (!result.success) {
        return failure(
          workflowError(
            'WORKFLOW_EXECUTION_FAILED',
            result.error || 'Workflow execution failed',
            'SYSTEM',
            { workflowType: input.type, operation: 'execute', error: result.error }
          )
        );
      }

      return success(result);
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(input.type, false, executionTime);

      return failure(
        workflowError(
          'WORKFLOW_EXECUTION_ERROR',
          `Workflow execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { workflowType: input.type, operation: 'execute', error: String(error) }
        )
      );
    }
  }

  /**
   * Get information about all registered workflows
   */
  getWorkflowInfo(): Result<WorkflowInfo[], QiError> {
    if (!this.initialized) {
      return failure(
        workflowError('NOT_INITIALIZED', 'WorkflowManager not initialized', 'SYSTEM', {
          operation: 'getWorkflowInfo',
        })
      );
    }

    const workflowInfos: WorkflowInfo[] = [];

    for (const [workflowClass, workflow] of this.workflows) {
      workflowInfos.push({
        id: workflowClass,
        name: workflowClass.replace('-', ' ').toUpperCase(),
        description: workflow.getDescription(),
        initialized: true,
        stats: {
          totalExecutions: this.stats.workflowCounts.get(workflowClass) || 0,
          successCount: 0, // TODO: track per-workflow success
          avgExecutionTime:
            this.stats.totalExecutions > 0
              ? this.stats.totalExecutionTime / this.stats.totalExecutions
              : 0,
        },
      });
    }

    return success(workflowInfos);
  }

  /**
   * Get information about all available tools
   */
  getToolInfo(): Result<ToolInfo[], QiError> {
    if (!this.initialized) {
      return failure(
        workflowError('NOT_INITIALIZED', 'WorkflowManager not initialized', 'SYSTEM', {
          operation: 'getToolInfo',
        })
      );
    }

    const toolInfos: ToolInfo[] = [];
    const toolMetadata = this.toolRegistry.listTools();

    for (const meta of toolMetadata) {
      toolInfos.push({
        id: meta.name,
        name: meta.name,
        description: meta.description,
        category: meta.category,
        initialized: this.toolRegistry.has(meta.name),
        stats: {
          totalUses: this.stats.toolCounts.get(meta.name) || 0,
          successCount: 0, // TODO: track per-tool success
          avgExecutionTime:
            this.stats.totalExecutions > 0
              ? this.stats.totalExecutionTime / this.stats.totalExecutions
              : 0,
        },
      });
    }

    return success(toolInfos);
  }

  /**
   * Check if a specific workflow type is available
   */
  isWorkflowAvailable(workflowClass: SimpleWorkflowClass): Result<boolean, QiError> {
    return success(this.workflows.has(workflowClass));
  }

  /**
   * Get detailed execution statistics
   */
  getStats(): Result<WorkflowManagerStats, QiError> {
    const averageExecutionTime =
      this.stats.totalExecutions > 0
        ? this.stats.totalExecutionTime / this.stats.totalExecutions
        : 0;

    const stats: WorkflowManagerStats = {
      totalExecutions: this.stats.totalExecutions,
      successfulExecutions: this.stats.successfulExecutions,
      failedExecutions: this.stats.failedExecutions,
      averageExecutionTime,
      workflowCounts: new Map(this.stats.workflowCounts),
      toolCounts: new Map(this.stats.toolCounts),
    };

    return success(stats);
  }

  /**
   * Register a new workflow (internal use)
   */
  registerWorkflow(workflow: SimpleWorkflow): Result<void, QiError> {
    const workflowClass = workflow.getWorkflowClass();

    if (this.workflows.has(workflowClass)) {
      return failure(
        workflowError(
          'WORKFLOW_ALREADY_REGISTERED',
          `Workflow for class '${workflowClass}' is already registered`,
          'VALIDATION',
          { workflowType: workflowClass, operation: 'registerWorkflow' }
        )
      );
    }

    this.workflows.set(workflowClass, workflow);
    return success(undefined);
  }

  /**
   * Clean up resources and shutdown
   */
  async shutdown(): Promise<Result<void, QiError>> {
    try {
      await this.toolRegistry.clear();
      this.workflows.clear();
      this.initialized = false;
      return success(undefined);
    } catch (error) {
      return failure(
        workflowError(
          'SHUTDOWN_FAILED',
          `Shutdown failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { operation: 'shutdown', error: String(error) }
        )
      );
    }
  }

  // Private methods for internal tool management

  private initializeFileContentResolver(): Result<void, QiError> {
    try {
      this.fileResolver = new FileContentResolver();
      const metadata: ToolMetadata = {
        name: 'FileContentResolver',
        description: 'Resolves and reads file contents',
        version: '1.0.0',
        category: 'files',
        dependencies: [],
        tags: ['file', 'content', 'resolver'],
      };
      this.toolRegistry.register(this.fileResolver, metadata);
      return success(undefined);
    } catch (error) {
      return failure(
        workflowError(
          'TOOL_INIT_FAILED',
          `FileContentResolver initialization failed: ${error}`,
          'SYSTEM',
          { operation: 'initializeFileContentResolver', error: String(error) }
        )
      );
    }
  }

  private initializeProjectStructureScanner(_config?: {
    maxDepth?: number;
    excludePatterns?: string[];
  }): Result<void, QiError> {
    try {
      this.projectScanner = new ProjectStructureScanner();
      const metadata: ToolMetadata = {
        name: 'ProjectStructureScanner',
        description: 'Scans and analyzes project structure',
        version: '1.0.0',
        category: 'analysis',
        dependencies: [],
        tags: ['project', 'structure', 'scanner'],
      };
      this.toolRegistry.register(this.projectScanner, metadata);
      return success(undefined);
    } catch (error) {
      return failure(
        workflowError(
          'TOOL_INIT_FAILED',
          `ProjectStructureScanner initialization failed: ${error}`,
          'SYSTEM',
          { operation: 'initializeProjectStructureScanner', error: String(error) }
        )
      );
    }
  }

  private initializeFileReferenceParser(): Result<void, QiError> {
    try {
      this.referenceParser = new FileReferenceParser();
      const metadata: ToolMetadata = {
        name: 'FileReferenceParser',
        description: 'Parses file references from input text',
        version: '1.0.0',
        category: 'parsing',
        dependencies: [],
        tags: ['file', 'reference', 'parser'],
      };
      this.toolRegistry.register(this.referenceParser, metadata);
      return success(undefined);
    } catch (error) {
      return failure(
        workflowError(
          'TOOL_INIT_FAILED',
          `FileReferenceParser initialization failed: ${error}`,
          'SYSTEM',
          { operation: 'initializeFileReferenceParser', error: String(error) }
        )
      );
    }
  }

  private initializeSessionManager(_config?: {
    maxSessions?: number;
    sessionTimeout?: number;
  }): Result<void, QiError> {
    try {
      this.sessionManager = new SessionManager();
      const metadata: ToolMetadata = {
        name: 'SessionManager',
        description: 'Manages user sessions and context',
        version: '1.0.0',
        category: 'context',
        dependencies: [],
        tags: ['session', 'context', 'manager'],
      };
      this.toolRegistry.register(this.sessionManager, metadata);
      return success(undefined);
    } catch (error) {
      return failure(
        workflowError(
          'TOOL_INIT_FAILED',
          `SessionManager initialization failed: ${error}`,
          'SYSTEM',
          { operation: 'initializeSessionManager', error: String(error) }
        )
      );
    }
  }

  private registerDefaultWorkflows(): Result<void, QiError> {
    try {
      const fileReferenceWorkflow = new FileReferenceWorkflow(this.toolRegistry);
      return this.registerWorkflow(fileReferenceWorkflow);
    } catch (error) {
      return failure(
        workflowError(
          'WORKFLOW_REGISTRATION_FAILED',
          `Default workflow registration failed: ${error}`,
          'SYSTEM',
          { operation: 'registerDefaultWorkflows', error: String(error) }
        )
      );
    }
  }

  private validateWorkflowInput(input: WorkflowInput): Result<void, QiError> {
    if (!input.content || input.content.trim().length === 0) {
      return failure(
        workflowError('INVALID_INPUT', 'Workflow input content cannot be empty', 'VALIDATION', {
          operation: 'validateWorkflowInput',
        })
      );
    }

    if (!Object.values(SimpleWorkflowClass).includes(input.type)) {
      return failure(
        workflowError(
          'INVALID_WORKFLOW_TYPE',
          `Invalid workflow type: ${input.type}`,
          'VALIDATION',
          { workflowType: input.type, operation: 'validateWorkflowInput' }
        )
      );
    }

    return success(undefined);
  }

  private updateStats(
    workflowClass: SimpleWorkflowClass,
    success: boolean,
    executionTime: number
  ): void {
    this.stats.totalExecutions++;
    this.stats.totalExecutionTime += executionTime;

    if (success) {
      this.stats.successfulExecutions++;
    } else {
      this.stats.failedExecutions++;
    }

    const currentCount = this.stats.workflowCounts.get(workflowClass) || 0;
    this.stats.workflowCounts.set(workflowClass, currentCount + 1);
  }
}
