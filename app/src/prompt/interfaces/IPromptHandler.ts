/**
 * @qi/prompt - User-facing interface for prompt handling
 * 
 * Provides a simple, user-friendly API for LLM interactions
 * without exposing qicore complexity
 */

export interface PromptOptions {
  provider?: string
  model?: string  
  temperature?: number
  maxTokens?: number
}

export type PromptResponse = 
  | { success: true; data: string }
  | { success: false; error: string }

export interface ProviderInfo {
  id: string
  name: string
  available: boolean
  models: number
}

/**
 * User-facing prompt handler interface
 * Simple promise-based API, no qicore Result<T> patterns exposed
 */
export interface IPromptHandler {
  /**
   * Initialize the handler with configuration
   */
  initialize(configPath: string, schemaPath: string): Promise<PromptResponse>
  
  /**
   * Execute a prompt with the specified provider
   */
  complete(prompt: string, options?: PromptOptions): Promise<PromptResponse>
  
  /**
   * Get list of available providers
   */
  getAvailableProviders(): Promise<ProviderInfo[]>
  
  /**
   * Check if a specific provider is available
   */
  validateProvider(providerId: string): Promise<boolean>
}