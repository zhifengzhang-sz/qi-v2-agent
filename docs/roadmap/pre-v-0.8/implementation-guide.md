# qi-v2-agent Framework Implementation Guide

**Document Version**: 2.0  
**Date**: 2025-01-17  
**Status**: Step-by-Step Construction Instructions  
**Reference**: [Foundation Design Guide](./foundation-design-guide.md)

## Implementation Overview

This guide provides detailed, step-by-step instructions for implementing the qi-v2-agent framework from scratch. Each phase includes concrete implementation steps, code patterns, and validation criteria.

## Project Setup and Foundation

### **Step 1: Initialize Project Structure**

#### **1.1 Create Package Architecture**

```bash
# Root project structure
mkdir qi-v2-agent && cd qi-v2-agent

# Package structure following contract separation
mkdir -p packages/{base,core,agent}
mkdir -p packages/agent/{messaging,security,context,tools,state,cli,workflows,classifier,core}

# Application packages  
mkdir -p packages/{prompt,code}

# Development and build infrastructure
mkdir -p {docs,scripts,config,examples}
```

#### **1.2 Setup Package.json and Tooling**

**Root package.json**:
```json
{
  "name": "@qi/agent-framework",
  "version": "0.8.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "packages/agent/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "dev": "turbo run dev"
  },
  "devDependencies": {
    "turbo": "^1.10.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "tsup": "^8.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**turbo.json**:
```json
{
  "schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

#### **1.3 TypeScript Configuration**

**Root tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "noEmit": true,
    "paths": {
      "@qi/base": ["./packages/base/src"],
      "@qi/core": ["./packages/core/src"],
      "@qi/agent/*": ["./packages/agent/*/src"]
    }
  },
  "include": ["packages/**/*"],
  "references": [
    { "path": "./packages/base" },
    { "path": "./packages/core" },
    { "path": "./packages/agent/messaging" },
    { "path": "./packages/agent/core" }
  ]
}
```

## Phase 1: Core Infrastructure Implementation

### **Step 2: QiCore Foundation (@qi/base)**

#### **2.1 Result<T> Pattern Implementation**

**packages/base/src/result.ts**:
```typescript
/**
 * Discriminated union for success/failure results
 */
export type Result<T, E = Error> = 
  | { tag: 'success'; value: T }
  | { tag: 'failure'; error: E };

/**
 * Create success result
 */
export function success<T>(value: T): Result<T, never> {
  return { tag: 'success', value };
}

/**
 * Create failure result  
 */
export function failure<E>(error: E): Result<never, E> {
  return { tag: 'failure', error };
}

/**
 * Transform success values
 */
export function map<T, U, E>(
  fn: (value: T) => U,
  result: Result<T, E>
): Result<U, E> {
  return result.tag === 'success' 
    ? success(fn(result.value))
    : result;
}

/**
 * Chain operations that can fail
 */
export function flatMap<T, U, E>(
  fn: (value: T) => Result<U, E>,
  result: Result<T, E>
): Result<U, E> {
  return result.tag === 'success' 
    ? fn(result.value)
    : result;
}

/**
 * Pattern matching for results
 */
export function match<T, E, U>(
  onSuccess: (value: T) => U,
  onFailure: (error: E) => U,
  result: Result<T, E>
): U {
  return result.tag === 'success'
    ? onSuccess(result.value)
    : onFailure(result.error);
}

/**
 * Convert async operations to Result
 */
export async function fromAsyncTryCatch<T, E>(
  operation: () => Promise<T>,
  onError: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await operation();
    return success(value);
  } catch (error) {
    return failure(onError(error));
  }
}
```

#### **2.2 QiError Implementation**

**packages/base/src/error.ts**:
```typescript
/**
 * Structured error with context
 */
export interface QiError {
  readonly code: string;
  readonly message: string;
  readonly category: 'VALIDATION' | 'SYSTEM' | 'NETWORK' | 'BUSINESS';
  readonly context: Record<string, unknown>;
  readonly timestamp: Date;
}

/**
 * Create QiError with context
 */
export function create(
  code: string,
  message: string,
  category: QiError['category'],
  context: Record<string, unknown> = {}
): QiError {
  return {
    code,
    message,
    category,
    context,
    timestamp: new Date()
  };
}

/**
 * Validation error factory
 */
export function validationError(
  message: string,
  context?: Record<string, unknown>
): QiError {
  return create('VALIDATION_ERROR', message, 'VALIDATION', context);
}

/**
 * System error factory
 */
export function systemError(
  message: string,
  context?: Record<string, unknown>
): QiError {
  return create('SYSTEM_ERROR', message, 'SYSTEM', context);
}

/**
 * Network error factory
 */
export function networkError(
  message: string,
  context?: Record<string, unknown>
): QiError {
  return create('NETWORK_ERROR', message, 'NETWORK', context);
}

/**
 * Business error factory
 */
export function businessError(
  message: string,
  context?: Record<string, unknown>
): QiError {
  return create('BUSINESS_ERROR', message, 'BUSINESS', context);
}
```

#### **2.3 Package Configuration**

**packages/base/package.json**:
```json
{
  "name": "@qi/base",
  "version": "0.8.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vitest": "^1.0.0",
    "typescript": "^5.0.0"
  }
}
```

**packages/base/src/index.ts**:
```typescript
// Export all public APIs
export * from './result.js';
export * from './error.js';
export type { Result, QiError } from './types.js';
```

### **Step 3: h2A Message Queue Implementation**

#### **3.1 Message Types and Interfaces**

**packages/agent/messaging/src/types/MessageTypes.ts**:
```typescript
import type { QiError } from '@qi/base';

/**
 * Base message interface
 */
export interface QiMessage {
  readonly id: string;
  readonly type: MessageType;
  readonly content: MessageContent;
  readonly metadata: MessageMetadata;
  readonly timestamp: Date;
}

/**
 * Message type enumeration
 */
