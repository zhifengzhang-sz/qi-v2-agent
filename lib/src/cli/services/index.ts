/**
 * CLI Services - QiCore-based implementations
 * 
 * This module exports all shared QiCore services that provide robust
 * error handling and functional composition for CLI operations.
 */

// QiCore service implementations
export { QiCoreEventManager } from './QiCoreEventManager.js';
export { QiCoreCommandRouter } from './QiCoreCommandRouter.js';
export { QiCoreAgentConnector } from './QiCoreAgentConnector.js';

// Export service interfaces for type safety
export type {
  IEventManager,
  ICommandRouter,
  IAgentConnector,
  IConfigManager,
  IStateManager,
  CommandParseResult,
  CommandHandler,
} from '../abstractions/ICLIServices.js';