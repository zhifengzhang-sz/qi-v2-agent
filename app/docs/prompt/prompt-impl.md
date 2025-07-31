# Prompt Module - Implementation Guide

## 🎯 Implementation Overview

This guide provides step-by-step instructions for implementing the Prompt module with multi-provider support and user-friendly API. The implementation focuses on **hiding qicore complexity** while providing robust LLM integration with Ollama as the primary provider.

## 📦 Package Selection and Justification

### Core Dependencies

#### 1. YAML Configuration Management
```json
{
  "yaml": "^2.8.0",
  "zod": "^3.22.0"
}
```

**What YAML provides**:
- **Human-readable configuration** files that are easy to edit
- **Environment variable substitution** with `${ENV_VAR}` syntax
- **Multi-document support** for complex configurations
- **Comments and documentation** within config files

**What Zod provides**:
- **Runtime validation** of YAML configuration
- **TypeScript type inference** from schemas
- **Detailed error messages** for invalid configurations
- **Schema composition** for complex validation rules

**Why chosen over alternatives**:
- **vs JSON**: YAML supports comments and is more human-readable
- **vs TOML**: Better JavaScript ecosystem support
- **vs Joi**: Zod has better TypeScript integration and automatic type inference
- **vs direct object validation**: Zod provides comprehensive validation with clear error messages

#### 2. LLM Provider Integration (Optional)
```json
{
  "ollama": "^0.5.0",
  "openai": "^4.0.0"
}
```

**What these packages provide**:
- **Ollama**: Local LLM integration with streaming support
- **OpenAI**: Cloud API integration with function calling
- **Standardized interfaces** for different model providers
- **Built-in error handling** and retry mechanisms

**Why chosen over direct HTTP calls**:
- **Provider-specific optimizations** (connection pooling, streaming)
- **Authentication handling** built-in
- **Error code interpretation** and retry logic
- **Type safety** with TypeScript definitions

### Implementation Strategy: Dependency Isolation

```typescript
// Optional dependencies pattern - only load what's available
class ProviderLoader {
  static async loadOllama(): Promise<OllamaProvider | null> {
    try {
      const { Ollama } = await import('ollama')
      return new OllamaProvider(new Ollama())
    } catch (error) {
      console.warn('Ollama not available:', error.message)
      return null
    }
  }
  
  static async loadOpenAI(): Promise<OpenAIProvider | null> {
    try {
      const { OpenAI } = await import('openai')
      return new OpenAIProvider(new OpenAI())
    } catch (error) {
      console.warn('OpenAI not available:', error.message)
      return null
    }
  }
}
```

## 🔧 Implementation Steps

### Step 1: Configuration Schema and Validation

```typescript
// File: interfaces/IPromptConfig.ts
import { z } from 'zod'

// Provider configuration schema
const ProviderConfigSchema = z.object({
  type: z.enum(['ollama', 'openai', 'anthropic']).describe('Provider type'),
  baseUrl: z.string().url().optional().describe('Base URL for API calls'),
  apiKey: z.string().optional().describe('API key (use ${ENV_VAR} for environment variables)'),
  timeout: z.number().min(1000).max(300000).describe('Request timeout in milliseconds'),
  models: z.array(z.object({
    name: z.string().describe('Model identifier'),
    displayName: z.string().optional().describe('Human-readable model name'),
    default: z.boolean().optional().describe('Whether this is the default model'),
    contextLength: z.number().min(1).describe('Maximum context length'),
    capabilities: z.array(z.string()).optional().describe('Model capabilities')
  })).min(1).describe('Available models for this provider')
})

// Complete configuration schema
export const PromptConfigSchema = z.object({
  providers: z.record(ProviderConfigSchema).describe('Available LLM providers'),
  defaults: z.object({
    provider: z.string().describe('Default provider to use'),
    model: z.string().optional().describe('Default model (if not specified, use provider default)'),
    temperature: z.number().min(0).max(2).default(0.7).describe('Default temperature'),
    maxTokens: z.number().min(1).default(2048).describe('Default maximum tokens'),
    timeout: z.number().min(1000).default(30000).describe('Default timeout')
  }).describe('Default settings'),
  features: z.object({
    enableStreaming: z.boolean().default(true).describe('Enable streaming responses'),
    enableRetries: z.boolean().default(true).describe('Enable automatic retries'),
    enableFallback: z.boolean().default(true).describe('Enable provider fallback')
  }).optional().describe('Feature flags')
})

export type PromptConfiguration = z.infer<typeof PromptConfigSchema>

// Default configuration
export const DEFAULT_PROMPT_CONFIG: PromptConfiguration = {
  providers: {
    ollama: {
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      timeout: 30000,
      models: [
        {
          name: 'qwen2.5-coder:7b',
          displayName: 'Qwen2.5 Coder 7B',
          default: true,
          contextLength: 32768,
          capabilities: ['text-generation', 'code-completion']
        }
      ]
    }
  },
  defaults: {
    provider: 'ollama',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000
  },
  features: {
    enableStreaming: true,
    enableRetries: true,
    enableFallback: true
  }
}
```

