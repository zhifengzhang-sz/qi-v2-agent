#!/usr/bin/env node

/**
 * Load environment variables from config/.env
 */
import { config } from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the correct path to config/.env relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, '..', '..', '..', 'config', '.env');

config({ path: configPath });

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

import { createDefaultAppContext } from '@qi/agent/context';
import { createStateManager } from '@qi/agent/state';
import { createPromptHandler } from '@qi/agent/prompt';
import { createCommandHandler } from '@qi/agent/command';
import { createPromptApp } from '@qi/agent';
import { setupQuickCLI } from '@qi/agent/cli';

// Import toolbox components (v0.5.x preview)
import { 
  ToolRegistry,
  FileContentResolver,
  ProjectStructureScanner,
  FileReferenceParser,
  SessionManager,
} from '../../../lib/src/tools/index.js';

import { 
  WorkflowManager,
  SimpleWorkflowClass,
  type WorkflowInput,
} from '../../../lib/src/workflows/index.js';

import { FileReferenceClassifier } from '../../../lib/src/classifier/impl/FileReferenceClassifier.js';
import { ToolbasedContextManager } from '../../../lib/src/context/impl/ToolbasedContextManager.js';

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
import { createProviderCommand } from './commands/ProviderCommand.js';
import { createStatusCommand } from './commands/StatusCommand.js';

/**
 * Qi Prompt CLI - v-0.5.x Toolbox Preview
 * 
 * Preview implementation of v-0.8.x agent with toolbox architecture.
 */
class QiPromptCLI {
  private orchestrator: any;
  private cli: any;
  private stateManager: any;
  private contextManager: ToolbasedContextManager;
  private promptHandler: any;
  private commandHandler: any;
  private toolRegistry!: ToolRegistry;
  private workflowManager!: WorkflowManager;
  private classifier: FileReferenceClassifier;
  private debugMode: boolean;
  private framework?: 'readline' | 'ink';
  private autoDetect: boolean;
  private currentSession?: string;

  constructor(options: { 
    debug?: boolean; 
    framework?: 'readline' | 'ink';
    autoDetect?: boolean;
  } = {}) {
    this.debugMode = options.debug ?? false;
    this.framework = options.framework;
    this.autoDetect = options.autoDetect ?? false;
    
    // Initialize toolbox architecture (v-0.5.x preview)
    this.initializeToolbox();
    
    // Create agent components
    this.stateManager = createStateManager();
    
    // Create tool-based context manager (v-0.5.x)
    const appContext = createDefaultAppContext();
    this.contextManager = new ToolbasedContextManager(appContext, this.toolRegistry, {
      enableFileReferences: true,
      enableProjectDiscovery: true,
      enableSessionPersistence: true,
      enableContextAwarePrompting: true,
      maxContextWindow: 8000,
      maxFilesPerSession: 20,
      maxFileSize: 1024 * 1024,
      sessionStoragePath: '.claude-sessions',
      projectMemoryFileName: 'CLAUDE.md',
    });

    // Create file reference classifier (v-0.5.x)
    this.classifier = new FileReferenceClassifier({
      enableFileAwareness: true,
      enableExtendedThinking: true,
      enableContextContinuation: true,
      confidenceThresholds: new Map([
        ['command', 1.0],
        ['prompt', 0.8],
        ['simple-workflow', 0.7],
      ]),
    });
    
    this.promptHandler = createPromptHandler();
    this.commandHandler = createCommandHandler({
      enableBuiltInCommands: true,
    });
    
    // Register app-specific commands
    this.registerAppCommands();
  }

