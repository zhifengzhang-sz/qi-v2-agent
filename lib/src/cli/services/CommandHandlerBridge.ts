/**
 * CommandHandlerBridge - Connects CLI routing to app CommandHandler
 * 
 * This bridge allows the CLI framework to use the app's CommandHandler
 * instead of having separate command systems. It implements the CLI's
 * ICommandRouter interface while delegating to the app's ICommandHandler.
 */

import {
  Ok,
  Err,
  match,
  flatMap,
  validationError,
  create,
  type Result,
  type QiError,
} from '@qi/base';

import type {
  ICommandRouter,
  CommandParseResult,
} from '../abstractions/ICLIServices.js';

import type {
  ICommandHandler,
  CommandRequest,
  CommandResult,
} from '../../command/abstractions/index.js';

/**
 * Bridge error types
 */
interface BridgeError extends QiError {
  context: {
    command?: string;
    input?: string;
    operation?: string;
  };
}

const bridgeError = (
  code: string,
  message: string,
  context: BridgeError['context'] = {}
): BridgeError => create(code, message, 'SYSTEM', context) as BridgeError;

/**
 * Bridge that connects CLI command routing to app CommandHandler
 */
export class CommandHandlerBridge implements ICommandRouter {
  private commandPrefix: string = '/';

  constructor(
    private commandHandler: ICommandHandler,
    options: { commandPrefix?: string } = {}
  ) {
    this.commandPrefix = options.commandPrefix || '/';
  }

  /**
   * Parse input to determine if it's a command or prompt
   */
  parseInput(input: string): Result<CommandParseResult, QiError> {
    if (!input || typeof input !== 'string') {
      return Err(validationError('Input must be a non-empty string'));
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return Err(validationError('Input cannot be empty'));
    }

    if (!trimmed.startsWith(this.commandPrefix)) {
      return Ok({
        type: 'prompt',
        content: trimmed,
      });
    }

    // Parse command
    const commandLine = trimmed.slice(this.commandPrefix.length);
    const parts = commandLine.trim().split(/\s+/);
    
    if (parts.length === 0 || parts[0] === '') {
      return Err(bridgeError(
        'EMPTY_COMMAND',
        'Command cannot be empty',
        { input: trimmed, operation: 'parse' }
      ));
    }

    const [command, ...args] = parts;
    
    return Ok({
      type: 'command',
      content: trimmed,
      command,
      args,
      flags: {}, // CLI simple parsing - no flags for now
    });
  }

  /**
   * Handle a parsed command by delegating to app CommandHandler
   */
  async handleCommand(
    command: string,
    args: string[],
    flags: Record<string, string | boolean>
  ): Promise<Result<string, QiError>> {
    try {
      // Convert CLI args to CommandHandler parameters format
      const parameters = new Map<string, unknown>();
      
      // Simple parameter mapping - first arg goes to primary param
      if (args.length > 0) {
        // For now, use generic parameter names
        args.forEach((arg, index) => {
          parameters.set(`arg${index}`, arg);
        });
        
        // Also set common parameter names based on command
        if (command === 'help' && args[0]) {
          parameters.set('command', args[0]);
        } else if (command === 'model' && args[0]) {
          parameters.set('model_name', args[0]);
        }
      }

      // Create CommandRequest for the CommandHandler
      const request: CommandRequest = {
        commandName: command,
        parameters,
        rawInput: `${this.commandPrefix}${command} ${args.join(' ')}`.trim(),
        context: new Map(), // Empty context for now
      };

      // Delegate to app's CommandHandler
      const result: CommandResult = await this.commandHandler.executeCommand(request);
      
      if (result.success) {
        return Ok(result.content);
      } else {
        return Err(bridgeError(
          'COMMAND_EXECUTION_FAILED',
          result.error || 'Command execution failed',
          { command, operation: 'execute' }
        ));
      }

    } catch (error) {
      return Err(bridgeError(
        'BRIDGE_ERROR',
        `Bridge error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { command, operation: 'bridge' }
      ));
    }
  }

  /**
   * Register a command handler (not implemented - use app's CommandHandler directly)
   */
  registerCommand(): Result<void, QiError> {
    return Err(bridgeError(
      'NOT_IMPLEMENTED',
      'Use app CommandHandler.registerCommand() instead of bridge.registerCommand()',
      { operation: 'register' }
    ));
  }

  /**
   * Unregister a command (not implemented - use app's CommandHandler directly)
   */
  unregisterCommand(): Result<void, QiError> {
    return Err(bridgeError(
      'NOT_IMPLEMENTED', 
      'Use app CommandHandler.unregisterCommand() instead of bridge.unregisterCommand()',
      { operation: 'unregister' }
    ));
  }

  /**
   * Get registered commands from app CommandHandler
   */
  getRegisteredCommands(): string[] {
    const commands = this.commandHandler.getAvailableCommands();
    return commands.map(cmd => cmd.name).sort();
  }

  /**
   * Check if command exists in app CommandHandler
   */
  hasCommand(command: string): boolean {
    const commands = this.getRegisteredCommands();
    return commands.includes(command);
  }

  /**
   * Get command help (delegate to CLI's basic help format for now)
   */
  getCommandHelp(command?: string): string {
    if (command) {
      const commands = this.commandHandler.getAvailableCommands();
      const cmdDef = commands.find(c => c.name === command);
      
      if (!cmdDef) {
        return `Command '${command}' not found.`;
      }
      
      return `${cmdDef.description}\n\nUsage: ${cmdDef.usage}`;
    }
    
    // General help
    const commands = this.commandHandler.getAvailableCommands();
    let help = 'Available commands:\n\n';
    
    for (const cmd of commands) {
      help += `  ${this.commandPrefix}${cmd.name.padEnd(12)} ${cmd.description}\n`;
    }
    
    help += `\nUse '${this.commandPrefix}help <command>' for detailed information about a specific command.`;
    
    return help;
  }

  /**
   * Validate command syntax by checking with app CommandHandler
   */
  validateCommand(command: string, args: string[]): Result<void, QiError> {
    const commands = this.getRegisteredCommands();
    
    if (!commands.includes(command)) {
      return Err(bridgeError(
        'COMMAND_NOT_FOUND',
        `Command '${command}' not found`,
        { command, operation: 'validate' }
      ));
    }
    
    // Basic validation - could be enhanced
    return Ok(void 0);
  }
}