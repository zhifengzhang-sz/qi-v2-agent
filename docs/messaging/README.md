# v-0.6.x Messaging Module

The v-0.6.x messaging module provides a comprehensive async message queue system inspired by Claude Code's h2A pattern, fully integrated with QiCore functional programming principles.

## Quick Start

```typescript
import { 
  QiAsyncMessageQueue, 
  QiMessageFactory, 
  MessageType, 
  MessagePriority 
} from '@qi/agent/messaging';
import { match } from '@qi/base';

// Create factory and queue
const factory = new QiMessageFactory();
const queue = new QiAsyncMessageQueue();

// Create a message
const messageResult = factory.createUserInputMessage('Hello, World!', 'cli');

match(
  message => {
    // Enqueue the message
    const enqueueResult = queue.enqueue(message);
    
    match(
      () => console.log('Message enqueued successfully'),
      error => console.error('Enqueue failed:', error.message),
      enqueueResult
    );
  },
  error => console.error('Message creation failed:', error.message),
  messageResult
);

// Process messages
queue.done(); // Signal no more messages

for await (const message of queue) {
  console.log('Processing:', message.type, message);
}
```

## Core Components

### 1. Message Types

The messaging system uses strongly-typed messages based on `QiMessage`:

```typescript
interface QiMessage {
  id: string;           // Unique identifier (UUID)
  type: MessageType;    // Message type enum
  timestamp: Date;      // Creation timestamp
  priority: MessagePriority; // Processing priority
  correlationId?: string;     // For request/response patterns
  parentId?: string;          // For message threading
}
```

**Available Message Types:**
- `COMMAND` - System commands with execution context
- `COMMAND_RESPONSE` - Command execution results  
- `USER_INPUT` - User input from CLI/API/stdin
- `AGENT_OUTPUT` - Agent responses and outputs
- `SYSTEM_CONTROL` - System control messages (pause/resume/reset/shutdown)
- `SYSTEM_ABORT` - Critical abort signals
- `USER_INTERRUPT` - User interruption signals
- `COMMAND_ERROR` - Command execution errors
- `AGENT_ERROR` - Agent processing errors
- `STREAM_START/DATA/END` - Streaming message lifecycle
- `STREAM_ERROR` - Streaming errors
- `AGENT_THINKING` - Agent internal processing
- `SYSTEM_STATUS` - System status updates

**Message Priorities:**
- `CRITICAL = 0` - System aborts, user interrupts
- `HIGH = 1` - System control, errors
- `NORMAL = 2` - Commands, user input, agent output
- `LOW = 3` - Agent thinking, system status

### 2. QiMessageFactory

Type-safe message creation with automatic ID generation and validation:

```typescript
const factory = new QiMessageFactory();

// Create specific message types
const userInput = factory.createUserInputMessage(
  'user input text',
  'cli',        // source: 'stdin' | 'cli' | 'api' 
  false         // raw: boolean
);

const command = factory.createCommandMessage(
  'execute',
  ['arg1', 'arg2'],
  { executionId: 'exec-123' }
);

const output = factory.createAgentOutputMessage(
  'Agent response',
  'markdown',   // format: 'text' | 'markdown' | 'json'
  false         // streaming: boolean
);

const control = factory.createSystemControlMessage(
  'pause',      // action: 'pause' | 'resume' | 'reset' | 'shutdown'
  true,         // immediate: boolean
  'User requested pause'  // reason?: string
);

// Generic message creation
const customMessage = factory.createMessage(MessageType.AGENT_THINKING, {
  thoughts: 'Processing user request...',
  confidence: 0.85
});
```

### 3. QiAsyncMessageQueue  

H2A-inspired async message queue with real-time capabilities:

```typescript
// Configuration options
interface QueueOptions {
  maxSize?: number;           // Maximum queue size (0 = unlimited)
  maxConcurrent?: number;     // Maximum concurrent processing
  messageTtl?: number;        // Message TTL in milliseconds
  priorityQueuing?: boolean;  // Enable priority-based ordering
  autoCleanup?: boolean;      // Enable automatic cleanup
  enableStats?: boolean;      // Enable statistics tracking
  cleanupFn?: () => Promise<void>; // Custom cleanup function
}

const queue = new QiAsyncMessageQueue({
  maxSize: 1000,
  priorityQueuing: true,
  messageTtl: 300000, // 5 minutes
  enableStats: true
});
```

**Core Operations:**