### Step 2: Configuration Loading with Environment Variables

```typescript
// File: impl/ConfigurationManager.ts
import yaml from 'yaml'
import fs from 'fs/promises'
import { PromptConfigSchema, type PromptConfiguration } from '../interfaces/IPromptConfig.js'

export class ConfigurationManager {
  private config: PromptConfiguration | null = null
  private configPath: string | null = null

  async loadConfiguration(configPath: string, schemaPath?: string): Promise<PromptConfiguration> {
    try {
      // Read YAML file
      const configFile = await fs.readFile(configPath, 'utf-8')
      
      // Parse YAML with environment variable substitution
      const rawConfig = yaml.parse(this.substituteEnvironmentVariables(configFile))
      
      // Validate against schema
      const validatedConfig = PromptConfigSchema.parse(rawConfig)
      
      this.config = validatedConfig
      this.configPath = configPath
      
      return validatedConfig
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private substituteEnvironmentVariables(configContent: string): string {
    // Replace ${ENV_VAR} with actual environment variable values
    return configContent.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const value = process.env[envVar]
      if (value === undefined) {
        console.warn(`Environment variable ${envVar} is not set, using placeholder`)
        return match // Keep placeholder if env var not found
      }
      return value
    })
  }

  getConfiguration(): PromptConfiguration {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfiguration() first.')
    }
    return this.config
  }

  async reloadConfiguration(): Promise<PromptConfiguration> {
    if (!this.configPath) {
      throw new Error('No configuration path available for reload')
    }
    return await this.loadConfiguration(this.configPath)
  }
}
```

### Step 3: Provider Abstraction Layer

```typescript
// File: interfaces/IPromptProvider.ts
export interface IPromptProvider {
  readonly id: string
  readonly name: string
  readonly type: 'local' | 'cloud' | 'api'
  
  // Core functionality
  initialize(config: ProviderConfig): Promise<void>
  complete(request: PromptRequest): Promise<PromptProviderResponse>
  stream(request: PromptRequest): AsyncIterableIterator<PromptStreamChunk>
  
  // Provider introspection
  isAvailable(): Promise<boolean>
  getCapabilities(): ProviderCapabilities
  getModels(): Promise<ModelInfo[]>
  
  // Resource management
  cleanup(): Promise<void>
}

export interface PromptRequest {
  prompt: string
  model?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  metadata?: Record<string, unknown>
}

export interface PromptProviderResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  model: string
  finishReason?: string
  metadata?: Record<string, unknown>
}
```

### Step 4: Ollama Provider Implementation

