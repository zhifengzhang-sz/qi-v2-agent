/**
 * Command Module - Public API
 *
 * External modules should only import from this file.
 * Implementation details are hidden.
 */

// Export public abstractions
export type {
  CommandDefinition,
  CommandExecutor,
  CommandHandlerConfig,
  CommandParameter,
  CommandRequest,
  CommandResult,
  ICommandHandler,
} from './abstractions/index.js';

import type { CommandHandlerConfig } from './abstractions/index.js';
// Export factory functions (not implementation classes)
import { CommandHandler } from './impl/CommandHandler.js';

/**
 * Create a command handler with default configuration
 */
export function createCommandHandler(config?: CommandHandlerConfig): CommandHandler {
  return new CommandHandler(config);
}
