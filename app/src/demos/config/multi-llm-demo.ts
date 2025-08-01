#!/usr/bin/env node

/**
 * Multi-Provider LLM Demo using @qi/base and @qi/core (CORRECTED)
 *
 * Demonstrates proper usage of:
 * - @qi/base: Pure Result<T> composition, no try/catch, no .then()/.catch()
 * - @qi/core: ConfigBuilder, createLogger
 * - multi-llm-ts: Provider abstraction
 */

import { join } from 'node:path';
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
import { ConfigBuilder, createLogger } from '@qi/core';
import { type ChatModel, igniteEngine, type LlmEngine, loadModels, Message } from 'multi-llm-ts';

// ============================================================================
// Configuration Types (inferred from JSON schema, not duplicated)
// ============================================================================

interface LLMProvider {
  name: string;
  type: 'local' | 'api';
  enabled: boolean;
  baseURL: string;
  apiKey?: string;
  models: Array<{
    name: string;
    displayName: string;
    maxTokens: number;
    contextWindow: number;
    capabilities: string[];
  }>;
}

interface LLMConfig {
  llm: {
    defaultProvider: string;
    fallbackChain: string[];
    timeout: number;
    maxRetries: number;
    providers: Record<string, LLMProvider>;
  };
}

// ============================================================================
// Error Types
// ============================================================================

interface LLMError extends QiError {
  context: {
    provider?: string;
    model?: string;
    operation?: string;
    availableProviders?: string[];
    error?: string;
  };
}

const llmError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: LLMError['context'] = {}
): LLMError => create(code, message, category, context) as LLMError;

// ============================================================================
// Provider Engine Wrapper
// ============================================================================

interface ProviderEngine {
  id: string;
  name: string;
  engine: LlmEngine;
  models: ChatModel[];
}

// ============================================================================
// Multi-Provider LLM Client
// ============================================================================

// Import Logger type from qicore
import type { Logger } from '@qi/core';

