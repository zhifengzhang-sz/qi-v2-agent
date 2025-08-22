/**
 * Simplified message queue implementation for the QiCore subagent workflow
 * This provides basic message-driven coordination without requiring the full QiAsyncMessageQueue
 */

import { randomUUID } from 'node:crypto';
import type { Result } from './result';
import { success, failure } from './result';

export interface QiMessage {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: Date;
  readonly priority: number;
  readonly retryCount: number;
}

export interface MessageHandler {
  handle: (message: QiMessage) => Promise<Result<void, Error>>;
}

export interface QueueConfig {
  maxConcurrent: number;
  priorityQueuing: boolean;
  autoCleanup: boolean;
  enableStats: boolean;
  messageTtl: number;
}

export class SimpleMessageQueue {
  private handlers = new Map<string, MessageHandler>();
  private queue: QiMessage[] = [];
  private processing = false;
  private started = false;

  constructor(private config: QueueConfig) {}

  registerHandler(messageType: string, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }

  async sendMessage(message: QiMessage): Promise<Result<void, Error>> {
    if (!this.started) {
      return failure(new Error('Message queue not started'));
    }

    this.queue.push(message);
    
    if (this.config.priorityQueuing) {
      this.queue.sort((a, b) => b.priority - a.priority);
    }

    if (!this.processing) {
      this.processQueue();
    }

    return success(undefined);
  }

  async start(): Promise<Result<void, Error>> {
    try {
      this.started = true;
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async stop(): Promise<Result<void, Error>> {
    try {
      this.started = false;
      this.processing = false;
      this.queue = [];
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || !this.started) return;
    
    this.processing = true;

    while (this.queue.length > 0 && this.started) {
      const message = this.queue.shift();
      if (!message) continue;

      const handler = this.handlers.get(message.type);
      if (handler) {
        try {
          await handler.handle(message);
        } catch (error) {
          console.warn(`Message handler failed for ${message.type}:`, error);
        }
      }
    }

    this.processing = false;
  }
}