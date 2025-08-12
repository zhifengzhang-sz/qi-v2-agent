# Messaging Module API Reference

Complete API reference for the v-0.6.x messaging module.

## Table of Contents

1. [Types and Interfaces](#types-and-interfaces)
2. [QiMessageFactory](#qimessagefactory)
3. [QiAsyncMessageQueue](#qiasyncmessagequeue)
4. [Error Handling](#error-handling)
5. [Type Guards and Utilities](#type-guards-and-utilities)

## Types and Interfaces

### Core Types

```typescript
// Base message interface
interface BaseMessage {
  id: string;                 // UUID generated automatically
  type: MessageType;          // Message type enum
  timestamp: Date;            // Creation timestamp
  priority: MessagePriority;  // Processing priority (auto-inferred)
  correlationId?: string;     // For request/response patterns
  parentId?: string;          // For message threading
}

// Generic message interface
interface QiMessage extends BaseMessage {
  // Message type determines additional properties
}
```

### Message Types Enum

```typescript
enum MessageType {
  // Command execution
  COMMAND = 'command',
  COMMAND_RESPONSE = 'command_response',
  COMMAND_ERROR = 'command_error',
  
  // User interaction  
  USER_INPUT = 'user_input',
  USER_INTERRUPT = 'user_interrupt',
  
  // Agent processing
  AGENT_OUTPUT = 'agent_output', 
  AGENT_ERROR = 'agent_error',
  AGENT_THINKING = 'agent_thinking',
  
  // System control
  SYSTEM_CONTROL = 'system_control',
  SYSTEM_ABORT = 'system_abort',
  SYSTEM_STATUS = 'system_status',
  
  // Streaming
  STREAM_START = 'stream_start',
  STREAM_DATA = 'stream_data', 
  STREAM_END = 'stream_end',
  STREAM_ERROR = 'stream_error'
}
```

### Message Priority Enum

```typescript
enum MessagePriority {
  CRITICAL = 0,  // System aborts, user interrupts
  HIGH = 1,      // System control, errors  
  NORMAL = 2,    // Commands, user input, agent output
  LOW = 3        // Agent thinking, system status
}
```

### Message Status Enum

```typescript
enum MessageStatus {
  PENDING = 'pending',       // Waiting to be processed
  PROCESSING = 'processing', // Currently being processed
  COMPLETED = 'completed',   // Successfully processed
  FAILED = 'failed',         // Processing failed
  EXPIRED = 'expired'        // TTL expired before processing
}
```

### Specific Message Interfaces

```typescript
// Command message
interface CommandMessage extends BaseMessage {
  type: MessageType.COMMAND;
  command: string;
  args: readonly any[];
  context: CommandContext;
}

interface CommandContext {
  executionId: string;
  environment?: Record<string, string>;
  workingDirectory?: string;
  timeout?: number;
}

// Command response message
interface CommandResponseMessage extends BaseMessage {
  type: MessageType.COMMAND_RESPONSE;
  result: any;
  executionTime: number;
  context: CommandContext;
}

// User input message
interface UserInputMessage extends BaseMessage {
  type: MessageType.USER_INPUT;
  input: string;
  source: 'stdin' | 'cli' | 'api';
  raw: boolean;
}

// Agent output message
interface AgentOutputMessage extends BaseMessage {
  type: MessageType.AGENT_OUTPUT;
  content: string;
  format: 'text' | 'markdown' | 'json';
  streaming: boolean;
}

// System control message
interface SystemControlMessage extends BaseMessage {
  type: MessageType.SYSTEM_CONTROL;
  action: 'pause' | 'resume' | 'reset' | 'shutdown';
  immediate: boolean;
  reason?: string;
}

// Error messages
interface CommandErrorMessage extends BaseMessage {
  type: MessageType.COMMAND_ERROR;
  error: QiError;
  context: CommandContext;
}

interface AgentErrorMessage extends BaseMessage {
  type: MessageType.AGENT_ERROR;
  error: QiError;
  context?: Record<string, any>;
}

// Streaming messages
interface StreamStartMessage extends BaseMessage {
  type: MessageType.STREAM_START;
  streamId: string;
  contentType: string;
  metadata?: Record<string, any>;
}

interface StreamDataMessage extends BaseMessage {
  type: MessageType.STREAM_DATA;
  streamId: string;
  data: any;
  sequence: number;
}

interface StreamEndMessage extends BaseMessage {
  type: MessageType.STREAM_END;
  streamId: string;
  totalSequences: number;
  metadata?: Record<string, any>;
}

interface StreamErrorMessage extends BaseMessage {
  type: MessageType.STREAM_ERROR;
  streamId: string;
  error: QiError;
}

// Thinking and status messages
interface AgentThinkingMessage extends BaseMessage {
  type: MessageType.AGENT_THINKING;
  thoughts: string;
  confidence?: number;
  reasoning?: string[];
}

interface SystemStatusMessage extends BaseMessage {
  type: MessageType.SYSTEM_STATUS;
  status: string;
  details?: Record<string, any>;
  timestamp: Date;
}
```

### Queue Types

```typescript
// Queue configuration options
interface QueueOptions {
  maxSize?: number;           // Maximum queue size (0 = unlimited, default: 0)
  maxConcurrent?: number;     // Maximum concurrent processing (default: 10)
  messageTtl?: number;        // Message TTL in milliseconds (default: 300000)
  priorityQueuing?: boolean;  // Enable priority-based ordering (default: true)
  autoCleanup?: boolean;      // Enable automatic cleanup (default: true)
  enableStats?: boolean;      // Enable statistics tracking (default: true)
  cleanupFn?: () => Promise<void>; // Custom cleanup function
}

// Queue state information
interface QueueState {
  started: boolean;        // Whether iteration has started
  isDone: boolean;        // Whether queue is marked as done
  hasError: boolean;      // Whether queue has encountered errors
  messageCount: number;   // Total messages processed
  processingCount: number; // Currently processing messages
  errorCount: number;     // Total error count
}

// Queue statistics
interface MessageStats {
  totalMessages: number;
  messagesByType: Record<MessageType, number>;
  messagesByPriority: Record<MessagePriority, number>;
  messagesByStatus: Record<MessageStatus, number>;
  averageProcessingTime: number;
  errorRate: number;
  queueLength: number;
}

// Validation result
interface MessageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

## QiMessageFactory

Factory class for creating type-safe messages with automatic ID generation and validation.

### Constructor

```typescript
constructor(): QiMessageFactory
```

Creates a new message factory instance. No configuration required.

### Generic Message Creation

```typescript
createMessage<T extends QiMessage>(
  type: T['type'],
  payload: Omit<T, keyof BaseMessage>
): Result<T, FactoryError>
```

Creates a generic message of the specified type.

**Parameters:**
- `type`: Message type from MessageType enum
- `payload`: Message-specific properties (excluding base properties)

**Returns:** `Result<T, FactoryError>` - Created message or factory error

**Example:**
```typescript
const result = factory.createMessage(MessageType.AGENT_THINKING, {
  thoughts: 'Processing user request...',
  confidence: 0.85
});

match(
  message => console.log('Created:', message.id),
  error => console.error('Failed:', error.message),
  result
);
```

### Specific Message Creation Methods

#### createCommandMessage

```typescript
createCommandMessage(
  command: string,
  args: readonly any[],
  context: CommandContext
): Result<CommandMessage, FactoryError>
```

Creates a command message with execution context.

**Parameters:**
- `command`: Command string (required, non-empty)
- `args`: Command arguments array (required)
- `context`: Execution context with executionId (required)

**Validation:**
- Command must be non-empty string
- Args must be array
- Context must include executionId

#### createUserInputMessage

```typescript
createUserInputMessage(
  input: string,
  source: 'stdin' | 'cli' | 'api',
  raw?: boolean
): Result<UserInputMessage, FactoryError>
```

Creates a user input message.

**Parameters:**
- `input`: Input string (required)
- `source`: Input source (required)
- `raw`: Whether input is raw/unprocessed (optional, default: false)

**Validation:**
- Input must be string
- Source must be one of: 'stdin', 'cli', 'api'

#### createAgentOutputMessage

```typescript
createAgentOutputMessage(
  content: string,
  format?: 'text' | 'markdown' | 'json',
  streaming?: boolean
): Result<AgentOutputMessage, FactoryError>
```

Creates an agent output message with format validation.

**Parameters:**
- `content`: Output content (required string)
- `format`: Content format (optional, default: 'text')
- `streaming`: Whether output is streaming (optional, default: false)

**Validation:**
- Content must be string
- Format must be one of: 'text', 'markdown', 'json'
- If format is 'json', content must be valid JSON

#### createSystemControlMessage

```typescript
createSystemControlMessage(
  action: 'pause' | 'resume' | 'reset' | 'shutdown',
  immediate?: boolean,
  reason?: string
): Result<SystemControlMessage, FactoryError>
```

Creates a system control message.

**Parameters:**
- `action`: Control action (required)
- `immediate`: Execute immediately (optional, default: false)
- `reason`: Reason for action (optional)

**Validation:**
- Action must be one of: 'pause', 'resume', 'reset', 'shutdown'

### Message Correlation Methods

#### createCorrelatedMessage

```typescript
createCorrelatedMessage<T extends QiMessage>(
  type: T['type'],
  payload: Omit<T, keyof BaseMessage>,
  parentMessage: QiMessage
): Result<T, FactoryError>
```

Creates a message correlated to a parent message.

**Parameters:**
- `type`: Message type
- `payload`: Message payload
- `parentMessage`: Parent message for correlation

**Behavior:**
- Sets correlationId to parent's correlationId or parent's id
- Sets parentId to parent's id

#### createResponseMessage

```typescript
createResponseMessage(
  commandMessage: CommandMessage,
  result: any,
  executionTime: number
): Result<CommandResponseMessage, FactoryError>
```

Creates a response message for a command.

**Parameters:**
- `commandMessage`: Original command message
- `result`: Execution result
- `executionTime`: Execution time in milliseconds

#### createErrorMessage

```typescript
createErrorMessage(
  commandMessage: CommandMessage,
  error: QiError
): Result<CommandErrorMessage, FactoryError>
```

Creates an error message for a failed command.

**Parameters:**
- `commandMessage`: Original command message
- `error`: QiError describing the failure

### Static Methods

#### createCorrelationId

```typescript
static createCorrelationId(): string
```

Creates a unique correlation ID (UUID v4).

**Returns:** String UUID for message correlation

## QiAsyncMessageQueue

H2A-inspired async message queue with real-time message injection and priority processing.

### Constructor

```typescript
constructor(options?: QueueOptions): QiAsyncMessageQueue<T>
```

Creates a new message queue with optional configuration.

**Default Options:**
```typescript
{
  maxSize: 0,              // Unlimited
  maxConcurrent: 10,       
  messageTtl: 300000,      // 5 minutes
  priorityQueuing: true,   
  autoCleanup: true,       
  enableStats: true,       
  cleanupFn: undefined     
}
```

### Core Operations

#### enqueue

```typescript
enqueue(message: T): Result<void, QueueError>
```

Adds a message to the queue for processing.

**Parameters:**
- `message`: QiMessage to enqueue

**Returns:** `Result<void, QueueError>`

**Possible Errors:**
- `QUEUE_DONE`: Queue is marked as done
- `QUEUE_ERROR`: Queue is in error state
- `QUEUE_FULL`: Queue has reached maximum size

**Behavior:**
- If priorityQueuing enabled, inserts by priority
- If there's a waiting reader, resolves immediately (h2A pattern)
- Updates queue statistics if enabled

#### done

```typescript
done(): Result<void, QueueError>
```

Signals that no more messages will be added to the queue.

**Returns:** `Result<void, QueueError>`

**Behavior:**
- Marks queue as done
- If waiting reader exists and queue is empty, resolves iteration
- Prevents further enqueue operations

#### error

```typescript
error(error: QiError): Result<void, QueueError>
```

Signals an error condition in the queue.

**Parameters:**
- `error`: QiError describing the problem

**Returns:** `Result<void, QueueError>`

**Behavior:**
- Marks queue as having error
- Rejects any waiting readers
- Prevents further enqueue operations

### Queue State and Inspection

#### getState

```typescript
getState(): Result<QueueState, QueueError>
```

Gets current queue state information.

**Returns:** `Result<QueueState, QueueError>`

#### getStats

```typescript
getStats(): Result<MessageStats | null, QueueError>
```

Gets queue statistics (if enabled).

**Returns:** `Result<MessageStats | null, QueueError>`
- Returns `null` if statistics are disabled

#### peek

```typescript
peek(): Result<T | null, QueueError>
```

Looks at the next message without removing it.

**Returns:** `Result<T | null, QueueError>`
- Returns `null` if queue is empty

#### size

```typescript
size(): Result<number, QueueError>
```

Gets the current number of messages in the queue.

#### isEmpty

```typescript
isEmpty(): Result<boolean, QueueError>
```

Checks if the queue is empty.

#### isFull

```typescript
isFull(): Result<boolean, QueueError>
```

Checks if the queue is full (only relevant if maxSize > 0).

### Queue Control

#### clear

```typescript
clear(): Result<number, QueueError>
```

Removes all messages from the queue.

**Returns:** `Result<number, QueueError>` - Number of messages cleared

#### pause

```typescript
pause(): Result<void, QueueError>
```

Pauses message processing.

**Behavior:**
- New iterations will wait until resumed
- Current processing continues

#### resume

```typescript
resume(): Result<void, QueueError>
```

Resumes message processing.

#### isPaused

```typescript
isPaused(): Result<boolean, QueueError>
```

Checks if the queue is paused.

### Lifecycle Management

#### destroy

```typescript
destroy(): Promise<Result<void, QueueError>>
```

Destroys the queue and cleans up resources.

**Behavior:**
- Stops cleanup timer
- Rejects waiting readers
- Clears all messages
- Calls custom cleanup function if provided
- Clears event subscriptions

### Async Iteration (H2A Pattern)

#### Symbol.asyncIterator

```typescript
[Symbol.asyncIterator](): AsyncIterator<T, any, undefined>
```

Creates an async iterator for processing messages.

**Throws:** Error if queue is already being iterated (can only iterate once)

**Usage:**
```typescript
for await (const message of queue) {
  // Process message
  console.log('Processing:', message.type);
  
  // Real-time injection is possible during iteration
  if (urgent) {
    queue.enqueue(urgentMessage);
  }
}
```

#### next

```typescript
async next(): Promise<IteratorResult<T, any>>
```

Gets the next message from the queue (internal method).

**Returns:** `Promise<IteratorResult<T, any>>`

**Behavior:**
- Returns immediately if message available
- Waits for new message if queue not done
- Returns `{ done: true }` if queue is done and empty
- Handles pause state by waiting until resumed

## Error Handling

### FactoryError

Errors from message factory operations:

```typescript
interface FactoryError extends QiError {
  context: {
    operation?: string;      // Factory operation name
    messageType?: string;    // Message type being created
    validation?: string[];   // Validation error details
  };
}
```

**Common Error Codes:**
- `INVALID_MESSAGE_TYPE`: Unknown message type
- `INVALID_COMMAND`: Invalid command parameters
- `INVALID_ARGS`: Invalid argument array
- `INVALID_CONTEXT`: Missing or invalid context
- `INVALID_INPUT`: Invalid input string
- `INVALID_SOURCE`: Invalid source type
- `INVALID_CONTENT`: Invalid content
- `INVALID_FORMAT`: Invalid format type
- `INVALID_JSON`: Invalid JSON content
- `INVALID_ACTION`: Invalid system control action
- `VALIDATION_FAILED`: Message validation failed

### QueueError

Errors from queue operations:

```typescript
interface QueueError extends QiError {
  context: {
    operation?: string;      // Queue operation name
    queueSize?: number;      // Current queue size
    messageId?: string;      // Message ID if applicable
    messageType?: string;    // Message type if applicable
  };
}
```

**Common Error Codes:**
- `ALREADY_STARTED`: Queue iteration already started
- `QUEUE_DONE`: Operation not allowed on done queue
- `QUEUE_ERROR`: Operation not allowed on error queue  
- `QUEUE_FULL`: Queue has reached maximum size
- `CLEANUP_FAILED`: Cleanup function failed
- `QUEUE_DESTROYED`: Operation on destroyed queue

## Type Guards and Utilities

### Message Type Guards

```typescript
// Check specific message types
function isCommandMessage(message: QiMessage): message is CommandMessage {
  return message.type === MessageType.COMMAND;
}

function isUserInputMessage(message: QiMessage): message is UserInputMessage {
  return message.type === MessageType.USER_INPUT;
}

function isAgentOutputMessage(message: QiMessage): message is AgentOutputMessage {
  return message.type === MessageType.AGENT_OUTPUT;
}

function isSystemControlMessage(message: QiMessage): message is SystemControlMessage {
  return message.type === MessageType.SYSTEM_CONTROL;
}

function isErrorMessage(message: QiMessage): message is CommandErrorMessage | AgentErrorMessage | StreamErrorMessage {
  return [
    MessageType.COMMAND_ERROR,
    MessageType.AGENT_ERROR, 
    MessageType.STREAM_ERROR
  ].includes(message.type);
}

function isStreamMessage(message: QiMessage): boolean {
  return [
    MessageType.STREAM_START,
    MessageType.STREAM_DATA,
    MessageType.STREAM_END,
    MessageType.STREAM_ERROR
  ].includes(message.type);
}
```

### Priority Helpers

```typescript
// Check message priority levels
function isCriticalPriority(message: QiMessage): boolean {
  return message.priority === MessagePriority.CRITICAL;
}

function isHighPriority(message: QiMessage): boolean {
  return message.priority === MessagePriority.HIGH;
}

function isNormalPriority(message: QiMessage): boolean {
  return message.priority === MessagePriority.NORMAL;
}

function isLowPriority(message: QiMessage): boolean {
  return message.priority === MessagePriority.LOW;
}
```

### Utility Functions

```typescript
// Get message type name
function getMessageTypeName(type: MessageType): string {
  return type.replace('_', ' ').toLowerCase();
}

// Get priority name
function getPriorityName(priority: MessagePriority): string {
  return MessagePriority[priority].toLowerCase();
}

// Calculate processing time for responses
function calculateProcessingTime(start: Date, end: Date): number {
  return end.getTime() - start.getTime();
}

// Extract stream ID from streaming messages
function getStreamId(message: QiMessage): string | null {
  if (isStreamMessage(message)) {
    return (message as any).streamId || null;
  }
  return null;
}

// Check if messages are correlated
function areMessagesCorrelated(message1: QiMessage, message2: QiMessage): boolean {
  return !!(
    (message1.correlationId && message1.correlationId === message2.correlationId) ||
    (message1.parentId && message1.parentId === message2.id) ||
    (message2.parentId && message2.parentId === message1.id)
  );
}
```

## Usage Examples

See [README.md](./README.md) for comprehensive usage examples and best practices.

## Integration Notes

- All methods follow QiCore Result<T> patterns
- Use `match()` for error handling, never try/catch
- Message factory automatically infers priorities based on message type
- Queue supports real-time message injection during iteration
- Priority queuing orders messages: CRITICAL(0) → HIGH(1) → NORMAL(2) → LOW(3)
- TTL cleanup happens automatically when autoCleanup is enabled
- Statistics tracking is enabled by default but can be disabled for performance