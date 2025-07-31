/**
 * Command Module - Public Abstractions
 * 
 * Public interface contracts for the command module.
 * Other modules should only import from this file.
 */

export type {
  CommandRequest,
  CommandResult,
  CommandDefinition,
  CommandParameter,
  CommandExecutor,
  CommandHandlerConfig,
  ICommandHandler
} from './ICommandHandler.js';