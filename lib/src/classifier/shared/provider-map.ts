/**
 * Provider Map for Multi-Provider LLM Support
 * 
 * Provides automatic detection and configuration for different LLM providers
 * based on model names and patterns. Eliminates hardcoded provider assumptions.
 */

import type { ChatOpenAI } from '@langchain/openai';
import type { ChatOllama } from '@langchain/ollama';
import type { ChatAnthropic } from '@langchain/anthropic';

/**
 * Configuration for a specific LLM provider
 */
export interface ProviderConfig {
  /** Base URL for the provider's API */
  baseUrl: string;
  
  /** LangChain LLM class to use for this provider */
  llmClass: typeof ChatOllama | typeof ChatOpenAI | typeof ChatAnthropic;
  
  /** Environment variable name for API key */
  apiKeyEnv: string;
  
  /** Regex pattern to detect if a model belongs to this provider */
  modelPattern: RegExp;
  
  /** Whether this provider supports function calling */
  functionCallingSupported: boolean;
  
  /** API endpoint type for compatibility handling */
  endpointType: 'ollama' | 'openai-compatible' | 'anthropic';
  
  /** Default configuration options for this provider */
  configDefaults?: Record<string, any>;
  
  /** Display name for this provider */
  displayName: string;
  
  /** Optional model name transformation function */
  transformModelName?: (modelId: string) => string;
}

/**
 * Extended provider config with detected provider name
 */
export interface DetectedProviderConfig extends ProviderConfig {
  providerName: string;
}

/**
 * Comprehensive provider map supporting multiple LLM providers
 */
export const PROVIDER_MAP: Record<string, ProviderConfig> = {
  'ollama': {
    baseUrl: 'http://localhost:11434',
    llmClass: null as any, // Will be dynamically imported
    apiKeyEnv: 'OLLAMA_API_KEY',
    modelPattern: /^(llama|qwen|mistral|codellama|phi|gemma|deepseek)[\d\w\-:.]*$/i,
    functionCallingSupported: true,
    endpointType: 'ollama',
    displayName: 'Ollama (Local)',
    configDefaults: {
      timeout: 30000,
      keepAlive: '5m'
    }
  },
  
  'openrouter': {
    baseUrl: 'https://openrouter.ai/api/v1',
    llmClass: null as any, // Will be dynamically imported
    apiKeyEnv: 'OPENROUTER_API_KEY', 
    modelPattern: /^[\w\-]+\/[\w\-.:]+$/,
    functionCallingSupported: true,
    endpointType: 'openai-compatible',
    displayName: 'OpenRouter',
    configDefaults: {
      timeout: 60000
    }
  },
  
  'openai': {
    baseUrl: 'https://api.openai.com/v1',
    llmClass: null as any, // Will be dynamically imported
    apiKeyEnv: 'OPENAI_API_KEY',
    modelPattern: /^(gpt-|o1-|text-|davinci|curie|babbage|ada)/i,
    functionCallingSupported: true,
    endpointType: 'openai-compatible',
    displayName: 'OpenAI',
    configDefaults: {
      timeout: 60000
    }
  },
  
  'anthropic': {
    baseUrl: 'https://api.anthropic.com',
    llmClass: null as any, // Will be dynamically imported
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    modelPattern: /^(claude-|haiku|sonnet|opus)/i,
    functionCallingSupported: true,
    endpointType: 'anthropic',
    displayName: 'Anthropic',
    configDefaults: {
      timeout: 60000
    }
  },
  
  'together': {
    baseUrl: 'https://api.together.xyz/v1',
    llmClass: null as any, // Will be dynamically imported
    apiKeyEnv: 'TOGETHER_API_KEY',
    modelPattern: /^(meta-llama|mistralai|NousResearch|togethercomputer)[\w\-\/]+$/i,
    functionCallingSupported: true,
    endpointType: 'openai-compatible',
    displayName: 'Together AI',
    configDefaults: {
      timeout: 60000
    }
  },
  
  'groq': {
    baseUrl: 'https://api.groq.com/openai/v1',
    llmClass: null as any, // Will be dynamically imported
    apiKeyEnv: 'GROQ_API_KEY',
    modelPattern: /^(llama-|mixtral-|gemma-)/i,
    functionCallingSupported: true,
    endpointType: 'openai-compatible',
    displayName: 'Groq',
    configDefaults: {
      timeout: 30000
    }
  }
};

/**
 * Detect which provider a model belongs to based on model name patterns
 */
export function detectProviderFromModel(modelId: string): DetectedProviderConfig | null {
  if (!modelId) return null;
  
  for (const [providerName, config] of Object.entries(PROVIDER_MAP)) {
    if (config.modelPattern.test(modelId)) {
      return {
        ...config,
        providerName
      };
    }
  }
  
  return null;
}

/**
 * Get provider config by explicit provider name
 */
export function getProviderConfig(providerName: string): ProviderConfig | null {
  return PROVIDER_MAP[providerName] || null;
}

/**
 * List all available providers
 */