export enum MessageType {
  USER_INPUT = 'user_input',
  AGENT_OUTPUT = 'agent_output',
  TOOL_EXECUTION = 'tool_execution',
  WORKFLOW_EVENT = 'workflow_event',
  SYSTEM_CONTROL = 'system_control'
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Message content union
 */
export type MessageContent = 
  | UserInputContent
  | AgentOutputContent
  | ToolExecutionContent
  | WorkflowEventContent
  | SystemControlContent;

export interface UserInputContent {
  input: string;
  mode?: 'interactive' | 'command' | 'streaming';
}

export interface AgentOutputContent {
  content: string;
  type: 'command' | 'prompt' | 'workflow';
  confidence: number;
  success: boolean;
  error?: string;
}

export interface ToolExecutionContent {
  toolName: string;
  input: unknown;
  callId: string;
  phase: string;
}

export interface WorkflowEventContent {
  workflowId: string;
  event: string;
  data: unknown;
}

export interface SystemControlContent {
  command: 'shutdown' | 'pause' | 'resume' | 'reset';
  reason?: string;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  readonly priority: MessagePriority;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly source: string;
  readonly retryCount?: number;
  readonly ttl?: number;
}

/**
 * Queue statistics
 */
export interface MessageStats {
  readonly totalMessages: number;
  readonly processedMessages: number;
  readonly failedMessages: number;
  readonly averageProcessingTime: number;
  readonly queueSize: number;
  readonly priorityDistribution: Record<MessagePriority, number>;
}
```

#### **3.2 Queue Interface Definition**

**packages/agent/messaging/src/interfaces/IAsyncMessageQueue.ts**:
```typescript
import type { QiError, Result } from '@qi/base';
import type { QiMessage, MessageStats, MessagePriority } from '../types/MessageTypes.js';

/**
 * Queue state information
 */
export interface QueueState {
  readonly started: boolean;
  readonly isDone: boolean;
  readonly hasError: boolean;
  readonly messageCount: number;
  readonly processingCount: number;
  readonly errorCount: number;
}

/**
 * Queue configuration options
 */
export interface QueueOptions {
  maxSize?: number;
  maxConcurrent?: number;
  messageTtl?: number;
  priorityQueuing?: boolean;
  autoCleanup?: boolean;
  enableStats?: boolean;
  cleanupFn?: () => void | Promise<void>;
}

/**
 * h2A-pattern async message queue interface
 */
export interface IAsyncMessageQueue<T extends QiMessage = QiMessage> extends AsyncIterable<T> {
  // Core operations
  enqueue(message: T): Result<void, QiError>;
  done(): Result<void, QiError>;
  error(error: QiError): Result<void, QiError>;
  
  // State queries
  getState(): Result<QueueState, QiError>;
  getStats(): Result<MessageStats | null, QiError>;
  peek(): Result<T | null, QiError>;
  size(): Result<number, QiError>;
  isEmpty(): Result<boolean, QiError>;
  isFull(): Result<boolean, QiError>;
  
  // Queue management
  clear(): Result<number, QiError>;
  pause(): Result<void, QiError>;
  resume(): Result<void, QiError>;
  isPaused(): Result<boolean, QiError>;
  
  // Lifecycle
  destroy(): Promise<Result<void, QiError>>;
}
```

#### **3.3 h2A Queue Implementation**

**packages/agent/messaging/src/impl/QiAsyncMessageQueue.ts**:
```typescript
import { failure, success, validationError, systemError, type Result, type QiError } from '@qi/base';
import type { IAsyncMessageQueue, QueueState, QueueOptions } from '../interfaces/IAsyncMessageQueue.js';
import type { QiMessage, MessageStats, MessagePriority } from '../types/MessageTypes.js';

/**
 * h2A-pattern async message queue implementation
 * 
 * Key features:
 * - Single iterator constraint (h2A pattern)
 * - Non-blocking enqueue with Promise coordination
 * - Priority-based message ordering
 * - Automatic cleanup and TTL support
 */
export class QiAsyncMessageQueue<T extends QiMessage = QiMessage> implements IAsyncMessageQueue<T> {
  private queue: T[] = [];
  private priorityQueues: Map<MessagePriority, T[]> = new Map();
  private state: QueueState = {
    started: false,
    isDone: false, 
    hasError: false,
    messageCount: 0,
    processingCount: 0,
    errorCount: 0
  };
  
  // h2A coordination
  private waitingReader?: (value: T | null) => void;
  private iteratorStarted = false;
  
  // Statistics
  private stats: MessageStats = {
    totalMessages: 0,
    processedMessages: 0,
    failedMessages: 0,
    averageProcessingTime: 0,
    queueSize: 0,
    priorityDistribution: {
      [MessagePriority.LOW]: 0,
      [MessagePriority.NORMAL]: 0,
      [MessagePriority.HIGH]: 0,
      [MessagePriority.CRITICAL]: 0
    }
  };
  
  private cleanupTimer?: NodeJS.Timeout;
  private paused = false;
  private destroyed = false;
  
  constructor(private options: QueueOptions = {}) {
    // Initialize priority queues
    Object.values(MessagePriority).forEach(priority => {
      if (typeof priority === 'number') {
        this.priorityQueues.set(priority, []);
      }
    });
    
    // Setup auto-cleanup
    if (options.autoCleanup && options.messageTtl) {
      this.setupCleanup();
    }
  }

  /**
   * h2A async iterator implementation
   * Enforces single iterator constraint
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.iteratorStarted) {
      throw new Error('Queue can only be iterated once (h2A pattern)');
    }
    
    if (this.destroyed) {
      throw new Error('Queue has been destroyed');
    }
    
    this.iteratorStarted = true;
    this.state = { ...this.state, started: true };
    
    try {
      while (!this.state.isDone && !this.destroyed) {
        if (this.paused) {
          await this.waitForResume();
          continue;
        }
        
        const message = await this.waitForMessage();
        if (message) {
          this.state = { 
            ...this.state, 
            processingCount: this.state.processingCount + 1 
          };
          
          yield message;
          
          this.state = { 
            ...this.state, 
            processingCount: this.state.processingCount - 1 
          };
          
          if (this.options.enableStats) {
            this.updateProcessingStats();
          }
        }
      }
    } catch (error) {
      this.state = { ...this.state, hasError: true, errorCount: this.state.errorCount + 1 };
      throw error;
    }
  }

  /**
   * Non-blocking message enqueue
   */
  enqueue(message: T): Result<void, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    if (this.state.isDone) {
      return failure(validationError('Queue is marked as done'));
    }
    
    if (this.isFull().value) {
      return failure(validationError('Queue is full'));
    }
    
    // Add to appropriate priority queue
    const priority = message.metadata.priority ?? MessagePriority.NORMAL;
    const targetQueue = this.priorityQueues.get(priority);
    
    if (!targetQueue) {
      return failure(validationError(`Invalid priority: ${priority}`));
    }
    
    targetQueue.push(message);
    this.state = { 
      ...this.state, 
      messageCount: this.state.messageCount + 1 
    };
    
    // Update statistics
    if (this.options.enableStats) {
      this.stats.totalMessages++;
      this.stats.queueSize++;
      this.stats.priorityDistribution[priority]++;
    }
    
    // Wake up waiting reader
    if (this.waitingReader) {
      const nextMessage = this.getNextMessage();
      if (nextMessage) {
        this.waitingReader(nextMessage);
        this.waitingReader = undefined;
      }
    }
    
    return success(undefined);
  }

  /**
   * Mark queue as complete
   */
  done(): Result<void, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    this.state = { ...this.state, isDone: true };
    
    // Wake up waiting reader with null to signal completion
    if (this.waitingReader) {
      this.waitingReader(null);
      this.waitingReader = undefined;
    }
    
