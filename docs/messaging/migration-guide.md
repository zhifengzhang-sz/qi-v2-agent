# Migration Guide: v-0.5.x to v-0.6.x Messaging

This guide helps you integrate the new v-0.6.x messaging system with existing v-0.5.x components.

## Overview

The v-0.6.x messaging system is an **additive enhancement** - it doesn't replace existing functionality but provides a foundation for async message processing that complements your current setup.

## What's New in v-0.6.x

### Added Components
- **QiAsyncMessageQueue**: H2A-inspired async message queue
- **QiMessageFactory**: Type-safe message creation
- **Comprehensive Message Types**: 15+ typed message formats
- **Priority-based Processing**: CRITICAL → HIGH → NORMAL → LOW
- **Real-time Message Injection**: Add messages during processing
- **QiCore Integration**: Full Result<T> functional patterns

### Existing Components (Unchanged)
- **Hybrid CLI Framework**: Continue using as-is
- **QiCore Event Manager**: Still used for event-driven patterns
- **Prompt App (qi-prompt)**: Current functionality preserved
- **Configuration System**: No changes required

## Integration Strategies

### 1. CLI Input Processing

**Before (v-0.5.x):**
```typescript
// Direct processing in CLI handlers
const hybridCLI = createHybridCLI({
  onInput: async (input: string) => {
    const result = await processUserInput(input);
    console.log(result);
  }
});
```

**After (v-0.6.x Integration):**
```typescript
import { QiAsyncMessageQueue, QiMessageFactory } from '@qi/agent/messaging';
import { match } from '@qi/base';

const messageQueue = new QiAsyncMessageQueue({ priorityQueuing: true });
const messageFactory = new QiMessageFactory();

const hybridCLI = createHybridCLI({
  onInput: (input: string) => {
    // Create typed message
    const messageResult = messageFactory.createUserInputMessage(input, 'cli');
    
    match(
      message => {
        // Enqueue for async processing
        const enqueueResult = messageQueue.enqueue(message);
        match(
          () => console.log('Input queued for processing'),
          error => console.error('Queue error:', error.message),
          enqueueResult
        );
      },
      error => console.error('Message creation failed:', error.message),
      messageResult
    );
  }
});

// Process messages asynchronously
async function processMessages() {
  for await (const message of messageQueue) {
    if (message.type === 'user_input') {
      const result = await processUserInput(message.input);
      
      // Create response message
      const responseResult = messageFactory.createAgentOutputMessage(
        result,
        'markdown'
      );
      
      match(
        response => console.log('Response:', response.content),
        error => console.error('Response creation failed:', error.message),
        responseResult
      );
    }
  }
}

// Start processing
processMessages();
```

### 2. Event System Integration

**Before (v-0.5.x):**
```typescript
import { QiCoreEventManager } from '@qi/agent/cli';

const eventManager = new QiCoreEventManager();

eventManager.on('user-action', (data) => {
  console.log('User action:', data);
});

eventManager.emit('user-action', { type: 'click', target: 'button' });
```

**After (v-0.6.x Integration):**
```typescript
import { QiCoreEventManager } from '@qi/agent/cli';
import { QiAsyncMessageQueue, QiMessageFactory } from '@qi/agent/messaging';
import { match } from '@qi/base';

const eventManager = new QiCoreEventManager();
const messageQueue = new QiAsyncMessageQueue();
const messageFactory = new QiMessageFactory();

// Bridge events to message queue
eventManager.on('user-action', (data) => {
  const messageResult = messageFactory.createMessage('user_input', {
    input: JSON.stringify(data),
    source: 'api',
    raw: false
  });
  
  match(
    message => {
      const enqueueResult = messageQueue.enqueue(message);
      match(
        () => {}, // Successfully queued
        error => console.error('Failed to queue event:', error.message),
        enqueueResult
      );
    },
    error => console.error('Failed to create event message:', error.message),
    messageResult
  );
});

// Continue using events for immediate responses
eventManager.emit('user-action', { type: 'click', target: 'button' });

// Process queued messages for complex workflows
processMessageQueue();
```

### 3. Agent Processing Enhancement

**Before (v-0.5.x):**
```typescript
// Simple synchronous processing
function processUserRequest(input: string): string {
  // Process input
  return `Processed: ${input}`;
}
```