```typescript
// File: impl/providers/OllamaProvider.ts
import type { IPromptProvider, PromptRequest, PromptProviderResponse } from '../../interfaces/IPromptProvider.js'

export class OllamaProvider implements IPromptProvider {
  readonly id = 'ollama'
  readonly name = 'Ollama Local LLM'
  readonly type = 'local' as const

  private baseUrl: string = 'http://localhost:11434'
  private timeout: number = 30000
  private availableModels: ModelInfo[] = []

  async initialize(config: ProviderConfig): Promise<void> {
    this.baseUrl = config.baseUrl || 'http://localhost:11434'
    this.timeout = config.timeout || 30000
    
    // Verify Ollama is running and fetch available models
    try {
      await this.fetchAvailableModels()
      console.log(`✅ Ollama provider initialized with ${this.availableModels.length} models`)
    } catch (error) {
      throw new Error(`Failed to initialize Ollama provider: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async complete(request: PromptRequest): Promise<PromptProviderResponse> {
    const model = request.model || this.getDefaultModel()
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          temperature: request.temperature || 0.7,
          options: {
            num_predict: request.maxTokens || 2048
          },
          stream: false // Non-streaming for complete() method
        }),
        signal: AbortSignal.timeout(request.timeout || this.timeout)
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        content: data.response || '',
        model: data.model || model,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        },
        metadata: {
          totalDuration: data.total_duration,
          loadDuration: data.load_duration,
          promptEvalDuration: data.prompt_eval_duration,
          evalDuration: data.eval_duration
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Ollama request timeout after ${request.timeout || this.timeout}ms`)
      }
      throw error
    }
  }

  async *stream(request: PromptRequest): AsyncIterableIterator<PromptStreamChunk> {
    const model = request.model || this.getDefaultModel()
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          temperature: request.temperature || 0.7,
          options: {
            num_predict: request.maxTokens || 2048
          },
          stream: true // Enable streaming
        }),
        signal: AbortSignal.timeout(request.timeout || this.timeout)
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body available for streaming')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line)
                
                yield {
                  content: data.response || '',
                  isComplete: !!data.done,
                  metadata: {
                    model: data.model,
                    promptEvalCount: data.prompt_eval_count,
                    evalCount: data.eval_count
                  }
                }

                if (data.done) {
                  return // Stream complete
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming response line:', line)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Ollama streaming timeout after ${request.timeout || this.timeout}ms`)
      }
      throw error
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // Quick availability check
      })
      return response.ok
    } catch (error) {
      return false
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      streaming: true,
      functionCalling: false,
      imageInput: false,
      maxContextLength: 32768,
      supportedFormats: ['text']
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    return this.availableModels
  }

  private async fetchAvailableModels(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`)
      }

      const data = await response.json()
      this.availableModels = (data.models || []).map((model: any) => ({
        name: model.name,
        displayName: model.name,
        contextLength: model.details?.parameter_size ? parseInt(model.details.parameter_size) * 1000 : 4096,
        isDefault: model.name.includes('qwen2.5-coder'),
        capabilities: ['text-generation']
      }))
    } catch (error) {
      console.warn('Could not fetch Ollama models:', error)
      this.availableModels = []
    }
  }

  private getDefaultModel(): string {
    const defaultModel = this.availableModels.find(m => m.isDefault)
    return defaultModel?.name || this.availableModels[0]?.name || 'qwen2.5-coder:7b'
  }

  async cleanup(): Promise<void> {
    // Ollama doesn't require explicit cleanup
    this.availableModels = []
  }
}
```

### Step 5: User-Friendly Prompt Handler

```typescript
// File: impl/DefaultPromptHandler.ts
import type { IPromptHandler, PromptResponse, PromptOptions, PromptStreamChunk } from '../interfaces/IPromptHandler.js'
import type { IPromptProvider } from '../interfaces/IPromptProvider.js'
import { ConfigurationManager } from './ConfigurationManager.js'
import { ProviderRegistry } from './ProviderRegistry.js'

export class DefaultPromptHandler implements IPromptHandler {
  private configManager: ConfigurationManager
  private providerRegistry: ProviderRegistry
  private isInitialized = false

  constructor() {
    this.configManager = new ConfigurationManager()
    this.providerRegistry = new ProviderRegistry()
  }

  async initialize(configPath: string, schemaPath?: string): Promise<InitializationResult> {
    try {
      // Load configuration
      const config = await this.configManager.loadConfiguration(configPath, schemaPath)
      
      // Initialize providers
      await this.providerRegistry.initializeProviders(config.providers)
      
      this.isInitialized = true
      
      const availableProviders = await this.providerRegistry.getAvailableProviders()
      
      return {
        success: true,
        message: `Initialized with ${availableProviders.length} providers`,
        availableProviders: availableProviders.map(p => p.id)
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        suggestions: [
          'Check if configuration file exists and is valid YAML',
          'Verify that Ollama is running on http://localhost:11434',
          'Ensure environment variables are properly set'
        ]
      }
    }
  }

  async complete(prompt: string, options: PromptOptions = {}): Promise<PromptResponse> {
    // Validate inputs
    if (!prompt?.trim()) {
      return {
        success: false,
        error: 'Empty prompt provided',
        suggestions: ['Provide a non-empty prompt string']
      }
    }

    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Handler not initialized',
        suggestions: ['Call initialize() with a valid configuration file']
      }
    }

    try {
      // Get provider and configuration
      const config = this.configManager.getConfiguration()
      const providerName = options.provider || config.defaults.provider
      const provider = await this.providerRegistry.getProvider(providerName)

      if (!provider) {
        return {
          success: false,
          error: `Provider '${providerName}' not available`,
          suggestions: await this.getProviderSuggestions()
        }
      }

      // Execute prompt with provider
      const providerResponse = await provider.complete({
        prompt,
        model: options.model || config.defaults.model,
        temperature: options.temperature || config.defaults.temperature,
        maxTokens: options.maxTokens || config.defaults.maxTokens,
        timeout: options.timeout || config.defaults.timeout
      })

      return {
        success: true,
        data: providerResponse.content,
        metadata: {
          provider: providerName,
          model: providerResponse.model,
          usage: providerResponse.usage,
          finishReason: providerResponse.finishReason
        }
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        suggestions: await this.getErrorSuggestions(error)
      }
    }
  }

  async *stream(prompt: string, options: PromptOptions = {}): AsyncIterableIterator<PromptStreamChunk> {
    if (!prompt?.trim()) {
      yield {
        content: '',
        isComplete: true,
        error: 'Empty prompt provided'
      }
      return
    }

    if (!this.isInitialized) {
      yield {
        content: '',
        isComplete: true,
        error: 'Handler not initialized'
      }
      return
    }

    try {
      const config = this.configManager.getConfiguration()
      const providerName = options.provider || config.defaults.provider
      const provider = await this.providerRegistry.getProvider(providerName)

      if (!provider) {
        yield {
          content: '',
          isComplete: true,
          error: `Provider '${providerName}' not available`
        }
        return
      }

      // Stream from provider
      const providerStream = provider.stream({
        prompt,
        model: options.model || config.defaults.model,
        temperature: options.temperature || config.defaults.temperature,
        maxTokens: options.maxTokens || config.defaults.maxTokens,
        timeout: options.timeout || config.defaults.timeout
      })

      for await (const chunk of providerStream) {
        yield {
          content: chunk.content,
          isComplete: chunk.isComplete,
          metadata: {
            provider: providerName,
            ...chunk.metadata
          }
        }

        if (chunk.isComplete) {
          break
        }
      }

    } catch (error) {
      yield {
        content: '',
        isComplete: true,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  async getAvailableProviders(): Promise<ProviderInfo[]> {
    if (!this.isInitialized) {
      return []
    }

    const providers = await this.providerRegistry.getAvailableProviders()
    const providerInfos: ProviderInfo[] = []

    for (const provider of providers) {
      const isAvailable = await provider.isAvailable()
      const models = await provider.getModels()

      providerInfos.push({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        status: isAvailable ? 'available' : 'unavailable',
        capabilities: provider.getCapabilities(),
        models
      })
    }

    return providerInfos
  }

  async validateProvider(providerId: string): Promise<boolean> {
    if (!this.isInitialized) {
      return false
    }

    const provider = await this.providerRegistry.getProvider(providerId)
    return provider ? await provider.isAvailable() : false
  }

  private async getProviderSuggestions(): Promise<string[]> {
    const available = await this.getAvailableProviders()
    const suggestions = ['Check available providers:']
    
    for (const provider of available) {
      suggestions.push(`- ${provider.id} (${provider.status})`)
    }

    if (available.length === 0) {
      suggestions.push('No providers are currently available')
      suggestions.push('Make sure Ollama is running: ollama serve')
    }

    return suggestions
  }

  private async getErrorSuggestions(error: unknown): Promise<string[]> {
    const errorMessage = error instanceof Error ? error.message : String(error)
    
    if (errorMessage.includes('timeout')) {
      return [
        'Request timed out',
        'Try increasing the timeout value',
        'Check if the model is loaded in Ollama'
      ]
    }

    if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      return [
        'Connection failed',
        'Make sure Ollama is running: ollama serve',
        'Check if the base URL is correct'
      ]
    }

    if (errorMessage.includes('model')) {
      return [
        'Model-related error',
        'Check if the model is available: ollama list',
        'Try pulling the model: ollama pull qwen2.5-coder:7b'
      ]
    }

    return [
      'An unexpected error occurred',
      'Check the console for more details',
      'Try with a different provider or model'
    ]
  }
}
```

### Step 6: Factory Function and Easy Setup

```typescript
// File: index.ts
import { DefaultPromptHandler } from './impl/DefaultPromptHandler.js'
import { DEFAULT_PROMPT_CONFIG } from './interfaces/IPromptConfig.js'

// Main factory function
export function createPromptHandler(): DefaultPromptHandler {
  return new DefaultPromptHandler()
}

// Quick setup with defaults
export async function createQuickPromptHandler(): Promise<DefaultPromptHandler> {
  const handler = createPromptHandler()
  
  // Try to initialize with default configuration
  try {
    // Create temporary config file if none exists
    const tempConfigPath = await createDefaultConfig()
    await handler.initialize(tempConfigPath)
    return handler
  } catch (error) {
    console.warn('Quick setup failed, handler needs manual initialization:', error)
    return handler
  }
}

// Helper to create default configuration
async function createDefaultConfig(): Promise<string> {
  const fs = await import('fs/promises')
  const yaml = await import('yaml')
  const path = await import('path')
  
  const configPath = path.join(process.cwd(), 'prompt-config.yaml')
  
  try {
    // Check if config already exists
    await fs.access(configPath)
    return configPath
  } catch {
    // Create default config
    const configContent = yaml.stringify(DEFAULT_PROMPT_CONFIG)
    await fs.writeFile(configPath, configContent, 'utf-8')
    console.log(`Created default configuration at ${configPath}`)
    return configPath
  }
}

// Re-export types and interfaces
export type { IPromptHandler, PromptResponse, PromptOptions } from './interfaces/IPromptHandler.js'
export type { PromptConfiguration } from './interfaces/IPromptConfig.js'
```

## 🧪 Testing Implementation

### Unit Tests

```typescript
// File: __tests__/DefaultPromptHandler.test.ts
import { DefaultPromptHandler } from '../impl/DefaultPromptHandler'
import { createPromptHandler } from '../index'

describe('DefaultPromptHandler', () => {
  let handler: DefaultPromptHandler
  let mockConfigPath: string

  beforeEach(async () => {
    handler = createPromptHandler()
    mockConfigPath = await createMockConfig()
  })

  test('should initialize with valid configuration', async () => {
    const result = await handler.initialize(mockConfigPath)
    
    expect(result.success).toBe(true)
    expect(result.availableProviders).toContain('ollama')
  })

  test('should handle prompts successfully', async () => {
    await handler.initialize(mockConfigPath)
    
    const response = await handler.complete('Hello, world!')
    
    // Note: This test assumes Ollama is running
    if (response.success) {
      expect(response.data).toBeDefined()
      expect(response.metadata?.provider).toBe('ollama')
    } else {
      expect(response.error).toContain('ollama')
    }
  })

  test('should provide helpful error messages', async () => {
    const response = await handler.complete('') // Empty prompt
    
    expect(response.success).toBe(false)
    expect(response.error).toContain('Empty prompt')
    expect(response.suggestions).toBeDefined()
  })

  test('should support streaming responses', async () => {
    await handler.initialize(mockConfigPath)
    
    const chunks: string[] = []
    
    for await (const chunk of handler.stream('Count to 3')) {
      if (chunk.content) {
        chunks.push(chunk.content)
      }
      
      if (chunk.isComplete) {
        break
      }
    }
    
    // Should have received multiple chunks
    expect(chunks.length).toBeGreaterThan(0)
  })
})

async function createMockConfig(): Promise<string> {
  // Implementation to create mock configuration for testing
  // Returns path to temporary config file
}
```

## 🚀 Usage Examples

### Basic Usage

```typescript
import { createPromptHandler } from '@qi/prompt'

async function basicExample() {
  const handler = createPromptHandler()
  
  // Initialize with configuration
  const initResult = await handler.initialize('config/prompt-config.yaml')
  
  if (!initResult.success) {
    console.error('Failed to initialize:', initResult.error)
    return
  }
  
  // Simple prompt
  const response = await handler.complete('Explain async/await in JavaScript')
  
  if (response.success) {
    console.log('Response:', response.data)
    console.log('Used model:', response.metadata?.model)
  } else {
    console.error('Error:', response.error)
    response.suggestions?.forEach(s => console.log('Suggestion:', s))
  }
}
```

### Streaming Example

```typescript
async function streamingExample() {
  const handler = createPromptHandler()
  await handler.initialize('config/prompt-config.yaml')
  
  console.log('Streaming response:')
  
  for await (const chunk of handler.stream('Write a Python quicksort function')) {
    process.stdout.write(chunk.content)
    
    if (chunk.isComplete) {
      console.log('\n--- Stream complete ---')
      break
    }
  }
}
```

### Provider Management

```typescript
async function providerExample() {
  const handler = createPromptHandler()
  await handler.initialize('config/prompt-config.yaml')
  
  // Check available providers
  const providers = await handler.getAvailableProviders()
  console.log('Available providers:')
  
  providers.forEach(provider => {
    console.log(`- ${provider.name} (${provider.status})`)
    console.log(`  Models: ${provider.models.map(m => m.name).join(', ')}`)
  })
  
  // Use specific provider
  const response = await handler.complete('Hello!', {
    provider: 'ollama',
    model: 'qwen2.5-coder:7b',
    temperature: 0.3
  })
}
```

This implementation provides a robust, user-friendly prompt processing system that hides complex backend patterns while providing comprehensive LLM integration capabilities.