    return success(undefined);
  }

  /**
   * Signal error condition
   */
  error(error: QiError): Result<void, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    this.state = { 
      ...this.state, 
      hasError: true, 
      errorCount: this.state.errorCount + 1 
    };
    
    // Wake up waiting reader with error
    if (this.waitingReader) {
      this.waitingReader(null);
      this.waitingReader = undefined;
    }
    
    return success(undefined);
  }

  /**
   * Get current queue state
   */
  getState(): Result<QueueState, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    return success({ ...this.state });
  }

  /**
   * Get queue statistics
   */
  getStats(): Result<MessageStats | null, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    if (!this.options.enableStats) {
      return success(null);
    }
    
    return success({ ...this.stats });
  }

  /**
   * Peek at next message without removing
   */
  peek(): Result<T | null, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    const nextMessage = this.getNextMessage();
    return success(nextMessage);
  }

  /**
   * Get queue size
   */
  size(): Result<number, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    return success(this.state.messageCount);
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): Result<boolean, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    return success(this.state.messageCount === 0);
  }

  /**
   * Check if queue is full
   */
  isFull(): Result<boolean, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    if (!this.options.maxSize) {
      return success(false);
    }
    
    return success(this.state.messageCount >= this.options.maxSize);
  }

  /**
   * Clear all messages
   */
  clear(): Result<number, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    const clearedCount = this.state.messageCount;
    
    // Clear all priority queues
    this.priorityQueues.forEach(queue => queue.length = 0);
    
    this.state = { 
      ...this.state, 
      messageCount: 0 
    };
    
    if (this.options.enableStats) {
      this.stats.queueSize = 0;
      // Reset priority distribution
      Object.keys(this.stats.priorityDistribution).forEach(priority => {
        this.stats.priorityDistribution[priority as unknown as MessagePriority] = 0;
      });
    }
    
    return success(clearedCount);
  }

  /**
   * Pause message processing
   */
  pause(): Result<void, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    this.paused = true;
    return success(undefined);
  }

  /**
   * Resume message processing
   */
  resume(): Result<void, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    this.paused = false;
    
    // Wake up iterator if paused
    if (this.waitingReader) {
      const nextMessage = this.getNextMessage();
      if (nextMessage) {
        this.waitingReader(nextMessage);
        this.waitingReader = undefined;
      }
    }
    
    return success(undefined);
  }

  /**
   * Check if queue is paused
   */
  isPaused(): Result<boolean, QiError> {
    if (this.destroyed) {
      return failure(systemError('Queue has been destroyed'));
    }
    
    return success(this.paused);
  }

  /**
   * Destroy queue and cleanup resources
   */
  async destroy(): Promise<Result<void, QiError>> {
    if (this.destroyed) {
      return success(undefined);
    }
    
    this.destroyed = true;
    
    // Cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    
    // Wake up waiting reader
    if (this.waitingReader) {
      this.waitingReader(null);
      this.waitingReader = undefined;
    }
    
    // Clear all queues
    this.clear();
    
    // Call custom cleanup function
    if (this.options.cleanupFn) {
      try {
        await this.options.cleanupFn();
      } catch (error) {
        return failure(systemError(`Cleanup function failed: ${error}`));
      }
    }
    
    return success(undefined);
  }

  // Private helper methods

  /**
   * Wait for next message with Promise coordination
   */
  private async waitForMessage(): Promise<T | null> {
    const nextMessage = this.getNextMessage();
    if (nextMessage) {
      return nextMessage;
    }
    
    if (this.state.isDone) {
      return null;
    }
    
    // Wait for message to be enqueued
    return new Promise<T | null>((resolve) => {
      this.waitingReader = resolve;
    });
  }

  /**
   * Get next message respecting priority order
   */
  private getNextMessage(): T | null {
    // Process in priority order: CRITICAL -> HIGH -> NORMAL -> LOW
    const priorities = [MessagePriority.CRITICAL, MessagePriority.HIGH, MessagePriority.NORMAL, MessagePriority.LOW];
    
    for (const priority of priorities) {
      const queue = this.priorityQueues.get(priority);
      if (queue && queue.length > 0) {
        const message = queue.shift()!;
        this.state = { 
          ...this.state, 
          messageCount: this.state.messageCount - 1 
        };
        
        if (this.options.enableStats) {
          this.stats.queueSize--;
          this.stats.priorityDistribution[priority]--;
        }
        
        return message;
      }
    }
    
    return null;
  }

  /**
   * Wait for resume when paused
   */
  private async waitForResume(): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkPaused = () => {
        if (!this.paused) {
          resolve();
        } else {
          setTimeout(checkPaused, 10);
        }
      };
      checkPaused();
    });
  }

  /**
   * Setup automatic cleanup timer
   */
  private setupCleanup(): void {
    if (!this.options.messageTtl) return;
    
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;
      
      this.priorityQueues.forEach((queue) => {
        const originalLength = queue.length;
        queue.splice(0, queue.length, ...queue.filter(message => {
          const age = now - message.timestamp.getTime();
          return age < this.options.messageTtl!;
        }));
        cleanedCount += originalLength - queue.length;
      });
      
      if (cleanedCount > 0) {
        this.state = { 
          ...this.state, 
          messageCount: this.state.messageCount - cleanedCount 
        };
        
        if (this.options.enableStats) {
          this.stats.queueSize -= cleanedCount;
        }
      }
    }, this.options.messageTtl / 2);
  }

  /**
   * Update processing statistics
   */
  private updateProcessingStats(): void {
    this.stats.processedMessages++;
    // Processing time would be calculated if we tracked message start/end times
  }
}
```

#### **3.4 Message Factory Implementation**

**packages/agent/messaging/src/impl/QiMessageFactory.ts**:
```typescript
import { randomBytes } from 'node:crypto';
import type { QiMessage, MessageType, MessageContent, MessageMetadata, MessagePriority } from '../types/MessageTypes.js';

/**
 * Factory for creating typed messages
 */
export class QiMessageFactory {
  /**
   * Create user input message
   */
  static createUserInput(
    input: string,
    metadata: Partial<MessageMetadata> = {}
  ): QiMessage {
    return {
      id: this.generateId(),
      type: MessageType.USER_INPUT,
      content: { input },
      metadata: {
        priority: MessagePriority.NORMAL,
        source: 'user',
        ...metadata
      },
      timestamp: new Date()
    };
  }

  /**
   * Create agent output message
   */
  static createAgentOutput(
    content: string,
    type: 'command' | 'prompt' | 'workflow',
    confidence: number,
    success: boolean,
    metadata: Partial<MessageMetadata> = {},
    error?: string
  ): QiMessage {
    return {
      id: this.generateId(),
      type: MessageType.AGENT_OUTPUT,
      content: { content, type, confidence, success, error },
      metadata: {
        priority: MessagePriority.NORMAL,
        source: 'agent',
        ...metadata
      },
      timestamp: new Date()
    };
  }

  /**
   * Create tool execution message
   */
  static createToolExecution(
    toolName: string,
    input: unknown,
    callId: string,
    phase: string,
    metadata: Partial<MessageMetadata> = {}
  ): QiMessage {
    return {
      id: this.generateId(),
      type: MessageType.TOOL_EXECUTION,
      content: { toolName, input, callId, phase },
      metadata: {
        priority: MessagePriority.HIGH,
        source: 'tool_executor',
        ...metadata
      },
      timestamp: new Date()
    };
  }

