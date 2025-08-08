/**
 * Qi-Prompt App Commands
 * 
 * Exports all app-specific command definitions that get
 * installed into the Agent's CommandHandler.
 */

export { createModelCommand } from './ModelCommand.js';
export { createStatusCommand } from './StatusCommand.js';

import type { IStateManager } from '@qi/agent/state';
import type { CommandDefinition, CommandExecutor } from '@qi/agent/command';
import { createModelCommand } from './ModelCommand.js';
import { createStatusCommand } from './StatusCommand.js';

/**
 * Get all app-specific commands for installation into Agent's CommandHandler
 */
export function getPromptAppCommands(stateManager: IStateManager): Array<{
  definition: CommandDefinition;
  handler: CommandExecutor;
}> {
  return [
    createModelCommand(stateManager),
    createStatusCommand(stateManager),
  ];
}