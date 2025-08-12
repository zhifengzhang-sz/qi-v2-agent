/**
 * QiPrompt Core - v-0.6.1 Pure Message-Driven Architecture
 *
 * Simple message processing loop following h2A pattern and QiCore functional patterns.
 * Matches the exact design specification in docs/zz/design.v-0.6.1.md
 */

import type { ICommandHandler } from '@qi/agent/command';
import type { IContextManager } from '@qi/agent/context';
import type { IPromptHandler } from '@qi/agent/prompt';
import type { IStateManager } from '@qi/agent/state';
import type { ICLIFramework } from '../../../lib/src/cli/abstractions/ICLIFramework.js';
import { match, success, failure, flatMap, type Result, type QiError, create } from '@qi/base';
import type { IWorkflowHandler } from '../../../lib/src/workflows/interfaces/IWorkflowHandler.js';
import { QiAsyncMessageQueue } from '../../../lib/src/messaging/impl/QiAsyncMessageQueue.js';
import type { QiMessage } from '../../../lib/src/messaging/types/MessageTypes.js';
import { MessageType } from '../../../lib/src/messaging/types/MessageTypes.js';
import {
  type CLIUserInputMessage,
  type CLIMessageReceivedMessage,
} from '../../../lib/src/messaging/types/CLIMessageTypes.js';
import type { PromptAppOrchestrator } from '../../../lib/src/agent/PromptAppOrchestrator.js';
import type { AgentRequest } from '../../../lib/src/agent/abstractions/index.js';

/**
 * QiPrompt Core - Simple message processor matching v-0.6.1 design exactly
 */
export class QiPromptCLI {
  private messageQueue: QiAsyncMessageQueue<QiMessage>;
  private cli: ICLIFramework;
  private orchestrator: PromptAppOrchestrator;
  private isRunning = false;
  private processingStarted = false;

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
      return failure(create(
        'INITIALIZATION_FAILED',
        `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM'
      ));
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
      return failure(create(
        'START_FAILED',
        `Failed to start: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM'
      ));
    }
  }

  /**
   * Shutdown message processing
   */
  async shutdown(): Promise<Result<void, QiError>> {
    try {
      this.isRunning = false;
      
      // Send shutdown signal
      this.messageQueue.enqueue({ type: 'SHUTDOWN' });
      this.messageQueue.done();
      
      await this.cli.shutdown();
      await this.orchestrator.shutdown();
      
      return success(undefined);
    } catch (error) {
      return failure(create(
        'SHUTDOWN_FAILED',
        `Shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
        'SYSTEM'
      ));
    }
  }

  /**
   * Core message processing loop - matches design.v-0.6.1.md exactly
   */
  private async startMessageProcessingLoop(): Promise<void> {
    if (this.processingStarted) {
      console.warn('Message processing loop already started - preventing duplicate');
      return;
    }
    this.processingStarted = true;
    
    try {
      for await (const message of this.messageQueue) {
        if (!this.isRunning) break;
        
        await this.processMessage(message);
      }
    } catch (error) {
      console.error('Message processing loop error:', error);
    }
  }

  /**
   * Single message processor - EXACT design specification match
   */
  private async processMessage(message: QiMessage): Promise<void> {
    switch (message.type) {
      case MessageType.USER_INPUT:
        const result = await this.orchestrator.process({ input: (message as any).input, context: { sessionId: 'main', timestamp: new Date(), source: 'cli' } });
        this.messageQueue.enqueue({ 
          type: MessageType.AGENT_OUTPUT, 
          content: result.content,
          timestamp: new Date(),
          id: Math.random().toString(36),
          priority: 2 as any
        });
        break;
      case MessageType.AGENT_OUTPUT:
        this.cli.displayMessage((message as any).content);
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