/**
 * Sub-Agent Core Types and Interfaces
 *
 * Defines the foundational interfaces for the Workflow-Driven Sub-Agent Architecture.
 * All interfaces use QiCore Result<T, QiError> patterns for consistent error handling.
 */

import type { QiError, Result } from '@qi/base';

/**
 * Sub-agent capability definition
 */
export interface SubAgentCapability {
  readonly type:
    | 'file_operations'
    | 'search_operations'
    | 'code_analysis'
    | 'bug_fixing'
    | 'feature_implementation'
    | 'refactoring'
    | 'documentation'
    | 'testing'
    | 'custom';
  readonly name: string;
  readonly description: string;
  readonly confidence: number; // 0-1 scale
  readonly domains: string[]; // e.g., ['typescript', 'react', 'testing']
  readonly toolRequirements: string[]; // Required tools
  readonly workflowPatterns?: string[]; // Compatible workflow patterns
}

/**
 * Sub-agent task definition
 */
export interface SubAgentTask {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly input: unknown;
  readonly context: SubAgentContext;
  readonly constraints?: SubAgentConstraint[];
  readonly expectedOutput?: string; // Description of expected result
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * Sub-agent execution context
 */
export interface SubAgentContext {
  readonly sessionId: string;
  readonly workflowId: string;
  readonly parentTaskId?: string;
  readonly availableTools: string[];
  readonly workingDirectory: string;
  readonly environment: Record<string, unknown>;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

/**
 * Sub-agent constraint
 */
export interface SubAgentConstraint {
  readonly type: 'tool_restriction' | 'time_limit' | 'file_access' | 'resource_limit' | 'custom';
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/**
 * Sub-agent progress update
 */
export interface SubAgentProgress {
  readonly taskId: string;
  readonly stage: string;
  readonly progress: number; // 0-1 scale
  readonly message?: string;
  readonly intermediateResults?: unknown;
  readonly estimatedTimeRemaining?: number; // milliseconds
}

/**
 * Sub-agent execution result
 */
export interface SubAgentResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly output: unknown;
  readonly metadata: {
    readonly executionTime: number;
    readonly toolsUsed: string[];
    readonly stagesCompleted: string[];
    readonly resourcesConsumed: Record<string, number>;
  };
  readonly artifacts?: SubAgentArtifact[];
  readonly recommendations?: string[];
}

/**
 * Sub-agent artifact (files, outputs, etc.)
 */
export interface SubAgentArtifact {
  readonly type: 'file' | 'data' | 'report' | 'code' | 'custom';
  readonly name: string;
  readonly path?: string;
  readonly content?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Sub-agent health status
 */
export interface SubAgentHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly lastCheck: Date;
  readonly issues?: string[];
  readonly metrics?: Record<string, number>;
}

/**
 * Sub-agent configuration
 */
export interface SubAgentConfig {
  readonly toolProvider: IToolExecutor;
  readonly logger: unknown; // Will be typed when integrated
  readonly workingDirectory?: string;
  readonly defaultTimeout?: number;
  readonly maxRetries?: number;
  readonly customSettings?: Record<string, unknown>;
}

/**
 * Core sub-agent interface
 */
export interface ISubAgent {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: SubAgentCapability[];

  /**
   * Check if this sub-agent can handle a specific task
   */
  canHandle(task: SubAgentTask): Promise<Result<boolean, QiError>>;

  /**
   * Execute a task with streaming progress updates
   */
  execute(task: SubAgentTask): AsyncGenerator<SubAgentProgress, SubAgentResult>;

  /**
   * Validate that required tools are available
   */
  validateToolAccess(availableTools: string[]): Result<void, QiError>;

  /**
   * Get health status of the sub-agent
   */
  getHealth(): Promise<Result<SubAgentHealth, QiError>>;

  /**
   * Initialize the sub-agent with configuration
   */
  initialize(config: SubAgentConfig): Promise<Result<void, QiError>>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<Result<void, QiError>>;
}

/**
 * Tool execution delegation interface
 */
export interface IToolExecutor {
  executeTool(toolName: string, parameters: unknown): Promise<Result<unknown, QiError>>;
  isToolAvailable(toolName: string): boolean;
  getAvailableTools(): string[];
}

/**
 * Workflow integration interfaces
 */
export interface WorkflowSubAgentNode {
  readonly nodeId: string;
  readonly subAgentId: string;
  readonly taskDefinition: Omit<SubAgentTask, 'id' | 'context'>;
  readonly errorHandling: 'fail' | 'continue' | 'retry';
  readonly retryConfig?: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
  };
}

export interface WorkflowSubAgentResult {
  readonly nodeId: string;
  readonly subAgentResult: SubAgentResult;
  readonly workflowState: Record<string, unknown>;
  readonly nextNodes?: string[];
}

/**
 * Sub-agent registry interface
 */
export interface ISubAgentRegistry {
  /**
   * Register a sub-agent in the registry
   */
  register(subAgent: ISubAgent): Promise<Result<void, QiError>>;

  /**
   * Unregister a sub-agent from the registry
   */
  unregister(subAgentId: string): Promise<Result<void, QiError>>;

  /**
   * Find sub-agents capable of handling a task
   */
  findCapable(task: SubAgentTask): Promise<Result<ISubAgent[], QiError>>;

  /**
   * Get all registered sub-agents
   */
  getAll(): Promise<Result<ISubAgent[], QiError>>;

  /**
   * Get a specific sub-agent by ID
   */
  getById(subAgentId: string): Promise<Result<ISubAgent | null, QiError>>;
}

/**
 * Sub-agent factory interface
 */
export interface ISubAgentFactory {
  /**
   * Create a sub-agent instance by type
   */
  create(type: string, config: SubAgentConfig): Promise<Result<ISubAgent, QiError>>;

  /**
   * Get available sub-agent types
   */
  getAvailableTypes(): string[];

  /**
   * Check if a sub-agent type is supported
   */
  supports(type: string): boolean;
}
