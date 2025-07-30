// Agent Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { 
  DomainConfiguration, 
  CognitivePattern, 
  ProcessingContext 
} from './cognitive-patterns.js';
import type { IInputClassifier } from './input-classification.js';
import type { ICommandHandler, CommandDefinition } from './commands.js';
import type { IPromptHandler, IPromptManager } from './prompts.js';
import type { IWorkflowExtractor, WorkflowMode, WorkflowPerformance } from './workflows.js';
import type { IPatternMatcher } from './cognitive-patterns.js';
import type { IWorkflowEngine } from './workflows.js';
import type { IModelProvider } from './models.js';
import type { IToolProvider, ToolDefinition } from './tools.js';
import type { IMemoryProvider } from './memory.js';

/**
 * Agent configuration (updated for three-type classification)
 */
export interface AgentConfiguration {
  readonly domain: DomainConfiguration;
  readonly inputClassifier: IInputClassifier;
  readonly commandHandler: ICommandHandler;
  readonly promptHandler: IPromptHandler;
  readonly promptManager: IPromptManager;
  readonly workflowExtractor: IWorkflowExtractor;
  readonly patternMatcher: IPatternMatcher;  // Kept for backward compatibility
  readonly workflowEngine: IWorkflowEngine;
  readonly modelProvider: IModelProvider;
  readonly toolProvider: IToolProvider;  
  readonly memoryProvider?: IMemoryProvider;
}

/**
 * Agent request
 */
export interface AgentRequest {
  readonly input: string;
  readonly context?: ProcessingContext;
  readonly options?: AgentOptions;
}

/**
 * Agent options
 */
export interface AgentOptions {
  readonly forcePattern?: string;
  readonly streaming?: boolean;
  readonly sessionId?: string;
  readonly timeout?: number;
  readonly retryPolicy?: RetryPolicy;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffStrategy: 'linear' | 'exponential';
  readonly retryableErrors: readonly string[];
}

/**
 * Agent response (updated for three-type classification)
 */
export interface AgentResponse {
  readonly success: boolean;
  readonly content: string;
  readonly inputType: 'command' | 'prompt' | 'workflow';
  readonly workflowMode?: string;
  readonly pattern?: CognitivePattern;  // Optional for backward compatibility
  readonly toolsUsed: readonly string[];
  readonly performance: WorkflowPerformance;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly error?: string;
  readonly isComplete?: boolean;  // For streaming compatibility
}

/**
 * Agent stream chunk (updated for three-type classification)
 */
export interface AgentStreamChunk {
  readonly content: string;
  readonly inputType?: 'command' | 'prompt' | 'workflow';
  readonly workflowMode?: string;
  readonly pattern?: CognitivePattern;  // Optional for backward compatibility
  readonly currentStage?: string;
  readonly isComplete: boolean;
  readonly error?: Error;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly components: ReadonlyMap<string, ComponentHealth>;
  readonly timestamp: Date;
}

/**
 * Component health
 */
export interface ComponentHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latency?: number;
  readonly errorRate?: number;
  readonly details?: string;
}

/**
 * Main agent interface (updated for three-type classification)
 */
export interface IAgent {
  initialize(): Promise<void>;
  process(request: AgentRequest): Promise<AgentResponse>;
  stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk>;
  
  getDomainConfiguration(): DomainConfiguration;
  getSupportedInputTypes(): readonly string[];
  getAvailableCommands(): readonly CommandDefinition[];
  getSupportedWorkflowModes(): readonly WorkflowMode[];
  getAvailablePatterns(): readonly CognitivePattern[];  // Kept for backward compatibility
  getAvailableTools(): Promise<readonly ToolDefinition[]>;
  
  healthCheck(): Promise<HealthCheckResult>;
  cleanup(): Promise<void>;
}