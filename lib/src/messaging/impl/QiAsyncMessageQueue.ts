/**
 * QiAsyncMessageQueue Implementation
 *
 * h2A-inspired async message queue with QiCore Result<T> patterns.
 * Provides non-blocking message processing with Promise-based flow control.
 */

import type {
  IAsyncMessageQueue,
  QueueEventCallback,
  QueueOptions,
  QueueState,
} from '@qi/agent/messaging/interfaces/IAsyncMessageQueue';
import { QueueEventType } from '@qi/agent/messaging/interfaces/IAsyncMessageQueue';
import type { MessageStats, QiMessage } from '@qi/agent/messaging/types/MessageTypes';
import { MessagePriority, MessageStatus } from '@qi/agent/messaging/types/MessageTypes';
import { create, failure, match, type QiError, type Result, success } from '@qi/base';

/**
 * Queue error types
 */
interface QueueError extends QiError {
  context: {
    operation?: string;
    queueSize?: number;
    messageId?: string;
    messageType?: string;
  };
}

const queueError = (
  code: string,
  message: string,
  context: QueueError['context'] = {}
): QueueError => create(code, message, 'SYSTEM', context) as QueueError;

/**
 * Internal message wrapper for queue management
 */
interface QueuedMessage<T extends QiMessage = QiMessage> {
  readonly message: T;
  readonly enqueuedAt: Date;
  readonly expiresAt?: Date;
  status: MessageStatus;
  processingStarted?: Date;
  processingCompleted?: Date;
  processingError?: QiError;
}

/**
 * QiAsyncMessageQueue implementation following h2A pattern
 */
export class QiAsyncMessageQueue<T extends QiMessage = QiMessage> implements IAsyncMessageQueue<T> {
  private queue: QueuedMessage<T>[] = [];
  private readResolve?: (value: IteratorResult<T, any>) => void;
  private readReject?: (error: any) => void;
  private state: QueueState;
  private options: Required<QueueOptions>;
  private stats: MessageStats;
  private eventSubscriptions: Map<QueueEventType, Set<QueueEventCallback<T>>> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private isPausedState = false;

  constructor(options: QueueOptions = {}) {
    // Initialize state
    this.state = {
      started: false,
      isDone: false,
      hasError: false,
      messageCount: 0,
      processingCount: 0,
      errorCount: 0,
    };

    // Set default options
    this.options = {
      maxSize: options.maxSize || 0, // 0 = unlimited
      maxConcurrent: options.maxConcurrent || 10,
      messageTtl: options.messageTtl || 300000, // 5 minutes default
      priorityQueuing: options.priorityQueuing ?? true,
      autoCleanup: options.autoCleanup ?? true,
      enableStats: options.enableStats ?? true,
      cleanupFn: options.cleanupFn || (() => {}),
    };

    // Initialize stats
    this.stats = {
      totalMessages: 0,
      messagesByType: {} as any,
      messagesByPriority: {} as any,
      messagesByStatus: {} as any,
      averageProcessingTime: 0,
      errorRate: 0,
      queueLength: 0,
    };

    // Setup auto-cleanup if enabled
    if (this.options.autoCleanup) {
      this.setupAutoCleanup();
    }
  }

  /**
   * AsyncIterable implementation - core h2A pattern
   */
  [Symbol.asyncIterator](): AsyncIterator<T, any, undefined> {
    if (this.state.started) {
      throw queueError('ALREADY_STARTED', 'Queue can only be iterated once');
    }

    this.state = { ...this.state, started: true };
    this.emit(QueueEventType.QUEUE_RESUMED, { started: true });

    return this;
  }

  /**
   * Core async iterator method - implements h2A's next() pattern
   */
  async next(): Promise<IteratorResult<T, any>> {
    // Check if queue is paused
    if (this.isPausedState) {
      return new Promise((resolve) => {
        const checkPaused = () => {
          if (!this.isPausedState) {
            this.next().then(resolve);
          } else {
            setTimeout(checkPaused, 100);
          }
        };
        checkPaused();
      });
    }

    // Priority: return from queue if available
    const nextMessage = this.dequeueNextMessage();
    return match(
      (queuedMessage) => {
        if (queuedMessage) {
          this.updateMessageStatus(queuedMessage, MessageStatus.PROCESSING);
          this.emit(QueueEventType.MESSAGE_DEQUEUED, { message: queuedMessage.message });

          return Promise.resolve({
            done: false,
            value: queuedMessage.message,
          });
        }
        // Continue to check done/error states
        return this.handleEmptyQueue();
      },
      (error) => {
        // Log error but continue processing
        console.error('Dequeue error:', error);
        return this.handleEmptyQueue();
      },
      nextMessage
    );
  }

  private handleEmptyQueue(): Promise<IteratorResult<T, any>> {
    // Check if queue is done
    if (this.state.isDone) {
      this.emit(QueueEventType.QUEUE_EMPTY, { final: true });
      return Promise.resolve({
        done: true,
        value: undefined,
      });
    }

    // Check for error state
    if (this.state.hasError) {
      return Promise.reject(queueError('QUEUE_ERROR', 'Queue is in error state'));
    }

    // Wait for new message - core h2A non-blocking pattern
    return new Promise((resolve, reject) => {
      this.readResolve = resolve;
      this.readReject = reject;
    });
  }

