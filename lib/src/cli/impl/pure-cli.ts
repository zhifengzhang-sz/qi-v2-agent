/**
 * Pure CLI Interface
 *
 * Provides a clean interface between Main App and terminal.
 * Only handles interface concerns - no business logic dependencies.
 */

import * as readline from 'node:readline';
import { type CLICommand, SimpleCLICommandHandler } from './simple-command-handler.js';

/**
 * CLI input types
 */
export type CLIInput =
  | { type: 'cli_handled' } // CLI handled it internally (help, exit, clear, version)
  | { type: 'user_input'; input: string } // Raw user input for agent processing
  | { type: 'exit' }; // CLI is shutting down

/**
 * Main App feedback to CLI
 */
export type CLIFeedback =
  | { type: 'display_result'; content: string }
  | { type: 'display_error'; error: string }
  | { type: 'display_progress'; message: string; percentage?: number }
  | { type: 'clear_screen' };

/**
 * Pure CLI interface for Main App integration
 */
export interface ICLI {
  /**
   * Start the CLI interface
   */
  start(): Promise<void>;

  /**
   * Stop the CLI interface
   */
  stop(): void;

  /**
   * Check if CLI is running
   */
  isRunning(): boolean;

  /**
   * Display feedback from Main App/Agent
   */
  displayFeedback(feedback: CLIFeedback): void;

  /**
   * Set callback for user input
   */
  onInput(callback: (input: CLIInput) => void): void;
}

/**
 * Pure CLI implementation - only handles interface concerns
 */
export class PureCLI implements ICLI {
  private commandHandler: SimpleCLICommandHandler;
  private rl?: readline.Interface;
  private isRunningFlag = false;
  private inputCallback?: (input: CLIInput) => void;

  constructor() {
    this.commandHandler = new SimpleCLICommandHandler();
  }

  async start(): Promise<void> {
    if (this.isRunningFlag) {
      return;
    }

    console.log('🖥️  Qi Agent CLI');
    console.log('================');
    console.log('Type /help for CLI commands, or enter any text for AI processing.\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    this.isRunningFlag = true;

    this.rl.on('line', (input: string) => {
      this.handleInput(input.trim());
    });

    this.rl.on('close', () => {
      this.handleExit();
    });

    this.rl.prompt();

    // Keep the process running
    return new Promise((resolve) => {
      this.rl?.on('close', resolve);
    });
  }

  stop(): void {
    if (this.rl) {
      this.isRunningFlag = false;
      this.rl.close();
    }
  }

  isRunning(): boolean {
    return this.isRunningFlag;
  }

  displayFeedback(feedback: CLIFeedback): void {
    if (!this.isRunningFlag) return;

    switch (feedback.type) {
      case 'display_result':
        console.log(feedback.content);
        break;
      case 'display_error':
        console.log(`❌ Error: ${feedback.error}`);
        break;
      case 'display_progress': {
        const progressBar = feedback.percentage ? ` [${feedback.percentage}%]` : '';
        console.log(`⏳ ${feedback.message}${progressBar}`);
        break;
      }
      case 'clear_screen':
        console.clear();
        break;
    }

    if (this.rl && this.isRunningFlag) {
      this.rl.prompt();
    }
  }

  onInput(callback: (input: CLIInput) => void): void {
    this.inputCallback = callback;
  }

  private handleInput(input: string): void {
    if (!input) {
      if (this.rl && this.isRunningFlag) {
        this.rl.prompt();
      }
      return;
    }

    // Check if it's a CLI command that we can handle
    if (this.commandHandler.isCommand(input)) {
      const commandRequest = this.commandHandler.parseCommand(input);
      if (commandRequest) {
        // Check if this is a command we actually handle (help, exit, clear, version)
        const cliCommands = ['help', 'exit', 'clear', 'version', 'h', '?', 'quit', 'q', 'cls', 'v'];
        if (cliCommands.includes(commandRequest.command)) {
          const result = this.commandHandler.executeCommand(commandRequest);

          if (result.shouldClear) {
            console.clear();
          } else if (result.output) {
            console.log(result.output);
          }

          if (result.shouldExit) {
            this.handleExit();
            return;
          }

          // Notify that CLI handled this command
          if (this.inputCallback) {
            this.inputCallback({ type: 'cli_handled' });
          }
        } else {
          // Command starts with / but not a CLI command - send to agent
          if (this.inputCallback) {
            this.inputCallback({ type: 'user_input', input });
          }
        }
      }
    } else {
      // Non-command input - send to Main App for agent processing
      if (this.inputCallback) {
        this.inputCallback({ type: 'user_input', input });
      }
    }

    if (this.rl && this.isRunningFlag) {
      this.rl.prompt();
    }
  }

  private handleExit(): void {
    if (this.inputCallback) {
      this.inputCallback({ type: 'exit' });
    }
    this.stop();
    process.exit(0);
  }

  /**
   * Get available CLI commands (for help/documentation)
   */
  getAvailableCommands(): readonly CLICommand[] {
    return this.commandHandler.getCommands();
  }
}

/**
 * Factory function to create pure CLI
 */
export function createPureCLI(): ICLI {
  return new PureCLI();
}
