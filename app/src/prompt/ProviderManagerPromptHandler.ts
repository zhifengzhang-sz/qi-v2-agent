/**
 * Custom Prompt Handler using ProviderManager for automatic fallback
 * Implements IPromptHandler interface but uses ProviderManager internally
 */

// biome-ignore lint/style/useImportType: ProviderManager is used as constructor, not just type
import { type ModelRequest, ProviderManager } from '@qi/agent/models/ProviderManager';
import type { IPromptHandler, PromptOptions, PromptResponse, ProviderInfo } from '@qi/agent/prompt';
import { match } from '@qi/base';

export class ProviderManagerPromptHandler implements IPromptHandler {
  private providerManager: ProviderManager;
  private initialized = false;

  constructor(providerManager: ProviderManager) {
    this.providerManager = providerManager;
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
   * Execute a prompt using ProviderManager with automatic fallback
   */
  async complete(prompt: string, options: PromptOptions = {}): Promise<PromptResponse> {
    if (!this.initialized) {
      return { success: false, error: 'Handler not initialized' };
    }

    try {
      const modelRequest: ModelRequest = {
        prompt,
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
}