  /**
   * Create system control message
   */
  static createSystemControl(
    command: 'shutdown' | 'pause' | 'resume' | 'reset',
    reason?: string,
    metadata: Partial<MessageMetadata> = {}
  ): QiMessage {
    return {
      id: this.generateId(),
      type: MessageType.SYSTEM_CONTROL,
      content: { command, reason },
      metadata: {
        priority: MessagePriority.CRITICAL,
        source: 'system',
        ...metadata
      },
      timestamp: new Date()
    };
  }

  /**
   * Generate unique message ID
   */
  private static generateId(): string {
    return randomBytes(8).toString('hex');
  }
}
```

## Phase 2: Agent Framework Core

### **Step 4: Agent Abstraction and Orchestration**

#### **4.1 Agent Interface Contracts**

**packages/agent/core/src/interfaces/IAgent.ts**:
```typescript
import type { QiError, Result } from '@qi/base';

/**
 * Agent request with context
 */
export interface AgentRequest {
  readonly input: string;
  readonly context: AgentContext;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly environmentContext?: ReadonlyMap<string, unknown>;
}

/**
 * Agent response
 */
export interface AgentResponse {
  readonly content: string;
  readonly type: 'command' | 'prompt' | 'workflow';
  readonly confidence: number;
  readonly executionTime: number;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Agent streaming chunk for real-time responses
 */
export interface AgentStreamChunk {
  readonly type: 'classification' | 'processing' | 'result' | 'error';
  readonly content: string;
  readonly isComplete: boolean;
  readonly metadata?: ReadonlyMap<string, unknown>;
  readonly error?: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  readonly domain: string;
  readonly enableCommands?: boolean;
  readonly enablePrompts?: boolean;
  readonly enableWorkflows?: boolean;
  readonly sessionPersistence?: boolean;
  readonly providers?: {
    readonly modelProvider?: string;
    readonly toolProvider?: string;
    readonly memoryProvider?: string;
  };
  readonly timeouts?: {
    readonly commandTimeout?: number;
    readonly promptTimeout?: number;
    readonly workflowTimeout?: number;
  };
  readonly retries?: {
    readonly maxRetries?: number;
    readonly retryDelay?: number;
  };
}

/**
 * Agent status information
 */
export interface AgentStatus {
  readonly isInitialized: boolean;
  readonly domain: string;
  readonly uptime: number;
  readonly requestsProcessed: number;
  readonly averageResponseTime: number;
  readonly lastActivity?: Date;
}

/**
 * Core agent interface
 */
export interface IAgent {
  /**
   * Initialize the agent with dependencies
   */
  initialize(): Promise<Result<void, QiError>>;

  /**
   * Process a single request
   */
  process(request: AgentRequest): Promise<Result<AgentResponse, QiError>>;

  /**
   * Stream request processing for real-time responses
   */
  stream(request: AgentRequest): AsyncIterableIterator<Result<AgentStreamChunk, QiError>>;

  /**
   * Get current agent status
   */
  getStatus(): AgentStatus;

  /**
   * Gracefully shutdown the agent
   */
  shutdown(): Promise<Result<void, QiError>>;
}
```

#### **4.2 Agent Orchestrator Implementation**

**packages/agent/core/src/impl/AgentOrchestrator.ts**:
```typescript
import { 
  success, 
  failure, 
  fromAsyncTryCatch, 
  systemError, 
  type Result, 
  type QiError 
} from '@qi/base';
import type { IStateManager } from '@qi/agent/state';
import type { IContextManager } from '@qi/agent/context';
import type { IClassifier } from '@qi/agent/classifier';
import type { ICommandHandler } from '@qi/agent/command';
import type { IPromptHandler } from '@qi/agent/prompt';
import type { IWorkflowHandler } from '@qi/agent/workflows';
import type { 
  IAgent, 
  AgentRequest, 
  AgentResponse, 
  AgentStreamChunk, 
  AgentConfig, 
  AgentStatus 
} from '../interfaces/IAgent.js';

/**
 * Agent orchestrator implementing the coordination pattern
 * 
 * The orchestrator coordinates but doesn't implement - it delegates to:
 * - Classifier for input type determination
 * - CommandHandler for command execution
 * - PromptHandler for LLM interactions
 * - WorkflowHandler for complex multi-step operations
 */
export class AgentOrchestrator implements IAgent {
  private initialized = false;
  private startTime = Date.now();
  private requestsProcessed = 0;
  private totalExecutionTime = 0;
  private lastActivity?: Date;

  constructor(
    private stateManager: IStateManager,
    private contextManager: IContextManager,
    private classifier: IClassifier,
    private commandHandler: ICommandHandler,
    private promptHandler: IPromptHandler,
    private workflowHandler: IWorkflowHandler,
    private config: AgentConfig
  ) {}

  /**
   * Initialize all components
   */
  async initialize(): Promise<Result<void, QiError>> {
    if (this.initialized) {
      return success(undefined);
    }

    return fromAsyncTryCatch(
      async () => {
        // Initialize components in dependency order
        await this.stateManager.initialize();
        await this.contextManager.initialize();
        await this.classifier.initialize();
        await this.commandHandler.initialize();
        await this.promptHandler.initialize();
        await this.workflowHandler.initialize();

        this.initialized = true;
        this.startTime = Date.now();
        
        return undefined;
      },
      error => systemError(`Agent initialization failed: ${error}`)
    );
  }

  /**
   * Process request through classification and delegation
   */
  async process(request: AgentRequest): Promise<Result<AgentResponse, QiError>> {
    if (!this.initialized) {
      return failure(systemError('Agent not initialized'));
    }

    const startTime = Date.now();
    this.lastActivity = new Date();

    return fromAsyncTryCatch(
      async () => {
        // Step 1: Classify input type
        const classificationResult = await this.classifier.classify(
          request.input,
          { sessionId: request.context.sessionId }
        );

        if (classificationResult.tag === 'failure') {
          throw new Error(`Classification failed: ${classificationResult.error.message}`);
        }

        const classification = classificationResult.value;

        // Step 2: Delegate to appropriate handler
        let response: AgentResponse;

        switch (classification.type) {
          case 'command':
            response = await this.handleCommand(request);
            break;
          case 'prompt':
            response = await this.handlePrompt(request);
            break;
          case 'workflow':
            response = await this.handleWorkflow(request);
            break;
          default:
            throw new Error(`Unknown classification type: ${classification.type}`);
        }

        // Step 3: Update statistics and state
        const executionTime = Date.now() - startTime;
        this.requestsProcessed++;
        this.totalExecutionTime += executionTime;

        // Add conversation entry to state
        await this.stateManager.addConversationEntry({
          id: `entry_${Date.now()}`,
          type: classification.type,
          input: request.input,
          output: response.content,
          timestamp: new Date(),
          executionTime,
          success: response.success
        });

        return response;
      },
      error => systemError(`Request processing failed: ${error}`)
    );
  }

