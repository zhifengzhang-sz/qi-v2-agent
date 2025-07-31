/**
 * Command Module - Public API
 * 
 * External modules should only import from this file.
 * Implementation details are hidden.
 */

// Export public abstractions
export type {
  CommandRequest,
  CommandResult,
  CommandDefinition,
  CommandParameter,
  CommandExecutor,
  CommandHandlerConfig,
  ICommandHandler
} from './abstractions/index.js';

// Export factory functions (not implementation classes)
import { CommandHandler } from './impl/CommandHandler.js';
import type { CommandHandlerConfig } from './abstractions/index.js';

/**
 * Create a command handler with default configuration
 */
export function createCommandHandler(config?: CommandHandlerConfig): CommandHandler {
  return new CommandHandler(config);
}