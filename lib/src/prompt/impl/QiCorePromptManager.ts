/**
 * QiCore-based implementation of IPromptManager
 *
 * Uses proper qicore Result<T> patterns for professional error handling
 * Extracted from the working multi-llm-demo.ts
 */

import {
  create,
  Err,
  type ErrorCategory,
  fromAsyncTryCatch,
  match,
  Ok,
  type QiError,
  type Result,
  validationError,
} from '@qi/base';
import { ConfigBuilder } from '@qi/core';
import { type ChatModel, igniteEngine, type LlmEngine, loadModels, Message } from 'multi-llm-ts';
import type {
  IPromptManager,
  LLMConfig,
  LLMProviderConfig,
  PromptExecutionOptions,
  ProviderStatusMap,
} from '../interfaces/IPromptManager.js';

interface LLMError extends QiError {
  context: {
    provider?: string;
    model?: string;
    operation?: string;
    availableProviders?: string[];
    error?: string;
  };
}

interface ProviderEngine {
  id: string;
  name: string;
  engine: LlmEngine;
  models: ChatModel[];
}

const llmError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: LLMError['context'] = {}
): LLMError => create(code, message, category, context) as LLMError;

export class QiCorePromptManager implements IPromptManager {
  private engines: Map<string, ProviderEngine> = new Map();
  private config: LLMConfig | null = null;

  async loadConfig(configPath: string, schemaPath: string): Promise<Result<LLMConfig, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const builderResult = await ConfigBuilder.fromYamlFile(configPath);
        const config = match(
          (builder: unknown) =>
            match(
              (validatedConfig: unknown) => validatedConfig,
              (error: QiError) => {
                throw new Error(`Config validation failed: ${error.message}`);
              },
              (
                builder as {
                  validateWithSchemaFile: (path: string) => {
                    build: () => Result<unknown, QiError>;
                  };
                }
              )
                .validateWithSchemaFile(schemaPath)
                .build()
            ),
          (error: QiError) => {
            throw new Error(`Config loading failed: ${error.message}`);
          },
          builderResult
        );

        // Extract LLM config
        const llmSection = match(
          (section: LLMConfig['llm']) => section,
          (error: QiError) => {
            throw new Error(`LLM config not found: ${error.message}`);
          },
          (config as { get: (key: string) => Result<LLMConfig['llm'], QiError> }).get('llm')
        );