**After (v-0.6.x Integration):**
```typescript
import { QiAsyncMessageQueue, QiMessageFactory, MessageType } from '@qi/agent/messaging';
import { match } from '@qi/base';

class EnhancedAgent {
  private messageQueue: QiAsyncMessageQueue;
  private messageFactory: QiMessageFactory;
  
  constructor() {
    this.messageQueue = new QiAsyncMessageQueue({
      priorityQueuing: true,
      enableStats: true
    });
    this.messageFactory = new QiMessageFactory();
    
    // Start message processing loop
    this.processMessages();
  }
  
  async processUserRequest(input: string): Promise<void> {
    // Create user input message
    const messageResult = this.messageFactory.createUserInputMessage(input, 'api');
    
    match(
      message => {
        const enqueueResult = this.messageQueue.enqueue(message);
        match(
          () => console.log('Request queued'),
          error => console.error('Queue error:', error.message),
          enqueueResult
        );
      },
      error => console.error('Message creation failed:', error.message),
      messageResult
    );
  }
  
  private async processMessages(): Promise<void> {
    for await (const message of this.messageQueue) {
      try {
        await this.handleMessage(message);
      } catch (error) {
        // Create error message
        const errorResult = this.messageFactory.createMessage(MessageType.AGENT_ERROR, {
          error: error,
          context: { originalMessageId: message.id }
        });
        
        match(
          errorMsg => console.error('Processing error:', errorMsg),
          err => console.error('Error message creation failed:', err.message),
          errorResult
        );
      }
    }
  }
  
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case MessageType.USER_INPUT:
        await this.handleUserInput(message);
        break;
      case MessageType.COMMAND:
        await this.handleCommand(message);
        break;
      case MessageType.SYSTEM_CONTROL:
        await this.handleSystemControl(message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }
  
  private async handleUserInput(message: any): Promise<void> {
    // Process the input
    const result = await this.processInput(message.input);
    
    // Create response message
    const responseResult = this.messageFactory.createAgentOutputMessage(
      result,
      'markdown'
    );
    
    match(
      response => console.log('Agent response:', response.content),
      error => console.error('Response creation failed:', error.message),
      responseResult
    );
  }
  
  private async processInput(input: string): Promise<string> {
    // Your existing processing logic
    return `Processed: ${input}`;
  }
}

// Usage
const agent = new EnhancedAgent();
agent.processUserRequest('Hello, world!');
```

## Migration Patterns

### Pattern 1: Gradual Migration

Start with high-value use cases and gradually expand:

```typescript
// Phase 1: Use messaging for user input only
const userInputQueue = new QiAsyncMessageQueue();

// Phase 2: Add command processing
const commandQueue = new QiAsyncMessageQueue();

// Phase 3: Unified message processing
const unifiedQueue = new QiAsyncMessageQueue();
```

### Pattern 2: Hybrid Approach

Keep synchronous processing for simple cases, use messaging for complex workflows:

```typescript
class HybridProcessor {
  private messageQueue: QiAsyncMessageQueue;
  
  async process(input: string, mode: 'sync' | 'async' = 'sync'): Promise<string> {
    if (mode === 'sync') {
      // Simple synchronous processing
      return this.processSynchrounous(input);
    } else {
      // Complex async processing via message queue
      return this.processAsynchronous(input);
    }
  }
  
  private processSynchrounous(input: string): string {
    // Your existing sync logic
    return `Sync: ${input}`;
  }
  
  private async processAsynchronous(input: string): Promise<string> {
    // Queue message and wait for result
    const messageResult = this.messageFactory.createUserInputMessage(input, 'api');
    
    return match(
      async message => {
        const enqueueResult = this.messageQueue.enqueue(message);
        return match(
          async () => {
            // Wait for processing to complete
            return await this.waitForResponse(message.id);
          },
          error => {
            throw new Error(`Queue error: ${error.message}`);
          },
          enqueueResult
        );
      },
      error => {
        throw new Error(`Message creation failed: ${error.message}`);
      },
      messageResult
    );
  }
}
```

### Pattern 3: Event-Driven Bridge

Bridge between events and messages:

