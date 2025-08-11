#!/usr/bin/env node

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Load environment variables from root .env file
 */
import { config } from 'dotenv';

// Get the correct path to .env relative to this file (root directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '..', '..', '.env');

config({ path: envPath });

/**
 * Qi Prompt CLI Application - v-0.5.x Preview
 *
 * Preview of v-0.8.x agent functionality with toolbox architecture:
 * - v-0.4.x: Pure prompt app
 * - v-0.5.x: Current - toolbox preview with file references and workflows
 * - v-0.6.x: Full toolbox (100+ tools, MCP integration)
 * - v-0.7.x: Advanced workflows
 * - v-0.8.x: Full agent capabilities
 *
 * Current Features (v-0.5.x):
 * - File reference processing (@file.txt patterns)
 * - Simple workflow architecture (FILE_REFERENCE)
 * - Tool registry with composable tools
 * - Session persistence and project awareness
 * - Context-aware prompting
 * - Shift+Tab: Cycle between Interactive/Command/Streaming modes
 * - Real-time progress bars and streaming responses
 */

import { createPromptApp } from '@qi/agent';
import { setupQuickCLI } from '@qi/agent/cli';
import { createCommandHandler } from '@qi/agent/command';
import { createDefaultAppContext } from '@qi/agent/context';
import { createPromptHandler } from '@qi/agent/prompt';
import { createStateManager } from '@qi/agent/state';
// Use standard context manager instead of tool-based one
import { ContextManager } from '../../../lib/src/context/impl/ContextManager.js';
// Import new two-layer workflow architecture (v0.5.x refactored)
import { createWorkflowHandler, type IWorkflowHandler } from '../../../lib/src/workflows/index.js';
// Import app-specific commands
import { createModelCommand } from './commands/ModelCommand.js';
import { createProviderCommand } from './commands/ProviderCommand.js';
import { createStatusCommand } from './commands/StatusCommand.js';
// Import app-specific event types
import type {
  ModeChangedEvent,
  ModeChangeRequestedEvent,
  ModelChangedEvent,
  ModelChangeRequestedEvent,
  StatusResponseEvent,
} from './events/PromptAppEvents.js';

/**
 * Qi Prompt CLI - v-0.5.x Toolbox Preview
 *
 * Preview implementation of v-0.8.x agent with toolbox architecture.
 */
class QiPromptCLI {
  private orchestrator: any;
  private cli: any;
  private stateManager: any;
  private contextManager: ContextManager;
  private promptHandler: any;
  private commandHandler: any;
  private workflowHandler!: IWorkflowHandler;
  private debugMode: boolean;
  private framework?: 'readline' | 'ink' | 'hybrid';
  private autoDetect: boolean;
  private currentSession?: string;