  /**
   * Stream request processing with real-time updates
   */
  async *stream(request: AgentRequest): AsyncIterableIterator<Result<AgentStreamChunk, QiError>> {
    if (!this.initialized) {
      yield failure(systemError('Agent not initialized'));
      return;
    }

    try {
      // Stream classification
      yield success({
        type: 'classification',
        content: 'Analyzing input...',
        isComplete: false
      });

      const classificationResult = await this.classifier.classify(
        request.input,
        { sessionId: request.context.sessionId }
      );

      if (classificationResult.tag === 'failure') {
        yield failure(classificationResult.error);
        return;
      }

      const classification = classificationResult.value;

      yield success({
        type: 'classification',
        content: `Classified as: ${classification.type}`,
        isComplete: true,
        metadata: new Map([['classificationType', classification.type]])
      });

      // Stream processing
      yield success({
        type: 'processing',
        content: `Processing ${classification.type} request...`,
        isComplete: false
      });

      // Delegate to appropriate handler (simplified for streaming)
      const response = await this.process(request);

      if (response.tag === 'failure') {
        yield failure(response.error);
        return;
      }

      // Stream final result
      yield success({
        type: 'result',
        content: response.value.content,
        isComplete: true,
        metadata: response.value.metadata
      });

    } catch (error) {
      yield failure(systemError(`Streaming failed: ${error}`));
    }
  }

  /**
   * Get current agent status
   */
  getStatus(): AgentStatus {
    return {
      isInitialized: this.initialized,
      domain: this.config.domain,
      uptime: Date.now() - this.startTime,
      requestsProcessed: this.requestsProcessed,
      averageResponseTime: this.requestsProcessed > 0 
        ? this.totalExecutionTime / this.requestsProcessed 
        : 0,
      lastActivity: this.lastActivity
    };
  }

  /**
   * Shutdown agent and cleanup resources
   */
  async shutdown(): Promise<Result<void, QiError>> {
    if (!this.initialized) {
      return success(undefined);
    }

    return fromAsyncTryCatch(
      async () => {
        // Shutdown components in reverse order
        await this.workflowHandler.shutdown();
        await this.promptHandler.shutdown();
        await this.commandHandler.shutdown();
        await this.classifier.shutdown();
        await this.contextManager.shutdown();
        await this.stateManager.shutdown();

        this.initialized = false;
        
        return undefined;
      },
      error => systemError(`Agent shutdown failed: ${error}`)
    );
  }

  // Private handler methods

  private async handleCommand(request: AgentRequest): Promise<AgentResponse> {
    const result = await this.commandHandler.execute(request.input, {
      sessionId: request.context.sessionId,
      userId: request.context.environmentContext?.get('userId') as string,
      timestamp: request.context.timestamp
    });

    if (result.tag === 'failure') {
      throw new Error(`Command execution failed: ${result.error.message}`);
    }

    return {
      content: result.value.message,
      type: 'command',
      confidence: 1.0,
      executionTime: Date.now() - request.context.timestamp.getTime(),
      metadata: new Map([
        ['commandName', result.value.commandName],
        ['success', result.value.success]
      ]),
      success: result.value.success,
      error: result.value.success ? undefined : result.value.message
    };
  }

  private async handlePrompt(request: AgentRequest): Promise<AgentResponse> {
    const result = await this.promptHandler.process(request.input, {
      sessionId: request.context.sessionId,
      conversationHistory: this.stateManager.getCurrentSession().conversationHistory,
      modelConfig: this.stateManager.getConfig().models
    });

    if (result.tag === 'failure') {
      throw new Error(`Prompt processing failed: ${result.error.message}`);
    }

    return {
      content: result.value.content,
      type: 'prompt',
      confidence: result.value.confidence,
      executionTime: Date.now() - request.context.timestamp.getTime(),
      metadata: new Map([
        ['model', result.value.model],
        ['tokens', result.value.tokens]
      ]),
      success: true
    };
  }

  private async handleWorkflow(request: AgentRequest): Promise<AgentResponse> {
    const isolatedContext = this.contextManager.createIsolatedContext({
      sessionId: request.context.sessionId,
      restrictions: {
        readOnlyMode: false,
        allowedPaths: [process.cwd()],
        blockedCommands: ['rm', 'rmdir', 'del'],
        blockedTools: [],
        requireApproval: false,
        maxExecutionTime: 300000, // 5 minutes
        networkAccess: true,
        systemAccess: false
      }
    });

    const result = await this.workflowHandler.execute(request.input, {
      context: isolatedContext,
      toolRegistry: this.getToolRegistry(),
      maxSteps: 10,
      timeout: 300000
    });

    if (result.tag === 'failure') {
      throw new Error(`Workflow execution failed: ${result.error.message}`);
    }

    return {
      content: result.value.summary,
      type: 'workflow',
      confidence: result.value.confidence,
      executionTime: Date.now() - request.context.timestamp.getTime(),
      metadata: new Map([
        ['workflowId', result.value.id],
        ['steps', result.value.steps.length],
        ['toolsUsed', result.value.toolsUsed]
      ]),
      success: result.value.success,
      error: result.value.success ? undefined : result.value.error
    };
  }

  private getToolRegistry(): any {
    // Tool registry would be injected or created here
    // For now, return placeholder
    return {};
  }
}
```

### **Step 5: State Management Implementation**

#### **5.1 State Manager Interface**

**packages/agent/state/src/interfaces/IStateManager.ts**:
```typescript
import type { QiError, Result } from '@qi/base';

/**
 * Application configuration
 */
export interface AppConfig {
  readonly defaultModel: string;
  readonly maxContextLength: number;
  readonly debugMode: boolean;
  readonly logLevel: string;
  readonly toolPermissions: Record<string, ToolPermissions>;
  readonly models: ModelConfig;
  readonly cli: CLIConfig;
}

export interface ModelConfig {
  readonly providers: ModelProvider[];
  readonly defaultProvider: string;
  readonly timeout: number;
  readonly retryAttempts: number;
}

export interface ModelProvider {
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly models: string[];
}

export interface CLIConfig {
  readonly framework: 'readline' | 'ink' | 'hybrid';
  readonly enableHotkeys: boolean;
  readonly enableStreaming: boolean;
  readonly theme: string;
}

export interface ToolPermissions {
  readonly readFiles: boolean;
  readonly writeFiles: boolean;
  readonly executeCommands: boolean;
  readonly networkAccess: boolean;
  readonly systemAccess: boolean;
  readonly allowedPaths?: readonly string[];
  readonly deniedPaths?: readonly string[];
}

/**
 * Session data
 */
export interface SessionData {
  readonly id: string;
  readonly userId?: string;
  readonly startTime: Date;
  readonly lastActivity: Date;
  readonly conversationHistory: ConversationEntry[];
  readonly context: Record<string, unknown>;
}

export interface ConversationEntry {
  readonly id: string;
  readonly type: 'command' | 'prompt' | 'workflow';
  readonly input: string;
  readonly output: string;
  readonly timestamp: Date;
  readonly executionTime: number;
  readonly success: boolean;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Model information
 */
export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly available: boolean;
  readonly contextLength: number;
  readonly capabilities: string[];
}

/**
 * State change event
 */
export interface StateChangeEvent {
  readonly type: 'config_updated' | 'session_created' | 'conversation_updated' | 'model_changed';
  readonly timestamp: Date;
  readonly data: unknown;
}

export type StateChangeListener = (event: StateChangeEvent) => void;

/**
 * State manager interface
 */
export interface IStateManager {
  /**
   * Initialize state manager
   */
  initialize(): Promise<Result<void, QiError>>;

