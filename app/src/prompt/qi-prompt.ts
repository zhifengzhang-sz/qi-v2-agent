#!/usr/bin/env node

/**
 * Qi Prompt CLI Application
 *
 * Modern event-driven CLI with hotkey support, progress indicators, and real-time streaming.
 * 
 * Features:
 * - Shift+Tab: Cycle between Interactive/Command/Streaming modes
 * - Esc: Cancel current operations
 * - Real-time progress bars during LLM processing
 * - Character-by-character streaming responses
 * - Responsive UI that doesn't block during long operations
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContextManager, createDefaultAppContext } from '@qi/agent/context';
import { createStateManager } from '@qi/agent/state';
import { createPromptHandler } from '@qi/agent/prompt';
import { createCommandHandler } from '@qi/agent/command';
import { createPromptApp } from '@qi/agent';
import { setupQuickCLI } from '@qi/agent/cli';

/**
 * Modern Event-Driven Prompt CLI
 * 
 * Uses the new EventDrivenCLI framework with hotkey support and real-time feedback.
 */
class QiPromptCLI {
  private orchestrator: any;
  private cli: any;
  private stateManager: any;
  private contextManager: any;
  private promptHandler: any;
  private commandHandler: any;
  private debugMode: boolean;

  constructor(options: { debug?: boolean } = {}) {
    this.debugMode = options.debug ?? false;
    
    // Create agent components (same as before)
    this.stateManager = createStateManager();
    const appContext = createDefaultAppContext();
    this.contextManager = createContextManager(appContext);
    this.promptHandler = createPromptHandler();
    this.commandHandler = createCommandHandler({
      enableBuiltInCommands: true,
    });
    
    // Register app-specific commands
    this.registerAppCommands();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Event-Driven Qi Prompt CLI...');

    try {
      // Load LLM configuration through StateManager
      console.log('📝 Loading LLM configuration...');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const configPath = join(__dirname, '..', '..', '..', 'config');
      await this.stateManager.loadLLMConfig(configPath);
      console.log('✅ Configuration loaded successfully');

      // Initialize prompt handler with config files
      const configPath2 = join(__dirname, '..', '..', '..', 'config', 'llm-providers.yaml');
      const schemaPath = join(__dirname, '..', '..', '..', 'config', 'llm-providers.schema.json');
      
      const initResult = await this.promptHandler.initialize(configPath2, schemaPath);
      if (!initResult.success) {
        throw new Error(`Failed to initialize prompt handler: ${initResult.error}`);
      }
      console.log('✅ Prompt handler initialized');

      // Create orchestrator (EventEmitter-enabled)
      this.orchestrator = createPromptApp(
        this.stateManager,
        this.contextManager,
        {
          domain: 'prompt-app',
          enableCommands: true,
          enablePrompts: true,
          sessionPersistence: false,
          commandHandler: this.commandHandler,
          promptHandler: this.promptHandler,
        }
      );

      await this.orchestrator.initialize();
      console.log('✅ PromptApp orchestrator initialized');

      // Create event-driven CLI with hotkey support
      this.cli = setupQuickCLI({
        agent: this.orchestrator,
        enableHotkeys: true,
        enableStreaming: true,
        debug: this.debugMode,
        commandHandler: this.commandHandler, // Connect app's CommandHandler to CLI
      });

      console.log('✅ Event-driven CLI initialized');
      console.log('🎉 Initialization complete!\n');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    // Start the event-driven CLI
    await this.cli.start();
  }

  /**
   * Shutdown the CLI and cleanup resources
   */
  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down...');
    
    try {
      // Shutdown CLI first
      if (this.cli) {
        await this.cli.shutdown();
      }
      
      // Then shutdown orchestrator
      if (this.orchestrator) {
        await this.orchestrator.shutdown();
      }
      
      console.log('✅ Shutdown complete');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  /**
   * Register application-specific commands
   */
  private registerAppCommands(): void {
    // Status command - show app status
    this.commandHandler.registerCommand(
      {
        name: 'status',
        description: 'Show current application status',
        usage: '/status',
        category: 'system',
        parameters: [],
      },
      async (request) => {
        const uptime = Math.floor(process.uptime());
        const commands = this.commandHandler.getAvailableCommands().length;
        
        const content = `📊 System Status:\n\n` +
          `  Mode: interactive\n` +
          `  Provider: ollama\n` +
          `  Model: qwen3:8b\n` +
          `  Uptime: ${uptime}s\n` +
          `  Commands: ${commands}`;

        return {
          status: 'success' as const,
          success: true,
          content,
          output: content,
          commandName: 'status',
          metadata: new Map()
        };
      }
    );

    // Model command - show/change model
    this.commandHandler.registerCommand(
      {
        name: 'model',
        description: 'Show or change the current LLM model',
        usage: '/model [model_name]',
        category: 'system',
        parameters: [
          {
            name: 'model_name',
            type: 'string',
            required: false,
            description: 'Model to switch to'
          }
        ],
      },
      async (request) => {
        const modelName = request.parameters.get('model_name') as string;
        
        let content: string;
        if (!modelName) {
          content = 'Current model: qwen3:8b\nAvailable models: qwen3:8b, llama3.2:3b';
        } else {
          content = `Model would be changed to: ${modelName} (not implemented yet)`;
        }

        return {
          status: 'success' as const,
          success: true,
          content,
          output: content,
          commandName: 'model',
          metadata: new Map()
        };
      }
    );
  }
}

// Parse command line arguments
function parseArgs(): { debug: boolean } {
  const args = process.argv.slice(2);
  const debug = args.includes('--debug') || args.includes('-d');
  return { debug };
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const cli = new QiPromptCLI(options);
  
  // Handle graceful shutdown - more aggressive
  const shutdown = (signal: string) => {
    console.log(`\n👋 Received ${signal}, shutting down...`);
    // Don't wait for async cleanup, just exit
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  
  // Also handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
  
  cli.start().catch((error) => {
    console.error('CLI failed:', error);
    process.exit(1);
  });
}

export { QiPromptCLI };