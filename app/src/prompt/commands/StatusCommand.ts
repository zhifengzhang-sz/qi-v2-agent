/**
 * Status Command Definition for Qi-Prompt App
 * 
 * App provides the command definition and logic,
 * Agent registers it in its CommandHandler.
 */

import type { CommandDefinition, CommandRequest, CommandResult } from '@qi/agent/command';
import type { IStateManager } from '@qi/agent/state';

/**
 * Create status command definition with app-specific logic
 */
export function createStatusCommand(stateManager: IStateManager): {
  definition: CommandDefinition;
  handler: (request: CommandRequest) => Promise<CommandResult>;
} {
  const definition: CommandDefinition = {
    name: 'status',
    description: 'Show current application status',
    usage: '/status',
    category: 'system',
    parameters: []
  };

  const handler = async (request: CommandRequest): Promise<CommandResult> => {
    try {
      const currentModel = stateManager.getCurrentModel();
      const currentMode = stateManager.getCurrentMode();
      const promptConfig = stateManager.getPromptConfig();
      const uptime = Math.floor(process.uptime());
      
      // Get app state
      const appState = stateManager.getState();
      const availableModels = stateManager.getAvailablePromptModels();
      
      let content = `📊 System Status:\n\n`;
      content += `  Mode: ${currentMode}\n`;
      content += `  Provider: ${promptConfig?.provider || 'ollama'}\n`;
      content += `  Model: ${currentModel}\n`;
      content += `  Uptime: ${uptime}s\n`;
      content += `  Available Models: ${availableModels.length}\n`;
      
      // Add memory usage if available
      const memUsage = process.memoryUsage();
      content += `  Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n`;
      
      // Add session info if available
      if (appState.session) {
        const session = appState.session;
        content += `  Session: ${session.id.substring(0, 8)}...\n`;
        content += `  Messages: ${session.conversationHistory.length}\n`;
      }
      
      return {
        status: 'success',
        content,
        output: content,
        commandName: 'status',
        success: true,
        metadata: new Map([
          ['uptime', String(uptime)],
          ['model', currentModel],
          ['mode', currentMode],
          ['provider', promptConfig?.provider || 'ollama'],
          ['availableModels', String(availableModels.length)],
          ['memoryMB', String(Math.round(memUsage.heapUsed / 1024 / 1024))]
        ])
      };
      
    } catch (error) {
      return {
        status: 'error',
        content: `❌ Failed to get status: ${error instanceof Error ? error.message : String(error)}`,
        output: `Failed to get status: ${error instanceof Error ? error.message : String(error)}`,
        commandName: 'status',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: new Map([
          ['error', 'execution_failed']
        ])
      };
    }
  };

  return { definition, handler };
}