```typescript
class EventMessageBridge {
  private eventManager: QiCoreEventManager;
  private messageQueue: QiAsyncMessageQueue;
  private messageFactory: QiMessageFactory;
  
  constructor() {
    this.eventManager = new QiCoreEventManager();
    this.messageQueue = new QiAsyncMessageQueue();
    this.messageFactory = new QiMessageFactory();
    
    this.setupBridge();
    this.processMessages();
  }
  
  private setupBridge(): void {
    // Convert specific events to messages
    this.eventManager.on('user-input', (data) => {
      this.convertToMessage(MessageType.USER_INPUT, data);
    });
    
    this.eventManager.on('system-command', (data) => {
      this.convertToMessage(MessageType.COMMAND, data);
    });
    
    this.eventManager.on('error', (data) => {
      this.convertToMessage(MessageType.AGENT_ERROR, data);
    });
  }
  
  private convertToMessage(type: MessageType, data: any): void {
    const messageResult = this.messageFactory.createMessage(type, data);
    
    match(
      message => {
        const enqueueResult = this.messageQueue.enqueue(message);
        match(
          () => {}, // Success
          error => console.error('Bridge enqueue failed:', error.message),
          enqueueResult
        );
      },
      error => console.error('Bridge message creation failed:', error.message),
      messageResult
    );
  }
  
  private async processMessages(): Promise<void> {
    for await (const message of this.messageQueue) {
      // Process message and optionally emit events for compatibility
      await this.processMessage(message);
      
      // Emit processed event for existing listeners
      this.eventManager.emit('message-processed', {
        messageId: message.id,
        type: message.type,
        result: 'completed'
      });
    }
  }
}
```

## Breaking Changes (None)

The v-0.6.x messaging system introduces **no breaking changes**:

- ✅ Existing CLI functionality unchanged
- ✅ Event system continues working
- ✅ Configuration system unchanged  
- ✅ All v-0.5.x APIs remain available
- ✅ No required changes to existing code

## Recommended Migration Steps

### Step 1: Install and Import
```typescript
// Add to your existing imports
import { QiAsyncMessageQueue, QiMessageFactory } from '@qi/agent/messaging';
```

### Step 2: Create Queue Infrastructure
```typescript
// Set up message processing infrastructure
const messageQueue = new QiAsyncMessageQueue({
  priorityQueuing: true,
  enableStats: true
});
const messageFactory = new QiMessageFactory();
```

### Step 3: Identify Integration Points
Choose where to introduce messaging:
- User input processing
- Command execution
- Error handling
- Agent response generation

### Step 4: Gradual Integration
Start with one integration point and expand:

```typescript
// Week 1: User input
routeUserInputToQueue(input);

// Week 2: Add commands  
routeCommandsToQueue(commands);

// Week 3: Add error handling
routeErrorsToQueue(errors);

// Week 4: Full processing loop
implementFullMessageProcessing();
```

### Step 5: Monitoring and Optimization
```typescript
// Monitor queue performance
const statsResult = messageQueue.getStats();
match(
  stats => {
    console.log('Queue performance:', {
      totalMessages: stats.totalMessages,
      errorRate: stats.errorRate,
      avgProcessingTime: stats.averageProcessingTime
    });
  },
  error => console.error('Stats unavailable:', error.message),
  statsResult
);
```

## Common Integration Patterns

### Priority Handling
```typescript
// Route urgent messages to high priority
const urgentMessageResult = messageFactory.createSystemControlMessage('pause');
match(
  message => {
    // This will be processed before normal messages
    messageQueue.enqueue(message);
  },
  error => console.error('Urgent message failed:', error.message),
  urgentMessageResult
);
```

### Request-Response Patterns
```typescript
// Create correlated request-response pairs
const commandResult = messageFactory.createCommandMessage('execute', ['task'], context);

match(
  command => {
    messageQueue.enqueue(command);
    
    // Later, create correlated response
    const responseResult = messageFactory.createResponseMessage(
      command,
      { success: true },
      1500 // execution time
    );
    
    match(
      response => {
        console.log('Response correlationId:', response.correlationId);
        messageQueue.enqueue(response);
      },
      error => console.error('Response creation failed:', error.message),
      responseResult
    );
  },
  error => console.error('Command creation failed:', error.message),
  commandResult
);
```