        const llmConfig: LLMConfig = { llm: llmSection };
        this.config = llmConfig;
        return llmConfig;
      },
      (error: unknown) =>
        validationError(
          `Config loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
    );
  }

  async initializeProviders(config: LLMConfig): Promise<Result<void, QiError>> {
    this.config = config;
    this.engines.clear();

    const initResults: Array<Result<ProviderEngine, LLMError>> = [];

    for (const [providerId, provider] of Object.entries(config.llm.providers)) {
      if (!provider.enabled) {
        continue;
      }

      const initResult = await this.initializeProvider(providerId, provider);
      initResults.push(initResult);

      match(
        (engine: ProviderEngine) => {
          this.engines.set(providerId, engine);
        },
        () => {
          // Error already logged, just continue
        },
        initResult
      );
    }

    if (this.engines.size === 0) {
      return Err(
        llmError('NO_PROVIDERS_INITIALIZED', 'No LLM providers could be initialized', 'SYSTEM', {
          operation: 'initialize',
        })
      );
    }

    return Ok(void 0);
  }

  async executePrompt(
    prompt: string,
    options: PromptExecutionOptions
  ): Promise<Result<string, QiError>> {
    if (!this.config) {
      return Err(
        llmError('NOT_INITIALIZED', 'PromptManager not initialized', 'SYSTEM', {
          operation: 'executePrompt',
        })
      );
    }

    const validationResult = this.validatePrompt(prompt);

    return match(
      async (validatedPrompt: string) =>
        await this.tryProvider(options.providerId, validatedPrompt, options),
      async (error: LLMError) => Err(error),
      validationResult
    );
  }

  getProviderStatus(): Result<ProviderStatusMap, QiError> {
    const status: ProviderStatusMap = {};

    for (const [id, engine] of this.engines) {
      status[id] = {
        available: true,
        models: engine.models.length,
        name: engine.name,
      };
    }

    return Ok(status);
  }

  isProviderAvailable(providerId: string): Result<boolean, QiError> {
    return Ok(this.engines.has(providerId));
  }

  // Private methods (extracted from working demo)

  private validatePrompt(prompt: string): Result<string, LLMError> {
    if (!prompt || prompt.trim().length === 0) {
      return Err(
        llmError('INVALID_PROMPT', 'Prompt cannot be empty', 'VALIDATION', {
          operation: 'validatePrompt',
        })
      );
    }

    if (prompt.length > 10000) {
      return Err(
        llmError(
          'PROMPT_TOO_LONG',
          'Prompt exceeds maximum length of 10,000 characters',
          'VALIDATION',
          { operation: 'validatePrompt' }
        )
      );
    }

    return Ok(prompt.trim());
  }

  private async tryProvider(
    providerId: string,
    prompt: string,
    options: PromptExecutionOptions
  ): Promise<Result<string, LLMError>> {
    const engine = this.engines.get(providerId);

    if (!engine) {
      return Err(
        llmError('PROVIDER_NOT_FOUND', `Provider ${providerId} not available`, 'SYSTEM', {
          provider: providerId,
          operation: 'tryProvider',
        })
      );
    }

    const model = this.selectModel(engine, options.model);
    if (!model) {
      return Err(
        llmError(
          'NO_MODEL_AVAILABLE',
          `No suitable model found for provider ${providerId}`,
          'SYSTEM',
          { provider: providerId, operation: 'selectModel' }
        )
      );
    }

    return fromAsyncTryCatch(
      async () => {
        const messages = [new Message('user', prompt)];
        const response = await engine.engine.complete(model, messages);

        // Handle different response formats
        if (typeof response === 'string') {
          return response;
        }

        if (response && typeof response === 'object' && 'content' in response) {
          return response.content as string;
        }

        return JSON.stringify(response);
      },
      (error: unknown): LLMError =>
        llmError(
          'COMPLETION_FAILED',
          `Provider ${providerId} completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'NETWORK',
          {
            provider: providerId,
            model: model.id || 'unknown',
            operation: 'complete',
            error: String(error),
          }
        )
    );
  }

  private async initializeProvider(
    providerId: string,
    provider: LLMProviderConfig
  ): Promise<Result<ProviderEngine, LLMError>> {
    return fromAsyncTryCatch(
      async () => {
        // Create engine configuration
        const engineConfig: Record<string, unknown> = {
          baseURL: provider.baseURL,
        };

        // Add API key for non-local providers
        if (provider.apiKey && provider.type === 'api') {
          const apiKey =
            provider.apiKey.startsWith('${') && provider.apiKey.endsWith('}')
              ? process.env[provider.apiKey.slice(2, -1)]
              : provider.apiKey;

          if (!apiKey) {
            throw new Error(`No API key found for provider ${provider.name}`);
          }
          engineConfig.apiKey = apiKey;
        }

        // Initialize engine
        const engineType = this.mapProviderToEngine(providerId);
        const engine = igniteEngine(engineType, engineConfig);

        // Load models - let fromAsyncTryCatch handle any errors
        const modelData = await loadModels(engineType, engineConfig);
        const models = modelData?.chat || [];

        return {
          id: providerId,
          name: provider.name,
          engine,
          models,
        };
      },
      (error: unknown): LLMError =>
        llmError(
          'PROVIDER_INIT_FAILED',
          `Failed to initialize provider ${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          {
            provider: providerId,
            operation: 'initializeProvider',
            error: String(error),
          }
        )
    );
  }

  private selectModel(engine: ProviderEngine, preferredModel?: string): ChatModel | null {
    if (engine.models.length === 0) {
      // Fallback for providers without model loading
      return { id: 'default' } as ChatModel;
    }

    if (preferredModel) {
      const model = engine.models.find((m) => m.id === preferredModel);
      if (model) return model;
    }

    return engine.models[0];
  }

  private mapProviderToEngine(providerId: string): string {
    const mapping: Record<string, string> = {
      ollama: 'ollama',
      openrouter: 'openai',  // OpenRouter uses OpenAI-compatible API
      groq: 'groq',
      huggingface: 'huggingface',
      together: 'together',
    };
    return mapping[providerId] || providerId;
  }
}
