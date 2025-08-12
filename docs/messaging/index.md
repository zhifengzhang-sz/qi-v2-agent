# v-0.6.x Messaging Module Documentation

H2A-inspired async message queue system with QiCore functional programming integration.

## Documentation Structure

### 🚀 [**README.md**](README.md)
**Complete user guide and tutorial**
- Quick start examples
- Core component overview  
- Advanced features and patterns
- Best practices and integration examples
- Performance optimization tips

### 📚 [**API Reference**](api-reference.md)
**Comprehensive API documentation**
- Full type definitions and interfaces
- Method signatures with parameters and return types
- Error handling patterns
- Usage examples for each method
- Type guards and utility functions

### 🔄 [**Migration Guide**](migration-guide.md)
**v-0.5.x to v-0.6.x migration**
- Integration strategies with existing components
- Migration patterns and examples
- Breaking changes (none!) and compatibility notes
- Performance considerations
- Troubleshooting common issues

## Key Features

### ✨ **H2A-Inspired Architecture**
- Non-blocking async iteration with Promise-based flow control
- Real-time message injection during processing
- Dual-buffer system for optimal performance

### 🏗️ **Type-Safe Message System**
- 15+ strongly-typed message formats
- Automatic ID generation and validation
- Request-response correlation patterns
- Priority-based processing (CRITICAL → HIGH → NORMAL → LOW)

### 🧮 **QiCore Integration**
- Full `Result<T, E>` functional error handling
- No exceptions - pure functional composition
- `match()` pattern for all error handling
- Proper QiCore coding patterns throughout

### ⚡ **Advanced Features**
- Priority queuing with automatic ordering
- Message TTL and automatic cleanup
- Statistics and monitoring
- Pause/resume processing control
- Resource cleanup and lifecycle management

## Quick Reference

```typescript
import { 
  QiAsyncMessageQueue, 
  QiMessageFactory,
  MessageType,
  MessagePriority 
} from '@qi/agent/messaging';
import { match } from '@qi/base';

// Create components
const factory = new QiMessageFactory();
const queue = new QiAsyncMessageQueue({ priorityQueuing: true });

// Create message
const messageResult = factory.createUserInputMessage('Hello!', 'cli');

// Enqueue message
match(
  message => {
    const enqueueResult = queue.enqueue(message);
    match(
      () => console.log('Enqueued successfully'),
      error => console.error('Enqueue failed:', error.message),
      enqueueResult
    );
  },
  error => console.error('Message creation failed:', error.message),
  messageResult
);

// Process messages
queue.done(); // Signal completion
for await (const message of queue) {
  console.log('Processing:', message.type);
}
```

## Architecture Context

The v-0.6.x messaging system provides the async processing foundation for future qi-v2-agent versions:

- **v-0.5.x**: Prompt app with hybrid CLI ✅ **Current**
- **v-0.6.x**: Async message queue system ✅ **Implemented** 
- **v-0.7.x**: Tools integration with MCP + 100+ tools
- **v-0.8.x**: Workflow orchestration and extraction
- **v-0.9.x**: Complete qi-code agent implementation

## Implementation Status

| Component | Status | Description |
|-----------|--------|-------------|
| **QiAsyncMessageQueue** | ✅ Complete | H2A-inspired async message queue |
| **QiMessageFactory** | ✅ Complete | Type-safe message creation |
| **Message Types** | ✅ Complete | 15+ typed message formats |
| **Priority System** | ✅ Complete | CRITICAL → HIGH → NORMAL → LOW |
| **QiCore Integration** | ✅ Complete | Full Result<T> patterns |
| **Statistics** | ✅ Complete | Performance monitoring |
| **TTL & Cleanup** | ✅ Complete | Automatic resource management |
| **Testing** | ✅ Complete | 42/42 tests passing |
| **Documentation** | ✅ Complete | Comprehensive docs |

## Related Documentation

- **[Architecture Design](../architecture/v-0.6.x-message-queue-design.md)**: Design decisions and Claude Code analysis
- **[QiCore Tutorial](../../app/docs/qicore/tutorial.md)**: QiCore functional programming patterns  
- **[Hybrid CLI](../cli/frameworks/hybrid/)**: CLI integration examples
- **[API Reference](../api-reference.md)**: Main API documentation

## Getting Started

1. **Start with [README.md](README.md)** for comprehensive examples and usage patterns
2. **Check [API Reference](api-reference.md)** for detailed type information  
3. **Use [Migration Guide](migration-guide.md)** if integrating with existing v-0.5.x code
4. **Run tests** with `bun run test` to see working examples

## Contributing

The messaging module follows strict QiCore patterns:

- ✅ All operations return `Result<T, E>`
- ✅ Use `match()` for error handling, never try/catch
- ✅ Functional composition over imperative patterns
- ✅ Comprehensive type safety with TypeScript
- ✅ Full test coverage with proper QiCore patterns

See [CLAUDE.md](../../CLAUDE.md) for development guidelines and coding standards.