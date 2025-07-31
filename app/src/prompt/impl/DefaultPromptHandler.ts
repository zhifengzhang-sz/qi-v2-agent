/**
 * Default implementation of IPromptHandler
 * 
 * Provides simple user-friendly API while using IPromptManager
 * for internal qicore complexity
 */

import { match } from '@qi/base'
import type { 
  IPromptHandler, 
  PromptOptions, 
  PromptResponse, 
  ProviderInfo 
} from '../interfaces/IPromptHandler.js'
import type { 
  IPromptManager, 
  LLMConfig,
  PromptExecutionOptions 
} from '../interfaces/IPromptManager.js'

export class DefaultPromptHandler implements IPromptHandler {
  private manager: IPromptManager
  private config: LLMConfig | null = null
  private initialized = false

  constructor(manager: IPromptManager) {
    this.manager = manager
  }

  /**
   * Initialize the handler with configuration
   */
  async initialize(configPath: string, schemaPath: string): Promise<PromptResponse> {
    const configResult = await this.manager.loadConfig(configPath, schemaPath)
    
    return await match(
      async (config: LLMConfig) => {
        this.config = config
        const initResult = await this.manager.initializeProviders(config)
        
        return match(
          (): PromptResponse => {
            this.initialized = true
            return { success: true, data: 'Handler initialized successfully' }
          },
          (error): PromptResponse => ({ success: false, error: error.message }),
          initResult
        )
      },
      async (error): Promise<PromptResponse> => ({ success: false, error: error.message }),
      configResult
    )
  }

  async complete(prompt: string, options: PromptOptions = {}): Promise<PromptResponse> {
    if (!this.initialized || !this.config) {
      return { success: false, error: 'Handler not initialized. Call initialize() first.' }
    }

    // Use provided provider or fallback to default
    const providerId = options.provider || this.config.llm.defaultProvider

    const executionOptions: PromptExecutionOptions = {
      providerId,
      model: options.model,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    }

    const result = await this.manager.executePrompt(prompt, executionOptions)
    
    return match(
      (data: string): PromptResponse => ({ success: true, data }),
      (error): PromptResponse => ({ success: false, error: error.message }),
      result
    )
  }

  async getAvailableProviders(): Promise<ProviderInfo[]> {
    if (!this.initialized) {
      return []
    }

    const statusResult = this.manager.getProviderStatus()
    
    return match(
      (statusMap) => {
        return Object.entries(statusMap).map(([id, info]) => ({
          id,
          name: info.name,
          available: info.available,
          models: info.models
        }))
      },
      () => [], // Return empty array on error
      statusResult
    )
  }

  async validateProvider(providerId: string): Promise<boolean> {
    if (!this.initialized) {
      return false
    }

    const availabilityResult = this.manager.isProviderAvailable(providerId)
    
    return match(
      (available) => available,
      () => false, // Return false on error
      availabilityResult
    )
  }
}