  /**
   * Initialize the toolbox with all required tools (v-0.5.x preview)
   */
  private initializeToolbox(): void {
    this.toolRegistry = new ToolRegistry();
    
    // Register file tools
    const fileResolver = new FileContentResolver({
      maxFileSize: 1024 * 1024,
      enableCache: true,
      cacheTimeout: 30 * 1000,
    });
    
    const projectScanner = new ProjectStructureScanner({
      maxDepth: 5,
      includeHidden: false,
      maxFiles: 1000,
    });
    
    this.toolRegistry.register(fileResolver, {
      name: 'file-content-resolver',
      description: 'Resolves file references and provides content',
      version: '1.0.0',
      category: 'files',
      dependencies: [],
      tags: ['file', 'content', 'resolver'],
    });
    
    this.toolRegistry.register(projectScanner, {
      name: 'project-structure-scanner',
      description: 'Scans and analyzes project structure',
      version: '1.0.0',
      category: 'files',
      dependencies: [],
      tags: ['project', 'structure', 'scanner'],
    });
    
    // Register parsing tools
    const fileParser = new FileReferenceParser();
    
    this.toolRegistry.register(fileParser, {
      name: 'file-reference-parser',
      description: 'Parses file references from text input',
      version: '1.0.0',
      category: 'parsing',
      dependencies: [],
      tags: ['parser', 'file-reference', 'text'],
    });
    
    // Register context tools
    const sessionManager = new SessionManager({
      storagePath: '.claude-sessions',
      maxSessions: 100,
      maxContextWindow: 8000,
      enablePersistence: true,
      autoSave: true,
    });
    
    this.toolRegistry.register(sessionManager, {
      name: 'session-manager',
      description: 'Manages conversation sessions with persistence',
      version: '1.0.0',
      category: 'context',
      dependencies: [],
      tags: ['session', 'persistence', 'conversation'],
    });
    
    // Initialize workflow manager with tool registry
    this.workflowManager = new WorkflowManager(this.toolRegistry);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Qi Prompt CLI v-0.5.x (Toolbox Preview)...');

    try {
      // Initialize tool-based context manager (v-0.5.x)
      console.log('🧰 Initializing toolbox and context manager...');
      await this.contextManager.initialize();
      console.log('✅ Toolbox and context manager initialized');

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

      // Start a new conversation session (v-0.5.x)
      console.log('📚 Starting conversation session...');
      const session = await this.contextManager.startNewConversation('Qi Prompt CLI v-0.5.x Session');
      this.currentSession = session.id;
      console.log(`✅ Session started: ${session.title}`);

      // Create orchestrator with toolbox context manager
      this.orchestrator = createPromptApp(
        this.stateManager,
        this.contextManager,
        {
          domain: 'prompt-app-v0-5-x',
          enableCommands: true,
          enablePrompts: true,
          sessionPersistence: true,
          commandHandler: this.commandHandler,
          promptHandler: this.promptHandler,
        }
      );

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
    
    // Show registered tools
    const toolStats = this.toolRegistry.getStats();
    console.log(`  - Registered tools: ${toolStats.totalTools} tools across ${Object.keys(toolStats.categories).length} categories`);
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

      // Cleanup tool registry
      if (this.toolRegistry) {
        await this.toolRegistry.clear();
        console.log('✅ Tool registry cleaned up');
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
    // CLI Events → Agent
    this.cli.on('modelChangeRequest', (modelName: string) => {
      const event: ModelChangeRequestedEvent = {
        type: 'modelChangeRequested',
        modelName,
        timestamp: new Date()
      };
      this.orchestrator.emit('modelChangeRequested', event);
    });
    
    this.cli.on('modeChangeRequest', (mode: 'interactive' | 'command' | 'streaming') => {
      const event: ModeChangeRequestedEvent = {
        type: 'modeChangeRequested', 
        mode,
        timestamp: new Date()
      };
      this.orchestrator.emit('modeChangeRequested', event);
    });
    
    // Enhanced: File reference detection (v-0.5.x)
    this.cli.on('fileReferenceDetected', (filePath: string) => {
      if (this.currentSession) {
        this.contextManager.addFileReference(filePath);
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
      const session = this.contextManager.getCurrentSession();
      const projectContext = this.contextManager.getCurrentProjectContext();
      const toolStats = this.toolRegistry.getStats();
      const workflowStats = this.workflowManager.getStats();
      
      const content = `📊 v-0.5.x System Status:\n\n` +
        `  Mode: ${mode}\n` +
        `  Provider: ${provider}\n` +
        `  Model: ${model}\n` +
        `  Uptime: ${uptime}s\n` +
        `  Memory: ${memoryUsage}MB\n\n` +
        `🧰 Toolbox Architecture:\n` +
        `  Tools: ${toolStats.totalTools} (${Object.keys(toolStats.categories).length} categories)\n` +
        `  Workflows: ${workflowStats.totalExecutions} executions (${workflowStats.successfulExecutions} successful)\n` +
        `  Project: ${projectContext ? projectContext.root : 'Not detected'}\n` +
        `  Session: ${session ? session.title : 'None'}`;
        
      this.cli.displayMessage(content);
    });
    
    // Enhanced: Workflow processing with classifier and workflow manager (v-0.5.x)
    this.orchestrator.on('processInput', async (input: string) => {
      if (this.currentSession) {
        // Classify input using file reference classifier
        const classificationResult = await this.classifier.classify(input);
        
        if (classificationResult.type === 'simple-workflow' &&
            classificationResult.extractedData.get('workflowClass')) {
          
          // Execute workflow
          const workflowInput: WorkflowInput = {
            originalInput: input,
            classification: classificationResult.extractedData.get('workflowClass') as SimpleWorkflowClass,
            sessionId: this.currentSession,
            projectPath: this.contextManager.getCurrentProjectContext()?.root,
            metadata: classificationResult.metadata,
          };
          
          const workflowResult = await this.workflowManager.executeWorkflow(workflowInput);
          
          if (workflowResult.success) {
            // Use workflow output instead of original input
            this.orchestrator.emit('workflowOutput', {
              original: input,
              enhanced: workflowResult.output,
              classification: classificationResult,
              sessionId: this.currentSession,
              workflow: classificationResult.extractedData.get('workflowClass'),
            });
          }
        } else if (classificationResult.type === 'prompt') {
          // Use context-aware prompting for regular prompts
          const enhancedPrompt = await this.contextManager.getContextAwarePrompt(
            this.currentSession, 
            input
          );
          
          this.orchestrator.emit('enhancedPrompt', {
            original: input,
            enhanced: enhancedPrompt,
            classification: classificationResult,
            sessionId: this.currentSession
          });
        }
      }
    });
    
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
        const session = this.contextManager.getCurrentSession();
        if (session && session.fileReferences.length > 0) {
          const recentFiles = session.fileReferences.slice(-3);
          responseContent += `\n\n📁 Recent files: ${recentFiles.join(', ')}`;
        }
        
        const workflowStats = this.workflowManager.getStats();
        if (workflowStats.totalExecutions > 0) {
          responseContent += `\n🧰 Workflows executed: ${workflowStats.totalExecutions}`;
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
        const tools = this.toolRegistry.listTools();
        const toolList = tools.map(tool => 
          `${tool.name} (${tool.category}): ${tool.description}`
        ).join('\n');

        return { 
          success: true, 
          message: `🧰 Registered Tools:\n${toolList}` 
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
        const stats = this.workflowManager.getStats();
        const workflows = this.workflowManager.getSupportedWorkflows();
        const descriptions = this.workflowManager.getWorkflowDescriptions();
        
        let content = `🔄 Workflow Statistics:\n`;
        content += `  Total Executions: ${stats.totalExecutions}\n`;
        content += `  Successful: ${stats.successfulExecutions}\n`;
        content += `  Failed: ${stats.failedExecutions}\n`;
        content += `  Average Time: ${stats.averageExecutionTime.toFixed(2)}ms\n\n`;
        
        content += `Supported Workflows:\n`;
        for (const workflow of workflows) {
          const desc = descriptions.get(workflow) || 'No description';
          content += `  ${workflow}: ${desc}\n`;
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
        const session = this.contextManager.getCurrentSession();
        if (!session || session.fileReferences.length === 0) {
          return { success: true, message: 'No file references in current session' };
        }

        return { 
          success: true, 
          message: `📁 Current file references:\n${session.fileReferences.join('\n')}` 
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
        const projectContext = this.contextManager.getCurrentProjectContext();
        if (!projectContext) {
          return { success: true, message: 'No project context detected' };
        }

        const info = `📂 Project Context:\n` +
          `  Root: ${projectContext.root}\n` +
          `  Memory Files: ${projectContext.memoryFiles.join(', ') || 'None'}\n` +
          `  Config Files: ${projectContext.configFiles.join(', ')}\n` +
          `  Structure: ${projectContext.structure.length} items`;

        return { success: true, message: info };
      }
    );
  }
}

// Parse command line arguments
function parseArgs(): { 
  debug: boolean;
  framework?: 'readline' | 'ink';
  autoDetect: boolean;
  help: boolean;
} {
  const args = process.argv.slice(2);
  
  const debug = args.includes('--debug') || args.includes('-d');
  const autoDetect = args.includes('--auto-detect') || args.includes('-a');
  const help = args.includes('--help') || args.includes('-h');
  
  let framework: 'readline' | 'ink' | undefined;
  
  // Look for framework argument (supports both --framework=value and --framework value formats)
  for (const arg of args) {
    if (arg.startsWith('--framework=')) {
      const frameworkArg = arg.split('=')[1];
      if (['readline', 'ink'].includes(frameworkArg)) {
        framework = frameworkArg as 'readline' | 'ink';
      }
      break;
    } else if (arg === '-f' || arg === '--framework') {
      const index = args.indexOf(arg);
      if (index >= 0 && index + 1 < args.length) {
        const frameworkArg = args[index + 1];
        if (['readline', 'ink'].includes(frameworkArg)) {
          framework = frameworkArg as 'readline' | 'ink';
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