```typescript
// Enqueue messages
const result = queue.enqueue(message);
match(
  () => console.log('Enqueued successfully'),
  error => console.error('Enqueue failed:', error.message),
  result
);

// Signal completion
queue.done();

// Handle errors
const errorResult = queue.error(someError);

// Query state
const stateResult = queue.getState();
match(
  state => {
    console.log('Queue state:', {
      started: state.started,
      isDone: state.isDone,
      hasError: state.hasError,
      messageCount: state.messageCount
    });
  },
  error => console.error('State check failed:', error.message),
  stateResult
);

// Queue operations
const peekResult = queue.peek();        // Peek without removing
const sizeResult = queue.size();        // Get queue size  
const emptyResult = queue.isEmpty();    // Check if empty
const fullResult = queue.isFull();     // Check if full
const clearResult = queue.clear();     // Clear all messages

// Pause/resume processing
queue.pause();
queue.resume();
const pausedResult = queue.isPaused();

// Cleanup
await queue.destroy();
```

**Async Iteration (H2A Pattern):**

```typescript
// Basic iteration
for await (const message of queue) {
  console.log('Processing message:', message.type);
  // Process message...
}

// Manual iterator control
const iterator = queue[Symbol.asyncIterator]();
let result = await iterator.next();

while (!result.done) {
  const message = result.value;
  
  // Process message...
  console.log('Message:', message.type);
  
  // Real-time injection is possible here!
  if (shouldInjectUrgentMessage) {
    const urgentMsg = factory.createSystemControlMessage('pause');
    match(
      urgent => queue.enqueue(urgent),
      error => console.error('Urgent injection failed:', error.message),
      urgentMsg
    );
  }
  
  result = await iterator.next();
}
```

## Advanced Features

### Priority Queuing

When `priorityQueuing: true`, messages are automatically ordered by priority:

```typescript
const queue = new QiAsyncMessageQueue({ priorityQueuing: true });

// Add messages in any order
queue.enqueue(normalMessage);    // Priority: NORMAL (2)
queue.enqueue(criticalMessage);  // Priority: CRITICAL (0) 
queue.enqueue(highMessage);      // Priority: HIGH (1)

// Processing order will be: CRITICAL → HIGH → NORMAL
for await (const message of queue) {
  console.log('Processing:', message.priority);
  // Output: 0 (CRITICAL), 1 (HIGH), 2 (NORMAL)
}
```

### Message TTL and Cleanup

```typescript
const queue = new QiAsyncMessageQueue({ 
  messageTtl: 60000,    // 1 minute TTL
  autoCleanup: true     // Enable automatic cleanup
});

// Expired messages are automatically removed
// Manual cleanup is also available
```

### Statistics and Monitoring

```typescript
const queue = new QiAsyncMessageQueue({ enableStats: true });

const statsResult = queue.getStats();
match(
  stats => {
    console.log('Queue statistics:', {
      totalMessages: stats.totalMessages,
      messagesByType: stats.messagesByType,
      messagesByPriority: stats.messagesByPriority,
      messagesByStatus: stats.messagesByStatus,
      averageProcessingTime: stats.averageProcessingTime,
      errorRate: stats.errorRate,
      queueLength: stats.queueLength
    });
  },
  error => console.error('Stats unavailable:', error.message),
  statsResult
);
```

### Request/Response Patterns

```typescript
const factory = new QiMessageFactory();

// Create correlated messages
const parentMessage = factory.createCommandMessage(
  'process-data', 
  ['data.json'],
  { executionId: 'exec-456' }
);

match(
  parent => {
    // Create response message
    const responseResult = factory.createResponseMessage(
      parent,
      { status: 'completed', results: [...] },
      1500 // execution time in ms
    );
    
    match(
      response => {
        console.log('Response correlationId:', response.correlationId);
        console.log('Response parentId:', response.parentId);
      },
      error => console.error('Response creation failed:', error.message),
      responseResult
    );
  },
  error => console.error('Parent creation failed:', error.message),
  parentMessage
);

// Or create correlated messages manually
const correlatedResult = factory.createCorrelatedMessage(
  MessageType.AGENT_OUTPUT,
  { content: 'Processing complete' },
  parentMessage
);
```

## Error Handling

The messaging module follows QiCore's functional error handling patterns:

```typescript
// All operations return Result<T, Error>
const messageResult = factory.createUserInputMessage('test', 'cli');

match(
  message => {
    // Success case - message created
    const enqueueResult = queue.enqueue(message);
    
    match(
      () => {
        // Success case - message enqueued
        console.log('Message processed successfully');
      },
      error => {
        // Error case - enqueue failed
        switch (error.code) {
          case 'QUEUE_FULL':
            console.log('Queue is full, try again later');
            break;
          case 'QUEUE_DONE':
            console.log('Queue is closed, cannot enqueue');
            break;
          default:
            console.error('Enqueue error:', error.message);
        }
      },
      enqueueResult
    );
  },
  error => {
    // Error case - message creation failed
    console.error('Message creation failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error context:', error.context);
  },
  messageResult
);

// Never use try/catch - always use match() for error handling
```

