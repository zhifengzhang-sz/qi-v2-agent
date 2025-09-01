/**
 * Sub-Agent Module (AgentChat Abstraction)
 * 
 * Single-agent task execution, tool coordination, conversation management,
 * and AgentChat framework integration.
 */

import type { Result, QiError } from '@qi/base';

// Core Types
export interface AgentTask {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly context: string;
  readonly requiredTools?: string[];
  readonly timeout?: number;
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly metadata?: Record<string, unknown>;
}

export interface AgentResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly output: unknown;
  readonly metadata: {
    executionTime: number;
    toolsUsed: string[];
    conversationTurns: number;
    specializationUsed?: string;
  };
  readonly error?: string;
  readonly artifacts?: Array<{
    type: string;
    content: unknown;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ConversationTurn {
  readonly id: string;
  readonly timestamp: Date;
  readonly input: string;
  readonly output: string;
  readonly toolsUsed: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface AgentSpecialization {
  readonly name: string;
  readonly description: string;
  readonly capabilities: string[];
  readonly toolRequirements: string[];
  readonly domains: string[];
  readonly performanceMetrics?: {
    successRate: number;
    averageResponseTime: number;
    qualityScore: number;
  };
}

export interface ToolCoordinationRequest {
  readonly tools: string[];
  readonly parameters: Record<string, unknown>;
  readonly parallelExecution?: boolean;
  readonly failureStrategy?: 'abort' | 'continue' | 'retry';
}

export interface ToolCoordinationResult {
  readonly success: boolean;
  readonly results: Array<{
    tool: string;
    success: boolean;
    output: unknown;
    executionTime: number;
    error?: string;
  }>;
  readonly totalExecutionTime: number;
  readonly failedTools: string[];
}

// Core Interface
export interface ISubAgent {
  /**
   * Execute a single task
   */
  executeTask(task: AgentTask): Promise<Result<AgentResult, QiError>>;

  /**
   * Handle conversational interaction
   */
  handleConversation(input: string, contextId?: string): Promise<Result<string, QiError>>;

  /**
   * Coordinate multiple tools for task execution
   */
  coordinateTools(request: ToolCoordinationRequest): Promise<Result<ToolCoordinationResult, QiError>>;

  /**
   * Specialize agent for specific domain
   */
  specializeFor(specialization: AgentSpecialization): Promise<Result<ISubAgent, QiError>>;

  /**
   * Get conversation history
   */
  getConversationHistory(contextId: string): Result<ConversationTurn[], QiError>;

  /**
   * Clear conversation context
   */
  clearConversation(contextId: string): Result<void, QiError>;

  /**
   * Get available specializations
   */
  getAvailableSpecializations(): Result<AgentSpecialization[], QiError>;
}

// Configuration
export interface SubAgentConfig {
  readonly maxConversationTurns?: number;
  readonly defaultTimeout?: number;
  readonly enableToolCoordination?: boolean;
  readonly agentChatConfig?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
  };
  readonly specializations?: AgentSpecialization[];
  readonly toolConfig?: {
    maxConcurrentTools: number;
    retryAttempts: number;
    timeoutMs: number;
  };
}

// AgentChat Integration Types
export interface AgentChatAdapter {
  initialize(config: SubAgentConfig['agentChatConfig']): Promise<Result<void, QiError>>;
  createAgent(specialization?: AgentSpecialization): Promise<Result<string, QiError>>;
  executeTask(agentId: string, task: AgentTask): Promise<Result<AgentResult, QiError>>;
  handleConversation(agentId: string, input: string): Promise<Result<string, QiError>>;
  cleanup(agentId: string): Promise<Result<void, QiError>>;
}

// Specialized Agent Types
export interface FileOpsAgent extends ISubAgent {
  readFile(path: string): Promise<Result<string, QiError>>;
  writeFile(path: string, content: string): Promise<Result<void, QiError>>;
  listFiles(directory: string): Promise<Result<string[], QiError>>;
  searchFiles(pattern: string, directory?: string): Promise<Result<string[], QiError>>;
}

export interface WebAgent extends ISubAgent {
  fetchUrl(url: string): Promise<Result<string, QiError>>;
  searchWeb(query: string): Promise<Result<Array<{title: string, url: string, snippet: string}>, QiError>>;
  extractContent(url: string, selector?: string): Promise<Result<string, QiError>>;
}

export interface GitAgent extends ISubAgent {
  getStatus(): Promise<Result<string, QiError>>;
  createCommit(message: string, files?: string[]): Promise<Result<string, QiError>>;
  createBranch(name: string): Promise<Result<void, QiError>>;
  switchBranch(name: string): Promise<Result<void, QiError>>;
}

// Implementation
export class SubAgent implements ISubAgent {
  private agentChatAdapter?: AgentChatAdapter;

  constructor(private config: SubAgentConfig = {}) {}

  async executeTask(task: AgentTask): Promise<Result<AgentResult, QiError>> {
    // Implementation pending
    throw new Error('SubAgent.executeTask implementation pending');
  }

  async handleConversation(input: string, contextId?: string): Promise<Result<string, QiError>> {
    // Implementation pending
    throw new Error('SubAgent.handleConversation implementation pending');
  }

  async coordinateTools(request: ToolCoordinationRequest): Promise<Result<ToolCoordinationResult, QiError>> {
    // Implementation pending
    throw new Error('SubAgent.coordinateTools implementation pending');
  }

  async specializeFor(specialization: AgentSpecialization): Promise<Result<ISubAgent, QiError>> {
    // Implementation pending
    throw new Error('SubAgent.specializeFor implementation pending');
  }

  getConversationHistory(contextId: string): Result<ConversationTurn[], QiError> {
    // Implementation pending
    throw new Error('SubAgent.getConversationHistory implementation pending');
  }

  clearConversation(contextId: string): Result<void, QiError> {
    // Implementation pending
    throw new Error('SubAgent.clearConversation implementation pending');
  }

  getAvailableSpecializations(): Result<AgentSpecialization[], QiError> {
    // Implementation pending
    throw new Error('SubAgent.getAvailableSpecializations implementation pending');
  }
}

// Factory Functions
export function createSubAgent(config: SubAgentConfig = {}): ISubAgent {
  return new SubAgent(config);
}

export function createFileOpsAgent(config: SubAgentConfig = {}): FileOpsAgent {
  // Implementation pending
  throw new Error('createFileOpsAgent implementation pending');
}

export function createWebAgent(config: SubAgentConfig = {}): WebAgent {
  // Implementation pending
  throw new Error('createWebAgent implementation pending');
}

export function createGitAgent(config: SubAgentConfig = {}): GitAgent {
  // Implementation pending
  throw new Error('createGitAgent implementation pending');
}