  constructor(
    options: {
      debug?: boolean;
      framework?: 'readline' | 'ink' | 'hybrid';
      autoDetect?: boolean;
    } = {}
  ) {
    this.debugMode = options.debug ?? false;
    this.framework = options.framework;
    this.autoDetect = options.autoDetect ?? false;

    // Initialize two-layer workflow architecture (v-0.5.x refactored)
    this.workflowHandler = createWorkflowHandler();

    // Create agent components
    this.stateManager = createStateManager();

    // Create standard context manager (cleaned architecture)
    const appContext = createDefaultAppContext();
    this.contextManager = new ContextManager(appContext);

    this.promptHandler = createPromptHandler();
    this.commandHandler = createCommandHandler({
      enableBuiltInCommands: true,
    });

    // Register app-specific commands
    this.registerAppCommands();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Qi Prompt CLI v-0.5.x (Refactored Architecture)...');

    try {
      // Initialize workflow handler (v-0.5.x refactored)
      console.log('🧰 Initializing workflow handler...');
      const workflowResult = await this.workflowHandler.initialize();
      if (!workflowResult.success) {
        const errorMsg = 'error' in workflowResult ? workflowResult.error : 'Unknown error';
        throw new Error(`Failed to initialize workflow handler: ${errorMsg}`);
      }

      // Initialize standard context manager
      await this.contextManager.initialize();
      console.log('✅ Workflow handler and context manager initialized');

      // Load LLM configuration through StateManager
      console.log('📝 Loading LLM configuration...');
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

      // Create a new conversation context (v-0.5.x refactored)
      console.log('📚 Creating conversation context...');
      const conversationContext = this.contextManager.createConversationContext('main');
      this.currentSession = conversationContext.id;
      console.log(`✅ Conversation context created: ${conversationContext.id}`);

      // Create orchestrator with toolbox context manager and workflow handler
      this.orchestrator = createPromptApp(this.stateManager, this.contextManager, {
        domain: 'prompt-app-v0-5-x',
        enableCommands: true,
        enablePrompts: true,
        sessionPersistence: true,
        commandHandler: this.commandHandler,
        promptHandler: this.promptHandler,
        workflowHandler: this.workflowHandler, // Pass workflow handler to fix race condition
      });

      await this.orchestrator.initialize();
      console.log('✅ PromptApp orchestrator initialized');

      // Create event-driven CLI with framework selection and configuration support
      this.cli = setupQuickCLI({
        framework: this.framework,
        agent: this.orchestrator,
        enableHotkeys: true,
        enableStreaming: true,
        debug: this.debugMode,
        commandHandler: this.commandHandler,
        autoDetect: this.autoDetect,
        args: process.argv.slice(2),
      });

      console.log('✅ Event-driven CLI created');

      // Explicitly initialize the CLI to ensure hotkeys work
      await this.cli.initialize();
      console.log('✅ Event-driven CLI initialized');

      // Setup toolbox-enhanced event communication (v-0.5.x)
      this.setupToolboxEventCommunication();
      console.log('✅ Toolbox event communication wired');

      console.log('🎉 v-0.5.x toolbox initialization complete!\n');
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    await this.initialize();

    // Display welcome message with v-0.5.x features
    console.log('🧰 v-0.5.x Toolbox Preview Features:');
    console.log('  - File references: Use @path/to/file to reference files');
    console.log('  - Simple workflows: FILE_REFERENCE workflow for @file + prompt patterns');
    console.log('  - Tool registry: Composable, reusable tools');
    console.log('  - Session persistence: Conversations saved automatically');
    console.log('  - Project awareness: Automatic project context detection');

    // Show workflow tools
    console.log(`  - Tools managed by workflow system`);
    console.log('');

    // Start the event-driven CLI
    await this.cli.start();
  }

  /**
   * Enhanced shutdown with toolbox cleanup (v-0.5.x)
   */
  async shutdown(): Promise<void> {
    console.log('\n🛑 Shutting down v-0.5.x toolbox CLI...');

    try {
      // Shutdown toolbox context manager
      if (this.contextManager) {
        await this.contextManager.shutdown();
        console.log('✅ Toolbox context manager shut down');
      }

      // Cleanup workflow handler
      if (this.workflowHandler) {
        // Workflow handler cleanup is handled internally
        console.log('✅ Workflow handler cleaned up');
      }

      // Shutdown CLI and orchestrator
      if (this.cli) {
        await this.cli.shutdown();
      }

      if (this.orchestrator) {
        await this.orchestrator.shutdown();
      }

      console.log('✅ v-0.5.x shutdown complete');
    } catch (error) {
      console.error('Error during toolbox shutdown:', error);
    }
  }

  /**
   * Setup toolbox-enhanced event communication (v-0.5.x)
   */
  private setupToolboxEventCommunication(): void {
    // Setup additional event handlers
    this.setupEventHandlers();
    // CLI Events → Agent
    this.cli.on('modelChangeRequest', (modelName: string) => {
      const event: ModelChangeRequestedEvent = {
        type: 'modelChangeRequested',
        modelName,
        timestamp: new Date(),
      };
      this.orchestrator.emit('modelChangeRequested', event);
    });

    this.cli.on('modeChangeRequest', (mode: 'interactive' | 'command' | 'streaming') => {
      const event: ModeChangeRequestedEvent = {
        type: 'modeChangeRequested',
        mode,
        timestamp: new Date(),
      };
      this.orchestrator.emit('modeChangeRequested', event);
    });

    // Enhanced: File reference detection (v-0.5.x)
    this.cli.on('fileReferenceDetected', (filePath: string) => {
      if (this.currentSession) {
        // File references now handled through workflow system
        console.log(`File reference detected: ${filePath}`);
      }
    });

    // Agent Events → CLI
    this.orchestrator.on('modelChanged', (event: ModelChangedEvent) => {
      if (event.success) {
        this.cli.displayMessage(`✅ Model changed: ${event.oldModel} → ${event.newModel}`);
        this.cli.updatePrompt(`${event.newModel} [🧰] > `);
      } else {
        this.cli.displayMessage(`❌ Model change failed: ${event.error}`);
      }
    });

    this.orchestrator.on('modeChanged', (event: ModeChangedEvent) => {
      if (event.success) {
        this.cli.displayMessage(`✅ Mode changed: ${event.oldMode} → ${event.newMode}`);
      } else {
        this.cli.displayMessage(`❌ Mode change failed`);
      }
    });

    // Enhanced status with toolbox information (v-0.5.x)
    this.orchestrator.on('statusResponse', (event: StatusResponseEvent) => {
      const { model, mode, uptime, provider, memoryUsage } = event.status;
      // Simplified for refactored architecture
      const _session = null; // Old session methods not available
      const _projectContext = null; // Old project methods not available

      const content =
        `📊 v-0.5.x System Status:\n\n` +
        `  Mode: ${mode}\n` +
        `  Provider: ${provider}\n` +
        `  Model: ${model}\n` +
        `  Uptime: ${uptime}s\n` +
        `  Memory: ${memoryUsage}MB\n\n` +
        `🧰 Refactored Architecture (v-0.5.x):\n` +
        `  Workflow System: Active\n` +
        `  Tools: Managed by workflow handler\n` +
        `  Project: ${process.cwd()}\n` +
        `  Session: ${this.currentSession || 'None'}`;

      this.cli.displayMessage(content);
    });

    // NOTE: Removed async processInput event handling to fix race condition
    // Workflow processing now happens synchronously in PromptAppOrchestrator.process()
  }

  // REMOVED: handleProcessInput method - workflow processing now handled synchronously
  // in PromptAppOrchestrator.process() to fix the race condition

  /**
   * Setup additional event handlers
   */
  private setupEventHandlers(): void {
    // Enhanced completion with workflow metadata (v-0.5.x)
    this.orchestrator.on('complete', async (event: { result: any; input?: string }) => {
      let responseContent = 'Task completed successfully';

      if (event.result) {
        if (typeof event.result === 'string') {
          responseContent = event.result;
        } else if (event.result.content) {
          responseContent = event.result.content;
        } else if (event.result.data) {
          responseContent = event.result.data;
        }
      }

      // Add toolbox context information (v-0.5.x)
      if (this.currentSession) {
        // Context information now managed through workflow system
        // Workflow stats available through new handler if needed
        const workflowStats = await this.workflowHandler.getAvailableWorkflows();
        // Only show workflow stats in debug mode
        const isDebugMode = process.argv.includes('--debug') || process.env.DEBUG === 'true';
        if (workflowStats.length > 0 && isDebugMode) {
          responseContent += `\n\n🔧 Available workflows: ${workflowStats.length}`;
        }
      }

      this.cli.displayMessage(responseContent, 'complete');
    });
  }

  /**
   * Register application-specific commands with toolbox enhancements (v-0.5.x)
   */
  private registerAppCommands(): void {
    // Standard app commands
    const modelCommand = createModelCommand(this.stateManager);
    this.commandHandler.registerCommand(modelCommand.definition, modelCommand.handler);

    const providerCommand = createProviderCommand(this.stateManager);
    this.commandHandler.registerCommand(providerCommand.definition, providerCommand.handler);

    const statusCommand = createStatusCommand(this.stateManager);
    this.commandHandler.registerCommand(statusCommand.definition, statusCommand.handler);

    // Toolbox-specific commands (v-0.5.x preview)
    this.commandHandler.registerCommand(
      {
        name: 'tools',
        description: 'List registered tools in the toolbox',
        category: 'toolbox',
      },
      async () => {
        const tools = await this.workflowHandler.getAvailableTools();
        if (tools.length === 0) {
          return { success: true, message: 'No tools available' };
        }
        const toolList = tools
          .map(
            (tool) =>
              `${tool.name} (${tool.category}): ${tool.description} ${tool.available ? '✓' : '✗'}`
          )
          .join('\n');

        return {
          success: true,
          message: `🧰 Registered Tools:\n${toolList}`,
        };
      }
    );

    this.commandHandler.registerCommand(
      {
        name: 'workflows',
        description: 'Show workflow execution statistics',
        category: 'toolbox',
      },
      async () => {
        const stats = await this.workflowHandler.getStats();
        const workflows = await this.workflowHandler.getAvailableWorkflows();

        let content = `🔄 Workflow Statistics:\n`;
        content += `  Total Executions: ${stats.totalExecutions}\n`;
        content += `  Success Rate: ${(stats.successRate * 100).toFixed(1)}%\n`;
        content += `  Average Time: ${stats.averageTime.toFixed(2)}ms\n\n`;

        content += `Available Workflows:\n`;
        for (const workflow of workflows) {
          content += `  ${workflow.name}: ${workflow.description} ${workflow.available ? '✓' : '✗'}\n`;
        }

        return { success: true, message: content };
      }
    );

    this.commandHandler.registerCommand(
      {
        name: 'files',
        description: 'List current file references',
        category: 'context',
      },
      async () => {
        // Simplified for refactored architecture
        if (!this.currentSession) {
          return { success: true, message: 'No active session' };
        }

        return {
          success: true,
          message: `📁 Current session: ${this.currentSession}\nFile references handled by workflow system`,
        };
      }
    );

    this.commandHandler.registerCommand(
      {
        name: 'project',
        description: 'Show current project context',
        category: 'context',
      },
      async () => {
        // Simplified for refactored architecture
        const _projectContext = null;
        if (!_projectContext) {
          const info =
            `📂 Project Context:\n` +
            `  Working Directory: ${process.cwd()}\n` +
            `  Session: ${this.currentSession || 'None'}\n` +
            `  Context managed by workflow system`;
          return { success: true, message: info };
        }
      }
    );
  }
}

// Parse command line arguments
function parseArgs(): {
  debug: boolean;
  framework?: 'readline' | 'ink' | 'hybrid';
  autoDetect: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);

