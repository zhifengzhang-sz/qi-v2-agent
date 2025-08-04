/**
 * URL utilities for classifier implementations
 */

/**
 * Compose OpenAI-compatible endpoint from base Ollama URL
 * @param baseUrl - Base Ollama URL (e.g., "http://localhost:11434")
 * @returns OpenAI-compatible endpoint (e.g., "http://localhost:11434/v1")
 */
export function composeOpenAIEndpoint(baseUrl: string): string {
  // Remove trailing slash if present
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Add /v1 if not already present
  return cleanBaseUrl.endsWith('/v1') ? cleanBaseUrl : `${cleanBaseUrl}/v1`;
}

/**
 * Get Ollama base URL without the /v1 suffix for direct API calls
 * @param baseUrl - Base URL that might have /v1 suffix
 * @returns Clean Ollama base URL (e.g., "http://localhost:11434")
 */
export function getOllamaBaseUrl(baseUrl: string): string {
  // Remove trailing slash and /v1 if present
  return baseUrl.replace(/\/$/, '').replace(/\/v1$/, '');
}