  /**
   * Enqueue message - supports real-time injection (h2A pattern)
   */
  enqueue(message: T): Result<void, QueueError> {
    // Validate queue state
    if (this.state.isDone) {
      return failure(
        queueError('QUEUE_DONE', 'Cannot enqueue to completed queue', {
          operation: 'enqueue',
          messageId: message.id,
          messageType: message.type,
        })
      );
    }

    if (this.state.hasError) {
      return failure(
        queueError('QUEUE_ERROR', 'Cannot enqueue to error queue', {
          operation: 'enqueue',
          messageId: message.id,
          messageType: message.type,
        })
      );
    }

    // Check size limits
    if (this.options.maxSize > 0 && this.queue.length >= this.options.maxSize) {
      this.emit(QueueEventType.QUEUE_FULL, {
        queueSize: this.queue.length,
        maxSize: this.options.maxSize,
      });

      return failure(
        queueError('QUEUE_FULL', 'Queue has reached maximum size', {
          operation: 'enqueue',
          queueSize: this.queue.length,
          messageId: message.id,
          messageType: message.type,
        })
      );
    }

    // Create queued message
    const queuedMessage: QueuedMessage<T> = {
      message,
      enqueuedAt: new Date(),
      expiresAt:
        this.options.messageTtl > 0 ? new Date(Date.now() + this.options.messageTtl) : undefined,
      status: MessageStatus.PENDING,
    };

    // Insert based on priority if enabled
    if (this.options.priorityQueuing) {
      this.insertByPriority(queuedMessage);
    } else {
      this.queue.push(queuedMessage);
    }

    // Update state and stats
    this.state = {
      ...this.state,
      messageCount: this.state.messageCount + 1,
    };

    this.updateStats(message, 'enqueued');
    this.emit(QueueEventType.MESSAGE_ENQUEUED, { message });

    // If there's a waiting reader, resolve immediately (h2A direct resolution)
    if (this.readResolve && !this.isPausedState) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;

      this.updateMessageStatus(queuedMessage, MessageStatus.PROCESSING);
      this.emit(QueueEventType.MESSAGE_DEQUEUED, { message });

      resolve({
        done: false,
        value: message,
      });
    }

