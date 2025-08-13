/**
 * Model Command Definition for Qi-Prompt App
 *
 * App provides the command definition and logic,
 * Agent registers it in its CommandHandler.
 */

import type { CommandDefinition, CommandRequest, CommandResult } from '@qi/agent/command';
import type { IStateManager } from '@qi/agent/state';

/**
 * Create model command definition with app-specific logic
 */
export function createModelCommand(stateManager: IStateManager): {
  definition: CommandDefinition;
  handler: (request: CommandRequest) => Promise<CommandResult>;
} {
  const definition: CommandDefinition = {
    name: 'model',
    description: 'Show or change the current LLM model',
    usage: '/model [model_name]',
    category: 'system',
    parameters: [
      {
        name: 'model_name',
        type: 'string',
        required: false,
        description: 'Model to switch to (e.g., llama3.2:3b, qwen3:8b)',
      },
    ],
  };

  const handler = async (request: CommandRequest): Promise<CommandResult> => {
    const modelName = request.parameters.get('arg1') as string;

    try {
      if (!modelName) {
        // Show current model and available models - use getCurrentModel() as single source of truth
        const currentModel = stateManager.getCurrentModel();
        const promptConfig = stateManager.getPromptConfig();
        const availableModels = stateManager.getAvailablePromptModels();

        let content = `Current model: ${currentModel}\n`;
        content += `Provider: ${promptConfig?.provider || 'ollama'}\n`;

        if (availableModels.length > 0) {
          content += `\nAvailable models:\n`;
          availableModels.forEach((model) => {
            const indicator = model === currentModel ? '→ ' : '  ';
            content += `${indicator}${model}\n`;
          });
          content += `\nUse '/model <model_name>' to switch models.`;
        }

        return {
          status: 'success',
          content,
          output: content,
          commandName: 'model',
          success: true,
          metadata: new Map([
            ['action', 'view'],
            ['currentModel', currentModel],
            ['availableCount', String(availableModels.length)],
          ]),
        };
      }

      // Switch to new model
      const availableModels = stateManager.getAvailablePromptModels();
      const currentModel = stateManager.getCurrentModel();

      // Validate model availability
      if (availableModels.length > 0 && !availableModels.includes(modelName)) {
        return {
          status: 'error',
          content: `❌ Model '${modelName}' not available.\n\nAvailable models:\n${availableModels.map((m) => `  ${m}`).join('\n')}`,
          output: `Model '${modelName}' not available`,
          commandName: 'model',
          success: false,
          error: 'Model not available',
          metadata: new Map([
            ['action', 'switch'],
            ['requestedModel', modelName],
            ['error', 'model_not_available'],
          ]),
        };
      }

      // Update model in StateManager
      stateManager.updatePromptModel(modelName);

      return {
        status: 'success',
        content: `✅ Switched to model: ${modelName}`,
        output: `Switched to model: ${modelName}`,
        commandName: 'model',
        success: true,
        metadata: new Map([
          ['action', 'switch'],
          ['previousModel', currentModel],
          ['newModel', modelName],
        ]),
      };
    } catch (error) {
      return {
        status: 'error',
        content: `❌ Failed to change model: ${error instanceof Error ? error.message : String(error)}`,
        output: `Failed to change model: ${error instanceof Error ? error.message : String(error)}`,
        commandName: 'model',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: new Map([
          ['action', 'switch'],
          ['requestedModel', modelName || 'unknown'],
          ['error', 'execution_failed'],
        ]),
      };
    }
  };

  return { definition, handler };
}
