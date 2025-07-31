/**
 * OllamaStructuredWrapper - Hybrid LangChain + multi-llm-ts solution
 * 
 * Uses working multi-llm-ts for actual Ollama calls while maintaining
 * LangChain interface compatibility for structured output
 */

import { LLM } from "@langchain/core/language_models/llms";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { igniteEngine, loadModels, Message, type LlmEngine, type ChatModel } from 'multi-llm-ts';

export interface OllamaStructuredConfig {
  model: string;
  baseURL?: string;
  temperature?: number;
  timeout?: number;
}

export class OllamaStructuredWrapper extends LLM {
  private engine: LlmEngine;
  private model: ChatModel;
  private config: OllamaStructuredConfig;

  constructor(config: OllamaStructuredConfig) {
    super({});
    this.config = config;
    
    // Initialize multi-llm-ts engine (same as working prompt system)
    this.engine = igniteEngine('ollama', {
      baseURL: config.baseURL || 'http://172.18.144.1:11434'
    });
    
    // Create model with proper capabilities structure
    this.model = {
      id: config.model,
      name: config.model,
      capabilities: {
        chat: true,
        tools: false,
        vision: false
      }
    };
  }

  async _call(
    prompt: string,
    options?: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    try {
      // Use the same working pattern as prompt system
      const messages = [new Message('user', prompt)];
      const response = await this.engine.complete(this.model, messages);
      
      // Handle different response formats (same as prompt system)
      if (typeof response === 'string') {
        return response;
      }
      
      if (response && typeof response === 'object' && 'content' in response) {
        return response.content as string;
      }
      
      return JSON.stringify(response);
    } catch (error) {
      throw new Error(`OllamaStructuredWrapper call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  _llmType(): string {
    return "ollama-structured-wrapper";
  }

  get _identifying_params() {
    return {
      model: this.config.model,
      baseURL: this.config.baseURL,
      temperature: this.config.temperature,
      _type: "ollama-structured-wrapper"
    };
  }

  /**
   * Generate structured output using JSON prompting
   * This replaces the broken ChatOllama.withStructuredOutput()
   */
  async generateStructured<T>(prompt: string, schema: any): Promise<T> {
    // Build JSON prompt with clear instructions
    const jsonPrompt = `${prompt}

IMPORTANT: You must respond with valid JSON only. No markdown, no explanations, just pure JSON.

Your response must match this exact schema:
${JSON.stringify(schema, null, 2)}

Respond with valid JSON that matches the schema above:`;

    try {
      const response = await this._call(jsonPrompt);
      
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response.trim();
      
      // Parse and return
      const parsed = JSON.parse(jsonString);
      return parsed as T;
    } catch (error) {
      throw new Error(`Structured output generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Alternative method for simpler structured outputs
   */
  async generateSimpleStructured(prompt: string, fields: string[]): Promise<Record<string, any>> {
    const schema = {
      type: "object",
      properties: Object.fromEntries(
        fields.map(field => [field, { type: "string" }])
      ),
      required: fields
    };

    return this.generateStructured(prompt, schema);
  }

  /**
   * Check if Ollama service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const baseUrl = this.config.baseURL || 'http://172.18.144.1:11434';
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<ChatModel[]> {
    try {
      const models = await loadModels('ollama', {
        baseURL: this.config.baseURL || 'http://172.18.144.1:11434'
      });
      return models?.chat || [];
    } catch (error) {
      console.warn('Failed to load models:', error);
      return [];
    }
  }
}

/**
 * Factory function for creating OllamaStructuredWrapper instances
 */
export function createOllamaStructuredWrapper(config: OllamaStructuredConfig): OllamaStructuredWrapper {
  return new OllamaStructuredWrapper(config);
}

/**
 * Structured output method that mimics LangChain's withStructuredOutput interface
 */
export class StructuredOllamaModel {
  constructor(private wrapper: OllamaStructuredWrapper, private schema: any) {}

  async invoke(prompt: string): Promise<any> {
    return this.wrapper.generateStructured(prompt, this.schema);
  }
}

/**
 * Create a structured model that mimics LangChain's withStructuredOutput pattern
 */
export function withStructuredOutput(wrapper: OllamaStructuredWrapper, schema: any): StructuredOllamaModel {
  return new StructuredOllamaModel(wrapper, schema);
}