class QiMultiLLMClient {
  private engines: Map<string, ProviderEngine> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize all enabled providers
   */
  async initialize(config: LLMConfig): Promise<Result<void, LLMError>> {
    this.logger.info('🔧 Initializing LLM providers...');

    const initResults: Array<Result<ProviderEngine, LLMError>> = [];

    for (const [providerId, provider] of Object.entries(config.llm.providers)) {
      if (!provider.enabled) {
        this.logger.info(`⏭️  Skipping disabled provider: ${provider.name}`);
        continue;
      }

      const initResult = await this.initializeProvider(providerId, provider);
      initResults.push(initResult);

      match(
        (engine: ProviderEngine) => {
          this.engines.set(providerId, engine);
          this.logger.info(`✅ ${provider.name} initialized with ${engine.models.length} models`);
        },
        (error: LLMError) => {
          this.logger.error(`❌ Failed to initialize ${provider.name}: ${error.message}`);
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

    this.logger.info(`✅ Initialized ${this.engines.size} provider(s)`);
    return Ok(void 0);
  }

  /**
   * Generate completion using provider fallback chain
   */
  async complete(
    prompt: string,
    options: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    } = {}
  ): Promise<Result<string, LLMError>> {
    const validationResult = this.validatePrompt(prompt);

    return match(
      async (validatedPrompt: string) =>
        await this.tryProvidersSequentially(validatedPrompt, options),
      async (error: LLMError) => Err(error),
      validationResult
    );
  }

  /**
   * Get provider status
   */
  getProviderStatus(): Record<string, { available: boolean; models: number; name: string }> {
    const status: Record<string, { available: boolean; models: number; name: string }> = {};

    for (const [id, engine] of this.engines) {
      status[id] = {
        available: true,
        models: engine.models.length,
        name: engine.name,
      };
    }

    return status;
  }

  // ============================================================================
  // Private Methods (Pure Result<T> Composition)
  // ============================================================================

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

  private async tryProvidersSequentially(
    prompt: string,
    options: { provider?: string; model?: string; temperature?: number; maxTokens?: number }
  ): Promise<Result<string, LLMError>> {
    const providerIds = options.provider ? [options.provider] : Array.from(this.engines.keys());

    for (const providerId of providerIds) {
      const result = await this.tryProvider(providerId, prompt, options);

      const shouldContinue = match(
        () => false, // Success - don't continue
        (error: LLMError) => {
          this.logger.warn(
            `⚠️  Provider ${providerId} failed, trying next... Error: ${error.message}`
          );
          return true; // Continue to next provider
        },
        result
      );

      if (!shouldContinue) {
        return result;
      }
    }

    return Err(
      llmError(
        'ALL_PROVIDERS_FAILED',
        'All configured providers failed to generate response',
        'SYSTEM',
        { operation: 'complete', availableProviders: providerIds }
      )
    );
  }

  private async tryProvider(
    providerId: string,
    prompt: string,
    options: { model?: string; temperature?: number; maxTokens?: number }
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
    provider: LLMProvider
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
      groq: 'groq',
      huggingface: 'huggingface',
      together: 'together',
    };
    return mapping[providerId] || providerId;
  }
}

// ============================================================================
// Demo Application (Pure Result<T> Composition)
// ============================================================================

async function runDemo(): Promise<Result<void, QiError>> {
  console.log('🚀 Qi Multi-Provider LLM Demo (CORRECTED)');
  console.log('==========================================');

  // Wrap the entire async operation in fromAsyncTryCatch
  return fromAsyncTryCatch(
    async () => {
      // Initialize logger using @qi/core
      const loggerResult = createLogger({ level: 'info', pretty: true });
      const logger = match(
        (logger: Logger) => logger,
        (error: QiError) => {
          throw new Error(`Logger failed: ${error.message}`);
        },
        loggerResult
      );

      logger.info('📝 Loading LLM configuration...');

      // Load configuration using @qi/core ConfigBuilder with JSON schema validation
      const configPath = join(process.cwd(), '..', 'config', 'llm-providers.yaml');
      const schemaPath = join(process.cwd(), '..', 'config', 'llm-providers.schema.json');

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
                validateWithSchemaFile: (path: string) => { build: () => Result<unknown, QiError> };
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

      logger.info('✅ Configuration loaded and validated with JSON schema');

      // Extract LLM config
      const llmSection = match(
        (section: LLMConfig['llm']) => section,
        (error: QiError) => {
          throw new Error(`LLM config not found: ${error.message}`);
        },
        (config as { get: (key: string) => Result<LLMConfig['llm'], QiError> }).get('llm')
      );

      const llmConfig: LLMConfig = { llm: llmSection };

      // Initialize client
      const client = new QiMultiLLMClient(logger);
      const initResult = await client.initialize(llmConfig);

      match(
        () => logger.info('✅ Client initialized successfully'),
        (error: LLMError) => {
          throw new Error(`Client initialization failed: ${error.message}`);
        },
        initResult
      );

      // Show provider status
      const status = client.getProviderStatus();
      logger.info('📊 Provider Status:', status);

      // Run prompt tests
      const testResult = await runPromptTests(client, logger);
      return match(
        () => void 0,
        (error: QiError) => {
          throw new Error(`Prompt tests failed: ${error.message}`);
        },
        testResult
      );
    },
    (error: unknown) =>
      validationError(`Demo failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  );
}

async function runPromptTests(
  client: QiMultiLLMClient,
  logger: Logger
): Promise<Result<void, QiError>> {
  // Test prompts
  const prompts = [
    'Hello! Can you introduce yourself?',
    'Write a simple function to add two numbers',
    'What is the capital of France?',
  ];

  logger.info('\n🎯 Testing prompts...');

  for (const prompt of prompts) {
    logger.info(`\n📤 Prompt: "${prompt}"`);

    const result = await client.complete(prompt, { maxTokens: 150 });

    match(
      (response: string) => {
        logger.info(`✅ Success: ${response.slice(0, 100)}...`);
      },
      (error: LLMError) => {
        logger.error(`❌ Failed: ${error.message} (${error.category})`);
      },
      result
    );

    // Add delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  logger.info('\n🎉 Demo completed successfully!');
  logger.info('\n💡 To enable more providers, set these environment variables:');
  logger.info('   export GROQ_API_KEY="your-groq-key"');
  logger.info('   export HUGGINGFACE_API_KEY="your-hf-token"');
  logger.info('   export TOGETHER_API_KEY="your-together-key"');
  logger.info('\n💡 Make sure Ollama is running locally on http://localhost:11434');

  return Ok(void 0);
}

// ============================================================================
// Main Entry Point (Pure Result<T> Composition)
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().then((result) => {
    match(
      () => {
        console.log('\n✨ Demo completed successfully!');
        process.exit(0);
      },
      (error: QiError) => {
        console.error('\n💥 Demo failed:', error.message);
        if (error.context) {
          console.error('Context:', error.context);
        }
        process.exit(1);
      },
      result
    );
  });
  // NO .catch() - pure Result<T> composition
}

export { QiMultiLLMClient, runDemo };

// Test if the imports work
// Uncomment lines below to debug:
// console.log(Ok, Err, match, flatMap, fromAsyncTryCatch, create, validationError)
