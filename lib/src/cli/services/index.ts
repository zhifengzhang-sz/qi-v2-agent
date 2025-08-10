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
export { QiCoreAgentConnector } from './QiCoreAgentConnector.js';
export { QiCoreCommandRouter } from './QiCoreCommandRouter.js';
// QiCore service implementations
export { QiCoreEventManager } from './QiCoreEventManager.js';
