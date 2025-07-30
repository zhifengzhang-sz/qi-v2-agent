// Prompt Handler Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { ProcessingContext } from './cognitive-patterns.js';
import type { ModelConfiguration } from './models.js';

/**
 * Prompt request
 */
export interface PromptRequest {
  readonly input: string;
  readonly context?: ProcessingContext;
  readonly templateId?: string;
  readonly parameters?: ReadonlyMap<string, unknown>;
}

/**
 * Prompt response
 */
export interface PromptResponse {
  readonly content: string;
  readonly templateUsed?: string;
  readonly modelUsed: string;
  readonly usage?: TokenUsage;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * Prompt stream chunk
 */
export interface PromptStreamChunk {
  readonly content: string;
  readonly isComplete: boolean;
  readonly metadata?: ReadonlyMap<string, unknown>;
}

/**
 * Prompt template
 */
export interface PromptTemplate {
  readonly id: string;
  readonly name: string;
  readonly template: string;
  readonly parameters: readonly string[];
  readonly description: string;
}

/**
 * Prompt handler interface - processes input text and handles template rendering
 */
export interface IPromptHandler {
  handlePrompt(request: PromptRequest): Promise<PromptResponse>;
  streamPrompt(request: PromptRequest): AsyncIterableIterator<PromptStreamChunk>;
  renderTemplate(template: PromptTemplate, parameters: ReadonlyMap<string, unknown>): Promise<string>;
  getSupportedTemplates(): readonly string[];
}

/**
 * Prompt manager interface - manages templates and model configurations
 * Provider selection logic is externalized to routing engines
 */
export interface IPromptManager {
  loadTemplate(templateId: string): Promise<PromptTemplate>;
  getAvailableTemplates(): readonly PromptTemplate[];
  getModelConfiguration(providerId: string, modelId: string): Promise<ModelConfiguration>;
  getAvailableModels(providerId?: string): Promise<readonly ModelConfiguration[]>;
}