### Error Recovery Integration
```typescript
// Integrate with existing error handling
const existingErrorHandler = (error: Error) => {
  // Your existing error handling
  console.error('Error:', error.message);
  
  // Enhanced: Route to message queue for structured processing
  const errorMessageResult = messageFactory.createMessage(MessageType.AGENT_ERROR, {
    error: {
      code: 'PROCESSING_ERROR',
      message: error.message,
      category: 'SYSTEM',
      context: {}
    },
    context: { timestamp: new Date() }
  });
  
  match(
    errorMessage => {
      messageQueue.enqueue(errorMessage);
    },
    err => console.error('Error message creation failed:', err.message),
    errorMessageResult
  );
};
```

## Performance Considerations

### Queue Configuration for Different Use Cases

**High Throughput:**
```typescript
const highThroughputQueue = new QiAsyncMessageQueue({
  maxSize: 10000,
  priorityQueuing: false,  // Faster without priority sorting
  enableStats: false,      // Disable for better performance
  autoCleanup: false       // Manual cleanup for control
});
```

**Real-time Processing:**
```typescript
const realtimeQueue = new QiAsyncMessageQueue({
  maxSize: 100,           // Small queue for low latency
  priorityQueuing: true,  // Urgent messages first
  messageTtl: 5000,       // Short TTL for freshness
  enableStats: true       // Monitor performance
});
```

**Batch Processing:**
```typescript
const batchQueue = new QiAsyncMessageQueue({
  maxSize: 0,             // Unlimited for large batches
  priorityQueuing: false, // FIFO processing
  enableStats: true,      // Track batch metrics
  autoCleanup: true       // Prevent memory leaks
});
```

## Troubleshooting

### Common Issues and Solutions

**Issue: Messages not being processed**
```typescript
// Check queue state
const stateResult = messageQueue.getState();
match(
  state => {
    if (!state.started) {
      console.log('Queue not started - create iterator');
      // Start processing: for await (const message of messageQueue)
    }
    if (state.isDone) {
      console.log('Queue is done - no more processing');
    }
    if (state.hasError) {
      console.log('Queue has errors - check error handling');
    }
  },
  error => console.error('State check failed:', error.message),
  stateResult
);
```

**Issue: Memory usage growing**
```typescript
// Check queue size and enable cleanup
const sizeResult = messageQueue.size();
match(
  size => {
    if (size > 1000) {
      console.warn('Large queue detected:', size);
      
      // Enable cleanup or clear queue
      const clearResult = messageQueue.clear();
      match(
        clearedCount => console.log('Cleared', clearedCount, 'messages'),
        error => console.error('Clear failed:', error.message),
        clearResult
      );
    }
  },
  error => console.error('Size check failed:', error.message),
  sizeResult
);
```

**Issue: Performance degradation**
```typescript
// Check statistics and optimize
const statsResult = messageQueue.getStats();
match(
  stats => {
    if (stats && stats.errorRate > 0.1) {
      console.warn('High error rate:', stats.errorRate);
    }
    if (stats && stats.averageProcessingTime > 1000) {
      console.warn('Slow processing:', stats.averageProcessingTime + 'ms');
    }
    
    console.log('Queue metrics:', {
      queueLength: stats?.queueLength,
      totalMessages: stats?.totalMessages,
      errorRate: stats?.errorRate
    });
  },
  error => console.error('Stats unavailable:', error.message),
  statsResult
);
```

## Next Steps

After successful migration to v-0.6.x:

1. **Monitor Performance**: Use queue statistics to optimize configuration
2. **Expand Integration**: Gradually move more functionality to message-based processing
3. **Prepare for v-0.7.x**: Message queue foundation enables advanced tool coordination
4. **Document Patterns**: Create team-specific patterns for your use cases

## Support and Resources

- **Documentation**: [README.md](./README.md) - Comprehensive usage guide
- **API Reference**: [api-reference.md](./api-reference.md) - Complete API documentation  
- **Examples**: `lib/tests/messaging/` - Working examples and test cases
- **Architecture**: `docs/architecture/v-0.6.x-message-queue-design.md` - Design decisions

The v-0.6.x messaging system provides a solid foundation for advanced async processing while maintaining full compatibility with your existing v-0.5.x infrastructure.