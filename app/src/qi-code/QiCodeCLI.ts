/**
 * QiCode Core - Message-Driven Architecture with QiCodeAgent Integration
 *
 * Integrates with the real QiCodeAgent from lib/src/agent/impl/QiCodeAgent.ts
 * Follows the qi-prompt pattern but uses QiCodeAgent instead of PromptAppOrchestrator
 */

import type { QiCodeAgent } from '@qi/agent/agent/impl/QiCodeAgent';
import type { CLIMode, ICLIFramework } from '@qi/agent/cli/abstractions/ICLIFramework';
import type { QiAsyncMessageQueue } from '@qi/agent/messaging/impl/QiAsyncMessageQueue';
import type { QiMessage, UserInputMessage } from '@qi/agent/messaging/types/MessageTypes';
import { MessageType } from '@qi/agent/messaging/types/MessageTypes';
import {
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
  systemError,
} from '@qi/base';

// Simple logger interface (fallback for @qi/core/logger)
interface SimpleLogger {
  info: (message: string, data?: any, metadata?: any) => void;
  error: (message: string, data?: any, metadata?: any) => void;
  warn: (message: string, data?: any, metadata?: any) => void;
  debug: (message: string, data?: any, metadata?: any) => void;
}

const createLogger = (config: {
  level: string;
  pretty: boolean;
}): Result<SimpleLogger, QiError> => {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[config.level as keyof typeof levels] || 1;

  const log = (logLevel: string, message: string, _data?: any, metadata?: any) => {
    if (levels[logLevel as keyof typeof levels] >= currentLevel) {
      const timestamp = new Date().toISOString();
      if (config.pretty && metadata) {
        console.log(`[${timestamp}] ${logLevel.toUpperCase()}: ${message}`, metadata);
      } else {
        console.log(`[${timestamp}] ${logLevel.toUpperCase()}: ${message}`);
      }
    }
  };

  return success({
    info: (msg, data, meta) => log('info', msg, data, meta),
    error: (msg, data, meta) => log('error', msg, data, meta),
    warn: (msg, data, meta) => log('warn', msg, data, meta),
    debug: (msg, data, meta) => log('debug', msg, data, meta),
  });
};

/**
 * QiCode Core - Message processor with QiCodeAgent integration
 */
export class QiCodeCLI {
  private messageQueue: QiAsyncMessageQueue<QiMessage>;
  private cli: ICLIFramework;
  private qiCodeAgent: QiCodeAgent;
  private isRunning = false;
  private processingStarted = false;
  private logger!: SimpleLogger;

  constructor(
    cli: ICLIFramework,
    qiCodeAgent: QiCodeAgent,
    messageQueue: QiAsyncMessageQueue<QiMessage>
  ) {
    this.cli = cli;
    this.qiCodeAgent = qiCodeAgent;
    this.messageQueue = messageQueue;

    // Initialize QiCore logger with fallback
    const loggerResult = createLogger({ level: 'info', pretty: true });
    this.logger = match(
      (logger) => logger,
      () => ({
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
      }),
      loggerResult
    );
  }

