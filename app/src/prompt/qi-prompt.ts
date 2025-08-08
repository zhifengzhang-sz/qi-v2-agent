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

// Import app-specific event types
import type {
  ModelChangeRequestedEvent,
  ModeChangeRequestedEvent,
  ModelChangedEvent,
  ModeChangedEvent,
  StatusResponseEvent
} from './events/PromptAppEvents.js';

// Import app-specific commands
import { createModelCommand } from './commands/ModelCommand.js';
import { createStatusCommand } from './commands/StatusCommand.js';

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
    
    // Register app-specific commands that integrate with StateManager
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

      console.log('✅ Event-driven CLI created');

      // Explicitly initialize the CLI to ensure hotkeys work
      await this.cli.initialize();
      console.log('✅ Event-driven CLI initialized');

      // Setup bidirectional event communication (Phase 5: App Assembly)
      this.setupEventCommunication();
      console.log('✅ Event-driven communication wired');
      
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
   * Setup bidirectional event communication between CLI and Agent
   * This is Phase 5: App Assembly - where the app layer wires CLI and Agent with app-specific events
   */
  private setupEventCommunication(): void {
    // ===========================================
    // CLI Events → Agent (CLI emits, Agent handles)
    // ===========================================
    
    // Wire CLI model change requests to Agent
    // When CLI detects /model command, emit modelChangeRequested event to Agent
    this.cli.on('modelChangeRequest', (modelName: string) => {
      const event: ModelChangeRequestedEvent = {
        type: 'modelChangeRequested',
        modelName,
        timestamp: new Date()
      };
      this.orchestrator.emit('modelChangeRequested', event);
    });
    
    // Wire CLI mode change requests to Agent  
    // TODO: Define proper CLI mode vs App mode separation
    // Reason: CLI modes (interactive/command/streaming) are UI behavior modes,
    // while App modes (ready/planning/editing/executing/error) are workflow states.
    // Need to decide if CLI modes should affect app workflow or remain independent.
    this.cli.on('modeChangeRequest', (mode: 'interactive' | 'command' | 'streaming') => {
      const event: ModeChangeRequestedEvent = {
        type: 'modeChangeRequested', 
        mode,
        timestamp: new Date()
      };
      this.orchestrator.emit('modeChangeRequested', event);
    });
    
    // ===========================================
    // Agent Events → CLI (Agent emits, CLI handles) 
    // ===========================================
    
    // Wire Agent model change confirmations back to CLI
    this.orchestrator.on('modelChanged', (event: ModelChangedEvent) => {
      if (event.success) {
        this.cli.displayMessage(`✅ Model changed: ${event.oldModel} → ${event.newModel}`);
        // Update CLI prompt display to show new model
        this.cli.updatePrompt(`${event.newModel} [💬] > `);
      } else {
        this.cli.displayMessage(`❌ Model change failed: ${event.error}`);
      }
    });
    
    // Wire Agent mode change confirmations back to CLI
    // TODO: Implement proper mode change feedback to CLI
    // Reason: Currently CLI and Agent have different mode systems that need reconciliation
    this.orchestrator.on('modeChanged', (event: ModeChangedEvent) => {
      if (event.success) {
        this.cli.displayMessage(`✅ Mode changed: ${event.oldMode} → ${event.newMode}`);
        // TODO: Update CLI mode indicator properly
        // Reason: CLI modes and Agent modes are different - need proper mapping
      } else {
        this.cli.displayMessage(`❌ Mode change failed`);
      }
    });
    
    // Wire Agent status responses back to CLI
    this.orchestrator.on('statusResponse', (event: StatusResponseEvent) => {
      const { model, mode, uptime, provider, memoryUsage } = event.status;
      const content = `📊 System Status:\n\n` +
        `  Mode: ${mode}\n` +
        `  Provider: ${provider}\n` +
        `  Model: ${model}\n` +
        `  Uptime: ${uptime}s\n` +
        `  Memory: ${memoryUsage}MB`;
      this.cli.displayMessage(content);
    });
  }

  /**
   * Register application-specific commands that use StateManager properly
   */
  private registerAppCommands(): void {
    // Register model command with real StateManager integration
    const modelCommand = createModelCommand(this.stateManager);
    this.commandHandler.registerCommand(modelCommand.definition, modelCommand.handler);

    // Register status command with real StateManager integration  
    const statusCommand = createStatusCommand(this.stateManager);
    this.commandHandler.registerCommand(statusCommand.definition, statusCommand.handler);
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