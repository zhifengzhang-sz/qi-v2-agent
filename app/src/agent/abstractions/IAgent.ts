/**
 * Agent Module - Abstract Interfaces
 * 
 * Defines contracts for the AI agent without any implementation details.
 * The agent orchestrates classification, command execution, prompt processing, and workflows.
 */

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
    readonly commandTimeout?: number;
    readonly promptTimeout?: number;
    readonly workflowTimeout?: number;
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
 * Agent streaming chunk
 */
export interface AgentStreamChunk {
  readonly type: 'classification' | 'processing' | 'result' | 'error';
  readonly content: string;
  readonly isComplete: boolean;
  readonly metadata?: ReadonlyMap<string, unknown>;
  readonly error?: string;
}