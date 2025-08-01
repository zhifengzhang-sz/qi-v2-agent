/**
 * @qi/prompt - Simple LLM prompt handling with multi-provider support
 *
 * Provides a user-friendly API that hides qicore complexity
 */

// Implementations
export { DefaultPromptHandler } from './impl/DefaultPromptHandler.js';
export { QiCorePromptManager } from './impl/QiCorePromptManager.js';
// Interfaces
export type {
  IPromptHandler,
  PromptOptions,
  PromptResponse,
  ProviderInfo,
} from './interfaces/IPromptHandler.js';
export type {
  IPromptManager,
  LLMConfig,
  LLMProviderConfig,
  PromptExecutionOptions,
  ProviderStatusMap,
} from './interfaces/IPromptManager.js';

// Factory function for easy setup
import { DefaultPromptHandler } from './impl/DefaultPromptHandler.js';
import { QiCorePromptManager } from './impl/QiCorePromptManager.js';

/**
 * Create a prompt handler with default QiCore-based manager
 *
 * Usage:
 * ```typescript
 * const handler = createPromptHandler()
 * const initResult = await handler.initialize(configPath, schemaPath)
 * if (initResult.success) {
 *   const response = await handler.complete('Hello!', { provider: 'ollama' })
 * }
 * ```
 */
export function createPromptHandler(): DefaultPromptHandler {
  const manager = new QiCorePromptManager();
  return new DefaultPromptHandler(manager);
}
