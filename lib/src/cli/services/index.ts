/**
 * CLI Services - QiCore-based implementations
 *
 * This module exports all shared QiCore services that provide robust
 * error handling and functional composition for CLI operations.
 */

// Export service interfaces for type safety
export type {
  CommandHandler,
  CommandParseResult,
  IAgentConnector,
  ICommandRouter,
  IConfigManager,
  IEventManager,
  IStateManager,
} from '../abstractions/ICLIServices.js';
// v-0.6.1: Event-based services removed
// export { QiCoreAgentConnector } from './QiCoreAgentConnector.js';
export { QiCoreCommandRouter } from './QiCoreCommandRouter.js';
// v-0.6.1: QiCore event manager removed - pure message-driven
// export { QiCoreEventManager } from './QiCoreEventManager.js';
