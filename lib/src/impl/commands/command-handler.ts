// Command Handler Implementation
//
// Provides built-in command execution functionality

import type {
  ICommandHandler,
  CommandDefinition,
  CommandRequest,
  CommandResult,
  CommandExecutor,
  CommandParameter,
  CommandParameterValidation
} from '../../core/interfaces.js';

export class BasicCommandHandler implements ICommandHandler {
  private commands = new Map<string, CommandDefinition>();
  private handlers = new Map<string, CommandExecutor>();
  private aliases = new Map<string, string>();
  private configuration = new Map<string, unknown>();

  constructor(initialConfig?: Map<string, unknown>) {
    this.configuration = initialConfig || new Map();
    this.registerBuiltinCommands();
  }

  getAvailableCommands(): readonly CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  async executeCommand(request: CommandRequest): Promise<CommandResult> {
    const commandName = this.resolveAlias(request.commandName);
    
    if (!this.commands.has(commandName)) {
      return {
        status: 'not_found',
        content: `Command '${request.commandName}' not found.`,
        output: `Command '${request.commandName}' not found.`,
        commandName: request.commandName,
        success: false,
        suggestions: this.getSuggestions(request.commandName),
        metadata: new Map<string, unknown>([
          ['originalCommand', request.commandName],
          ['availableCommands', Array.from(this.commands.keys())]
        ])
      };
    }

    const definition = this.commands.get(commandName)!;
    const handler = this.handlers.get(commandName)!;

    // Validate parameters
    const validationResult = await this.validateCommand(commandName, request.parameters);
    if (!validationResult) {
      return {
        status: 'error',
        content: `Invalid parameters for command '${commandName}'.`,
        output: `Invalid parameters for command '${commandName}'.`,
        commandName: request.commandName,
        success: false,
        data: definition,
        metadata: new Map<string, unknown>([
          ['commandDefinition', definition],
          ['providedParameters', Object.fromEntries(request.parameters)]
        ])
      };
    }

    try {
      return await handler(request);
    } catch (error) {
      return {
        status: 'error',
        content: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        output: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        commandName: request.commandName,
        success: false,
        metadata: new Map<string, unknown>([
          ['error', error],
          ['commandName', commandName]
        ])
      };
    }
  }

  async validateCommand(commandName: string, parameters: ReadonlyMap<string, unknown>): Promise<boolean> {
    const definition = this.commands.get(commandName);
    if (!definition) return false;

    // Basic validation - could be enhanced
    for (const param of definition.parameters) {
      if (param.required && !parameters.has(param.name)) {
        return false;
      }
    }

    return true;
  }

  registerCommand(definition: CommandDefinition, handler: CommandExecutor): void {
    this.commands.set(definition.name, definition);
    this.handlers.set(definition.name, handler);
  }

  unregisterCommand(commandName: string): void {
    this.commands.delete(commandName);
    this.handlers.delete(commandName);
  }

  private registerBuiltinCommands(): void {
    // Help command
    this.registerCommand(
      {
        name: 'help',
        description: 'Show available commands and usage information',
        usage: '/help [command]',
        category: 'system',
        parameters: []
      },
      async (request) => this.handleHelp(request)
    );

    // Status command
    this.registerCommand(
      {
        name: 'status',
        description: 'Show system status',
        usage: '/status',
        category: 'system', 
        parameters: []
      },
      async (request) => this.handleStatus(request)
    );
  }

  private async handleHelp(request: CommandRequest): Promise<CommandResult> {
    const commands = Array.from(this.commands.values());
    let helpText = 'Available Commands:\n\n';
    
    for (const cmd of commands) {
      helpText += `/${cmd.name} - ${cmd.description}\n`;
    }

    return {
      status: 'success',
      content: helpText,
      output: helpText,
      commandName: 'help',
      success: true,
      metadata: new Map<string, unknown>([
        ['totalCommands', this.commands.size]
      ])
    };
  }

  private async handleStatus(request: CommandRequest): Promise<CommandResult> {
    const statusText = `System Status: OK\nCommands Available: ${this.commands.size}`;

    return {
      status: 'success',
      content: statusText,
      output: statusText,
      commandName: 'status',
      success: true,
      metadata: new Map<string, unknown>([
        ['commandCount', this.commands.size]
      ])
    };
  }

  private resolveAlias(commandName: string): string {
    return this.aliases.get(commandName) || commandName;
  }

  private getSuggestions(input: string): string[] {
    const commands = Array.from(this.commands.keys());
    return commands.filter(cmd => cmd.includes(input) || input.includes(cmd)).slice(0, 3);
  }
}