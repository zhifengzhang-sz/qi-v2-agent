/**
 * QiPrompt Core - v-0.6.1 Pure Message-Driven Architecture
 *
 * Simple message processing loop following h2A pattern and QiCore functional patterns.
 * Matches the exact design specification in docs/qi-prompt/architecture.md
 */

import type { ICommandHandler } from '@qi/agent/command';
import type { IContextManager } from '@qi/agent/context';
import type { IPromptHandler } from '@qi/agent/prompt';
import type { IStateManager } from '@qi/agent/state';
import { create, failure, flatMap, match, type QiError, type Result, success } from '@qi/base';
import type { AgentRequest } from '../../../lib/src/agent/abstractions/index.js';
import type { PromptAppOrchestrator } from '../../../lib/src/agent/PromptAppOrchestrator.js';
import type { ICLIFramework } from '../../../lib/src/cli/abstractions/ICLIFramework.js';
import type { QiAsyncMessageQueue } from '../../../lib/src/messaging/impl/QiAsyncMessageQueue.js';
import type {
  CLIMessageReceivedMessage,
  CLIUserInputMessage,
} from '../../../lib/src/messaging/types/CLIMessageTypes.js';
import type {
  AgentOutputMessage,
  QiMessage,
  SystemControlMessage,
} from '../../../lib/src/messaging/types/MessageTypes.js';
import { MessagePriority, MessageType } from '../../../lib/src/messaging/types/MessageTypes.js';
import type { IWorkflowHandler } from '../../../lib/src/workflows/interfaces/IWorkflowHandler.js';
import { createDebugLogger } from '../../../lib/src/utils/DebugLogger.js';

/**
 * QiPrompt Core - Simple message processor matching v-0.6.1 design exactly
 */
export class QiPromptCLI {
  private messageQueue: QiAsyncMessageQueue<QiMessage>;
  private cli: ICLIFramework;
  private orchestrator: PromptAppOrchestrator;
  private isRunning = false;
  private processingStarted = false;
  private debug = createDebugLogger('QiPromptCLI');

  constructor(
    cli: ICLIFramework,
    orchestrator: PromptAppOrchestrator,
    messageQueue: QiAsyncMessageQueue<QiMessage>
  ) {
    this.cli = cli;
    this.orchestrator = orchestrator;
    this.messageQueue = messageQueue;
  }

  /**
   * Initialize and start the message processing loop
   */
  async initialize(): Promise<Result<void, QiError>> {
    try {
      // Initialize CLI
      await this.cli.initialize();

      // Initialize orchestrator
      await this.orchestrator.initialize();

      // v-0.6.1: No CLI event handlers - pure message queue communication only

      return success(undefined);
    } catch (error) {
      return failure(
        create(
          'INITIALIZATION_FAILED',
          `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM'
        )
      );
    }
  }

  /**
   * Start message processing loop (h2A pattern)
   */
  async start(): Promise<Result<void, QiError>> {
    try {
      this.isRunning = true;
      await this.cli.start();

      // Start message processing loop
      this.startMessageProcessingLoop();

      return success(undefined);
    } catch (error) {
      return failure(
        create(
          'START_FAILED',
          `Failed to start: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM'
        )
      );
    }
  }

  /**
   * Shutdown message processing
   */
  async shutdown(): Promise<Result<void, QiError>> {
    try {
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

      return success(undefined);
    } catch (error) {
      return failure(
        create(
          'SHUTDOWN_FAILED',
          `Shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM'
        )
      );
    }
  }

  /**
   * Core message processing loop - matches design.v-0.6.1.md exactly
   */
  private async startMessageProcessingLoop(): Promise<void> {
    if (this.processingStarted) {
      this.debug.warn('Message processing loop already started - preventing duplicate');
      return;
    }
    this.processingStarted = true;

    try {
      this.debug.log('🔁 Starting message processing loop');
      for await (const message of this.messageQueue) {
        if (!this.isRunning) {
          this.debug.log('🛑 Breaking loop - not running');
          break;
        }

        this.debug.log(`⏳ About to process message ID=${message.id}`);
        await this.processMessage(message);
        this.debug.log(`✅ Finished processing message ID=${message.id}`);
      }
      this.debug.log('🏁 Message processing loop ended');
    } catch (error) {
      console.error('Message processing loop error:', error);
    }
  }

  /**
   * Single message processor - EXACT design specification match
   */
  private async processMessage(message: QiMessage): Promise<void> {
    this.debug.log(
      `🔄 Processing message: ID=${message.id}, type=${message.type}, input="${(message as any).input || 'N/A'}"`
    );

    switch (message.type) {
      case MessageType.USER_INPUT: {
        this.debug.log(`📝 Processing USER_INPUT: "${(message as any).input}"`);
        const result = await this.orchestrator.process({
          input: (message as any).input,
          context: { sessionId: 'main', timestamp: new Date(), source: 'cli' },
        });
        this.debug.log(`🤖 LLM response: "${result.content}"`);

        // FIX: Display result directly without re-enqueueing to prevent infinite loop
        this.debug.log(`📺 Displaying LLM response directly: "${result.content}"`);
        this.cli.displayMessage(result.content);

        // CRITICAL: Reset processing state in CLI to stop infinite loading
        if (typeof this.cli.resetProcessingState === 'function') {
          this.cli.resetProcessingState();
          this.debug.log(`🔄 Reset processing state in CLI`);
        }

        this.debug.log(`✅ Message processing complete for ID=${message.id}`);
        break;
      }
      case MessageType.AGENT_OUTPUT:
        this.debug.log(`📺 Displaying AGENT_OUTPUT: "${(message as any).content}"`);
        this.cli.displayMessage((message as any).content);
        this.debug.log(`✅ Message processing complete for ID=${message.id}`);
        break;
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
