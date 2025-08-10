/**
 * QiCore-based Event Manager implementation
 *
 * Provides robust event handling with proper qicore Result<T> patterns
 * and functional composition for error handling.
 */

import { EventEmitter } from 'node:events';
import { create, Err, match, Ok, type QiError, type Result } from '@qi/base';
import type { IEventManager } from '../abstractions/ICLIServices.js';

/**
 * Event manager error types
 */
interface EventManagerError extends QiError {
  context: {
    event?: string;
    listenerCount?: number;
    operation?: string;
    error?: string;
  };
}

const eventError = (
  code: string,
  message: string,
  context: EventManagerError['context'] = {}
): EventManagerError => create(code, message, 'SYSTEM', context) as EventManagerError;

/**
 * QiCore implementation of event management
 * Uses EventEmitter internally but adds Result<T> error handling
 */
export class QiCoreEventManager implements IEventManager {
  private emitter: EventEmitter;
  private maxListeners: number;
  private eventHistory: Array<{ event: string; timestamp: Date; args: any[] }>;
  private isDestroyed = false;

  constructor(options: { maxListeners?: number; trackHistory?: boolean } = {}) {
    this.emitter = new EventEmitter();
    this.maxListeners = options.maxListeners || 100;
    this.eventHistory = [];

    // Configure EventEmitter
    this.emitter.setMaxListeners(this.maxListeners);

    // Track history if enabled
    if (options.trackHistory) {
      this.setupHistoryTracking();
    }

    // Setup error handling
    this.setupErrorHandling();
  }

  /**
   * Subscribe to an event
   */
  on(event: string, listener: (...args: any[]) => void): void {
    if (this.isDestroyed) {
      console.warn('EventManager: Attempted to add listener to destroyed manager');
      return;
    }

    match(
      () => {
        this.emitter.on(event, listener);
      },
      (error: any) => {
        console.error('EventManager: Failed to add listener:', error.message);
      },
      this.validateEvent(event)
    );
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, listener: (...args: any[]) => void): void {
    if (this.isDestroyed) {
      return;
    }

    match(
      () => {
        this.emitter.off(event, listener);
      },
      (error: any) => {
        console.error('EventManager: Failed to remove listener:', error.message);
      },
      this.validateEvent(event)
    );
  }

  /**
   * Emit an event with qicore error handling
   */
  emit(event: string, ...args: any[]): boolean {
    if (this.isDestroyed) {
      return false;
    }

    const emitResult = this.safeEmit(event, ...args);

    return match(
      (success) => success,
      (error) => {
        console.error('EventManager: Failed to emit event:', error.message);
        return false;
      },
      emitResult
    );
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, listener: (...args: any[]) => void): void {
    if (this.isDestroyed) {
      return;
    }

    match(
      () => {
        this.emitter.once(event, listener);
      },
      (error: any) => {
        console.error('EventManager: Failed to add once listener:', error.message);
      },
      this.validateEvent(event)
    );
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (this.isDestroyed) {
      return;
    }

    if (event) {
      match(
        () => {
          this.emitter.removeAllListeners(event);
        },
        (error: any) => {
          console.error('EventManager: Failed to remove all listeners:', error.message);
        },
        this.validateEvent(event)
      );
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get current event listeners
   */
  getListeners(event: string): Function[] {
    if (this.isDestroyed) {
      return [];
    }

    const listenersResult = this.getEventListeners(event);

    return match(
      (listeners) => listeners,
      (error) => {
        console.error('EventManager: Failed to get listeners:', error.message);
        return [];
      },
      listenersResult
    );
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    // Remove all listeners
    this.emitter.removeAllListeners();

    // Clear history
    this.eventHistory = [];

    // Mark as destroyed
    this.isDestroyed = true;

    // Emit final destroy event
    this.emitter.emit('destroyed');
  }

  /**
   * Get event emission statistics
   */
  getStats(): { totalEvents: number; uniqueEvents: number; listenerCount: number } {
    const uniqueEvents = new Set(this.eventHistory.map((entry) => entry.event));

    return {
      totalEvents: this.eventHistory.length,
      uniqueEvents: uniqueEvents.size,
      listenerCount: this.emitter
        .eventNames()
        .reduce((total, eventName) => total + this.emitter.listenerCount(eventName), 0),
    };
  }

  /**
   * Get recent event history
   */
  getRecentEvents(limit: number = 10): Array<{ event: string; timestamp: Date }> {
    return this.eventHistory.slice(-limit).map(({ event, timestamp }) => ({ event, timestamp }));
  }

  // Private methods with qicore patterns

  private validateEvent(event: string): Result<void, EventManagerError> {
    if (!event || typeof event !== 'string') {
      return Err(
        eventError('INVALID_EVENT', 'Event name must be a non-empty string', {
          event,
          operation: 'validate',
        })
      );
    }

    if (event.length > 100) {
      return Err(
        eventError('EVENT_NAME_TOO_LONG', 'Event name exceeds maximum length of 100 characters', {
          event,
          operation: 'validate',
        })
      );
    }

    return Ok(void 0);
  }

  private safeEmit(event: string, ...args: any[]): Result<boolean, EventManagerError> {
    const validateResult = this.validateEvent(event);

    return match(
      () => {
        try {
          const success = this.emitter.emit(event, ...args);

          // Track in history
          this.eventHistory.push({
            event,
            timestamp: new Date(),
            args: args.map((arg) => this.sanitizeArg(arg)),
          });

          return Ok(success);
        } catch (error) {
          return Err(
            eventError(
              'EMIT_FAILED',
              `Failed to emit event: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { event, operation: 'emit', error: String(error) }
            )
          );
        }
      },
      (error) => Err(error),
      validateResult
    );
  }

  private getEventListeners(event: string): Result<Function[], EventManagerError> {
    const validateResult = this.validateEvent(event);

    return match(
      () => {
        try {
          const listeners = this.emitter.listeners(event);
          return Ok(listeners);
        } catch (error) {
          return Err(
            eventError(
              'GET_LISTENERS_FAILED',
              `Failed to get listeners: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { event, operation: 'getListeners', error: String(error) }
            )
          );
        }
      },
      (error) => Err(error),
      validateResult
    );
  }

  private setupHistoryTracking(): void {
    // Limit history size to prevent memory issues
    const maxHistorySize = 1000;

    setInterval(() => {
      if (this.eventHistory.length > maxHistorySize) {
        this.eventHistory = this.eventHistory.slice(-maxHistorySize * 0.8);
      }
    }, 60000); // Check every minute
  }

  private setupErrorHandling(): void {
    this.emitter.on('error', (error) => {
      console.error('EventManager: Internal EventEmitter error:', error);
    });
  }

  private sanitizeArg(arg: any): any {
    // Sanitize arguments for history tracking
    if (arg === null || arg === undefined) {
      return arg;
    }

    if (typeof arg === 'function') {
      return '[Function]';
    }

    if (typeof arg === 'object') {
      try {
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return '[Object]';
      }
    }

    return arg;
  }
}
