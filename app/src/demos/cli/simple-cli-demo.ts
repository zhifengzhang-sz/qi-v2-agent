#!/usr/bin/env node

/**
 * Simple CLI Demo
 * 
 * Demonstrates proper CLI functionality focused on interface concerns:
 * - Command parsing and execution
 * - Input/output handling
 * - Basic CLI commands (help, exit, clear, version)
 * 
 * Does NOT do agent work - that should be handled by the agent layer.
 */

import * as readline from 'node:readline';
import { SimpleCLICommandHandler, type CLICommand } from '../../cli/impl/simple-command-handler.js';

class SimpleCLIDemo {
  private commandHandler: SimpleCLICommandHandler;
  private rl: readline.Interface;
  private isRunning = false;

  constructor() {
    this.commandHandler = new SimpleCLICommandHandler();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
  }

  getCommands(): readonly CLICommand[] {
    return this.commandHandler.getCommands();
  }

  async start(): Promise<void> {
    console.log('🖥️  Simple CLI Demo');
    console.log('==================');
    console.log('This demonstrates proper CLI interface functionality.');
    console.log('Type /help for available commands, /exit to quit.\n');

    this.isRunning = true;
    this.rl.prompt();

    this.rl.on('line', (input: string) => {
      this.handleInput(input.trim());
    });

    this.rl.on('close', () => {
      this.stop();
    });

    // Keep the process running
    return new Promise((resolve) => {
      this.rl.on('close', resolve);
    });
  }

  private handleInput(input: string): void {
    if (!input) {
      this.rl.prompt();
      return;
    }

    // Check if it's a CLI command
    if (this.commandHandler.isCommand(input)) {
      const commandRequest = this.commandHandler.parseCommand(input);
      if (commandRequest) {
        const result = this.commandHandler.executeCommand(commandRequest);
        
        if (result.shouldClear) {
          console.clear();
        } else if (result.output) {
          console.log(result.output);
        }

        if (result.shouldExit) {
          this.stop();
          return;
        }
      }
    } else {
      // Non-command input - in a real system, this would go to the agent
      console.log(`📝 Input received: "${input}"`);
      console.log('    (In a real system, this would be processed by the agent layer)');
      console.log('    (The CLI only handles interface commands like /help, /exit, etc.)');
    }

    if (this.isRunning) {
      this.rl.prompt();
    }
  }

  private stop(): void {
    this.isRunning = false;
    this.rl.close();
    process.exit(0);
  }
}

// Demo scenarios
async function runDemo(): Promise<void> {
  console.log('Starting CLI demo...\n');
  
  const demo = new SimpleCLIDemo();
  
  // Show command capabilities first
  console.log('Available CLI commands:');
  const commands = demo.getCommands();
  for (const cmd of commands) {
    console.log(`  /${cmd.name} - ${cmd.description}`);
  }
  console.log('');

  await demo.start();
}

if (import.meta.main) {
  runDemo().catch(console.error);
}