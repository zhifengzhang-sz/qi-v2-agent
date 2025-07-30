// Tool Provider Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { CognitivePattern } from './cognitive-patterns.js';

/**
 * Tool definition
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;
  readonly outputSchema: ToolSchema;
  readonly category: string;
  readonly capabilities: ToolCapabilities;
}

/**
 * Tool schema
 */
export interface ToolSchema {
  readonly type: string;
  readonly properties: ReadonlyMap<string, ToolSchemaProperty>;
  readonly required: readonly string[];
}

/**
 * Tool schema property
 */
export interface ToolSchemaProperty {
  readonly type: string;
  readonly description: string;
  readonly enum?: readonly string[];
  readonly format?: string;
}

/**
 * Tool capabilities
 */
export interface ToolCapabilities {
  readonly isAsync: boolean;
  readonly supportsStreaming: boolean;
  readonly requiresConfirmation: boolean;
  readonly maxExecutionTime: number;
  readonly resourceRequirements: readonly string[];
}

/**
 * Tool request
 */
export interface ToolRequest {
  readonly toolName: string;
  readonly parameters: ReadonlyMap<string, unknown>;
  readonly context: ReadonlyMap<string, unknown>;
  readonly executionOptions: ToolExecutionOptions;
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  readonly timeout?: number;
  readonly retryCount?: number;
  readonly confirmationRequired?: boolean;
  readonly streaming?: boolean;
}

/**
 * Tool result
 */
export interface ToolResult {
  readonly toolName: string;
  readonly status: 'success' | 'error' | 'timeout' | 'cancelled';
  readonly data?: unknown;
  readonly error?: string;
  readonly executionTime: number;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Tool stream chunk
 */
export interface ToolStreamChunk {
  readonly toolName: string;
  readonly data: unknown;
  readonly isComplete: boolean;
  readonly error?: string;
}

/**
 * Abstract tool provider interface
 */
export interface IToolProvider {
  getAvailableTools(pattern?: CognitivePattern): Promise<readonly ToolDefinition[]>;
  executeTool(request: ToolRequest): Promise<ToolResult>;
  streamTool(request: ToolRequest): AsyncIterableIterator<ToolStreamChunk>;
  validateTool(toolName: string, parameters: ReadonlyMap<string, unknown>): Promise<boolean>;
  getToolsForDomain(domain: string): Promise<readonly ToolDefinition[]>;
}