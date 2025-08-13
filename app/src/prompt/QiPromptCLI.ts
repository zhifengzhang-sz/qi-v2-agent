/**
 * QiPrompt Core - v-0.6.3 Pure Message-Driven Architecture with QiCore Integration
 *
 * Simple message processing loop following h2A pattern and QiCore functional patterns.
 * Matches the exact design specification in docs/qi-prompt/architecture.md
 */

import type { PromptAppOrchestrator } from '@qi/agent/agent/PromptAppOrchestrator';
import type { ICLIFramework } from '@qi/agent/cli/abstractions/ICLIFramework';
import type { QiAsyncMessageQueue } from '@qi/agent/messaging/impl/QiAsyncMessageQueue';
import type { QiMessage, SystemControlMessage } from '@qi/agent/messaging/types/MessageTypes';
import { MessagePriority, MessageType } from '@qi/agent/messaging/types/MessageTypes';
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
 * QiPrompt Core - Simple message processor matching v-0.6.3 design exactly
 */
export class QiPromptCLI {
  private messageQueue: QiAsyncMessageQueue<QiMessage>;
  private cli: ICLIFramework;
  private orchestrator: PromptAppOrchestrator;
  private isRunning = false;
  private processingStarted = false;
  private logger!: SimpleLogger;

  constructor(
    cli: ICLIFramework,
    orchestrator: PromptAppOrchestrator,
    messageQueue: QiAsyncMessageQueue<QiMessage>
  ) {
    this.cli = cli;
    this.orchestrator = orchestrator;
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

        // Initialize orchestrator
        await this.orchestrator.initialize();

        // v-0.6.3: No CLI event handlers - pure message queue communication only

        return undefined;
      },
      (error) =>
        systemError('Failed to initialize QiPromptCLI', {
          originalError: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          component: 'QiPromptCLI',
          step: 'initialization',
        })
    );
  }

  /**
   * Start message processing loop (h2A pattern)
   */
  async start(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        this.isRunning = true;
        await this.cli.start();

        // Start message processing loop
        this.startMessageProcessingLoop();

        return undefined;
      },
      (error) =>
        systemError('Failed to start QiPromptCLI', {
          originalError: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          component: 'QiPromptCLI',
          step: 'start',
        })
    );
  }

  /**
   * Shutdown message processing
   */
  async shutdown(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        this.isRunning = false;

        // Send shutdown signal
        const shutdownMessage: SystemControlMessage = {
          id: Math.random().toString(36).substring(2, 15),
          type: MessageType.SYSTEM_CONTROL,
          timestamp: new Date(),
          priority: MessagePriority.HIGH,
          action: 'shutdown',
          reason: 'QiPromptCLI shutdown requested',
          immediate: true,
        };
        this.messageQueue.enqueue(shutdownMessage);
        this.messageQueue.done();

        await this.cli.shutdown();
        await this.orchestrator.shutdown();

        return undefined;
      },
      (error) =>
        systemError('QiPromptCLI shutdown failed', {
          originalError: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          component: 'QiPromptCLI',
          step: 'shutdown',
        })
    );
  }

  /**
   * Core message processing loop - matches design.v-0.6.3.md exactly
   */
  private async startMessageProcessingLoop(): Promise<void> {
    if (this.processingStarted) {
      this.logger.warn(
        'Message processing loop already started - preventing duplicate',
        undefined,
        {
          component: 'QiPromptCLI',
          method: 'startMessageProcessingLoop',
        }
      );
      return;
    }
    this.processingStarted = true;

    const loopResult = await fromAsyncTryCatch(
      async () => {
        this.logger.info('🔁 Starting message processing loop', undefined, {
          component: 'QiPromptCLI',
          method: 'startMessageProcessingLoop',
        });

        for await (const message of this.messageQueue) {
          if (!this.isRunning) {
            this.logger.debug('🛑 Breaking loop - not running', undefined, {
              component: 'QiPromptCLI',
              reason: 'isRunning_false',
            });
            break;
          }

          this.logger.debug('⏳ About to process message', undefined, {
            messageId: message.id,
            messageType: message.type,
            component: 'QiPromptCLI',
          });

          await this.processMessage(message);

          this.logger.debug('✅ Finished processing message', undefined, {
            messageId: message.id,
            component: 'QiPromptCLI',
          });
        }

        this.logger.info('🏁 Message processing loop ended', undefined, {
          component: 'QiPromptCLI',
        });

        return undefined;
      },
      (error) =>
        systemError('Message processing loop failed', {
          originalError: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          component: 'QiPromptCLI',
          step: 'message_processing_loop',
        })
    );

    // Log error if the loop failed
    match(
      () => {}, // Success - no action needed
      (error) =>
        this.logger.error('Message processing loop error', undefined, {
          component: 'QiPromptCLI',
          error: error.message,
          errorContext: error.context,
        }),
      loopResult
    );
  }

  /**
   * Single message processor - EXACT design specification match
   */
  private async processMessage(message: QiMessage): Promise<void> {
    this.logger.debug('🔄 Processing message', undefined, {
      messageId: message.id,
      messageType: message.type,
      userInput: (message as any).input || 'N/A',
      component: 'QiPromptCLI',
    });

    switch (message.type) {
      case MessageType.USER_INPUT: {
        const userInput = (message as any).input;
        this.logger.debug('📝 Processing USER_INPUT', undefined, {
          userInput,
          messageId: message.id,
          component: 'QiPromptCLI',
        });

        const result = await this.orchestrator.process({
          input: userInput,
          context: { sessionId: 'main', timestamp: new Date(), source: 'cli' },
        });

        this.logger.debug('🤖 LLM response received', undefined, {
          responseLength: result.content.length,
          messageId: message.id,
          component: 'QiPromptCLI',
        });

        // FIX: Display result directly without re-enqueueing to prevent infinite loop
        this.logger.debug('📺 Displaying LLM response directly', undefined, {
          messageId: message.id,
          component: 'QiPromptCLI',
        });
        this.cli.displayMessage(result.content);

        // CRITICAL: Reset processing state in CLI to stop infinite loading
        if (typeof this.cli.resetProcessingState === 'function') {
          this.cli.resetProcessingState();
          this.logger.debug('🔄 Reset processing state in CLI', undefined, {
            messageId: message.id,
            component: 'QiPromptCLI',
          });
        }

        this.logger.debug('✅ Message processing complete', undefined, {
          messageId: message.id,
          component: 'QiPromptCLI',
        });
        break;
      }
      case MessageType.AGENT_OUTPUT: {
        const agentContent = (message as any).content;
        this.logger.debug('📺 Displaying AGENT_OUTPUT', undefined, {
          contentLength: agentContent.length,
          messageId: message.id,
          component: 'QiPromptCLI',
        });
        this.cli.displayMessage(agentContent);
        this.logger.debug('✅ Message processing complete', undefined, {
          messageId: message.id,
          component: 'QiPromptCLI',
        });
        break;
      }
    }
  }

  /**
   * v-0.6.1: REMOVED - No CLI event handlers needed
   *
   * Pure message-driven flow:
   * CLI.handleInput() → messageQueue.enqueue() → QiPrompt.processMessage()
   *
   * This setupCLIEventHandlers method violated the design by creating
   * a second input path through events, when the design specifies
   * CLI should only enqueue directly to message queue.
   */
}
