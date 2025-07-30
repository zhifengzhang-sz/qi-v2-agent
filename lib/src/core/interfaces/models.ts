// Model Provider Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { ConfigurationSection } from './utils.js';
import type { TokenUsage } from './prompts.js';

/**
 * Model configuration section from config file
 */
export interface ModelConfigurationSection extends ConfigurationSection {
  readonly name: string;
  readonly temperature: number;
  readonly baseUrl: string;
  readonly thinkingEnabled: boolean;
}

/**
 * Model configuration
 */
export interface ModelConfiguration {
  readonly id: string;
  readonly name: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly parameters: ModelParameters;
  readonly capabilities: ModelCapabilities;
}

/**
 * Model parameters
 */
export interface ModelParameters {
  readonly temperature: number;
  readonly maxTokens: number;
  readonly topP?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stopSequences?: readonly string[];
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsToolCalling: boolean;
  readonly supportsSystemMessages: boolean;
  readonly maxContextLength: number;
  readonly supportedMessageTypes: readonly string[];
}

/**
 * Model message
 */
export interface ModelMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly metadata?: ReadonlyMap<string, unknown>;
}

/**
 * Model request
 */
export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly configuration: ModelConfiguration;
  readonly context: ReadonlyMap<string, unknown>;
  readonly options?: {
    readonly model?: string;
    readonly temperature?: number;
    readonly stream?: boolean;
    readonly [key: string]: unknown;
  };
}

/**
 * Model response
 */
export interface ModelResponse {
  readonly content: string;
  readonly finishReason: 'completed' | 'length' | 'stop' | 'tool_call';
  readonly usage: TokenUsage;
  readonly metadata: ReadonlyMap<string, unknown>;
}


/**
 * Model stream chunk
 */
export interface ModelStreamChunk {
  readonly content: string;
  readonly isComplete: boolean;
  readonly usage?: TokenUsage;
  readonly metadata?: ReadonlyMap<string, unknown>;
}

/**
 * Abstract model provider interface
 */
export interface IModelProvider {
  getAvailableModels(): Promise<readonly ModelConfiguration[]>;
  invoke(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk>;
  validateConfiguration(config: ModelConfiguration): Promise<boolean>;
  estimateTokens(messages: readonly ModelMessage[]): Promise<number>;
}