/**
 * OllamaStructuredWrapper - Hybrid LangChain + multi-llm-ts solution
 *
 * Uses working multi-llm-ts for actual Ollama calls while maintaining
 * LangChain interface compatibility for structured output
 */

import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { LLM } from '@langchain/core/language_models/llms';
import { type ChatModel, igniteEngine, type LlmEngine, loadModels, Message } from 'multi-llm-ts';

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
      baseURL: config.baseURL || 'http://172.18.144.1:11434',
    });

    // Create model with proper capabilities structure
    this.model = {
      id: config.model,
      name: config.model,
      capabilities: {
        tools: false,
        vision: false,
      } as any, // TODO: Check ModelCapabilities interface
    };
  }

  async _call(
    prompt: string,
    _options?: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    try {
      // Use the same working pattern as prompt system
      const messages = [new Message('user', prompt)];
      const response = await this.engine.complete(this.model, messages);
      
      return this.processResponse(response);
    } catch (error) {
      throw new Error(
        `OllamaStructuredWrapper call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private processResponse(response: any): string {
      // Handle different response formats (same as prompt system)
      if (typeof response === 'string') {
        return response;
      }

      if (response && typeof response === 'object' && 'content' in response) {
        return response.content as string;
      }

      return JSON.stringify(response);
  }

  _llmType(): string {
    return 'ollama-structured-wrapper';
  }

  get _identifying_params() {
    return {
      model: this.config.model,
      baseURL: this.config.baseURL,
      temperature: this.config.temperature,
      _type: 'ollama-structured-wrapper',
    };
  }

  /**
   * Generate structured output using JSON prompting
   * This replaces the broken ChatOllama.withStructuredOutput()
   */
  async generateStructured<T>(prompt: string, schema: any): Promise<T> {
    // Build simpler JSON prompt for smaller models
    const jsonPrompt = `${prompt}

Respond with ONLY a JSON object in this format:
{
  "type": "prompt or workflow",
  "confidence": 0.8,
  "reasoning": "brief explanation",
  "indicators": ["key", "words"],
  "extracted_data": {}
}

JSON response:`;

    try {
      const response = await this._call(jsonPrompt);

      // Clean and extract JSON more robustly
      let jsonString = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to find JSON object bounds more carefully
      const firstBrace = jsonString.indexOf('{');
      const lastBrace = jsonString.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
      }
      
      // Parse with better error handling
      try {
        const parsed = JSON.parse(jsonString);
        return parsed as T;
      } catch (parseError) {
        // Log the full raw response for debugging
        console.warn(`Raw model response (first 500 chars): ${response.substring(0, 500)}`);
        console.warn(`Extracted JSON string: ${jsonString}`);
        console.warn(`Parse error: ${parseError}`);
        
        // Try to fix common JSON issues
        let fixedJson = jsonString;
        
        // Fix truncated strings (common issue)
        if (fixedJson.includes('"reasoning": "') && !fixedJson.includes('",\n  "indicators"')) {
          // Find and fix incomplete reasoning field
          const reasoningMatch = fixedJson.match(/"reasoning": "([^"]*?)$/);
          if (reasoningMatch) {
            fixedJson = fixedJson.replace(reasoningMatch[0], '"reasoning": "Incomplete response"');
          }
        }
        
        // Try parsing the fixed version
        try {
          const parsed = JSON.parse(fixedJson);
          console.warn(`Successfully parsed with fix`);
          return parsed as T;
        } catch (_) {
          // Return a fallback result that matches the schema structure
          const fallback = this.createFallbackResult(schema);
          return fallback as T;
        }
      }
      
    } catch (error) {
      throw new Error(
        `Structured output generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  private createFallbackResult(schema: any): any {
    // Create a basic fallback that matches the expected schema
    if (schema.properties) {
      const fallback: any = {};
      
      if (schema.properties.type) {
        fallback.type = 'prompt'; // Default classification
      }
      if (schema.properties.confidence) {
        fallback.confidence = 0.5; // Low confidence for fallback
      }
      if (schema.properties.reasoning) {
        fallback.reasoning = 'Classification failed, using fallback';
      }
      if (schema.properties.indicators) {
        fallback.indicators = ['parsing_error'];
      }
      if (schema.properties.extracted_data) {
        fallback.extracted_data = {};
      }
      
      return fallback;
    }
    
    return { error: 'fallback_result' };
  }

  /**
   * Alternative method for simpler structured outputs
   */
  async generateSimpleStructured(prompt: string, fields: string[]): Promise<Record<string, any>> {
    const schema = {
      type: 'object',
      properties: Object.fromEntries(fields.map((field) => [field, { type: 'string' }])),
      required: fields,
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
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get available models
   */
  async getAvailableModels(): Promise<ChatModel[]> {
    try {
      const models = await loadModels('ollama', {
        baseURL: this.config.baseURL || 'http://172.18.144.1:11434',
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
export function createOllamaStructuredWrapper(
  config: OllamaStructuredConfig
): OllamaStructuredWrapper {
  return new OllamaStructuredWrapper(config);
}

/**
 * Structured output method that mimics LangChain's withStructuredOutput interface
 */
export class StructuredOllamaModel {
  constructor(
    private wrapper: OllamaStructuredWrapper,
    private schema: any
  ) {}

  async invoke(prompt: string): Promise<any> {
    return this.wrapper.generateStructured(prompt, this.schema);
  }
}

/**
 * Create a structured model that mimics LangChain's withStructuredOutput pattern
 */
export function withStructuredOutput(
  wrapper: OllamaStructuredWrapper,
  schema: any
): StructuredOllamaModel {
  return new StructuredOllamaModel(wrapper, schema);
}