  const debug = args.includes('--debug') || args.includes('-d');
  const autoDetect = args.includes('--auto-detect') || args.includes('-a');
  const help = args.includes('--help') || args.includes('-h');

  let framework: 'readline' | 'ink' | 'hybrid' | undefined;

  // Look for framework argument (supports both --framework=value and --framework value formats)
  for (const arg of args) {
    if (arg.startsWith('--framework=')) {
      const frameworkArg = arg.split('=')[1];
      if (['readline', 'ink', 'hybrid'].includes(frameworkArg)) {
        framework = frameworkArg as 'readline' | 'ink' | 'hybrid';
      }
      break;
    } else if (arg === '-f' || arg === '--framework') {
      const index = args.indexOf(arg);
      if (index >= 0 && index + 1 < args.length) {
        const frameworkArg = args[index + 1];
        if (['readline', 'ink', 'hybrid'].includes(frameworkArg)) {
          framework = frameworkArg as 'readline' | 'ink' | 'hybrid';
        }
      }
      break;
    }
  }

  return { debug, framework, autoDetect, help };
}

// Display help function
function displayHelp() {
  // Import configuration utilities for dynamic help
  const { getAvailableFrameworks, autoDetectFramework } = require('@qi/agent/cli');

  const available = getAvailableFrameworks();
  const recommended = autoDetectFramework();

  console.log(`

🧰 Qi Prompt CLI v-0.5.x - Toolbox Preview
AI Assistant with advanced file references, workflows, and session management

VERSIONING ROADMAP:
  v-0.4.x: Pure prompt app ✓
  v-0.5.x: Current - toolbox preview with file references and workflows  ← YOU ARE HERE
  v-0.6.x: Full toolbox (100+ tools, MCP integration)
  v-0.7.x: Advanced workflows  
  v-0.8.x: Full agent capabilities

TOOLBOX FEATURES (v-0.5.x):
  📁 File References    - Use @path/to/file to include file content in prompts
  🔄 Simple Workflows   - FILE_REFERENCE workflow for @file + prompt patterns  
  🧰 Tool Registry      - Composable tools: file resolver, project scanner, parser
  💾 Session Persistence - Automatic conversation and context saving
  📂 Project Awareness  - Auto-detection of project structure and memory files
  🎯 Context-Aware      - Enhanced prompting with project and session context

Usage: bun run qi-prompt [options]

Options:
  --framework, -f <type>    UI framework (${available.join('|')})
  --auto-detect, -a         Auto-detect best framework for environment
  --tui                     Enable TUI mode
  --debug, -d               Enable debug mode
  --help, -h                Display this help message

Environment Variables:
  QI_CLI_FRAMEWORK         Set framework (${available.join('|')})
  QI_CLI_DEBUG            Enable debug mode (true|false)
  QI_CLI_ENABLE_HOTKEYS   Enable hotkeys (true|false)
  QI_CLI_COLORS           Enable colors (true|false)

Configuration Files:
  config/cli.yaml         Global CLI configuration
  .qi-cli.yaml           Local CLI configuration

Framework Information:
  Available: ${available.join(', ')}
  Recommended for your environment: ${recommended}
  
  • readline  - Zero dependencies, always available, basic terminal UI
  • ink       - Rich React-based UI with animations and colors ${available.includes('ink') ? '✓' : '✗ (run: bun add ink @inkjs/ui)'}

TOOLBOX COMMANDS (v-0.5.x):
  /tools        - List all registered tools in the toolbox
  /workflows    - Show workflow execution statistics
  /files        - List current file references in session
  /project      - Show detected project context and memory files

HOTKEYS:
  Shift+Tab     - Cycle through Interactive/Command/Streaming modes
  Ctrl+C        - Clear current input (Ink framework only)

Examples:
  bun run qi-prompt                           # Use default configuration
  bun run qi-prompt --framework ink          # Use Ink framework (React-based UI)  
  bun run qi-prompt --framework readline     # Use basic terminal UI
  bun run qi-prompt --auto-detect            # Use recommended framework (${recommended})
  bun run qi-prompt --debug                  # Enable debug mode
  
  QI_CLI_FRAMEWORK=ink bun run qi-prompt     # Use environment variable

TOOLBOX USAGE EXAMPLES (v-0.5.x):
  @src/index.ts explain this file          # File reference workflow
  @package.json @src/main.ts help me       # Multiple file references
  /tools                                   # List available tools
  /project                                 # Show project context
`);
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();

  // Display help if requested
  if (options.help) {
    displayHelp();
    process.exit(0);
  }

  const cli = new QiPromptCLI(options);

  // Handle graceful shutdown - only for external SIGTERM, let CLI handle SIGINT (Ctrl+C) internally
  let shutdownRequested = false;
  const shutdown = (signal: string) => {
    if (shutdownRequested) {
      console.log(`\n⚡ Force ${signal}, exiting immediately...`);
      process.exit(0);
    }

    shutdownRequested = true;
    console.log(`\n👋 Received ${signal}, shutting down gracefully... (press again to force exit)`);

    // Allow CLI to handle cancellation first
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };

  // Only handle SIGTERM - let CLI handle SIGINT (Ctrl+C) internally for prompt clearing
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Also handle uncaught exceptions with better debugging
  process.on('uncaughtException', (error) => {
    console.error('\n🚨 UNCAUGHT EXCEPTION - This indicates a bug that needs fixing!');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('\n💡 This likely occurred during file reference processing or cancellation.');
    console.error('Please report this error for debugging.\n');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n🚨 UNHANDLED PROMISE REJECTION - This indicates a missing .catch()!');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    if (reason instanceof Error) {
      console.error('Error name:', reason.name);
      console.error('Error message:', reason.message);
      console.error('Stack trace:');
      console.error(reason.stack);
    }
    console.error('\n💡 This likely occurred during async workflow processing.');
    console.error('Please report this error for debugging.\n');
    process.exit(1);
  });

  cli.start().catch((error) => {
    console.error('CLI failed:', error);
    process.exit(1);
  });
}

export { QiPromptCLI };
