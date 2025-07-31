/**
 * @qi/prompt - Internal prompt manager interface
 * 
 * Handles qicore complexity, configuration loading, and provider management
 * Uses proper qicore Result<T> patterns internally
 */

import type { Result, QiError } from '@qi/base'

export interface LLMConfig {
  llm: {
    defaultProvider: string
    fallbackChain: string[]
    timeout: number
    maxRetries: number
    providers: Record<string, LLMProviderConfig>
  }
}

export interface LLMProviderConfig {
  name: string
  type: 'local' | 'api'
  enabled: boolean
  baseURL: string
  apiKey?: string
  models: Array<{
    name: string
    displayName: string
    maxTokens: number
    contextWindow: number
    capabilities: string[]
  }>
}

export interface ProviderStatusMap {
  [providerId: string]: {
    available: boolean
    models: number
    name: string
  }
}

export interface PromptExecutionOptions {
  providerId: string
  model?: string
  temperature?: number
  maxTokens?: number
}

/**
 * Internal prompt manager interface
 * Uses qicore Result<T> patterns for professional error handling
 */
export interface IPromptManager {
  /**
   * Load and validate configuration from files
   */
  loadConfig(configPath: string, schemaPath: string): Promise<Result<LLMConfig, QiError>>
  
  /**
   * Initialize all enabled providers
   */
  initializeProviders(config: LLMConfig): Promise<Result<void, QiError>>
  
  /**
   * Execute prompt with specified provider
   */
  executePrompt(prompt: string, options: PromptExecutionOptions): Promise<Result<string, QiError>>
  
  /**
   * Get current provider status
   */
  getProviderStatus(): Result<ProviderStatusMap, QiError>
  
  /**
   * Check if provider is available and initialized
   */
  isProviderAvailable(providerId: string): Result<boolean, QiError>
}