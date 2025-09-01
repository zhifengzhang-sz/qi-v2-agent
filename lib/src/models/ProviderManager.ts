/**
 * Provider Manager - QiCore Implementation
 * Following implementation guide Step 2.5: Integration with qi-prompt
 */

import { businessError, fromAsyncTryCatch, type QiError, type Result } from '@qi/base';

export interface ModelRequest {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelResponse {
  content: string;
  provider: string;
  model: string;
}

export interface IModelProvider {
  readonly name: string;
  readonly type: 'local' | 'remote';

  isAvailable(): Promise<boolean>;
  invoke(request: ModelRequest): Promise<ModelResponse>;
}

/**
 * Simple Ollama Provider Implementation
 */
export class OllamaProvider implements IModelProvider {
  readonly name = 'ollama';
  readonly type = 'local' as const;

  constructor(private baseUrl: string = 'http://localhost:11434') {}

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: this.buildPrompt(request),
        stream: false,
        options: {
          temperature: request.temperature || 0.7,
          num_predict: request.maxTokens || 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data: any = await response.json();

    return {
      content: data.response || '',
      provider: this.name,
      model: 'llama3.2:3b',
    };
  }

  private buildPrompt(request: ModelRequest): string {
    if (request.system) {
      return `System: ${request.system}\n\nUser: ${request.prompt}`;
    }
    return request.prompt;
  }
}

/**
 * Simple OpenRouter Provider Implementation
 */
export class OpenRouterProvider implements IModelProvider {
  readonly name = 'openrouter';
  readonly type = 'remote' as const;

  constructor(private apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async invoke(request: ModelRequest): Promise<ModelResponse> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://qi-v2-agent.dev',
        'X-Title': 'qi-v2-agent',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku',
        messages: this.buildMessages(request),
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.statusText}`);
    }

    const data: any = await response.json();
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error('No response choices returned from OpenRouter');
    }

    return {
      content: choice.message?.content || '',
      provider: this.name,
      model: 'anthropic/claude-3.5-haiku',
    };
  }

  private buildMessages(request: ModelRequest) {
    const messages = [];

    if (request.system) {
      messages.push({ role: 'system', content: request.system });
    }

    messages.push({ role: 'user', content: request.prompt });

    return messages;
  }
}

/**
 * Provider Manager - following implementation guide exactly
 */
export class ProviderManager {
  private providers: Map<string, IModelProvider> = new Map();
  private preferences: string[] = ['ollama', 'openrouter'];

  constructor() {
    this.registerProvider(new OllamaProvider());

    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey) {
      this.registerProvider(new OpenRouterProvider(openrouterKey));
    }
  }

  registerProvider(provider: IModelProvider): void {
    this.providers.set(provider.name, provider);
  }

  async getAvailableProvider(): Promise<Result<IModelProvider, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        for (const providerName of this.preferences) {
          const provider = this.providers.get(providerName);
          if (provider && (await provider.isAvailable())) {
            return provider;
          }
        }

        throw new Error('No available model providers');
      },
      (error: unknown) =>
        businessError(
          `No available providers: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { code: 'NO_PROVIDERS_AVAILABLE' }
        )
    );
  }

  async invoke(request: ModelRequest): Promise<Result<ModelResponse, QiError>> {
    const providerResult = await this.getAvailableProvider();

    if (providerResult.tag === 'failure') {
      return providerResult;
    }

    return fromAsyncTryCatch(
      async () => {
        return await providerResult.value.invoke(request);
      },
      (error: unknown) =>
        businessError(
          `Provider invocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { code: 'PROVIDER_INVOKE_FAILED' }
        )
    );
  }

  getSystemPrompt(): string {
    return `You are a helpful AI assistant. You provide clear, accurate, and concise responses.`;
  }
}
