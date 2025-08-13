# Message-Driven Architecture Best Practices

*Based on lessons learned from the v0.6.1 infinite loop bug analysis*

## Core Principles

### 1. Message Flow Topology Rules

**✅ DO:**
- Design message flows as **Directed Acyclic Graphs (DAG)**
- Create **terminal message types** that don't trigger new messages
- Use **direct method calls** for immediate responses
- Document message flow paths explicitly

**❌ DON'T:**
- Create circular message dependencies
- Re-enqueue messages within the same processing cycle
- Mix synchronous calls with message enqueueing for the same data flow

### 2. Message Processing Patterns

#### Pattern: Terminal Processing
```typescript
// ✅ CORRECT - Terminal processing
case MessageType.USER_INPUT:
  const result = await this.orchestrator.process(request);
  this.cli.displayMessage(result.content); // Direct call, no re-enqueue
  break;
```

#### Anti-Pattern: Circular Enqueueing
```typescript
// ❌ WRONG - Creates infinite loop
case MessageType.USER_INPUT:
  const result = await this.orchestrator.process(request);
  this.messageQueue.enqueue({ 
    type: MessageType.AGENT_OUTPUT, 
    content: result.content 
  }); // This will be processed again!
  break;
```

### 3. Component Responsibility Matrix

| Component | Creates Messages | Consumes Messages | Direct Calls | Logging Level |
|-----------|-----------------|-------------------|--------------|---------------|
| **InkCLIFramework** | USER_INPUT | CLI_MESSAGE_RECEIVED | displayMessage() | Info/Debug |
| **QiPromptCLI** | SYSTEM_CONTROL | USER_INPUT, AGENT_OUTPUT | orchestrator.process() | Info/Debug |
| **PromptAppOrchestrator** | *(none)* | *(none)* | All internal processing | Info/Error |
| **QiAsyncMessageQueue** | *(none)* | *(all)* | Event emission only | Debug only |

### 4. Logging in Message-Driven Architecture

#### Logging Levels by Message Flow

- **Debug**: Message enqueueing, processing start/end, detailed state
- **Info**: Major state changes, component initialization, user actions
- **Warn**: Degraded conditions, retries, fallback behaviors
- **Error**: Processing failures, system errors, unrecoverable states

#### Structured Message Logging

```typescript
// Message creation logging
this.logger.debug('📤 Creating message', undefined, {
  messageType: message.type,
  messageId: message.id,
  component: 'MessageProducer',
});

// Message processing logging
this.logger.debug('⏳ Processing message', undefined, {
  messageId: message.id,
  messageType: message.type,
  component: 'MessageProcessor',
  queueSize: this.messageQueue.size,
});

// Message completion logging
this.logger.debug('✅ Message processing complete', undefined, {
  messageId: message.id,
  component: 'MessageProcessor',
  processingTime: Date.now() - startTime,
});
```

#### Performance Impact Considerations

- Use conditional debug logging for verbose message tracing
- Include timing data only when performance monitoring is enabled
- Avoid expensive serialization in hot message processing paths

## Development Guidelines

### 1. Message Design Checklist

Before adding a new message type, verify:
- [ ] **Clear Purpose**: What specific event does this message represent?
- [ ] **Single Responsibility**: Does this message have one clear purpose?
- [ ] **No Circular Dependencies**: Can this message create a processing loop?
- [ ] **Proper Ownership**: Which component creates/consumes this message?
- [ ] **Lifecycle Management**: How and when is this message cleaned up?

### 2. Code Review Checklist

For any changes involving message processing:
- [ ] **Flow Diagram**: Can you draw the message flow without cycles?
- [ ] **Terminal Verification**: Are responses displayed directly or re-enqueued?
- [ ] **Error Boundaries**: What happens if message processing fails?
- [ ] **Performance Impact**: Will this change affect message processing speed?
- [ ] **Memory Cleanup**: Are all references properly cleaned up?

### 3. Testing Requirements

Every message flow must have:
- [ ] **Unit Tests**: Test individual message type processing
- [ ] **Integration Tests**: Test complete user scenarios
- [ ] **Loop Detection Tests**: Verify no infinite processing
- [ ] **Performance Tests**: Measure processing time and memory usage
- [ ] **Error Recovery Tests**: Test failure modes and recovery

## Debugging Techniques

### 1. Message Flow Tracing

Add comprehensive logging for message lifecycle using QiCore logger:
```typescript
// At message creation
this.logger.debug('📤 Creating message', undefined, {
  messageType,
  messageId: id,
  component: 'MessageFactory',
  trace: 'creation',
});

// At message processing start
this.logger.debug('⏳ Processing message', undefined, {
  messageType,
  messageId: id,
  component: 'MessageProcessor',
  trace: 'processing_start',
});

// At message processing completion
this.logger.debug('✅ Message processing complete', undefined, {
  messageType,
  messageId: id,
  component: 'MessageProcessor',
  trace: 'processing_complete',
  processingTime: Date.now() - startTime,
});

// At message enqueueing
this.logger.debug('📥 Enqueuing message', undefined, {
  messageType,
  messageId: id,
  component: 'MessageQueue',
  trace: 'enqueueing',
  queueSize: this.messageQueue.size,
});
```

