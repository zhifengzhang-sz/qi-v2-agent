#!/usr/bin/env node

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Load environment variables from root .env file
 */
import { config } from 'dotenv';

// Environment loading will be handled after argument parsing

/**
 * Qi Prompt CLI Application - v-0.8.0 Complete Binary Compilation with Professional Configuration
 *
 * Roadmap:
 * - v-0.4.x: Pure prompt app ✓
 * - v-0.5.x: Toolbox preview with file references and workflows ✓
 * - v-0.6.1: Pure message-driven architecture (h2A pattern) ✓
 * - v-0.8.0: Complete binary compilation with professional configuration ← YOU ARE HERE
 * - v-0.6.x: Full toolbox (100+ tools, MCP integration)
 * - v-0.7.x: Advanced workflows
 * - v-0.8.x: Full agent capabilities
 *
 * v-0.8.0 Features:
 * - Portable binary compilation (8.74MB executable)
 * - Professional CLI arguments (--config-path, --schema-path, --env-path)
 * - No hardcoded paths - complete configuration flexibility
 * - Dynamic imports solving top-level await bundling issues
 * - Complete QiCore integration with Result<T> patterns
 * - Structured logging and professional error handling
 */

// v-0.6.3: QiCore imports for professional patterns
import { createCommandHandler } from '@qi/agent/command';
import { createDefaultAppContext } from '@qi/agent/context';
// Use standard context manager instead of tool-based one
import { ContextManager } from '@qi/agent/context/impl/ContextManager';
import { RAGIntegration } from '@qi/agent/context/RAGIntegration';
// v-0.8.x: MCP Integration imports
import { MCPServiceManager } from '@qi/agent/mcp/MCPServiceManager';
import { QiAsyncMessageQueue } from '@qi/agent/messaging/impl/QiAsyncMessageQueue';
import type { QiMessage } from '@qi/agent/messaging/types/MessageTypes';
// v-0.8.x: Multi-Provider Model Support
import { ProviderManager } from '@qi/agent/models/ProviderManager';
import { createPromptHandler } from '@qi/agent/prompt';
import { createStateManager } from '@qi/agent/state';
import { WebTool } from '@qi/agent/tools/WebTool';
// Debug logging utility
import { initializeDebugLogging } from '@qi/agent/utils/DebugLogger';
// Import new two-layer workflow architecture (v0.5.x refactored)
import { createWorkflowHandler, type IWorkflowHandler } from '@qi/agent/workflows';
import {
  businessError,
  create,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
// Import app-specific commands
import { createModelCommand } from './commands/ModelCommand.js';
import { createProviderCommand } from './commands/ProviderCommand.js';
import { createStatusCommand } from './commands/StatusCommand.js';
// v-0.8.x: Custom prompt handler using ProviderManager
import { ProviderManagerPromptHandler } from './ProviderManagerPromptHandler.js';
// v-0.6.1: Import new QiPrompt Core and message queue
import { QiPromptCLI } from './QiPromptCLI.js';

// Simple logger implementation (fallback for @qi/core/logger)
interface SimpleLogger {
  info: (message: string, data?: any, metadata?: any) => void;
  error: (message: string, data?: any, metadata?: any) => void;
  warn: (message: string, data?: any, metadata?: any) => void;
  debug: (message: string, data?: any, metadata?: any) => void;
}

const createSimpleLogger = (level: string = 'info', pretty: boolean = true): SimpleLogger => {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[level as keyof typeof levels] || 1;

  const log = (logLevel: string, message: string, _data?: any, metadata?: any) => {
    if (levels[logLevel as keyof typeof levels] >= currentLevel) {
      const timestamp = new Date().toISOString();
      if (pretty && metadata) {
        console.log(`[${timestamp}] ${logLevel.toUpperCase()}: ${message}`, metadata);
      } else {
        console.log(`[${timestamp}] ${logLevel.toUpperCase()}: ${message}`);
      }
    }
  };

  return {
    info: (msg, data, meta) => log('info', msg, data, meta),
    error: (msg, data, meta) => log('error', msg, data, meta),
    warn: (msg, data, meta) => log('warn', msg, data, meta),
    debug: (msg, data, meta) => log('debug', msg, data, meta),
  };
};

// Configuration helper to extract app config from StateManager
interface AppConfigHelper {
  getOr: (path: string, defaultValue: any) => any;
}

const createAppConfigHelper = (stateManager: any): AppConfigHelper => ({
  getOr: (path: string, defaultValue: any) => {
    try {
      const config = stateManager.getConfig();
      const keys = path.split('.');

      // Handle specific paths for app configuration
      if (keys[0] === 'app') {
        if (keys[1] === 'framework') return 'hybrid'; // Default framework
        if (keys[1] === 'debug') return config.enableDebugMode || false;
      }
      if (keys[0] === 'ui') {
        if (keys[1] === 'enableHotkeys') return true; // Default UI settings
        if (keys[1] === 'enableStreaming') return true;
      }
      if (keys[0] === 'messaging') {
        if (keys[1] === 'queueTTL') return 300000; // 5 minutes default
      }
      if (keys[0] === 'logging') {
        if (keys[1] === 'level') return config.enableDebugMode ? 'debug' : 'info';
        if (keys[1] === 'pretty') return true;
        if (keys[1] === 'component') return 'QiPromptApp';
      }

      return defaultValue;
    } catch {
      return defaultValue;
    }
  },
});

/**
 * Main Application Class - v-0.6.3 Pure Message-Driven Architecture with QiCore Integration
 *
 * Coordinates QiPrompt Core, CLI, and all components through message queue.
 * Uses QiCore patterns for logging, error handling, and configuration.
 */
class QiPromptApp {
  private qiPromptCore?: QiPromptCLI; // v-0.6.3: Message-driven core with QiCore
  private messageQueue!: QiAsyncMessageQueue<QiMessage>; // v-0.6.3: Central coordination - Initialized in initialize()
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
  private logger: SimpleLogger;
  private configHelper!: AppConfigHelper;
  private promptConfigPath?: string;
  private promptSchemaPath?: string;
  // v-0.8.x: MCP Integration components
  private serviceManager: MCPServiceManager;
  private ragIntegration: RAGIntegration;
  private webTool: WebTool;
  // v-0.8.x: Multi-Provider Model Support
  private providerManager: ProviderManager;

  constructor(
    options: {
      debug?: boolean;
      framework?: 'readline' | 'ink' | 'hybrid';
      autoDetect?: boolean;
      promptConfigPath?: string;
      promptSchemaPath?: string;
      envPath?: string;
    } = {}
  ) {
    this.debugMode = options.debug ?? false;
    this.framework = options.framework;
    this.autoDetect = options.autoDetect ?? false;
    this.promptConfigPath = options.promptConfigPath;
    this.promptSchemaPath = options.promptSchemaPath;

    // Load environment file if provided
    if (options.envPath) {
      config({ path: options.envPath });
    }

    // Initialize simple logger
    this.logger = createSimpleLogger(this.debugMode ? 'debug' : 'info', true);

    // Initialize debug logging globally (legacy support)
    initializeDebugLogging(this.debugMode);

    // Initialize two-layer workflow architecture (v-0.5.x refactored)
    this.workflowHandler = createWorkflowHandler();

    // Create agent components
    this.stateManager = createStateManager();

    // Create standard context manager (cleaned architecture)
    const appContext = createDefaultAppContext();
    this.contextManager = new ContextManager(appContext);

    // v-0.8.x: Initialize Multi-Provider Model Support FIRST
    this.providerManager = new ProviderManager();

    // v-0.8.x: Use ProviderManager-based prompt handler for automatic fallback
    this.promptHandler = new ProviderManagerPromptHandler(this.providerManager);
    this.commandHandler = createCommandHandler({
      enableBuiltInCommands: true,
    });

    // v-0.8.x: Initialize MCP components
    this.serviceManager = new MCPServiceManager();
    this.ragIntegration = new RAGIntegration(this.serviceManager);
    this.webTool = new WebTool(this.serviceManager);

    // Register app-specific commands
    this.registerAppCommands();
  }

  async initialize(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Only show minimal startup message in normal mode
        if (this.debugMode) {
          this.logger.info(
            '🚀 Initializing Qi Prompt CLI v-0.6.3 (Pure Message-Driven Architecture with QiCore)...',
            undefined,
            {
              component: 'QiPromptApp',
              version: 'v-0.6.3',
            }
          );
        }

        // Load LLM configuration through StateManager FIRST (single source of truth)
        if (this.debugMode) {
          this.logger.info('📝 Loading LLM configuration...', undefined, {
            component: 'QiPromptApp',
            step: 'llm_config_loading',
          });
        }

        if (!this.promptConfigPath) {
          throw systemError(
            'Prompt config path is required for StateManager. Use --config-path argument.',
            {
              code: 'MISSING_STATE_CONFIG',
            }
          );
        }
        await this.stateManager.loadLLMConfig(this.promptConfigPath);

        // Create config helper that uses StateManager as source
        this.configHelper = createAppConfigHelper(this.stateManager);

        // Recreate logger with StateManager configuration values
        this.logger = createSimpleLogger(
          this.configHelper.getOr('logging.level', 'info'),
          this.configHelper.getOr('logging.pretty', true)
        );

        if (this.debugMode) {
          this.logger.info('✅ LLM Configuration loaded successfully', undefined, {
            component: this.configHelper.getOr('logging.component', 'QiPromptApp'),
            step: 'llm_config_loaded',
            configPath: this.promptConfigPath,
            logLevel: this.configHelper.getOr('logging.level', 'info'),
          });
        }

        // v-0.6.3: Initialize message queue with configuration values
        // Design specification: Single Message Queue with sequential processing
        this.messageQueue = new QiAsyncMessageQueue<QiMessage>({
          maxConcurrent: 1, // SINGLE processing loop as per design
          priorityQueuing: true,
          autoCleanup: true,
          enableStats: this.configHelper.getOr('app.debug', false),
          messageTtl: this.configHelper.getOr('messaging.queueTTL', 300000), // 5 minutes default
        });

        if (this.debugMode) {
          this.logger.info('✅ Message queue initialized with configuration', undefined, {
            component: 'QiPromptApp',
            step: 'message_queue_initialized',
            queueTTL: this.configHelper.getOr('messaging.queueTTL', 300000),
            enableStats: this.configHelper.getOr('app.debug', false),
          });

          // Initialize workflow handler (v-0.5.x refactored)
          this.logger.info('🧰 Initializing workflow handler...', undefined, {
            component: 'QiPromptApp',
            step: 'workflow_handler_init',
          });
        }

        const workflowResult = await this.workflowHandler.initialize();
        if (!workflowResult.success) {
          const errorMsg = 'error' in workflowResult ? workflowResult.error : 'Unknown error';
          const workflowError = businessError('Workflow handler initialization failed', {
            errorMessage: errorMsg,
            step: 'workflow_handler_init',
            component: 'WorkflowHandler',
          });
          throw workflowError;
        }

        // Initialize standard context manager
        await this.contextManager.initialize();
        if (this.debugMode) {
          this.logger.info('✅ Workflow handler and context manager initialized', undefined, {
            component: 'QiPromptApp',
            step: 'workflow_and_context_initialized',
          });
        }

        // Initialize prompt handler with config files
        if (!this.promptConfigPath) {
          throw systemError('Prompt config path is required. Use --config-path argument.', {
            code: 'MISSING_CONFIG',
          });
        }
        if (!this.promptSchemaPath) {
          throw systemError('Prompt schema path is required. Use --schema-path argument.', {
            code: 'MISSING_SCHEMA',
          });
        }

        const initResult = await this.promptHandler.initialize(
          this.promptConfigPath,
          this.promptSchemaPath
        );
        if (!initResult.success) {
          throw new Error(`Failed to initialize prompt handler: ${initResult.error}`);
        }
        if (this.debugMode) {
          this.logger.info('✅ Prompt handler initialized', undefined, {
            component: 'QiPromptApp',
            step: 'prompt_handler_initialized',
          });
        }

        // Create a new conversation context (v-0.5.x refactored)
        if (this.debugMode) {
          this.logger.info('📚 Creating conversation context...', undefined, {
            component: 'QiPromptApp',
            step: 'conversation_context_creation',
          });
        }

        const contextResult = this.contextManager.createConversationContext('main');
        const contextId = match(
          (context) => context.id,
          (error) => {
            throw new Error(`Failed to create conversation context: ${error.message}`);
          },
          contextResult
        );
        this.currentSession = contextId;
        if (this.debugMode) {
          this.logger.info('✅ Conversation context created', undefined, {
            component: 'QiPromptApp',
            step: 'conversation_context_created',
            contextId: contextId,
          });
        }

        // Enhanced Session Persistence: Try to load existing session or create new one
        await this.initializeSessionPersistence();

        // v-0.8.x: Initialize MCP services
        await this.initializeMCPServices();

        // v-0.6.3: Create orchestrator directly with message queue (bypass factory)
        this.orchestrator = new (
          await import('@qi/agent/agent/PromptAppOrchestrator')
        ).PromptAppOrchestrator(
          this.stateManager,
          this.contextManager,
          {
            domain: 'prompt-app-v0-6-3',
            enableCommands: true,
            enablePrompts: true,
            sessionPersistence: true,
          },
          {
            commandHandler: this.commandHandler,
            promptHandler: this.promptHandler,
            workflowHandler: this.workflowHandler,
            messageQueue: this.messageQueue, // v-0.6.3: Direct injection
          }
        );

        await this.orchestrator.initialize();
        if (this.debugMode) {
          this.logger.info('✅ PromptApp orchestrator initialized with message queue', undefined, {
            component: 'QiPromptApp',
            step: 'orchestrator_initialized',
          });
        }

        // v-0.6.3: Use proper CLI framework with message queue injection (async for dynamic imports)
        const { createCLIAsync } = await import('@qi/agent/cli');

        const selectedFramework =
          this.framework || this.configHelper.getOr('app.framework', 'hybrid');
        console.log(
          `🔍 [APP DEBUG] Using framework: ${selectedFramework} (this.framework: ${this.framework})`
        );

        const cliResult = await createCLIAsync({
          framework: selectedFramework,
          enableHotkeys: this.configHelper.getOr('ui.enableHotkeys', true),
          enableStreaming: this.configHelper.getOr('ui.enableStreaming', true),
          debug: this.debugMode || this.configHelper.getOr('app.debug', false),
          messageQueue: this.messageQueue, // v-0.6.3: Pass message queue to framework
          stateManager: this.stateManager, // v-0.6.3: Pass state manager for UI updates
        });

        // Check if this is already a CLI object (not a Result)
        if (typeof (cliResult as any)?.initialize === 'function') {
          if (this.debugMode) {
            this.logger.info('✅ CLI framework created', undefined, {
              component: 'QiPromptApp',
              step: 'cli_framework_created',
            });
          }
          this.cli = cliResult as any;
        } else {
          // Use QiCore functional pattern to unwrap the Result
          this.cli = match(
            (cli) => {
              if (this.debugMode) {
                this.logger.info('✅ CLI framework created', undefined, {
                  component: 'QiPromptApp',
                  step: 'cli_framework_created',
                });
              }
              return cli;
            },
            (error) => {
              const cliError = systemError('Failed to create CLI framework', {
                framework: this.framework || this.configHelper.getOr('app.framework', 'hybrid'),
                originalError: error instanceof Error ? error.message : String(error),
                step: 'cli_framework_creation',
              });
              throw cliError;
            },
            cliResult as any
          );
        }

        // CLI will be initialized by QiPromptCore

        // v-0.6.3: Create simplified QiPrompt Core for message processing
        this.qiPromptCore = new QiPromptCLI(this.cli, this.orchestrator, this.messageQueue);

        const coreInitResult = await this.qiPromptCore.initialize();
        // Use QiCore functional pattern instead of manual checking
        match(
          () => {
            if (this.debugMode) {
              this.logger.info(
                '✅ QiPrompt Core initialized with message processing loop',
                undefined,
                {
                  component: 'QiPromptApp',
                  step: 'qi_prompt_core_initialized',
                }
              );
            }
          },
          (error) => {
            throw new Error(`Failed to initialize QiPrompt Core: ${error.message}`);
          },
          coreInitResult
        );

        if (this.debugMode) {
          this.logger.info(
            '🎉 v-0.6.3 message-driven architecture initialization complete!',
            undefined,
            {
              component: 'QiPromptApp',
              step: 'initialization_complete',
            }
          );
        }

        return undefined;
      },
      (error) => {
        // Robust error message extraction
        let errorMessage: string;
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMessage = String((error as any).message);
        } else {
          errorMessage = String(error);
        }

        return create(
          'INITIALIZATION_FAILED',
          `Failed to initialize QiPromptApp: ${errorMessage}`,
          'SYSTEM',
          { originalError: errorMessage }
        );
      }
    );
  }

  async start(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const initResult = await this.initialize();

        // Handle initialization result using QiCore functional composition
        return match(
          async () => {
            // Display welcome message with v-0.6.3 features only in debug mode
            if (this.debugMode) {
              this.logger.info(
                '📨 v-0.6.3 Pure Message-Driven Features with QiCore Integration:',
                undefined,
                {
                  component: 'QiPromptApp',
                  features: [
                    'h2A-inspired message queue eliminates race conditions',
                    'Sequential processing prevents duplicate LLM calls',
                    'Pure message coordination (no EventEmitter)',
                    'Complete QiCore integration with Result<T> patterns',
                    'Structured logging with @qi/core/logger',
                    'Professional error handling with QiError',
                    'File references: Use @path/to/file to reference files',
                    'Simple workflows: FILE_REFERENCE workflow for @file + prompt patterns',
                    'Tool registry: Composable, reusable tools',
                    'Session persistence: Conversations saved automatically',
                    'Project awareness: Automatic project context detection',
                    'Tools managed by workflow system',
                  ],
                }
              );
            }

            // v-0.6.3: Start QiPrompt Core message processing loop
            if (!this.qiPromptCore) {
              throw new Error('QiPrompt Core not initialized');
            }

            const startResult = await this.qiPromptCore.start();
            // Use QiCore functional pattern
            return match(
              () => {
                if (this.debugMode) {
                  this.logger.info('🎯 QiPrompt Core message processing loop started', undefined, {
                    component: 'QiPromptApp',
                    step: 'message_processing_started',
                  });
                }
                return undefined;
              },
              (error) => {
                throw new Error(`Failed to start QiPrompt Core: ${error.message}`);
              },
              startResult
            );
          },
          (error) => {
            this.logger.error('Failed to initialize application', undefined, {
              component: 'QiPromptApp',
              error: error.message,
              ...(this.debugMode && { errorContext: error.context }),
            });
            throw error; // Propagate QiError
          },
          initResult
        );
      },
      (error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return create(
          'APPLICATION_START_FAILED',
          `Failed to start QiPromptApp: ${errorMessage}`,
          'SYSTEM',
          { originalError: errorMessage, step: 'application_start' }
        );
      }
    );
  }

  /**
   * v-0.8.x: Initialize MCP services for RAG and web capabilities
   */
  private async initializeMCPServices(): Promise<void> {
    if (this.debugMode) {
      this.logger.info('🔌 Initializing MCP services...', undefined, {
        component: 'QiPromptApp',
        step: 'mcp_services_init',
      });
    }

    // Define MCP services to connect to
    const servicesToConnect = [
      {
        name: 'memory',
        command: ['npx', '@modelcontextprotocol/server-memory'],
        autoConnect: true,
      },
      {
        name: 'fetch',
        command: ['npx', '@modelcontextprotocol/server-fetch'],
        autoConnect: true,
      },
      {
        name: 'brave-search',
        command: ['npx', '@modelcontextprotocol/server-brave-search'],
        autoConnect: false, // Optional service
      },
    ];

    // Connect to MCP services
    for (const service of servicesToConnect) {
      if (service.autoConnect) {
        try {
          const result = await this.serviceManager.connectToService(service);
          match(
            () => {
              if (this.debugMode) {
                this.logger.info(`✅ Connected to MCP service: ${service.name}`, undefined, {
                  component: 'QiPromptApp',
                  step: 'mcp_service_connected',
                  serviceName: service.name,
                });
              }
            },
            (error) => {
              this.logger.warn(
                `⚠️ Failed to connect to ${service.name}: ${error.message}`,
                undefined,
                {
                  component: 'QiPromptApp',
                  step: 'mcp_service_connection_failed',
                  serviceName: service.name,
                  error: error.message,
                }
              );
            },
            result
          );
        } catch (error) {
          this.logger.warn(`⚠️ Error connecting to ${service.name}`, undefined, {
            component: 'QiPromptApp',
            step: 'mcp_service_connection_error',
            serviceName: service.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (this.debugMode) {
      const connectedServices = this.serviceManager.getConnectedServices();
      this.logger.info('🔌 MCP services initialization complete', undefined, {
        component: 'QiPromptApp',
        step: 'mcp_services_init_complete',
        connectedServices,
        ragAvailable: this.ragIntegration.isAvailable(),
        webFetchAvailable: this.webTool.isWebFetchAvailable(),
      });
    }
  }

  /**
   * Enhanced shutdown with v-0.6.3 message queue cleanup and QiCore logging
   */
  async shutdown(): Promise<Result<void, QiError>> {
    if (this.debugMode) {
      this.logger.info('🛑 Shutting down v-0.6.3 message-driven CLI...', undefined, {
        component: 'QiPromptApp',
        step: 'shutdown_initiated',
      });
    }

    const shutdownResult = await fromAsyncTryCatch(
      async () => {
        // Enhanced Session Persistence: Save current session before shutdown
        await this.saveCurrentSession();

        // v-0.6.3: Shutdown QiPrompt Core first (stops message processing)
        if (this.qiPromptCore) {
          const shutdownResult = await this.qiPromptCore.shutdown();
          // Use QiCore functional pattern
          match(
            () =>
              this.logger.info('✅ QiPrompt Core shut down', undefined, {
                component: 'QiPromptApp',
                step: 'qi_prompt_core_shutdown',
              }),
            (error) =>
              this.logger.warn('⚠️ QiPrompt Core shutdown had issues', undefined, {
                component: 'QiPromptApp',
                error: error.message,
              }),
            shutdownResult
          );
        }

        // Shutdown message queue
        if (this.messageQueue) {
          await this.messageQueue.destroy();
          this.logger.info('✅ Message queue destroyed', undefined, {
            component: 'QiPromptApp',
            step: 'message_queue_destroyed',
          });
        }

        // Shutdown context manager
        if (this.contextManager) {
          await this.contextManager.shutdown();
          this.logger.info('✅ Context manager shut down', undefined, {
            component: 'QiPromptApp',
            step: 'context_manager_shutdown',
          });
        }

        // v-0.8.x: Shutdown MCP services
        if (this.serviceManager) {
          await this.serviceManager.shutdown();
          this.logger.info('✅ MCP services shut down', undefined, {
            component: 'QiPromptApp',
            step: 'mcp_services_shutdown',
          });
        }

        // Cleanup workflow handler
        if (this.workflowHandler) {
          // Workflow handler cleanup is handled internally
          this.logger.info('✅ Workflow handler cleaned up', undefined, {
            component: 'QiPromptApp',
            step: 'workflow_handler_cleanup',
          });
        }

        this.logger.info('✅ v-0.6.3 shutdown complete', undefined, {
          component: 'QiPromptApp',
          step: 'shutdown_complete',
        });

        return undefined;
      },
      (error) =>
        create(
          'SHUTDOWN_FAILED',
          `Error during v-0.6.3 shutdown: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { error }
        )
    );

    // Log any shutdown errors and return the result
    return match(
      () => {
        return success(undefined); // Success case
      },
      (error) => {
        this.logger.error('Error during v-0.6.3 shutdown', undefined, {
          component: 'QiPromptApp',
          error: error.message,
          ...(this.debugMode && { errorContext: error.context }),
        });
        return shutdownResult; // Return the error Result
      },
      shutdownResult
    );
  }

  // v-0.6.1: All event communication methods removed - pure message-driven architecture

  // v-0.6.1: All deprecated event handling methods removed completely

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

    // v-0.8.x: MCP-related commands
    this.commandHandler.registerCommand(
      {
        name: 'mcp',
        description: 'Show MCP service status and capabilities',
        category: 'services',
      },
      async () => {
        const connectedServices = this.serviceManager.getConnectedServices();
        const ragAvailable = this.ragIntegration.isAvailable();
        const webFetchAvailable = this.webTool.isWebFetchAvailable();

        let info = `🔌 MCP Services Status:\n`;
        info += `  Connected Services: ${connectedServices.length > 0 ? connectedServices.join(', ') : 'None'}\n`;
        info += `  RAG Available: ${ragAvailable ? '✅' : '❌'}\n`;
        info += `  Web Fetch Available: ${webFetchAvailable ? '✅' : '❌'}\n`;

        if (connectedServices.length > 0) {
          info += `\n🧠 Enhanced Capabilities:\n`;
          if (ragAvailable) {
            info += `  • Knowledge storage and retrieval\n`;
          }
          if (webFetchAvailable) {
            info += `  • Real-time web content fetching\n`;
          }
        } else {
          info += `\n💡 No MCP services connected. Enhanced features unavailable.`;
        }

        return { success: true, message: info };
      }
    );

    this.commandHandler.registerCommand(
      {
        name: 'knowledge',
        description: 'Search stored knowledge using RAG',
        category: 'context',
      },
      async (args: string[]) => {
        if (!this.ragIntegration.isAvailable()) {
          return {
            success: false,
            message: '❌ RAG service not available. Knowledge search unavailable.',
          };
        }

        const query = args.join(' ');
        if (!query) {
          return {
            success: false,
            message: '❌ Please provide a search query. Usage: /knowledge <query>',
          };
        }

        try {
          const searchResult = await this.ragIntegration.searchRelevantContext(query, 5);
          return match(
            (documents) => {
              if (documents.length === 0) {
                return {
                  success: true,
                  message: `🔍 No relevant knowledge found for: "${query}"`,
                };
              }

              let response = `🧠 Knowledge Search Results for "${query}":\n\n`;
              documents.forEach((doc, index) => {
                const content = doc.content;
                response += `${index + 1}. ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}\n\n`;
              });

              return { success: true, message: response };
            },
            (error) => {
              return {
                success: false,
                message: `❌ Knowledge search failed: ${error.message}`,
              };
            },
            searchResult
          );
        } catch (error) {
          return {
            success: false,
            message: `❌ Knowledge search error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }
    );

    // v-0.8.x: Provider status command
    this.commandHandler.registerCommand(
      {
        name: 'providers',
        description: 'Show available LLM providers and their status',
        category: 'models',
      },
      async () => {
        try {
          const availableProviderResult = await this.providerManager.getAvailableProvider();

          return match(
            (provider) => {
              let info = `🤖 LLM Provider Status:\n`;
              info += `  Active Provider: ${provider.name} (${provider.type})\n`;
              info += `  Status: ✅ Available\n\n`;

              info += `🔄 Provider Priority:\n`;
              info += `  1. Ollama (local) - ${provider.name === 'ollama' ? '✅ Active' : '❌ Unavailable'}\n`;
              info += `  2. OpenRouter (remote) - ${provider.name === 'openrouter' ? '✅ Active' : provider.name === 'ollama' ? '⏩ Fallback ready' : '❌ Unavailable'}\n\n`;

              info += `💡 Automatic fallback: Ollama → OpenRouter when needed`;

              return { success: true, message: info };
            },
            (error) => {
              return {
                success: false,
                message: `❌ No providers available: ${error.message}\n\n💡 Check:\n  • Ollama running (http://localhost:11434)\n  • OPENROUTER_API_KEY environment variable set`,
              };
            },
            availableProviderResult
          );
        } catch (error) {
          return {
            success: false,
            message: `❌ Provider check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      }
    );
  }

  // ==========================================================================
  // Enhanced Session Persistence Methods
  // ==========================================================================

  /**
   * Initialize session persistence - try to load existing session or create new one
   */
  private async initializeSessionPersistence(): Promise<void> {
    try {
      if (!this.currentSession) {
        this.logger.warn('No current session to persist', undefined, {
          component: 'QiPromptApp',
          step: 'session_persistence_init_warning',
        });
        return;
      }

      // Try to load existing session data
      const existingSession = await this.stateManager.loadPersistedSession(this.currentSession);

      if (existingSession) {
        // Restore session data
        this.logger.info('📂 Session restored from previous run', undefined, {
          component: 'QiPromptApp',
          step: 'session_restored',
          sessionId: this.currentSession,
          messageCount: existingSession.conversationHistory.length,
        });

        // Restore conversation history to current session
        for (const entry of existingSession.conversationHistory) {
          this.stateManager.addConversationEntry({
            type: entry.type,
            content: entry.content,
            metadata: entry.metadata,
          });
        }

        // Set context memory for quick access
        this.stateManager.setContextMemory('last_session_id', this.currentSession);
        this.stateManager.setContextMemory('session_start_time', new Date().toISOString());
      } else {
        this.logger.info('🆕 Starting new session', undefined, {
          component: 'QiPromptApp',
          step: 'new_session_started',
          sessionId: this.currentSession,
        });

        // Set context memory for new session
        this.stateManager.setContextMemory('last_session_id', this.currentSession);
        this.stateManager.setContextMemory('session_start_time', new Date().toISOString());
      }

      // Setup auto-save every 30 seconds
      this.setupAutoSave();
    } catch (error) {
      this.logger.error('Failed to initialize session persistence', undefined, {
        component: 'QiPromptApp',
        step: 'session_persistence_init_error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save current session data
   */
  private async saveCurrentSession(): Promise<void> {
    try {
      if (!this.currentSession) {
        return;
      }

      const currentSessionData = this.stateManager.getCurrentSession();
      await this.stateManager.persistSession(this.currentSession, currentSessionData);

      if (this.debugMode) {
        this.logger.info('💾 Session saved', undefined, {
          component: 'QiPromptApp',
          step: 'session_saved',
          sessionId: this.currentSession,
          messageCount: currentSessionData.conversationHistory.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to save session', undefined, {
        component: 'QiPromptApp',
        step: 'session_save_error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Setup automatic session saving
   */
  private setupAutoSave(): void {
    // Auto-save every 30 seconds
    setInterval(async () => {
      await this.saveCurrentSession();
    }, 30000);

    // Also save on process exit
    process.on('SIGINT', async () => {
      this.logger.info('🛑 Received SIGINT, saving session...', undefined, {
        component: 'QiPromptApp',
        step: 'sigint_session_save',
      });
      await this.saveCurrentSession();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.info('🛑 Received SIGTERM, saving session...', undefined, {
        component: 'QiPromptApp',
        step: 'sigterm_session_save',
      });
      await this.saveCurrentSession();
      process.exit(0);
    });
  }

  /**
   * List previous sessions
   */
  async listPreviousSessions(): Promise<void> {
    try {
      const sessions = await this.stateManager.listSessions();

      if (sessions.length === 0) {
        console.log('📭 No previous sessions found');
        return;
      }

      console.log('\n📚 Previous Sessions:');
      console.log('────────────────────');

      for (const session of sessions.slice(0, 10)) {
        // Show last 10 sessions
        const lastActive = session.lastActiveAt.toLocaleDateString();
        const messageCount = session.messageCount;
        const summary =
          session.summary.length > 60 ? session.summary.substring(0, 60) + '...' : session.summary;

        console.log(
          `${session.id.substring(0, 8)}... | ${lastActive} | ${messageCount} msgs | ${summary}`
        );
      }

      console.log('────────────────────\n');
    } catch (error) {
      this.logger.error('Failed to list sessions', undefined, {
        component: 'QiPromptApp',
        step: 'session_list_error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // v-0.6.1: Input handling delegated to CLI framework
}

// Parse command line arguments
function parseArgs(): {
  debug: boolean;
  framework?: 'readline' | 'ink' | 'hybrid';
  autoDetect: boolean;
  help: boolean;
  promptConfigPath?: string;
  promptSchemaPath?: string;
  envPath?: string;
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

  let promptConfigPath: string | undefined;
  let promptSchemaPath: string | undefined;

  // Look for config path argument
  for (const arg of args) {
    if (arg.startsWith('--config-path=')) {
      promptConfigPath = arg.split('=')[1];
      break;
    } else if (arg === '--config-path') {
      const index = args.indexOf(arg);
      if (index >= 0 && index + 1 < args.length) {
        promptConfigPath = args[index + 1];
      }
      break;
    }
  }

  // Look for schema path argument
  for (const arg of args) {
    if (arg.startsWith('--schema-path=')) {
      promptSchemaPath = arg.split('=')[1];
      break;
    } else if (arg === '--schema-path') {
      const index = args.indexOf(arg);
      if (index >= 0 && index + 1 < args.length) {
        promptSchemaPath = args[index + 1];
      }
      break;
    }
  }

  let envPath: string | undefined;

  // Look for env path argument
  for (const arg of args) {
    if (arg.startsWith('--env-path=')) {
      envPath = arg.split('=')[1];
      break;
    } else if (arg === '--env-path') {
      const index = args.indexOf(arg);
      if (index >= 0 && index + 1 < args.length) {
        envPath = args[index + 1];
      }
      break;
    }
  }

  return { debug, framework, autoDetect, help, promptConfigPath, promptSchemaPath, envPath };
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
  --config-path <path>      Path to LLM providers configuration file
  --schema-path <path>      Path to LLM providers schema file
  --env-path <path>         Path to environment variables file (.env)
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
  bun run qi-prompt --config-path config/llm.yaml --schema-path config/schema.json --env-path .env
  bun run qi-prompt --framework ink --config-path ./my-config.yaml --schema-path ./schema.json --env-path ./my.env
  bun run qi-prompt --framework readline --config-path /path/to/config.yaml --schema-path /path/to/schema.json --env-path /path/to/.env
  bun run qi-prompt --auto-detect --debug --config-path config.yaml --schema-path schema.json --env-path .env

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

  const cli = new QiPromptApp(options);

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

  // Handle QiCore Result<T> return from start() with two-layer pattern
  cli
    .start()
    .then((result) => {
      match(
        () => {
          // Success - application is running
        },
        (error) => {
          // Transform QiError to traditional error for external boundary
          // Hide internal QiCore structure from external consumers
          console.error('CLI failed:', error.message);
          if (options.debug) {
            // Only show internal error structure in debug mode
            console.error('Debug details:', {
              code: error.code,
              category: error.category,
              context: error.context,
            });
          }
          process.exit(1);
        },
        result
      );
    })
    .catch((error) => {
      // Fallback for non-QiCore errors
      console.error('Unexpected CLI error:', error);
      process.exit(1);
    });
}

export { QiPromptApp };