    return success(undefined);
  }

  /**
   * Mark queue as done - no more messages will be added
   */
  done(): Result<void, QueueError> {
    if (this.state.isDone) {
      return success(undefined);
    }

    this.state = { ...this.state, isDone: true };

    // Resolve waiting reader if queue is empty
    if (this.readResolve && this.queue.length === 0) {
      const resolve = this.readResolve;
      this.readResolve = undefined;
      this.readReject = undefined;

      resolve({
        done: true,
        value: undefined,
      });
    }

    this.emit(QueueEventType.QUEUE_EMPTY, { final: true });
    return success(undefined);
  }

  /**
   * Signal error condition
   */
  error(error: QiError): Result<void, QueueError> {
    this.state = {
      ...this.state,
      hasError: true,
      errorCount: this.state.errorCount + 1,
    };

    // Reject waiting reader
    if (this.readReject) {
      const reject = this.readReject;
      this.readResolve = undefined;
      this.readReject = undefined;
      reject(error);
    }

    this.emit(QueueEventType.QUEUE_ERROR, { error });
    return success(undefined);
  }

  /**
   * Get current queue state
   */
  getState(): Result<QueueState, QueueError> {
    return success({
      ...this.state,
      messageCount: this.queue.length,
    });
  }

  /**
   * Get queue statistics
   */
  getStats(): Result<MessageStats | null, QueueError> {
    if (!this.options.enableStats) {
      return success(null);
    }

    return success({
      ...this.stats,
      queueLength: this.queue.length,
    });
  }

  /**
   * Peek at next message without removing it
   */
  peek(): Result<T | null, QueueError> {
    if (this.queue.length === 0) {
      return success(null);
    }

    const nextMessage = this.findNextMessage();
    return success(nextMessage ? nextMessage.message : null);
  }

  /**
   * Get queue size
   */
  size(): Result<number, QueueError> {
    return success(this.queue.length);
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): Result<boolean, QueueError> {
    return success(this.queue.length === 0);
  }

  /**
   * Check if queue is full
   */
  isFull(): Result<boolean, QueueError> {
    if (this.options.maxSize === 0) {
      return success(false);
    }
    return success(this.queue.length >= this.options.maxSize);
  }

  /**
   * Clear all messages from queue
   */
  clear(): Result<number, QueueError> {
    const clearedCount = this.queue.length;
    this.queue = [];
    this.state = {
      ...this.state,
      messageCount: 0,
    };

    this.emit(QueueEventType.QUEUE_EMPTY, { cleared: true, count: clearedCount });
    return success(clearedCount);
  }

  /**
   * Pause message processing
   */
  pause(): Result<void, QueueError> {
    this.isPausedState = true;
    this.emit(QueueEventType.QUEUE_PAUSED, { timestamp: new Date() });
    return success(undefined);
  }

  /**
   * Resume message processing
   */
  resume(): Result<void, QueueError> {
    this.isPausedState = false;
    this.emit(QueueEventType.QUEUE_RESUMED, { timestamp: new Date() });
    return success(undefined);
  }

  /**
   * Check if queue is paused
   */
  isPaused(): Result<boolean, QueueError> {
    return success(this.isPausedState);
  }

  /**
   * Cleanup and destroy queue
   */
  async destroy(): Promise<Result<void, QueueError>> {
    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Reject any waiting readers
    if (this.readReject) {
      this.readReject(queueError('QUEUE_DESTROYED', 'Queue was destroyed'));
      this.readResolve = undefined;
      this.readReject = undefined;
    }

    // Clear queue
    this.queue = [];

    // Call cleanup function if provided
    if (this.options.cleanupFn) {
      try {
        await this.options.cleanupFn();
      } catch (error) {
        return failure(
          queueError('CLEANUP_FAILED', 'Cleanup function failed', {
            operation: 'destroy',
          })
        );
      }
    }

    // Clear subscriptions
    this.eventSubscriptions.clear();

    this.emit(QueueEventType.QUEUE_DESTROYED, { timestamp: new Date() });
    return success(undefined);
  }

  // Private helper methods

  private dequeueNextMessage(): Result<QueuedMessage<T> | null, QueueError> {
    if (this.queue.length === 0) {
      return success(null);
    }

    const message = this.queue.shift()!;

    // Check if message has expired
    if (message.expiresAt && new Date() > message.expiresAt) {
      this.updateStats(message.message, 'expired');
      return this.dequeueNextMessage(); // Try next message
    }

    return success(message);
  }

  private findNextMessage(): QueuedMessage<T> | null {
    if (this.queue.length === 0) {
      return null;
    }

    // Find first non-expired message
    for (const message of this.queue) {
      if (!message.expiresAt || new Date() <= message.expiresAt) {
        return message;
      }
    }

    return null;
  }

  private insertByPriority(queuedMessage: QueuedMessage<T>): void {
    const priority = queuedMessage.message.priority;

    // Find insertion point based on priority
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].message.priority > priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, queuedMessage);
  }

  private updateMessageStatus(queuedMessage: QueuedMessage<T>, status: MessageStatus): void {
    queuedMessage.status = status;

    if (status === MessageStatus.PROCESSING) {
      queuedMessage.processingStarted = new Date();
      this.state = {
        ...this.state,
        processingCount: this.state.processingCount + 1,
      };
    } else if (status === MessageStatus.COMPLETED || status === MessageStatus.FAILED) {
      queuedMessage.processingCompleted = new Date();
      this.state = {
        ...this.state,
        processingCount: Math.max(0, this.state.processingCount - 1),
      };
    }

    this.updateStats(queuedMessage.message, status);
  }

  private updateStats(message: T, event: string | MessageStatus): void {
    if (!this.options.enableStats) {
      return;
    }

    // Update counters
    if (event === 'enqueued') {
      this.stats.totalMessages++;
      this.stats.messagesByType[message.type] = (this.stats.messagesByType[message.type] || 0) + 1;
      this.stats.messagesByPriority[message.priority] =
        (this.stats.messagesByPriority[message.priority] || 0) + 1;
    }

    if (typeof event === 'string' && event in MessageStatus) {
      const status = event as MessageStatus;
      this.stats.messagesByStatus[status] = (this.stats.messagesByStatus[status] || 0) + 1;
    }

    // Calculate error rate
    const totalErrors = this.stats.messagesByStatus[MessageStatus.FAILED] || 0;
    this.stats.errorRate =
      this.stats.totalMessages > 0 ? totalErrors / this.stats.totalMessages : 0;
  }

  private setupAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredMessages();
    }, 60000); // Cleanup every minute
  }

  private cleanupExpiredMessages(): void {
    const now = new Date();
    const originalLength = this.queue.length;

    this.queue = this.queue.filter((queuedMessage) => {
      if (queuedMessage.expiresAt && now > queuedMessage.expiresAt) {
        this.updateStats(queuedMessage.message, 'expired');
        return false;
      }
      return true;
    });

    const removedCount = originalLength - this.queue.length;
    if (removedCount > 0) {
      this.state = {
        ...this.state,
        messageCount: this.queue.length,
      };
    }
  }

  private emit(eventType: QueueEventType, data: any): void {
    const subscribers = this.eventSubscriptions.get(eventType);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const event = {
      type: eventType,
      timestamp: new Date(),
      queue: this,
      data,
      message: data?.message,
      error: data?.error,
    };

    for (const callback of subscribers) {
      try {
        callback(event);
      } catch (error) {
        // Log but don't throw to prevent callback errors from affecting queue
        console.error('Queue event callback error:', error);
      }
    }
  }
}
