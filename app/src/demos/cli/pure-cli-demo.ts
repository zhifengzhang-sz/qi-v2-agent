#!/usr/bin/env node

/**
 * Pure CLI Demo
 * 
 * Demonstrates the new pure CLI design:
 * - CLI handles only interface commands (/help, /exit, /clear, /version)
 * - Main App receives raw user input for agent processing
 * - Shows proper separation of concerns
 */

import { createPureCLI, type ICLI, type CLIInput, type CLIFeedback } from '../../cli/impl/pure-cli.js';

/**
 * Mock Main App that simulates agent processing
 */
class MockMainApp {
  private cli: ICLI;

  constructor() {
    this.cli = createPureCLI();
    this.setupCLIHandlers();
  }

  private setupCLIHandlers(): void {
    this.cli.onInput((input: CLIInput) => {
      this.handleCLIInput(input);
    });
  }

  private handleCLIInput(input: CLIInput): void {
    switch (input.type) {
      case 'cli_handled':
        // CLI handled a command internally - nothing to do
        console.log('  [Debug: CLI handled command internally]');
        break;

      case 'user_input':
        // Raw user input - simulate agent processing
        console.log(`  [Debug: Received user input: "${input.input}"]`);
        this.simulateAgentProcessing(input.input);
        break;

      case 'exit':
        // CLI is shutting down
        console.log('  [Debug: CLI requested exit]');
        process.exit(0);
        break;
    }
  }

  private simulateAgentProcessing(input: string): void {
    // Simulate some agent commands
    if (input.startsWith('/model')) {
      const parts = input.split(' ');
      const modelName = parts[1] || 'current';
      
      if (parts[1]) {
        this.cli.displayFeedback({
          type: 'display_result',
          content: `✅ Model changed to: ${modelName}`
        });
      } else {
        this.cli.displayFeedback({
          type: 'display_result',
          content: '📋 Current model: ollama (qwen2.5:7b)\nAvailable: ollama, groq, openai'
        });
      }
    } else if (input.startsWith('/status')) {
      this.cli.displayFeedback({
        type: 'display_result',
        content: '📊 Agent Status:\n  Model: ollama (qwen2.5:7b)\n  Mode: ready\n  Session: active'
      });
    } else if (input.includes('error')) {
      // Simulate an error
      this.cli.displayFeedback({
        type: 'display_error',
        error: 'Simulated processing error'
      });
    } else if (input.includes('progress')) {
      // Simulate progress updates
      this.simulateProgress();
    } else {
      // Simulate AI response
      this.cli.displayFeedback({
        type: 'display_result',
        content: `🤖 Agent processed: "${input}"\n\n[This would be the actual AI response in a real system]`
      });
    }
  }

  private async simulateProgress(): Promise<void> {
    const steps = ['Analyzing input', 'Processing request', 'Generating response'];
    
    for (let i = 0; i < steps.length; i++) {
      this.cli.displayFeedback({
        type: 'display_progress',
        message: steps[i],
        percentage: Math.round(((i + 1) / steps.length) * 100)
      });
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.cli.displayFeedback({
      type: 'display_result',
      content: '✅ Progress simulation completed!'
    });
  }

  async start(): Promise<void> {
    console.log('🔧 Pure CLI Demo - Main App Integration');
    console.log('======================================\n');
    console.log('This demonstrates proper CLI ↔ Main App communication:');
    console.log('• CLI commands (/help, /exit) → Handled by CLI');
    console.log('• Agent commands (/model, /status) → Sent to Main App → Mock Agent');
    console.log('• Regular input → Sent to Main App → Mock Agent\n');
    console.log('Try these examples:');
    console.log('  /help        - CLI handles this');
    console.log('  /model       - Mock agent handles this');
    console.log('  /model ollama - Mock agent handles this');
    console.log('  /status      - Mock agent handles this');
    console.log('  hello world  - Mock agent handles this');
    console.log('  test error   - Mock agent simulates error');
    console.log('  test progress - Mock agent simulates progress');
    console.log('  /exit        - CLI handles this\n');

    await this.cli.start();
  }
}

async function main(): Promise<void> {
  const app = new MockMainApp();
  await app.start();
}

if (import.meta.main) {
  main().catch(console.error);
}