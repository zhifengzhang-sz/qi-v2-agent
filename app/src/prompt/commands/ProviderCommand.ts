/**
 * Provider Command Definition for Qi-Prompt App
 * 
 * App provides the command definition and logic,
 * Agent registers it in its CommandHandler.
 */

import type { CommandDefinition, CommandRequest, CommandResult } from '@qi/agent/command';
import type { IStateManager } from '@qi/agent/state';

/**
 * Create provider command definition with app-specific logic
 */
export function createProviderCommand(stateManager: IStateManager): {
  definition: CommandDefinition;
  handler: (request: CommandRequest) => Promise<CommandResult>;
} {
  const definition: CommandDefinition = {
    name: 'provider',
    description: 'Show or change the current LLM provider',
    usage: '/provider [provider_name]',
    category: 'system',
    parameters: [
      {
        name: 'provider_name',
        type: 'string',
        required: false,
        description: 'Provider to switch to (e.g., openrouter, ollama, groq)'
      }
    ]
  };

  const handler = async (request: CommandRequest): Promise<CommandResult> => {
    const providerName = request.parameters.get('arg1') as string;
    
    try {
      if (!providerName) {
        // Show current provider and available providers
        const promptConfig = stateManager.getPromptConfig();
        const currentProvider = promptConfig?.provider || 'ollama';
        const availableProviders = stateManager.getAvailablePromptProviders();
        
        let content = `Current provider: ${currentProvider}\n`;
        content += `Model: ${promptConfig?.model || 'qwen3:0.6b'}\n`;
        
        if (availableProviders.length > 0) {
          content += `\nAvailable providers:\n`;
          availableProviders.forEach(provider => {
            const indicator = provider === currentProvider ? '→ ' : '  ';
            content += `${indicator}${provider}\n`;
          });
          content += `\nUse '/provider <provider_name>' to switch providers.`;
        }
        
        return {
          status: 'success',
          content,
          output: content,
          commandName: 'provider',
          success: true,
          metadata: new Map([
            ['action', 'view'],
            ['currentProvider', currentProvider],
            ['availableCount', String(availableProviders.length)]
          ])
        };
      }
      
      // Switch to new provider
      const availableProviders = stateManager.getAvailablePromptProviders();
      const promptConfig = stateManager.getPromptConfig();
      const currentProvider = promptConfig?.provider || 'ollama';
      
      // Validate provider availability
      if (availableProviders.length > 0 && !availableProviders.includes(providerName)) {
        return {
          status: 'error',
          content: `❌ Provider '${providerName}' not available.\n\nAvailable providers:\n${availableProviders.map(p => `  ${p}`).join('\n')}`,
          output: `Provider '${providerName}' not available`,
          commandName: 'provider',
          success: false,
          error: 'Provider not available',
          metadata: new Map([
            ['action', 'switch'],
            ['requestedProvider', providerName],
            ['error', 'provider_not_available']
          ])
        };
      }
      
      // Update provider in StateManager
      stateManager.updatePromptProvider(providerName);
      
      return {
        status: 'success',
        content: `✅ Switched to provider: ${providerName}`,
        output: `Switched to provider: ${providerName}`,
        commandName: 'provider',
        success: true,
        metadata: new Map([
          ['action', 'switch'],
          ['previousProvider', currentProvider],
          ['newProvider', providerName]
        ])
      };
      
    } catch (error) {
      return {
        status: 'error',
        content: `❌ Failed to change provider: ${error instanceof Error ? error.message : String(error)}`,
        output: `Failed to change provider: ${error instanceof Error ? error.message : String(error)}`,
        commandName: 'provider',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: new Map([
          ['action', 'switch'],
          ['requestedProvider', providerName || 'unknown'],
          ['error', 'execution_failed']
        ])
      };
    }
  };

  return { definition, handler };
}