#!/usr/bin/env node

/**
 * Qi Prompt CLI Application
 *
 * CLI that communicates with PromptAppOrchestrator using the same contracts as the full agent.
 * Architecture: CLI + PromptAppOrchestrator (which is Agent without classifier)
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as readline from 'node:readline';
import { createContextManager, createDefaultAppContext } from '@qi/agent/context';
import { createStateManager } from '@qi/agent/state';
import { createPromptHandler } from '@qi/agent/prompt';
import { createCommandHandler } from '@qi/agent/command';
import type { AgentRequest } from '@qi/agent/abstractions';
import { PromptAppOrchestrator } from './PromptAppOrchestrator.js';

/**
 * CLI for Prompt App - communicates with orchestrator using same interface as agent
 */
class QiPromptCLI {
  private orchestrator: PromptAppOrchestrator;
  private stateManager: any;
  private rl: readline.Interface;
  private isRunning = false;

  private promptHandler: any;
  private contextManager: any;
  private commandHandler: any;

  constructor() {
    // Create components (same as agent initialization)
    this.stateManager = createStateManager();
    const appContext = createDefaultAppContext();
    this.contextManager = createContextManager(appContext);
    this.promptHandler = createPromptHandler();
    this.commandHandler = createCommandHandler({
      enableBuiltInCommands: true,
    });

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Qi Prompt CLI...');

    try {
      // Load LLM configuration through StateManager (same as agent demo)
      console.log('📝 Loading LLM configuration...');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const configPath = join(__dirname, '..', '..', '..', 'config');
      await this.stateManager.loadLLMConfig(configPath);
      console.log('✅ Configuration loaded successfully');

      // Initialize prompt handler with config files (like the working demo)
      const configPath2 = join(__dirname, '..', '..', '..', 'config', 'llm-providers.yaml');
      const schemaPath = join(__dirname, '..', '..', '..', 'config', 'llm-providers.schema.json');
      
      const initResult = await this.promptHandler.initialize(configPath2, schemaPath);
      if (!initResult.success) {
        throw new Error(`Failed to initialize prompt handler: ${initResult.error}`);
      }
      console.log('✅ Prompt handler initialized');

      // Create orchestrator with initialized components
      this.orchestrator = new PromptAppOrchestrator(
        this.stateManager,
        this.contextManager,
        {
          domain: 'prompt-app',
          enableCommands: true,
          enablePrompts: true,
          enableWorkflows: false, // PromptApp doesn't handle workflows
          sessionPersistence: false,
        },
        {
          commandHandler: this.commandHandler,
          promptHandler: this.promptHandler,
        }
      );

      // Initialize orchestrator (same interface as agent.initialize())
      await this.orchestrator.initialize();
      console.log('✅ PromptApp orchestrator initialized');

      console.log('🎉 Initialization complete!\n');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    console.log('💬 Qi Prompt CLI');
    console.log('================');
    console.log('This is a simplified agent focused on prompt processing.');
    console.log('Commands:');
    console.log('  - Type any message to send to the LLM');
    console.log('  - Type /help to see available commands');
    console.log('  - Type /status (or /s) to see current status');
    console.log('  - Type /model [model_name] (or /m) to change models');
    console.log('  - Type /exit to quit\n');

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

  private async handleInput(input: string): Promise<void> {
    if (!input) {
      this.rl.prompt();
      return;
    }

    try {
      // Handle special CLI commands that should exit immediately
      if (input === '/exit' || input === '/quit' || input === '/q') {
        await this.stop();
        return;
      }

      // Create AgentRequest (same format as full agent)
      const request: AgentRequest = {
        input,
        context: {
          sessionId: 'cli-session',
          timestamp: new Date(),
          source: 'cli',
          environmentContext: new Map([
            ['cwd', process.cwd()],
            ['platform', process.platform],
          ]),
        },
      };

      console.log(`\n📤 Processing: "${input}"`);
      const startTime = Date.now();

      // Process using same interface as agent.process()
      const response = await this.orchestrator.process(request);
      const totalTime = Date.now() - startTime;

      // Display response
      if (response.success !== false) {
        console.log(`📥 Response (${response.executionTime || totalTime}ms):`);
        console.log(`   ${response.content}`);
        
        // Show additional metadata if available
        if (response.metadata.has('provider')) {
          console.log(`   Provider: ${response.metadata.get('provider')}`);
        }
        if (response.metadata.has('inputType')) {
          console.log(`   Input Type: ${response.metadata.get('inputType')}`);
        }
      } else {
        console.log(`❌ Error: ${response.error || response.content}`);
      }
    } catch (error) {
      console.error(`💥 Processing failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log('');
    if (this.isRunning) {
      this.rl.prompt();
    }
  }

  private async stop(): Promise<void> {
    console.log('\n🛑 Shutting down...');
    this.isRunning = false;
    
    try {
      // Shutdown orchestrator (same interface as agent.shutdown())
      await this.orchestrator.shutdown();
      console.log('✅ Shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
    
    this.rl.close();
    process.exit(0);
  }

  private showStatus(): void {
    // Get status from orchestrator (same interface as agent.getStatus())
    const status = this.orchestrator.getStatus();
    const stateInfo = this.stateManager.getCurrentState();

    console.log('\n📊 System Status:');
    console.log(`   Initialized: ${status.isInitialized}`);
    console.log(`   Domain: ${status.domain}`);
    console.log(`   Uptime: ${Math.floor(status.uptime / 1000)}s`);
    console.log(`   Requests Processed: ${status.requestsProcessed}`);
    console.log(`   Average Response Time: ${Math.floor(status.averageResponseTime)}ms`);
    
    if (status.lastActivity) {
      console.log(`   Last Activity: ${status.lastActivity.toLocaleTimeString()}`);
    }

    // Show state manager info
    console.log('\n🔧 Configuration:');
    console.log(`   Current Model: ${stateInfo?.currentModel || 'default'}`);
    console.log(`   Provider: ${stateInfo?.currentProvider || 'ollama'}`);
    console.log(`   Temperature: ${stateInfo?.temperature || 0.1}`);
    console.log('');
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new QiPromptCLI();
  
  cli.start().catch((error) => {
    console.error('CLI failed:', error);
    process.exit(1);
  });
}

export { QiPromptCLI };