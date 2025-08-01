#!/usr/bin/env node

/**
 * Pure CLI Demo
 *
 * Demonstrates the new pure CLI design:
 * - CLI handles only interface commands (/help, /exit, /clear, /version)
 * - Main App receives raw user input for agent processing
 * - Shows proper separation of concerns
 */

import { type CLIInput, createPureCLI, type ICLI } from '@qi/cli/impl/pure-cli';
import { createStateManager } from '@qi/agent/state';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Demo Main App that demonstrates agent processing patterns
 */
class DemoMainApp {
  private cli: ICLI;
  private stateManager: any;
  private config: any;

  constructor() {
    this.cli = createPureCLI();
    this.stateManager = createStateManager();
    this.setupCLIHandlers();
  }

  async initialize(): Promise<void> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = join(__dirname, '..', '..', '..', '..', 'config');
    await this.stateManager.loadLLMConfig(configPath);
    this.config = this.stateManager.getLLMConfigForPromptModule();
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
        // Raw user input - demonstrate agent processing
        console.log(`  [Debug: Received user input: "${input.input}"]`);
        this.demonstrateAgentProcessing(input.input);
        break;

      case 'exit':
        // CLI is shutting down
        console.log('  [Debug: CLI requested exit]');
        process.exit(0);
        break;
    }
  }

  private demonstrateAgentProcessing(input: string): void {
    // Demonstrate agent command handling patterns
    if (input.startsWith('/model')) {
      const parts = input.split(' ');
      const modelName = parts[1] || 'current';

      if (parts[1]) {
        this.cli.displayFeedback({
          type: 'display_result',
          content: `✅ Model changed to: ${modelName}`,
        });
      } else {
        this.cli.displayFeedback({
          type: 'display_result',
          content: `📋 Current model: ${this.getCurrentModelInfo()}\nAvailable: ${this.getAvailableModels()}`,
        });
      }
    } else if (input.startsWith('/status')) {
      this.cli.displayFeedback({
        type: 'display_result',
        content: `📊 Agent Status:\n  Model: ${this.getCurrentModelInfo()}\n  Mode: ready\n  Session: active`,
      });
    } else if (input.includes('error')) {
      // Demonstrate error handling
      this.cli.displayFeedback({
        type: 'display_error',
        error: 'Demo processing error',
      });
    } else if (input.includes('progress')) {
      // Demonstrate progress updates
      this.demonstrateProgress();
    } else {
      // Demonstrate AI response pattern
      this.cli.displayFeedback({
        type: 'display_result',
        content: `🤖 Agent processed: "${input}"\n\n[This would be the actual AI response in a real system]`,
      });
    }
  }

  private async demonstrateProgress(): Promise<void> {
    const steps = ['Analyzing input', 'Processing request', 'Generating response'];

    for (let i = 0; i < steps.length; i++) {
      this.cli.displayFeedback({
        type: 'display_progress',
        message: steps[i],
        percentage: Math.round(((i + 1) / steps.length) * 100),
      });

      // Demo work delay
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.cli.displayFeedback({
      type: 'display_result',
      content: '✅ Progress demonstration completed!',
    });
  }

  private getCurrentModelInfo(): string {
    if (!this.config?.llm?.providers?.ollama) return 'unknown';
    const model = this.config.llm.prompt?.currentModel || this.config.llm.classifier?.model || 'unknown';
    return `ollama (${model})`;
  }

  private getAvailableModels(): string {
    if (!this.config?.llm?.providers) return 'unknown';
    const providers = Object.keys(this.config.llm.providers);
    return providers.join(', ');
  }

  async start(): Promise<void> {
    await this.initialize();
    console.log('🔧 Pure CLI Demo - Main App Integration');
    console.log('======================================\n');
    console.log('This demonstrates proper CLI ↔ Main App communication:');
    console.log('• CLI commands (/help, /exit) → Handled by CLI');
    console.log('• Agent commands (/model, /status) → Sent to Main App → Demo Agent');
    console.log('• Regular input → Sent to Main App → Demo Agent\n');
    console.log('Try these examples:');
    console.log('  /help        - CLI handles this');
    console.log('  /model       - Demo agent handles this');
    console.log('  /model ollama - Demo agent handles this');
    console.log('  /status      - Demo agent handles this');
    console.log('  hello world  - Demo agent handles this');
    console.log('  test error   - Demo agent shows error handling');
    console.log('  test progress - Demo agent shows progress display');
    console.log('  /exit        - CLI handles this\n');

    await this.cli.start();
  }
}

async function main(): Promise<void> {
  const app = new DemoMainApp();
  await app.start();
}

if (import.meta.main) {
  main().catch(console.error);
}
