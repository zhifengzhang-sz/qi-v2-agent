/**
 * Model Capability Detection and Caching
 *
 * Provides information about which models support which features.
 * Based on Ollama's official documentation and testing.
 */

export interface ModelCapabilities {
  functionCalling: boolean;
  jsonMode: boolean;
  maxContextLength?: number;
  notes?: string;
}

/**
 * Known model capabilities based on Ollama documentation and testing
 * Updated: January 2025
 */
const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Llama models - Function calling support as of 3.1+
  'llama3.2:3b': {
    functionCalling: true,
    jsonMode: true,
    maxContextLength: 128000,
    notes: 'Supports single, nested, and parallel function calling',
  },
  'llama3.1:8b': {
    functionCalling: true,
    jsonMode: true,
    maxContextLength: 128000,
    notes: 'Supports single, nested, and parallel function calling',
  },
  'llama3.1:70b': {
    functionCalling: true,
    jsonMode: true,
    maxContextLength: 128000,
    notes: 'Supports single, nested, and parallel function calling',
  },
  'llama3:8b': {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 8192,
    notes: 'Pre-3.1 version without function calling',
  },

  // Qwen models - No native function calling support
  'qwen3:0.6b': {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 32768,
    notes: 'No native Ollama function calling support',
  },
  'qwen2.5:7b': {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 32768,
    notes: 'No native Ollama function calling support',
  },
  'qwen2.5:14b': {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 32768,
    notes: 'No native Ollama function calling support',
  },

  // Mistral models
  'mistral:7b': {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 8192,
    notes: 'JSON mode only, no function calling',
  },
  'mistral:v0.3': {
    functionCalling: true,
    jsonMode: true,
    maxContextLength: 8192,
    notes: 'v0.3 adds function calling support',
  },

  // DeepSeek models
  'deepseek-coder:6.7b': {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 16384,
    notes: 'Code-focused model without function calling',
  },

  // Phi models
  'phi3:mini': {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 4096,
    notes: 'Lightweight model without function calling',
  },
  phi4: {
    functionCalling: false,
    jsonMode: true,
    maxContextLength: 16384,
    notes: 'No native function calling support',
  },
};

// Cache for runtime capability detection
const capabilityCache = new Map<string, ModelCapabilities>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const cacheTimestamps = new Map<string, number>();

/**
 * Check if a model supports tool/function calling
 */
export function supportsToolCalling(modelId: string): boolean {
  const capabilities = getModelCapabilities(modelId);
  return capabilities?.functionCalling ?? false;
}

/**
 * Check if a model supports JSON mode
 */
export function supportsJsonMode(modelId: string): boolean {
  const capabilities = getModelCapabilities(modelId);
  return capabilities?.jsonMode ?? true; // Default to true as most models support it
}

/**
 * Get full capabilities for a model
 */
export function getModelCapabilities(modelId: string): ModelCapabilities | undefined {
  // Check static configuration first
  if (MODEL_CAPABILITIES[modelId]) {
    return MODEL_CAPABILITIES[modelId];
  }

  // Check cache
  const cached = getCachedCapabilities(modelId);
  if (cached) {
    return cached;
  }

  // For unknown models, return conservative defaults
  // Models not in our list likely don't support function calling
  return {
    functionCalling: false,
    jsonMode: true, // Most models support JSON mode
    notes: 'Unknown model - conservative defaults applied',
  };
}

/**
 * Get cached capabilities if still valid
 */
function getCachedCapabilities(modelId: string): ModelCapabilities | undefined {
  const timestamp = cacheTimestamps.get(modelId);
  if (timestamp && Date.now() - timestamp < CACHE_TTL) {
    return capabilityCache.get(modelId);
  }

  // Cache expired
  capabilityCache.delete(modelId);
  cacheTimestamps.delete(modelId);
  return undefined;
}

/**
 * Cache detected capabilities for a model
 */
export function cacheModelCapabilities(modelId: string, capabilities: ModelCapabilities): void {
  capabilityCache.set(modelId, capabilities);
  cacheTimestamps.set(modelId, Date.now());
}

/**
 * Test if a model supports function calling by making a test request
 * This should be called sparingly as it makes an actual API call
 */
export async function testFunctionCallingSupport(
  modelId: string,
  baseUrl: string = 'http://localhost:11434'
): Promise<boolean> {
  // Check cache first
  const cached = getCachedCapabilities(modelId);
  if (cached) {
    return cached.functionCalling;
  }

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Test' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'test_function',
              description: 'Test function',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(5000),
    });

    const result = (await response.json()) as { error?: { message?: string } };

    // Check for explicit "does not support tools" error
    const supportsTools = !(
      result.error?.message?.includes('does not support tools') ||
      result.error?.message?.includes('does not support function')
    );

    // Cache the result
    cacheModelCapabilities(modelId, {
      functionCalling: supportsTools,
      jsonMode: true,
      notes: 'Detected via runtime test',
    });

    return supportsTools;
  } catch (_error) {
    // On error, assume no support
    return false;
  }
}

/**
 * Get recommended classification method for a model
 */
export function getRecommendedMethod(modelId: string): string {
  const capabilities = getModelCapabilities(modelId);

  if (!capabilities) {
    return 'ollama-native'; // Safe default
  }

  if (capabilities.functionCalling) {
    // Model supports function calling - can use any method
    return 'langchain-json-schema'; // Recommended for 2025
  } else {
    // Model doesn't support function calling
    // Avoid methods that require it
    return 'ollama-native'; // Direct API calls work best
  }
}

/**
 * Check if a classification method is compatible with a model
 */
export function isMethodCompatible(
  method: string,
  modelId: string
): { compatible: boolean; reason?: string } {
  const capabilities = getModelCapabilities(modelId);

  // Methods that require function calling
  const functionCallingMethods = [
    'langchain-function-calling',
    'langchain-structured', // May fall back to function calling
  ];

  if (functionCallingMethods.includes(method)) {
    if (!capabilities?.functionCalling) {
      return {
        compatible: false,
        reason: `Model ${modelId} does not support function calling required by ${method}`,
      };
    }
  }

  // All other methods should work with JSON mode
  return { compatible: true };
}

// Export the static configuration for reference
export { MODEL_CAPABILITIES };