### 2. Loop Detection Utilities

```typescript
import { createLogger } from '@qi/core';
import { match } from '@qi/base';

class MessageLoopDetector {
  private processedMessages = new Set<string>();
  private processingStack: string[] = [];
  private logger: Logger;

  constructor() {
    const loggerResult = createLogger({ level: 'error', pretty: true });
    this.logger = match(logger => logger, () => fallbackLogger, loggerResult);
  }

  checkForLoop(messageId: string, messageType: string): boolean {
    if (this.processingStack.includes(messageId)) {
      this.logger.error('🔄 Message processing loop detected', undefined, {
        component: 'MessageLoopDetector',
        messageType,
        messageId,
        processingStack: this.processingStack,
        stackDepth: this.processingStack.length,
      });
      return true;
    }
    return false;
  }

  startProcessing(messageId: string): void {
    this.processingStack.push(messageId);
  }

  endProcessing(messageId: string): void {
    const index = this.processingStack.indexOf(messageId);
    if (index !== -1) {
      this.processingStack.splice(index, 1);
    }
    this.processedMessages.add(messageId);
  }
}
```

### 3. Performance Monitoring

```typescript
class MessagePerformanceMonitor {
  private metrics = new Map<string, {
    count: number;
    totalTime: number;
    maxTime: number;
    errors: number;
  }>();

  recordProcessing(messageType: string, processingTime: number, error?: Error): void {
    const stats = this.metrics.get(messageType) || { 
      count: 0, totalTime: 0, maxTime: 0, errors: 0 
    };
    
    stats.count++;
    stats.totalTime += processingTime;
    stats.maxTime = Math.max(stats.maxTime, processingTime);
    if (error) stats.errors++;
    
    this.metrics.set(messageType, stats);
  }

  getStats(): Record<string, any> {
    const result: Record<string, any> = {};
    this.metrics.forEach((stats, messageType) => {
      result[messageType] = {
        ...stats,
        averageTime: stats.totalTime / stats.count,
        errorRate: stats.errors / stats.count
      };
    });
    return result;
  }
}
```

## Architecture Evolution Guidelines

### 1. Adding New Message Types

When adding new message types, follow this process:
1. **Design Phase**: Create flow diagram showing all message paths
2. **Review Phase**: Verify no circular dependencies in design
3. **Implementation Phase**: Add loop detection and performance monitoring
4. **Testing Phase**: Test complete flows and error scenarios
5. **Documentation Phase**: Update architecture docs and flow diagrams

### 2. Refactoring Existing Flows

When modifying existing message flows:
1. **Document Current State**: Map existing message flows
2. **Identify Changes**: Show what message paths will change
3. **Verify Safety**: Ensure no new circular dependencies
4. **Incremental Migration**: Change one message type at a time
5. **Validation**: Test each change before proceeding

### 3. Performance Optimization

For performance improvements:
1. **Measure First**: Use performance monitoring to identify bottlenecks
2. **Optimize Message Creation**: Reduce message object creation overhead
3. **Batch Processing**: Group related messages where possible
4. **Queue Management**: Optimize queue data structures and algorithms
5. **Memory Management**: Implement proper cleanup and TTL policies

## Common Pitfalls and Solutions

### Pitfall 1: "Message Ping-Pong"
**Problem**: Two components sending messages back and forth
**Solution**: Designate one component as the "orchestrator" for the flow

### Pitfall 2: "Silent Message Loss"
**Problem**: Messages enqueued but never processed
**Solution**: Add message queue monitoring and timeouts

### Pitfall 3: "Synchronous Message Dependencies"
**Problem**: Blocking on message responses in synchronous code
**Solution**: Use async/await patterns or direct method calls

### Pitfall 4: "Message Type Explosion"
**Problem**: Too many similar message types
**Solution**: Use message metadata/payloads instead of new types

### Pitfall 5: "Debug Log Noise"
**Problem**: Too much logging makes debugging harder
**Solution**: Use structured logging with configurable levels

## Conclusion

The key insight from the infinite loop bug is that **message flow topology** is a first-class architectural concern. Just as we design class hierarchies and module dependencies carefully, we must design message flows with the same rigor.

**Remember**: In message-driven architectures, the connections between components are as important as the components themselves.

## Quick Reference

**Before any message-related change, ask:**
1. "Does this create a cycle in the message flow?"
2. "Is this the right boundary between sync and async processing?"
3. "How will I debug this if it goes wrong?"
4. "What happens if this message is processed twice?"
5. "How will this perform under load?"

**For any bug involving infinite loops or hanging:**
1. Trace the complete message flow from start to finish
2. Look for re-enqueueing patterns in message processors  
3. Check for multiple iterators on the same queue
4. Verify terminal processing vs. forwarding patterns
5. Add comprehensive logging and monitor for patterns