## Integration Examples

### CLI Integration

```typescript
import { createHybridCLI } from '@qi/agent/cli';
import { QiAsyncMessageQueue, QiMessageFactory } from '@qi/agent/messaging';

const messageQueue = new QiAsyncMessageQueue({ priorityQueuing: true });
const messageFactory = new QiMessageFactory();

const cli = createHybridCLI({
  onInput: (input: string) => {
    const messageResult = messageFactory.createUserInputMessage(input, 'cli');
    
    match(
      message => {
        const enqueueResult = messageQueue.enqueue(message);
        match(
          () => console.log('Input queued for processing'),
          error => console.error('Failed to queue input:', error.message),
          enqueueResult
        );
      },
      error => console.error('Failed to create input message:', error.message),
      messageResult
    );
  }
});
```

### Agent Processing Loop

```typescript
async function processMessages(queue: QiAsyncMessageQueue) {
  for await (const message of queue) {
    match(
      async processedResult => {
        // Create response message
        const responseResult = messageFactory.createAgentOutputMessage(
          processedResult,
          'markdown'
        );
        
        match(
          response => {
            // Send response to output...
            console.log('Agent response:', response.content);
          },
          error => console.error('Response creation failed:', error.message),
          responseResult
        );
      },
      error => {
        // Create error message  
        const errorResult = messageFactory.createErrorMessage(message, error);
        match(
          errorMsg => console.error('Processing error:', errorMsg),
          err => console.error('Error message creation failed:', err.message),
          errorResult
        );
      },
      await processMessage(message)
    );
  }
}
```

## Best Practices

### 1. Use Proper QiCore Patterns

```typescript
// ✅ Correct: Use match() for all Result handling
match(
  message => {
    // Handle success
    console.log('Success:', message);
  },
  error => {
    // Handle error
    console.error('Error:', error.message);
  },
  messageResult
);

// ❌ Incorrect: Don't use manual tag checking
if (messageResult.tag === 'success') {
  console.log(messageResult.value);
}
```

### 2. Message Lifecycle Management

```typescript
// Create queue with appropriate options
const queue = new QiAsyncMessageQueue({
  maxSize: 1000,           // Prevent memory issues
  messageTtl: 300000,      // 5 minute expiration
  priorityQueuing: true,   // Handle urgent messages first
  enableStats: true       // Monitor performance
});

// Always signal completion
queue.done();

// Clean up resources
await queue.destroy();
```

### 3. Error Recovery

```typescript
// Handle specific error types
match(
  () => {
    // Success
  },
  error => {
    switch (error.code) {
      case 'QUEUE_FULL':
        // Implement backpressure or retry logic
        break;
      case 'VALIDATION_FAILED':
        // Fix message format and retry
        break;
      case 'QUEUE_DONE':
        // Queue is closed, handle gracefully
        break;
      default:
        // Log unexpected errors
        console.error('Unexpected error:', error);
    }
  },
  operationResult
);
```

### 4. Performance Optimization

```typescript
// Use appropriate queue size for your use case
const queue = new QiAsyncMessageQueue({
  maxSize: 10000,          // High throughput
  maxConcurrent: 5,        // Limit concurrent processing
  priorityQueuing: false,  // Disable if not needed (faster)
  autoCleanup: true,       // Prevent memory leaks
  enableStats: false       // Disable if not monitoring
});

// Process messages in batches if needed
const messages = [];
for await (const message of queue) {
  messages.push(message);
  
  if (messages.length >= 10) {
    await processBatch(messages);
    messages.length = 0;
  }
}
```

## API Reference

See the [complete API documentation](../api-reference.md#messaging) for detailed type information and method signatures.

## Testing

The messaging module includes comprehensive tests demonstrating all functionality:

- `lib/tests/messaging/QiMessageFactory.test.ts` - Message factory tests
- `lib/tests/messaging/QiAsyncMessageQueue.test.ts` - Queue functionality tests

Run tests with:
```bash
bun run test
```

## Migration from v-0.5.x

The v-0.6.x messaging system is a new addition and doesn't replace existing functionality. Integration points:

- **Event System**: Continue using `QiCoreEventManager` for event-driven patterns
- **CLI Input**: Route CLI input through the message queue for processing
- **Agent Loop**: Use message queue as foundation for agent processing loop

## Next Steps

The v-0.6.x messaging system provides the foundation for:
- **v-0.7.x Tools**: Concurrent tool execution via message coordination
- **v-0.8.x Workflows**: Complex workflow orchestration with message passing
- **v-0.9.x Agent**: Full agent loop implementation with async messaging