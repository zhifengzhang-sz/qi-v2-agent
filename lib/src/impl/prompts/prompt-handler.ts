// Basic Prompt Handler Implementation
//
// Simple pass-through implementation that delegates to PromptManager and ModelProvider
// Can be enhanced with LangChain prompt templates and other features later

import type { 
  IPromptHandler, 
  IPromptManager,
  PromptRequest, 
  PromptResponse, 
  PromptStreamChunk,
  PromptTemplate
} from '../../core/interfaces.js';
import type { IModelProvider } from '../../core/interfaces.js';
import type { ModelRoutingEngine } from '../models/model-routing-engine.js';

export class BasicPromptHandler implements IPromptHandler {
  constructor(
    private promptManager: IPromptManager,
    private modelProvider: IModelProvider,
    private routingEngine: ModelRoutingEngine
  ) {}

  async handlePrompt(request: PromptRequest): Promise<PromptResponse> {
    // 1. Process input text (can add preprocessing here)
    let processedInput = request.input;
    
    // 2. Apply template if specified
    if (request.templateId) {
      const template = await this.promptManager.loadTemplate(request.templateId);
      processedInput = await this.renderTemplate(template, request.parameters || new Map([['input', request.input]]));
    }
    
    // 3. Use external routing engine to select provider, then get model config
    const context = request.context || {
      threadId: undefined,
      sessionId: undefined,
      currentInputType: 'prompt',
      userHistory: [],
      environmentContext: new Map()
    };
    
    const selectedProvider = await this.routingEngine.selectProvider(context);
    const availableModels = await this.promptManager.getAvailableModels(selectedProvider);
    
    if (availableModels.length === 0) {
      throw new Error(`No models available for provider: ${selectedProvider}`);
    }
    
    // For now, select the first available model from the chosen provider
    const modelConfig = availableModels[0];

    // 4. Call model provider
    const modelRequest = {
      messages: [{
        role: 'user' as const,
        content: processedInput,
        metadata: new Map(Object.entries(request.parameters || {}))
      }],
      configuration: modelConfig,
      context: new Map(),
      options: {
        model: modelConfig.modelId,
        temperature: modelConfig.parameters.temperature,
        maxTokens: modelConfig.parameters.maxTokens
      }
    };

    const response = await this.modelProvider.invoke(modelRequest);
    
    return {
      content: response.content,
      templateUsed: request.templateId,
      modelUsed: modelConfig.modelId,
      usage: response.usage,
      metadata: response.metadata
    };
  }

  async *streamPrompt(request: PromptRequest): AsyncIterableIterator<PromptStreamChunk> {
    // 1. Process input text (same as handlePrompt)
    let processedInput = request.input;
    
    // 2. Apply template if specified
    if (request.templateId) {
      const template = await this.promptManager.loadTemplate(request.templateId);
      processedInput = await this.renderTemplate(template, request.parameters || new Map([['input', request.input]]));
    }
    
    // 3. Use external routing engine to select provider, then get model config
    const context = request.context || {
      threadId: undefined,
      sessionId: undefined,
      currentInputType: 'prompt',
      userHistory: [],
      environmentContext: new Map()
    };
    
    const selectedProvider = await this.routingEngine.selectProvider(context);
    const availableModels = await this.promptManager.getAvailableModels(selectedProvider);
    
    if (availableModels.length === 0) {
      throw new Error(`No models available for provider: ${selectedProvider}`);
    }
    
    // For now, select the first available model from the chosen provider
    const modelConfig = availableModels[0];

    const modelRequest = {
      messages: [{
        role: 'user' as const,
        content: processedInput,
        metadata: new Map(Object.entries(request.parameters || {}))
      }],
      configuration: modelConfig,
      context: new Map(),
      options: {
        model: modelConfig.modelId,
        temperature: modelConfig.parameters.temperature,
        maxTokens: modelConfig.parameters.maxTokens,
        stream: true
      }
    };

    try {
      for await (const chunk of this.modelProvider.stream(modelRequest)) {
        yield {
          content: chunk.content,
          isComplete: chunk.isComplete,
          metadata: chunk.metadata
        };
      }
    } catch (error) {
      yield {
        content: `Error: ${error}`,
        isComplete: true,
        metadata: new Map([['error', true]])
      };
    }
  }

  async renderTemplate(template: PromptTemplate, parameters: ReadonlyMap<string, unknown>): Promise<string> {
    // Simple template rendering - can be enhanced with proper template engine (LangChain, etc.)
    let rendered = template.template;
    
    for (const [key, value] of parameters) {
      rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    
    return rendered;
  }

  getSupportedTemplates(): readonly string[] {
    return this.promptManager.getAvailableTemplates().map(t => t.id);
  }
}