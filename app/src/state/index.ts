/**
 * State Module - Public API
 * 
 * External modules should only import from this file.
 * Implementation details are hidden.
 */

// Export public abstractions
export type {
  AppConfig,
  AppMode,
  ModelInfo,
  AppContext,
  SessionData,
  ConversationEntry,
  StateChange,
  StateChangeListener,
  IStateManager
} from './abstractions/index.js';

// Export factory function (not implementation class)
import { StateManager } from './impl/StateManager.js';

/**
 * Create a state manager with default configuration
 */
export function createStateManager(): StateManager {
  return new StateManager();
}