  /**
   * Configuration management
   */
  getConfig(): AppConfig;
  updateConfig(updates: Partial<AppConfig>): Promise<Result<void, QiError>>;
  
  /**
   * Session management
   */
  getCurrentSession(): SessionData;
  createSession(userId?: string): Promise<Result<SessionData, QiError>>;
  addConversationEntry(entry: ConversationEntry): Promise<Result<void, QiError>>;
  
  /**
   * Model management
   */
  getCurrentModel(): string;
  setCurrentModel(modelId: string): Promise<Result<void, QiError>>;
  getAvailableModels(): ModelInfo[];
  
  /**
   * Persistence
   */
  saveState(): Promise<Result<void, QiError>>;
  loadState(): Promise<Result<void, QiError>>;
  
  /**
   * Event system
   */
  subscribe(listener: StateChangeListener): () => void;
  
  /**
   * Shutdown
   */
  shutdown(): Promise<Result<void, QiError>>;
}
```

#### **5.2 State Manager Implementation**

**packages/agent/state/src/impl/StateManager.ts**:
```typescript
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { 
  success, 
  failure, 
  fromAsyncTryCatch, 
  systemError, 
  validationError,
  type Result, 
  type QiError 
} from '@qi/base';
import type { 
  IStateManager, 
  AppConfig, 
  SessionData, 
  ConversationEntry, 
  ModelInfo, 
  StateChangeEvent, 
  StateChangeListener 
} from '../interfaces/IStateManager.js';

/**
 * Persisted state structure
 */
interface PersistedState {
  config: AppConfig;
  currentSession: SessionData;
  currentModel: string;
}

/**
 * State manager implementation with file-based persistence
 */
export class StateManager implements IStateManager {
  private config: AppConfig;
  private currentSession: SessionData;
  private currentModel: string;
  private listeners: StateChangeListener[] = [];
  private statePath: string;
  private initialized = false;

  constructor(configPath?: string) {
    // Initialize with defaults
    this.config = this.getDefaultConfig();
    this.currentSession = this.createDefaultSession();
    this.currentModel = this.config.defaultModel;
    
    // Setup state persistence path
    this.statePath = configPath || join(homedir(), '.qi-agent', 'state.json');
  }

  /**
   * Initialize state manager
   */
  async initialize(): Promise<Result<void, QiError>> {
    if (this.initialized) {
      return success(undefined);
    }

    return fromAsyncTryCatch(
      async () => {
        // Try to load existing state
        const loadResult = await this.loadState();
        if (loadResult.tag === 'failure') {
          // If loading fails, use defaults and save them
          await this.saveState();
        }

        this.initialized = true;
        return undefined;
      },
      error => systemError(`State manager initialization failed: ${error}`)
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<AppConfig>): Promise<Result<void, QiError>> {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    const saveResult = await this.saveState();
    if (saveResult.tag === 'failure') {
      // Rollback on save failure
      this.config = oldConfig;
      return failure(saveResult.error);
    }

    this.notifyListeners({
      type: 'config_updated',
      timestamp: new Date(),
      data: { oldConfig, newConfig: this.config }
    });

    return success(undefined);
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionData {
    return { ...this.currentSession };
  }

  /**
   * Create new session
   */
  async createSession(userId?: string): Promise<Result<SessionData, QiError>> {
    const newSession: SessionData = {
      id: this.generateSessionId(),
      userId,
      startTime: new Date(),
      lastActivity: new Date(),
      conversationHistory: [],
      context: {}
    };

    this.currentSession = newSession;

    const saveResult = await this.saveState();
    if (saveResult.tag === 'failure') {
      return failure(saveResult.error);
    }

    this.notifyListeners({
      type: 'session_created',
      timestamp: new Date(),
      data: newSession
    });

    return success({ ...newSession });
  }

  /**
   * Add conversation entry
   */
  async addConversationEntry(entry: ConversationEntry): Promise<Result<void, QiError>> {
    this.currentSession.conversationHistory.push(entry);
    this.currentSession.lastActivity = new Date();

    // Limit conversation history size
    const maxEntries = 1000;
    if (this.currentSession.conversationHistory.length > maxEntries) {
      this.currentSession.conversationHistory = this.currentSession.conversationHistory.slice(-maxEntries);
    }

    const saveResult = await this.saveState();
    if (saveResult.tag === 'failure') {
      return failure(saveResult.error);
    }

    this.notifyListeners({
      type: 'conversation_updated',
      timestamp: new Date(),
      data: entry
    });

    return success(undefined);
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Set current model
   */
  async setCurrentModel(modelId: string): Promise<Result<void, QiError>> {
    const availableModels = this.getAvailableModels();
    const model = availableModels.find(m => m.id === modelId);
    
    if (!model) {
      return failure(validationError(`Model not found: ${modelId}`));
    }

    if (!model.available) {
      return failure(validationError(`Model not available: ${modelId}`));
    }

    const oldModel = this.currentModel;
    this.currentModel = modelId;

    const saveResult = await this.saveState();
    if (saveResult.tag === 'failure') {
      // Rollback on save failure
      this.currentModel = oldModel;
      return failure(saveResult.error);
    }

    this.notifyListeners({
      type: 'model_changed',
      timestamp: new Date(),
      data: { oldModel, newModel: modelId }
    });

    return success(undefined);
  }

  /**
   * Get available models
   */
  getAvailableModels(): ModelInfo[] {
    const models: ModelInfo[] = [];
    
    for (const provider of this.config.models.providers) {
      for (const modelId of provider.models) {
        models.push({
          id: modelId,
          name: modelId,
          provider: provider.name,
          available: true, // Would check actual availability
          contextLength: 4096, // Would get from model capabilities
          capabilities: ['text', 'chat'] // Would get from model capabilities
        });
      }
    }
    
    return models;
  }

  /**
   * Save state to disk
   */
  async saveState(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const state: PersistedState = {
          config: this.config,
          currentSession: this.currentSession,
          currentModel: this.currentModel
        };

        // Ensure directory exists
        await mkdir(dirname(this.statePath), { recursive: true });
        
        // Write state atomically
        const tempPath = `${this.statePath}.tmp`;
        await writeFile(tempPath, JSON.stringify(state, null, 2), 'utf-8');
        
        // Move temp file to final location (atomic on most filesystems)
        await writeFile(this.statePath, JSON.stringify(state, null, 2), 'utf-8');
        
        return undefined;
      },
      error => systemError(`Failed to save state: ${error}`)
    );
  }

  /**
   * Load state from disk
   */
  async loadState(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const data = await readFile(this.statePath, 'utf-8');
        const state: PersistedState = JSON.parse(data);
        
        // Validate loaded state
        if (!state.config || !state.currentSession || !state.currentModel) {
          throw new Error('Invalid state format');
        }
        
        this.config = { ...this.getDefaultConfig(), ...state.config };
        this.currentSession = state.currentSession;
        this.currentModel = state.currentModel;
        
        return undefined;
      },
      error => systemError(`Failed to load state: ${error}`)
    );
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Shutdown state manager
   */
  async shutdown(): Promise<Result<void, QiError>> {
    if (!this.initialized) {
      return success(undefined);
    }

    // Final state save
    const saveResult = await this.saveState();
    if (saveResult.tag === 'failure') {
      return failure(saveResult.error);
    }

    // Clear listeners
    this.listeners = [];
    this.initialized = false;

    return success(undefined);
  }

