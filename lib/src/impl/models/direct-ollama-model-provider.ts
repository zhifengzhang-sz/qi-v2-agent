// Direct Ollama Model Provider - Bypasses LangChain
//
// Uses direct HTTP calls to Ollama API instead of @langchain/ollama wrapper
// to avoid version compatibility issues

import type { 
  IModelProvider,
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelConfiguration,
  ModelMessage
} from '../../core/interfaces.js';

export class DirectOllamaModelProvider implements IModelProvider {
  private baseUrl: string;
  private defaultModel: string;
  private connectionTimeout: number;
  private requestTimeout: number;

  constructor(config: {
    baseUrl?: string;
    defaultModel?: string;
    connectionTimeout?: number;
    requestTimeout?: number;
  } = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
    this.defaultModel = config.defaultModel || 'qwen2.5-coder:7b';
    this.connectionTimeout = config.connectionTimeout || 30000;
    this.requestTimeout = config.requestTimeout || 120000;
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const startTime = Date.now();
    const modelId = request.options?.model || this.defaultModel;
    
    try {
      // Convert messages to simple prompt
      const prompt = this.convertMessagesToPrompt(request.messages);
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          prompt: prompt,
          stream: false,
          options: {
            temperature: request.options?.temperature || 0.7,
            num_predict: request.options?.maxTokens || 2048,
            top_k: request.options?.topK || 40,
            top_p: request.options?.topP || 0.9,
          },
          keep_alive: -1 // Keep model loaded
        }),
        signal: AbortSignal.timeout(this.requestTimeout)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json() as any;
      const executionTime = Date.now() - startTime;
      
      // Estimate token usage
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(result.response.length / 4);
      
      return {
        content: result.response,
        finishReason: result.done ? 'completed' : 'stop',
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens
        },
        metadata: new Map([
          ['provider', 'direct-ollama'],
          ['baseUrl', this.baseUrl],
          ['model', modelId],
          ['executionTime', executionTime.toString()],
          ['temperature', (request.options?.temperature || 0.7).toString()],
          ['responseId', `ollama-${Date.now()}`],
          ['context_length', result.context?.length?.toString() || '0']
        ])
      };
    } catch (error) {
      throw new Error(`Direct Ollama invocation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async *stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk> {
    const modelId = request.options?.model || this.defaultModel;
    let accumulatedContent = '';
    
    try {
      const prompt = this.convertMessagesToPrompt(request.messages);
      
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelId,
          prompt: prompt,
          stream: true,
          options: {
            temperature: request.options?.temperature || 0.7,
            num_predict: request.options?.maxTokens || 2048,
            top_k: request.options?.topK || 40,
            top_p: request.options?.topP || 0.9,
          },
          keep_alive: -1
        }),
        signal: AbortSignal.timeout(this.requestTimeout)
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.response) {
              accumulatedContent += data.response;
              
              yield {
                content: data.response,
                isComplete: data.done || false,
                metadata: new Map([
                  ['provider', 'direct-ollama'],
                  ['model', modelId],
                  ['accumulated_length', accumulatedContent.length.toString()]
                ])
              };
            }
            
            if (data.done) {
              yield {
                content: '',
                isComplete: true,
                metadata: new Map([
                  ['provider', 'direct-ollama'],
                  ['model', modelId],
                  ['total_content', accumulatedContent],
                  ['completed', 'true']
                ])
              };
              break;
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } catch (error) {
      yield {
        content: '',
        isComplete: true,
        metadata: new Map([
          ['provider', 'direct-ollama'],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      };
    }
  }

  async getAvailableModels(): Promise<readonly ModelConfiguration[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.connectionTimeout)
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      const models: ModelConfiguration[] = [];
      
      for (const model of data.models || []) {
        models.push({
          id: `direct-ollama-${model.name}`,
          name: model.name,
          modelId: model.name,
          providerId: 'direct-ollama',
          parameters: {
            temperature: 0.7,
            maxTokens: 2048
          },
          capabilities: {
            supportsStreaming: true,
            supportsToolCalling: false,
            supportsSystemMessages: true,
            maxContextLength: 4096,
            supportedMessageTypes: ['text']
          }
        });
      }
      
      return models;
    } catch (error) {
      console.error('Error fetching available models:', error);
      return [];
    }
  }

  async validateConfiguration(config: ModelConfiguration): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.connectionTimeout)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.connectionTimeout)
      });
      
      if (response.ok) {
        const data = await response.json() as any;
        return {
          status: 'healthy',
          details: `Connected to Ollama server with ${data.models?.length || 0} models available`
        };
      } else {
        return {
          status: 'unhealthy',
          details: `Ollama server responded with status ${response.status}`
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        details: `Failed to connect to Ollama: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async estimateTokens(messages: readonly ModelMessage[]): Promise<number> {
    const prompt = this.convertMessagesToPrompt(messages);
    return Math.ceil(prompt.length / 4); // Rough estimation: ~4 characters per token
  }

  private convertMessagesToPrompt(messages: readonly ModelMessage[]): string {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return `System: ${msg.content}`;
        case 'user':
          return `Human: ${msg.content}`;
        case 'assistant':
          return `Assistant: ${msg.content}`;
        default:
          return msg.content;
      }
    }).join('\n\n');
  }
}