  /**
   * Initialize and start the message processing loop
   */
  async initialize(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Initialize CLI
        await this.cli.initialize();

        // Initialize QiCodeAgent
        await this.qiCodeAgent.initialize();

        this.logger.info('✅ QiCode Core initialized successfully', undefined, {
          component: 'QiCodeCLI',
          qiCodeAgent: 'ready',
          cli: 'ready',
        });

        return undefined;
      },
      (error) =>
        systemError('QiCode initialization failed', {
          originalError: error instanceof Error ? error.message : String(error),
          component: 'QiCodeCLI',
          step: 'initialization',
        })
    );
  }

  /**
   * Start the CLI and message processing
   */
  async start(): Promise<Result<void, QiError>> {
    if (this.processingStarted) {
      return success(undefined);
    }
    this.processingStarted = true;
    this.isRunning = true;

    this.logger.info('🚀 Starting QiCode Core message processing', undefined, {
      component: 'QiCodeCLI',
    });

    // Start CLI
    await this.cli.start();

    // Start message processing loop
    const loopResult = await fromAsyncTryCatch(
      async () => {
        this.logger.info('🔄 QiCode message processing loop started', undefined, {
          component: 'QiCodeCLI',
        });

        // Process messages using async iteration (like qi-prompt)
        for await (const message of this.messageQueue) {
          if (!this.isRunning) {
            this.logger.debug('🛑 Breaking loop - not running', undefined, {
              component: 'QiCodeCLI',
              reason: 'isRunning_false',
            });
            break;
          }

          this.logger.debug('⏳ About to process message', undefined, {
            messageId: message.id,
            messageType: message.type,
            component: 'QiCodeCLI',
          });

          await this.processMessage(message);

          this.logger.debug('✅ Finished processing message', undefined, {
            messageId: message.id,
            component: 'QiCodeCLI',
          });
        }

        this.logger.info('🏁 QiCode message processing loop ended', undefined, {
          component: 'QiCodeCLI',
        });

        return undefined;
      },
      (error) =>
        systemError('QiCode message processing loop failed', {
          originalError: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          component: 'QiCodeCLI',
          step: 'message_processing_loop',
        })
    );

    // Log error if the loop failed
    match(
      () => {}, // Success - no action needed
      (error) =>
        this.logger.error('QiCode message processing loop error', undefined, {
          component: 'QiCodeCLI',
          error: error.message,
          errorContext: error.context,
        }),
      loopResult
    );

    return success(undefined);
  }

  /**
   * Process individual message using QiCodeAgent
   */
  private async processMessage(message: QiMessage): Promise<void> {
    try {
      // Handle different message types
      if (message.type === MessageType.USER_INPUT) {
        const userMessage = message as UserInputMessage;
        
        this.logger.debug('📨 Processing user input with QiCodeAgent', undefined, {
          messageId: message.id,
          input: userMessage.input.substring(0, 50),
          component: 'QiCodeCLI',
          method: 'processMessage',
        });

        // Create AgentRequest for QiCodeAgent
        const agentRequest = {
          id: message.id,
          input: userMessage.input,
          timestamp: message.timestamp,
          context: {
            sessionId: `cli-session-${Date.now()}`,
            timestamp: message.timestamp,
            source: 'cli',
            mode: this.cli.getMode?.() || 'interactive',
          },
        };

        // Process with QiCodeAgent
        const response = await this.qiCodeAgent.process(agentRequest);
        
        // Display response through CLI
        if (response && response.content) {
          this.cli.displayMessage?.(response.content, 'info');
          
          this.logger.info('✅ QiCodeAgent response displayed', undefined, {
            messageId: message.id,
            responseLength: response.content.length,
            component: 'QiCodeCLI',
            method: 'processMessage',
          });
        }

        // Handle exit commands
        const trimmed = userMessage.input.trim();
        if (trimmed === '/exit' || trimmed === '/quit' || trimmed === 'exit' || trimmed === 'quit') {
          this.logger.info('🛑 Exit command received, stopping QiCode', undefined, {
            command: trimmed,
            component: 'QiCodeCLI',
            method: 'processMessage',
          });
          this.isRunning = false;
          await this.cli.shutdown?.();
        }
      }
    } catch (error: any) {
      this.logger.error('❌ Error processing message', undefined, {
        messageId: message.id,
        error: error.message,
        component: 'QiCodeCLI',
        method: 'processMessage',
      });
      
      // Display error to user
      this.cli.displayMessage?.(`Error: ${error.message}`, 'error');
    }
  }

  /**
   * Stop the message processing
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.logger.info('🛑 QiCode Core stopped', undefined, {
      component: 'QiCodeCLI',
    });
  }
}