export function listProviders(): Array<{ name: string; displayName: string; endpointType: string }> {
  return Object.entries(PROVIDER_MAP).map(([name, config]) => ({
    name,
    displayName: config.displayName,
    endpointType: config.endpointType
  }));
}

/**
 * Create LLM instance with appropriate provider configuration
 */
export async function createLLMInstance(
  modelId: string, 
  options: {
    baseUrl?: string;
    apiKey?: string;
    temperature?: number;
    timeout?: number;
    [key: string]: any;
  } = {}
): Promise<ChatOllama | ChatOpenAI | ChatAnthropic> {
  const providerConfig = detectProviderFromModel(modelId);
  
  if (!providerConfig) {
    throw new Error(
      `Unable to detect provider for model "${modelId}". Supported patterns: ${
        Object.entries(PROVIDER_MAP)
          .map(([name, config]) => `${name}: ${config.modelPattern}`)
          .join(', ')
      }`
    );
  }
  
  // Get API key from environment or options
  const apiKey = options.apiKey || process.env[providerConfig.apiKeyEnv];
  
  // Validate API key for non-Ollama providers
  if (providerConfig.endpointType !== 'ollama' && !apiKey) {
    throw new Error(
      `API key required for ${providerConfig.displayName}. Set ${providerConfig.apiKeyEnv} environment variable or pass apiKey option.`
    );
  }
  
  // Merge configuration
  const finalConfig = {
    model: providerConfig.transformModelName ? providerConfig.transformModelName(modelId) : modelId,
    baseUrl: options.baseUrl || providerConfig.baseUrl,
    temperature: options.temperature ?? 0.1,
    timeout: options.timeout ?? providerConfig.configDefaults?.timeout ?? 30000,
    ...providerConfig.configDefaults,
    ...options
  };
  
  // Add API key for non-Ollama providers
  if (providerConfig.endpointType !== 'ollama') {
    // OpenRouter specific configuration
    if (providerConfig.providerName === 'openrouter') {
      (finalConfig as any).openAIApiKey = apiKey; // OpenRouter uses openAIApiKey parameter (capitalized AI)
    } else {
      // Standard OpenAI and other providers
      (finalConfig as any).apiKey = apiKey;
    }
  }
  
  
  // Dynamically import and instantiate the appropriate LLM class
  let LLMClass: any;
  
  switch (providerConfig.endpointType) {
    case 'ollama':
      const { ChatOllama } = await import('@langchain/ollama');
      LLMClass = ChatOllama;
      break;
      
    case 'openai-compatible':
      const { ChatOpenAI } = await import('@langchain/openai');
      LLMClass = ChatOpenAI;
      break;
      
    case 'anthropic':
      const { ChatAnthropic } = await import('@langchain/anthropic');
      LLMClass = ChatAnthropic;
      break;
      
    default:
      throw new Error(`Unsupported endpoint type: ${providerConfig.endpointType}`);
  }
  
  // Handle OpenRouter special configuration for ChatOpenAI
  if (providerConfig.providerName === 'openrouter') {
    // OpenRouter needs basePath and baseOptions in second parameter
    return new LLMClass(finalConfig, {
      basePath: 'https://openrouter.ai/api/v1',
      baseOptions: {
        headers: {
          'HTTP-Referer': 'https://github.com/zzhang/qi-v2-agent',
          'X-Title': 'Qi Classification Agent'
        }
      }
    });
  } else {
    return new LLMClass(finalConfig);
  }
}

/**
 * Validate if a provider configuration is available
 */
export function validateProviderAvailability(modelId: string): {
  isSupported: boolean;
  provider?: DetectedProviderConfig;
  apiKeyAvailable: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const provider = detectProviderFromModel(modelId);
  
  if (!provider) {
    errors.push(`Model "${modelId}" does not match any known provider patterns`);
    return { isSupported: false, apiKeyAvailable: false, errors };
  }
  
  const apiKeyAvailable = provider.endpointType === 'ollama' || !!process.env[provider.apiKeyEnv];
  
  if (!apiKeyAvailable && provider.endpointType !== 'ollama') {
    errors.push(`Missing API key: ${provider.apiKeyEnv} environment variable not set`);
  }
  
  return {
    isSupported: true,
    provider,
    apiKeyAvailable,
    errors
  };
}

/**
 * Get debugging information about provider detection
 */
export function debugProviderDetection(modelId: string): {
  modelId: string;
  detectedProvider: string | null;
  allProviderMatches: Array<{ provider: string; pattern: string; matches: boolean }>;
  apiKeysAvailable: Record<string, boolean>;
} {
  const detected = detectProviderFromModel(modelId);
  
  const allProviderMatches = Object.entries(PROVIDER_MAP).map(([name, config]) => ({
    provider: name,
    pattern: config.modelPattern.toString(),
    matches: config.modelPattern.test(modelId)
  }));
  
  const apiKeysAvailable = Object.fromEntries(
    Object.entries(PROVIDER_MAP).map(([name, config]) => [
      name,
      config.endpointType === 'ollama' || !!process.env[config.apiKeyEnv]
    ])
  );
  
  return {
    modelId,
    detectedProvider: detected?.providerName || null,
    allProviderMatches,
    apiKeysAvailable
  };
}