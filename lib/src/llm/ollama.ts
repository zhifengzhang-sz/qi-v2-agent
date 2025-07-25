import { ChatOllama } from '@langchain/ollama';
import type { ModelConfig } from '../config/schema.js';
import type { StreamingOptions, AgentResponse } from '../utils/types.js';

export class OllamaLLM {
  private model: ChatOllama;
  private config: ModelConfig;

  constructor(config: ModelConfig) {
    this.config = config;
    this.model = this.createModel(config);
  }

  private createModel(config: ModelConfig): ChatOllama {
    return new ChatOllama({
      model: config.name,
      baseUrl: config.baseUrl || 'http://localhost:11434',
      temperature: config.temperature,
      maxRetries: 3,
      topP: config.topP || 0.9,
      // DeepSeek-R1 specific features
      ...(config.name.includes('deepseek-r1') && {
        thinkingEnabled: config.thinkingEnabled,
      }),
    });
  }

  async invoke(messages: Array<{ role: string; content: string }>): Promise<AgentResponse> {
    try {
      const startTime = Date.now();
      const response = await this.model.invoke(messages);
      const responseTime = Date.now() - startTime;

      return {
        content: response.content as string,
        metadata: {
          model: this.config.name,
          responseTime,
          timestamp: new Date(),
        },
      };
    } catch (error) {
      console.error('LLM invocation failed:', error);
      throw new Error(`LLM failed to respond: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stream(
    messages: Array<{ role: string; content: string }>,
    options: StreamingOptions = {}
  ): Promise<string> {
    const { onToken, onThinking, onComplete, onError, controller } = options;
    
    try {
      let fullResponse = '';
      let thinkingContent = '';
      
      const stream = await this.model.stream(messages, {
        signal: controller?.signal,
      });
      
      for await (const chunk of stream) {
        const content = typeof chunk.content === 'string' 
          ? chunk.content 
          : JSON.stringify(chunk.content);
        
        // Handle thinking mode for DeepSeek-R1
        if (this.isThinkingContent(content)) {
          thinkingContent += content;
          onThinking?.(content);
        } else {
          fullResponse += content;
          onToken?.(content);
        }
      }
      
      // Clean up thinking content from final response
      const cleanResponse = this.cleanThinkingContent(fullResponse);
      onComplete?.(cleanResponse);
      return cleanResponse;
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
      throw errorObj;
    }
  }

  private isThinkingContent(content: string): boolean {
    // Filter thinking content for models that use <think> tags
    return content.includes('<think>') || 
           content.includes('</think>') ||
           (this.config.name.includes('deepseek-r1') && 
            (this.config.thinkingEnabled === true) &&
            content.includes('<think>'));
  }

  private cleanThinkingContent(text: string): string {
    // Remove everything between <think> and </think> tags
    return text
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/\n\s*\n/g, '\n') // Remove extra newlines
      .trim();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.model.invoke([
        { role: 'user', content: 'Hello' }
      ]);
      return !!response.content;
    } catch (error) {
      console.warn('Ollama health check failed:', error);
      return false;
    }
  }

  getModel(): ChatOllama {
    return this.model;
  }

  getConfig(): ModelConfig {
    return { ...this.config };
  }

  // Update model configuration
  updateConfig(newConfig: Partial<ModelConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.model = this.createModel(this.config);
  }
}