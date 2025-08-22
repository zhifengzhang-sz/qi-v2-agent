/**
 * Custom Prompt Handler using ProviderManager for automatic fallback
 * Implements IPromptHandler interface but uses ProviderManager internally
 */

import type { ContextManager } from '@qi/agent/context/impl/ContextManager';
// biome-ignore lint/style/useImportType: ProviderManager is used as constructor, not just type
import { type ModelRequest, ProviderManager } from '@qi/agent/models/ProviderManager';
import type { IPromptHandler, PromptOptions, PromptResponse, ProviderInfo } from '@qi/agent/prompt';
import { match } from '@qi/base';

export class ProviderManagerPromptHandler implements IPromptHandler {
  private providerManager: ProviderManager;
  private contextManager?: ContextManager;
  private initialized = false;

  constructor(providerManager: ProviderManager, contextManager?: ContextManager) {
    this.providerManager = providerManager;
    this.contextManager = contextManager;
  }

  /**
   * Initialize the handler - just mark as initialized since ProviderManager handles its own setup
   */
  async initialize(configPath: string, schemaPath: string): Promise<PromptResponse> {
    try {
      // ProviderManager doesn't need config files - it auto-detects providers
      this.initialized = true;
      return { success: true, data: 'ProviderManager prompt handler initialized' };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize ProviderManager handler: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Execute a prompt using ProviderManager with automatic fallback and context optimization
   */
  async complete(prompt: string, options: PromptOptions = {}): Promise<PromptResponse> {
    if (!this.initialized) {
      return { success: false, error: 'Handler not initialized' };
    }

    try {
      // Enhancement 3: Context Optimization - optimize prompt if ContextManager available
      let optimizedPrompt = prompt;
      if (this.contextManager && prompt.length > 1000) {
        // Only optimize larger prompts
        const maxTokens = this.getMaxTokensForProvider(options.provider);
        const optimizationResult = await this.contextManager.optimizeContext(prompt, maxTokens);

        // Use optimized context if successful, fallback to original if failed
        match(
          (optimized) => {
            optimizedPrompt = optimized;
          },
          (error) => {
            console.warn(`Context optimization failed: ${error.message}, using original prompt`);
          },
          optimizationResult
        );
      }

      const modelRequest: ModelRequest = {
        prompt: optimizedPrompt,
        system: options.model
          ? `Using model: ${options.model}`
          : this.providerManager.getSystemPrompt(),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      };

      const result = await this.providerManager.invoke(modelRequest);

      return match(
        (response): PromptResponse => ({
          success: true,
          data: response.content,
        }),
        (error): PromptResponse => ({
          success: false,
          error: `Provider invocation failed: ${error.message}`,
        }),
        result
      );
    } catch (error) {
      return {
        success: false,
        error: `Prompt completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get list of available providers
   */
  async getAvailableProviders(): Promise<ProviderInfo[]> {
    try {
      const result = await this.providerManager.getAvailableProvider();

      return match(
        (provider) => [
          {
            id: provider.name,
            name: provider.name,
            available: true,
            models: 1, // Simplified - each provider has at least one model
          },
        ],
        () => [], // No providers available
        result
      );
    } catch {
      return [];
    }
  }

  /**
   * Check if a specific provider is available
   */
  async validateProvider(providerId: string): Promise<boolean> {
    try {
      const result = await this.providerManager.getAvailableProvider();

      return match(
        (provider) => provider.name === providerId,
        () => false,
        result
      );
    } catch {
      return false;
    }
  }

  /**
   * Get maximum token limits based on provider (Enhancement 3: Context Optimization)
   */
  private getMaxTokensForProvider(provider?: string): number {
    // Use provider preference from ProviderManager if not specified
    if (!provider) {
      // Try to detect current provider - simplified approach
      return 16000; // Conservative default
    }

    switch (provider.toLowerCase()) {
      case 'ollama':
        return 8000; // Conservative for local models
      case 'openrouter':
        return 32000; // Varies by model, use conservative estimate
      default:
        return 16000; // Safe default
    }
  }
}