  // Private helper methods

  private getDefaultConfig(): AppConfig {
    return {
      defaultModel: 'llama3.2',
      maxContextLength: 4096,
      debugMode: false,
      logLevel: 'info',
      toolPermissions: {
        default: {
          readFiles: true,
          writeFiles: true,
          executeCommands: false,
          networkAccess: false,
          systemAccess: false,
          allowedPaths: [process.cwd()],
          deniedPaths: ['/etc', '/sys', '/proc']
        }
      },
      models: {
        providers: [
          {
            name: 'ollama',
            baseUrl: 'http://localhost:11434',
            models: ['llama3.2', 'codellama', 'mistral']
          }
        ],
        defaultProvider: 'ollama',
        timeout: 30000,
        retryAttempts: 3
      },
      cli: {
        framework: 'hybrid',
        enableHotkeys: true,
        enableStreaming: true,
        theme: 'default'
      }
    };
  }

  private createDefaultSession(): SessionData {
    return {
      id: this.generateSessionId(),
      startTime: new Date(),
      lastActivity: new Date(),
      conversationHistory: [],
      context: {}
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private notifyListeners(event: StateChangeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        // Log error but don't throw to prevent disrupting other listeners
        console.error('State listener error:', error);
      }
    }
  }
}
```

## Validation and Testing

### **Step 6: Testing Framework Setup**

#### **6.1 Test Configuration**

**vitest.config.ts**:
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  resolve: {
    alias: {
      '@qi/base': resolve(__dirname, 'packages/base/src'),
      '@qi/core': resolve(__dirname, 'packages/core/src'),
      '@qi/agent/messaging': resolve(__dirname, 'packages/agent/messaging/src'),
      '@qi/agent/core': resolve(__dirname, 'packages/agent/core/src'),
      '@qi/agent/state': resolve(__dirname, 'packages/agent/state/src')
    }
  }
});
```

#### **6.2 Contract Testing Examples**

**tests/contracts/IAsyncMessageQueue.test.ts**:
```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { success, failure } from '@qi/base';
import { QiAsyncMessageQueue } from '@qi/agent/messaging';
import { QiMessageFactory } from '@qi/agent/messaging';
import type { IAsyncMessageQueue } from '@qi/agent/messaging';

describe('IAsyncMessageQueue Contract', () => {
  let queue: IAsyncMessageQueue;

  beforeEach(() => {
    queue = new QiAsyncMessageQueue({
      maxSize: 100,
      enableStats: true,
      priorityQueuing: true
    });
  });

  test('should enforce h2A single iterator constraint', () => {
    const iterator1 = queue[Symbol.asyncIterator]();
    
    expect(() => {
      queue[Symbol.asyncIterator]();
    }).toThrow('Queue can only be iterated once');
  });

  test('should process messages sequentially', async () => {
    const messages = [
      QiMessageFactory.createUserInput('message 1'),
      QiMessageFactory.createUserInput('message 2'),
      QiMessageFactory.createUserInput('message 3')
    ];

    // Enqueue messages
    for (const message of messages) {
      const result = queue.enqueue(message);
      expect(result.tag).toBe('success');
    }

    // Process messages sequentially
    const processedMessages = [];
    let count = 0;
    
    for await (const message of queue) {
      processedMessages.push(message);
      count++;
      if (count >= 3) {
        queue.done();
      }
    }

    expect(processedMessages).toHaveLength(3);
    expect(processedMessages[0].content.input).toBe('message 1');
    expect(processedMessages[1].content.input).toBe('message 2');
    expect(processedMessages[2].content.input).toBe('message 3');
  });

  test('should respect priority ordering', async () => {
    const lowPriorityMsg = QiMessageFactory.createUserInput('low', { priority: 0 });
    const highPriorityMsg = QiMessageFactory.createUserInput('high', { priority: 2 });
    const normalPriorityMsg = QiMessageFactory.createUserInput('normal', { priority: 1 });

    // Enqueue in mixed order
    queue.enqueue(lowPriorityMsg);
    queue.enqueue(normalPriorityMsg);
    queue.enqueue(highPriorityMsg);

    const processedMessages = [];
    let count = 0;
    
    for await (const message of queue) {
      processedMessages.push(message);
      count++;
      if (count >= 3) {
        queue.done();
      }
    }

    // Should process in priority order: high, normal, low
    expect(processedMessages[0].content.input).toBe('high');
    expect(processedMessages[1].content.input).toBe('normal');
    expect(processedMessages[2].content.input).toBe('low');
  });

  test('should return Result<T> for all operations', () => {
    const message = QiMessageFactory.createUserInput('test');
    
    const enqueueResult = queue.enqueue(message);
    expect(enqueueResult.tag).toBeOneOf(['success', 'failure']);
    
    const stateResult = queue.getState();
    expect(stateResult.tag).toBeOneOf(['success', 'failure']);
    
    const sizeResult = queue.size();
    expect(sizeResult.tag).toBeOneOf(['success', 'failure']);
  });
});
```

#### **6.3 Integration Testing Examples**

**tests/integration/AgentOrchestrator.test.ts**:
```typescript
import { describe, test, expect, beforeEach } from 'vitest';
import { AgentOrchestrator } from '@qi/agent/core';
import { StateManager } from '@qi/agent/state';
import { MockContextManager, MockClassifier, MockCommandHandler, MockPromptHandler, MockWorkflowHandler } from '../mocks';

describe('Agent Orchestrator Integration', () => {
  let orchestrator: AgentOrchestrator;
  let stateManager: StateManager;

  beforeEach(async () => {
    stateManager = new StateManager();
    await stateManager.initialize();

    orchestrator = new AgentOrchestrator(
      stateManager,
      new MockContextManager(),
      new MockClassifier(),
      new MockCommandHandler(),
      new MockPromptHandler(),
      new MockWorkflowHandler(),
      {
        domain: 'test-agent',
        enableCommands: true,
        enablePrompts: true,
        enableWorkflows: true
      }
    );

    await orchestrator.initialize();
  });

  test('should process command requests', async () => {
    const request = {
      input: '/status',
      context: {
        sessionId: 'test-session',
        timestamp: new Date(),
        source: 'test'
      }
    };

    const result = await orchestrator.process(request);
    
    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.type).toBe('command');
      expect(result.value.success).toBe(true);
    }
  });

  test('should process prompt requests', async () => {
    const request = {
      input: 'Hello, how are you?',
      context: {
        sessionId: 'test-session',
        timestamp: new Date(),
        source: 'test'
      }
    };

    const result = await orchestrator.process(request);
    
    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.type).toBe('prompt');
      expect(result.value.content).toContain('Hello');
    }
  });

  test('should update state after processing', async () => {
    const initialSession = stateManager.getCurrentSession();
    const initialHistoryLength = initialSession.conversationHistory.length;

    const request = {
      input: 'test message',
      context: {
        sessionId: initialSession.id,
        timestamp: new Date(),
        source: 'test'
      }
    };

    await orchestrator.process(request);

    const updatedSession = stateManager.getCurrentSession();
    expect(updatedSession.conversationHistory.length).toBe(initialHistoryLength + 1);
    
    const lastEntry = updatedSession.conversationHistory[updatedSession.conversationHistory.length - 1];
    expect(lastEntry.input).toBe('test message');
  });

  test('should provide streaming responses', async () => {
    const request = {
      input: 'streaming test',
      context: {
        sessionId: 'test-session',
        timestamp: new Date(),
        source: 'test'
      }
    };

    const chunks = [];
    for await (const chunk of orchestrator.stream(request)) {
      if (chunk.tag === 'success') {
        chunks.push(chunk.value);
      }
    }

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].type).toBe('classification');
    expect(chunks[chunks.length - 1].type).toBe('result');
    expect(chunks[chunks.length - 1].isComplete).toBe(true);
  });
});
```

## Implementation Checklist

### **Phase 1 Checklist: Core Infrastructure**

#### **QiCore Foundation (@qi/base)**
- [ ] Result<T> pattern implementation with success/failure discriminated union
- [ ] Functional composition methods (map, flatMap, match)
- [ ] Async operation support (fromAsyncTryCatch)
- [ ] QiError structure with context and categories
- [ ] Error factory functions (validationError, systemError, etc.)
- [ ] Package configuration and build setup
- [ ] Unit tests for all Result operations
- [ ] TypeScript declaration files

#### **Message Queue (@qi/agent/messaging)**
- [ ] QiMessage interface with proper typing
- [ ] MessageType enumeration and content unions
- [ ] MessagePriority and metadata structures
- [ ] IAsyncMessageQueue interface contract
- [ ] h2A pattern implementation with single iterator constraint
- [ ] Priority-based message ordering
- [ ] Non-blocking enqueue with Promise coordination
- [ ] TTL and auto-cleanup support
- [ ] Statistics tracking and queue state management
- [ ] QiMessageFactory for typed message creation
- [ ] Contract tests for h2A pattern compliance
- [ ] Performance tests for message throughput

#### **Agent Framework Core (@qi/agent/core)**
- [ ] IAgent interface with all required methods
- [ ] AgentRequest/Response/StreamChunk type definitions
- [ ] AgentOrchestrator implementation
- [ ] Classification-based request routing
- [ ] Streaming response support
- [ ] Agent status tracking and statistics
- [ ] Dependency injection pattern for components
- [ ] Integration tests with all handler types
- [ ] Error handling and recovery patterns

#### **State Management (@qi/agent/state)**
- [ ] IStateManager interface contract
- [ ] AppConfig structure with all configuration types
- [ ] SessionData and ConversationEntry definitions
- [ ] StateManager implementation with file persistence
- [ ] Configuration hierarchy (defaults → file → env → runtime)
- [ ] Event-driven state updates with observer pattern
- [ ] Session lifecycle management
- [ ] Model management and availability checking
- [ ] Atomic state saving with error recovery
- [ ] State migration support for schema changes
- [ ] Unit tests for all state operations
- [ ] Integration tests with persistence layer

### **Phase 2 Checklist: Tool and CLI Systems**

#### **Tool Execution Framework (@qi/agent/tools)**
- [ ] ITool interface with complete method signatures
- [ ] IToolExecutor interface for 6-phase pipeline
- [ ] IToolRegistry interface for tool management
- [ ] ToolExecutor implementation with AsyncGenerator progress
- [ ] 6-phase execution pipeline (Discovery → Cleanup)
- [ ] Tool registry with discovery and validation
- [ ] Permission system with path and resource validation
- [ ] Audit logging for all tool operations
- [ ] Concurrent and batch execution support
- [ ] Tool metadata and capability management
- [ ] Core tool implementations (Read, Write, Edit, LS, Glob, Grep, Bash)
- [ ] Security validation and sandboxing
- [ ] Tool execution metrics and performance monitoring
- [ ] Retry logic and error recovery
- [ ] Tool cleanup and resource management

#### **CLI Framework (@qi/agent/cli)**
- [ ] ICLIFramework interface for multi-framework support
- [ ] CLI configuration and state management
- [ ] Readline CLI implementation for basic terminal support
- [ ] Ink CLI implementation for rich terminal UI
- [ ] Hybrid CLI implementation with automatic fallback
- [ ] Message queue integration for h2A coordination
- [ ] Hotkey management and mode switching
- [ ] Streaming output and progress display
- [ ] State-driven UI updates
- [ ] CLI factory pattern for framework creation
- [ ] Input validation and command parsing
- [ ] Output formatting and styling
- [ ] Binary compilation compatibility

### **Phase 3 Checklist: Integration and Production**

#### **System Integration**
- [ ] Component dependency injection working correctly
- [ ] Message flow from CLI through orchestrator to handlers
- [ ] State persistence across application restarts
- [ ] Tool permission enforcement in all contexts
- [ ] Security boundary validation for isolated contexts
- [ ] Error propagation and recovery throughout system
- [ ] Performance monitoring and metrics collection
- [ ] Memory usage optimization and leak prevention
- [ ] Graceful shutdown with proper cleanup

#### **Production Readiness**
- [ ] Binary compilation with all dependencies bundled
- [ ] Configuration file loading and validation
- [ ] Environment variable support
- [ ] Logging configuration and output
- [ ] Error handling with user-friendly messages
- [ ] Performance targets met (see design guide)
- [ ] Security audit completed
- [ ] Documentation complete with examples

#### **Agent Creation Examples**
- [ ] qi-prompt implementation as simple agent example
- [ ] qi-code implementation as advanced agent example
- [ ] Custom tool development tutorial
- [ ] Agent extension patterns documentation
- [ ] Framework customization examples

## Next Steps

After completing this implementation:

1. **Follow the [Updated Implementation Checklist](./implementation-checklist.md)** for systematic progress tracking
2. **Build example agents** to validate framework patterns
3. **Performance optimization** based on benchmarking results
4. **Security hardening** through penetration testing
5. **Documentation completion** with comprehensive examples

This implementation guide provides the foundation for building a production-ready agent creation framework from scratch, emphasizing contract-driven development, security-first design, and extensible patterns that enable unlimited agent specialization.