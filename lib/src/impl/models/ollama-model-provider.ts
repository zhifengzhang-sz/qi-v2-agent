// Ollama Model Provider Implementation
//
// Modern 2025 implementation using direct ollama package for local LLM support
// Provides streaming, token estimation, and model management capabilities

import { Ollama } from 'ollama';
import type {
  IModelProvider,
  ModelConfiguration,
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelMessage,
  TokenUsage,
  ProcessingContext
} from '../../core/interfaces.js';

export class OllamaModelProvider implements IModelProvider {
  private client: Ollama;
  private configurations = new Map<string, ModelConfiguration>();
  private defaultModel: string;
  private baseUrl: string;
  private tokenCache = new Map<string, { tokenCount: number; timestamp: number }>();
  private readonly tokenCacheTimeout = 300000; // 5 minutes

  constructor(config: OllamaModelProviderConfig) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.defaultModel = config.defaultModel || 'qwen2.5:7b';
    
    // Initialize Ollama client
    this.client = new Ollama({ host: this.baseUrl });
    
    // Initialize models from configuration
    this.initializeModels(config.models || []);
    
    // Clean up token cache periodically
    setInterval(() => this.cleanTokenCache(), 600000); // Clean every 10 minutes
  }

  async getAvailableModels(): Promise<readonly ModelConfiguration[]> {
    try {
      // Get available models from Ollama client
      const response = await this.client.list();
      const availableModels: ModelConfiguration[] = [];

      for (const model of response.models || []) {
        const config: ModelConfiguration = {
          id: model.name,
          name: model.name,
          providerId: 'ollama',
          modelId: model.name,
          parameters: {
            temperature: 0.7,
            maxTokens: this.estimateContextLength(model.name),
            topP: 0.9
          },
          capabilities: {
            supportsStreaming: true,
            supportsToolCalling: model.name.includes('qwen') || model.name.includes('llama'),
            supportsSystemMessages: true,
            maxContextLength: this.estimateContextLength(model.name),
            supportedMessageTypes: ['user', 'assistant', 'system']
          }
        };
        
        availableModels.push(config);
        this.configurations.set(model.name, config);
      }

      return availableModels;
    } catch (error) {
      console.warn('Failed to fetch models from Ollama server, using configured models:', error);
      return Array.from(this.configurations.values());
    }
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    const modelId = request.options?.model || this.defaultModel;
    
    try {
      const messages = this.convertToOllamaMessages(request.messages);
      
      const response = await this.client.chat({
        model: modelId,
        messages: messages,
        stream: false,
        options: {
          temperature: request.options?.temperature || 0.7,
          num_predict: request.options?.maxTokens || 2048,
          top_p: request.options?.topP || 0.9,
          top_k: request.options?.topK || 40
        }
      } as any) as any; // Cast to any due to API type inconsistencies
      
      const executionTime = Date.now() - startTime;
      
      // Use actual token counts from Ollama response if available
      const inputTokens = response.prompt_eval_count || await this.estimateTokens(request.messages);
      const outputTokens = response.eval_count || Math.ceil((response.message?.content || '').length / 4);
      
      return {
        content: response.message?.content || '',
        finishReason: 'completed',
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens
        },
        metadata: new Map([
          ['provider', 'ollama'],
          ['baseUrl', this.baseUrl],
          ['responseId', `ollama-${Date.now()}`],
          ['temperature', String(request.options?.temperature || 0.7)],
          ['model', modelId],
          ['executionTime', String(executionTime)],
          ['totalDuration', String(response.total_duration || 0)],
          ['loadDuration', String(response.load_duration || 0)],
          ['promptEvalDuration', String(response.prompt_eval_duration || 0)],
          ['evalDuration', String(response.eval_duration || 0)]
        ])
      };
    } catch (error) {
      throw new Error(`Model invocation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async *stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk> {
    const modelId = request.options?.model || this.defaultModel;
    let accumulatedContent = '';
    let tokenCount = 0;
    
    try {
      const messages = this.convertToOllamaMessages(request.messages);
      
      const stream = await this.client.chat({
        model: modelId,
        messages: messages,
        stream: true,
        options: {
          temperature: request.options?.temperature || 0.7,
          num_predict: request.options?.maxTokens || 2048,
          top_p: request.options?.topP || 0.9,
          top_k: request.options?.topK || 40
        }
      } as any);
      
      for await (const chunk of stream) {
        const content = (chunk as any).message?.content || '';
        accumulatedContent += content;
        tokenCount += Math.ceil(content.length / 4); // Rough estimate
        
        yield {
          content,
          isComplete: false,
          usage: {
            promptTokens: await this.estimateTokens(request.messages),
            completionTokens: tokenCount,
            totalTokens: await this.estimateTokens(request.messages) + tokenCount
          },
          metadata: new Map([
            ['provider', 'ollama'],
            ['model', modelId],
            ['accumulatedLength', String(accumulatedContent.length)]
          ])
        };
      }
      
      // Final completion chunk
      yield {
        content: '',
        isComplete: true,
        usage: {
          promptTokens: await this.estimateTokens(request.messages),
          completionTokens: tokenCount,
          totalTokens: await this.estimateTokens(request.messages) + tokenCount
        },
        metadata: new Map([
          ['provider', 'ollama'],
          ['model', modelId],
          ['finalContent', accumulatedContent],
          ['completed', 'true']
        ])
      };
    } catch (error) {
      yield {
        content: '',
        isComplete: true,
        metadata: new Map([
          ['provider', 'ollama'],
          ['model', modelId],
          ['errorType', 'streaming-failed'],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      };
    }
  }

  async validateConfiguration(config: ModelConfiguration): Promise<boolean> {
    try {
      // Check if model exists using Ollama client
      await this.client.show({ model: config.id });
      return true;
    } catch (error) {
      return false;
    }
  }

  async estimateTokens(messages: readonly ModelMessage[]): Promise<number> {
    try {
      // Use Ollama's tokenization endpoint for accurate token counting
      const modelId = this.defaultModel;
      let totalTokens = 0;
      
      for (const message of messages) {
        const tokenCount = await this.getTokenCountFromOllama(message.content, modelId);
        totalTokens += tokenCount;
        
        // Add small overhead for role and message formatting
        totalTokens += 5;
      }
      
      return totalTokens;
    } catch (error) {
      console.warn('Failed to get accurate token count from Ollama, falling back to estimation:', error);
      return this.fallbackTokenEstimation(messages);
    }
  }

  private async getTokenCountFromOllama(text: string, modelId: string): Promise<number> {
    try {
      // Check if we have a cached result for this text
      const cacheKey = this.createTokenCacheKey(text, modelId);
      const cached = this.tokenCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.tokenCacheTimeout) {
        return cached.tokenCount;
      }
      
      // Use Ollama's embedding endpoint to get token count
      // This is more accurate than character-based estimation
      const response = await this.client.embeddings({
        model: modelId,
        prompt: text
      });
      
      // Extract token count from embedding response
      const tokenCount = (response as any).prompt_eval_count || this.fallbackTokenEstimationForText(text);
      
      // Cache the result
      this.tokenCache.set(cacheKey, {
        tokenCount,
        timestamp: Date.now()
      });
      
      return tokenCount;
    } catch (error) {
      // If the API call fails, fall back to improved estimation
      return this.fallbackTokenEstimationForText(text);
    }
  }

  private fallbackTokenEstimation(messages: readonly ModelMessage[]): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      totalTokens += this.fallbackTokenEstimationForText(message.content);
      // Add overhead for role and formatting
      totalTokens += 8;
    }
    
    return totalTokens;
  }

  private fallbackTokenEstimationForText(text: string): number {
    // Improved token estimation algorithm
    // Based on more sophisticated heuristics than simple character count
    
    // Count words, punctuation, and special characters separately
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const punctuation = (text.match(/[.,!?;:'"()\[\]{}\-]/g) || []).length;
    const numbers = (text.match(/\d+/g) || []).length;
    const specialChars = (text.match(/[^\w\s.,!?;:'"()\[\]{}\-]/g) || []).length;
    
    // Estimate tokens more accurately
    let tokenCount = 0;
    
    // Each word typically becomes 1-2 tokens
    tokenCount += words.length * 1.3;
    
    // Punctuation usually becomes separate tokens
    tokenCount += punctuation * 0.8;
    
    // Numbers can be multi-token
    tokenCount += numbers * 1.5;
    
    // Special characters often become separate tokens
    tokenCount += specialChars;
    
    // Account for subword tokenization (longer words often split)
    const longWords = words.filter(word => word.length > 8).length;
    tokenCount += longWords * 0.5;
    
    return Math.ceil(tokenCount);
  }

  private createTokenCacheKey(text: string, modelId: string): string {
    // Create a cache key that includes model and a hash of the text
    const textHash = this.simpleHash(text);
    return `${modelId}:${textHash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private cleanTokenCache(): void {
    const now = Date.now();
    const cutoff = now - this.tokenCacheTimeout;
    
    for (const [key, value] of this.tokenCache) {
      if (value.timestamp < cutoff) {
        this.tokenCache.delete(key);
      }
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private convertToOllamaMessages(messages: readonly ModelMessage[]) {
    return messages.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content
    }));
  }

  private initializeModels(configs: ModelConfiguration[]): void {
    for (const config of configs) {
      this.configurations.set(config.id, config);
    }
    
    // Add default models if none provided
    if (configs.length === 0) {
      this.addDefaultModels();
    }
  }

  private addDefaultModels(): void {
    const defaultModels: ModelConfiguration[] = [
      {
        id: 'qwen2.5:7b',
        name: 'Qwen 2.5 7B',
        providerId: 'ollama',
        modelId: 'qwen2.5:7b',
        parameters: {
          temperature: 0.7,
          maxTokens: 32768,
          topP: 0.9
        },
        capabilities: {
          supportsStreaming: true,
          supportsToolCalling: true,
          supportsSystemMessages: true,
          maxContextLength: 32768,
          supportedMessageTypes: ['user', 'assistant', 'system']
        }
      },
      {
        id: 'llama3.2:3b',
        name: 'Llama 3.2 3B',
        providerId: 'ollama',
        modelId: 'llama3.2:3b',
        parameters: {
          temperature: 0.7,
          maxTokens: 8192,
          topP: 0.9
        },
        capabilities: {
          supportsStreaming: true,
          supportsToolCalling: true,
          supportsSystemMessages: true,
          maxContextLength: 8192,
          supportedMessageTypes: ['user', 'assistant', 'system']
        }
      },
      {
        id: 'codellama:7b',
        name: 'Code Llama 7B',
        providerId: 'ollama',
        modelId: 'codellama:7b',
        parameters: {
          temperature: 0.2,
          maxTokens: 16384,
          topP: 0.9
        },
        capabilities: {
          supportsStreaming: true,
          supportsToolCalling: true,
          supportsSystemMessages: true,
          maxContextLength: 16384,
          supportedMessageTypes: ['user', 'assistant', 'system']
        }
      }
    ];

    for (const model of defaultModels) {
      this.configurations.set(model.id, model);
    }
  }

  private estimateContextLength(modelName: string): number {
    // Estimate context length based on model name patterns
    if (modelName.includes('32k') || modelName.includes('qwen2.5')) return 32768;
    if (modelName.includes('16k')) return 16384;
    if (modelName.includes('8k')) return 8192;
    if (modelName.includes('4k')) return 4096;
    
    // Default estimates based on model type
    if (modelName.includes('llama3.2')) return 8192;
    if (modelName.includes('codellama')) return 16384;
    if (modelName.includes('mistral')) return 8192;
    if (modelName.includes('phi')) return 4096;
    
    return 4096; // Conservative default
  }

  // Enhanced model management methods
  async pullModel(modelName: string): Promise<boolean> {
    try {
      await this.client.pull({ model: modelName });
      return true;
    } catch (error) {
      console.error(`Failed to pull model ${modelName}:`, error);
      return false;
    }
  }

  async deleteModel(modelName: string): Promise<boolean> {
    try {
      await this.client.delete({ model: modelName });
      this.configurations.delete(modelName);
      return true;
    } catch (error) {
      console.error(`Failed to delete model ${modelName}:`, error);
      return false;
    }
  }

  async getModelInfo(modelName: string): Promise<any> {
    try {
      return await this.client.show({ model: modelName });
    } catch (error) {
      console.error(`Failed to get model info for ${modelName}:`, error);
      return null;
    }
  }

  // Health check for Ollama server
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: string }> {
    try {
      const response = await this.client.list();
      return {
        status: 'healthy',
        details: `Connected to Ollama server with ${response.models?.length || 0} models available`
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Failed to connect to Ollama server: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // Get provider statistics
  getProviderStats(): {
    totalModels: number;
    defaultModel: string;
    baseUrl: string;
  } {
    return {
      totalModels: this.configurations.size,
      defaultModel: this.defaultModel,
      baseUrl: this.baseUrl
    };
  }
}

// =============================================================================
// Configuration Interface
// =============================================================================

export interface OllamaModelProviderConfig {
  baseUrl?: string;
  defaultModel?: string;
  models?: ModelConfiguration[];
  connectionTimeout?: number;
  requestTimeout?: number;
}