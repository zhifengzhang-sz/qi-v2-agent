/**
 * State Module - Public API with Two-Layer QiCore Architecture
 *
 * External modules should only import from this file.
 * Implementation details are hidden.
 *
 * v-0.8.1: Implements two-layer QiCore architecture for external modules:
 * - Clean public API without QiCore types
 * - Internal QiCore Result<T> implementation
 * - Error transformation at boundaries
 */

import type { QiError, Result } from '@qi/base';
import { failure, match, success } from '@qi/base';

// Export public abstractions
export type {
  AppConfig,
  AppContext,
  AppMode,
  ConversationEntry,
  IStateManager,
  ModelInfo,
  SessionData,
  StateChange,
  StateChangeListener,
} from './abstractions/index.js';

// Export factory function (not implementation class)
import { StateManager } from './impl/StateManager.js';

/**
 * QiCore-enhanced State Manager with two-layer architecture
 *
 * External layer: Clean API without QiCore types
 * Internal layer: Full QiCore Result<T> patterns
 */
export class QiCoreStateManager {
  private stateManager: StateManager;

  constructor() {
    // Create MCP service manager for unified storage
    const { MCPServiceManager } = require('../mcp/MCPServiceManager.js');
    const serviceManager = new MCPServiceManager();
    this.stateManager = new StateManager(serviceManager);
  }

  // ==========================================================================
  // External API Layer - Clean interfaces without QiCore exposure
  // ==========================================================================

  /**
   * Load LLM configuration from file path
   * External API: Promise<void> (traditional)
   */
  async loadLLMConfig(configPath: string): Promise<void> {
    return this.stateManager.loadLLMConfig(configPath);
  }

  /**
   * Save current state to persistence
   * External API: Promise<void> (traditional)
   */
  async saveState(): Promise<void> {
    const result = await this.stateManager.save();
    return this.transformResultToPromise(result);
  }

  /**
   * Load state from persistence
   * External API: Promise<void> (traditional)
   */
  async loadState(): Promise<void> {
    const result = await this.stateManager.load();
    return this.transformResultToPromise(result);
  }

  // ==========================================================================
  // Internal QiCore Layer - Full Result<T> patterns for internal use
  // ==========================================================================

  /**
   * Save state using QiCore Result<T> patterns
   * Internal API: Direct access to StatePersistence for Result<T> handling
   */
  async saveStateQiCore(): Promise<Result<void, QiError>> {
    const { StatePersistence } = await import('./persistence/index.js');
    // Access the internal agent state context like StateManager.save() does
    const context = (this.stateManager as any).actor.getSnapshot().context;
    return await StatePersistence.saveState(context);
  }

  /**
   * Load state using QiCore Result<T> patterns
   * Internal API: Direct access to StatePersistence for Result<T> handling
   */
  async loadStateQiCore(): Promise<Result<void, QiError>> {
    const { StatePersistence } = await import('./persistence/index.js');
    const result = await StatePersistence.loadState();
    // Transform loaded state to void for consistency
    return match(
      (_loadedState): Result<void, QiError> => success(undefined), // Explicit return type
      (error): Result<void, QiError> => failure(error),
      result
    );
  }

  // ==========================================================================
  // Error Transformation Layer - QiError to Error conversion
  // ==========================================================================

  /**
   * Transform QiCore Result<T> to traditional Promise for external consumers
   */
  private transformResultToPromise<T>(result: Result<T, QiError>): Promise<T> {
    return match(
      (value: T) => Promise.resolve(value),
      (error: QiError) => Promise.reject(new Error(`${error.message} (${error.code})`)),
      result
    );
  }

  // ==========================================================================
  // Delegate remaining methods to StateManager (backward compatibility)
  // ==========================================================================

  getConfig() {
    return this.stateManager.getConfig();
  }
  updateConfig(updates: any) {
    return this.stateManager.updateConfig(updates);
  }
  resetConfig() {
    return this.stateManager.resetConfig();
  }

  getClassifierConfig() {
    return this.stateManager.getClassifierConfig();
  }
  getPromptConfig() {
    return this.stateManager.getPromptConfig();
  }

  updatePromptModel(model: string) {
    return this.stateManager.updatePromptModel(model);
  }
  updatePromptMaxTokens(maxTokens: number) {
    return this.stateManager.updatePromptMaxTokens(maxTokens);
  }

  getCurrentModel() {
    return this.stateManager.getCurrentModel();
  }
  getCurrentMode() {
    return this.stateManager.getCurrentMode();
  }

  getAvailablePromptModels() {
    return this.stateManager.getAvailablePromptModels();
  }

  subscribe(listener: any) {
    return this.stateManager.subscribe(listener);
  }

  addConversationEntry(entry: any) {
    return this.stateManager.addConversationEntry(entry);
  }
  clearConversationHistory() {
    return this.stateManager.clearConversationHistory();
  }

  getContext() {
    return this.stateManager.getContext();
  }
}

/**
 * Create a state manager with MCP service manager
 */
export function createStateManager(): StateManager {
  // Create MCP service manager for unified storage
  const { MCPServiceManager } = require('../mcp/MCPServiceManager.js');
  const serviceManager = new MCPServiceManager();
  return new StateManager(serviceManager);
}

/**
 * Create a QiCore-enhanced state manager with two-layer architecture
 * New API: Returns QiCore-compatible state manager
 */
export function createQiCoreStateManager(): QiCoreStateManager {
  return new QiCoreStateManager();
}
