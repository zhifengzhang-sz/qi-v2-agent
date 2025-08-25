/**
 * Agent Module - Abstract Interfaces
 *
 * Defines contracts for the AI agent without any implementation details.
 * The agent orchestrates classification, command execution, prompt processing, and workflows.
 */

import type { QiError, Result } from '@qi/base';

/**
 * Agent input request
 */
export interface AgentRequest {
  readonly input: string;
  readonly context: AgentContext;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly environmentContext?: ReadonlyMap<string, unknown>;
}

/**
 * Agent response
 */
export interface AgentResponse {
  readonly content: string;
  readonly type: 'command' | 'prompt' | 'workflow';
  readonly confidence: number;
  readonly executionTime: number;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Agent configuration with embedded config handling (following prompt module pattern)
 */
export interface AgentConfig {
  readonly domain: string;
  readonly enableCommands?: boolean;
  readonly enablePrompts?: boolean;
  readonly enableWorkflows?: boolean;
  readonly sessionPersistence?: boolean;
  readonly configPath?: string;
  readonly providers?: {
    readonly modelProvider?: string;
    readonly toolProvider?: string;
    readonly memoryProvider?: string;
  };
  readonly timeouts?: {
    readonly classification?: number; // Classification timeout (ms)
    readonly commandExecution?: number; // Command timeout (ms)
    readonly promptProcessing?: number; // Prompt timeout (ms)
    readonly workflowExecution?: number; // Workflow timeout (ms)
  };
  readonly retries?: {
    readonly maxRetries?: number;
    readonly retryDelay?: number;
  };
}

/**
 * Agent status information
 */
export interface AgentStatus {
  readonly isInitialized: boolean;
  readonly domain: string;
  readonly uptime: number;
  readonly requestsProcessed: number;
  readonly averageResponseTime: number;
  readonly lastActivity?: Date;
}

/**
 * Abstract agent interface
 */
export interface IAgent {
  /**
   * Initialize the agent
   */
  initialize(): Promise<void>;

  /**
   * Process a request
   */
  process(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Stream a request for real-time responses
   */
  stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk>;

  /**
   * Get agent status
   */
  getStatus(): AgentStatus;

  /**
   * Shutdown the agent
   */
  shutdown(): Promise<void>;
}

/**
 * Agent streaming chunk - aligned with docs specification
 */
export interface AgentStreamChunk {
  readonly type: 'classification' | 'processing' | 'completion' | 'error';
  readonly content: string;
  readonly isComplete: boolean;
  readonly metadata?: ReadonlyMap<string, unknown>;
  readonly error?: string;
}

/**
 * Agent streaming data types
 */
export interface ClassificationData {
  readonly type: 'command' | 'prompt' | 'workflow';
  readonly confidence: number;
  readonly method: string;
}

export interface CompletionData {
  readonly executionTime: number;
  readonly performance: {
    readonly classificationTime?: number;
    readonly processingTime?: number;
    readonly totalTime: number;
  };
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Subagent integration interfaces - foundation for future implementation
 */
export interface SubagentDefinition {
  readonly name: string;
  readonly description: string;
  readonly tools?: string[];
  readonly model?: string;
  readonly maxTurns?: number;
  readonly permissionMode?: 'strict' | 'permissive';
  readonly systemPrompt: string;
}

export interface DelegationCriteria {
  readonly taskType: string;
  readonly requiredTools: string[];
  readonly contextSize: number;
  readonly priority: 'low' | 'medium' | 'high';
}

export interface ISubagentRegistry {
  discover(query: string): Promise<Result<SubagentDefinition[], QiError>>;
  invoke(name: string, prompt: string): Promise<Result<AgentResponse, QiError>>;
  register(agent: SubagentDefinition): Result<void, QiError>;
}

export interface IAgentOrchestrator {
  delegate(task: string, criteria: DelegationCriteria): Promise<Result<AgentResponse, QiError>>;
}
