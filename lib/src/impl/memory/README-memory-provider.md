# Memory Provider Implementation

## Overview

The `MultiModalMemoryProvider` implements the `IMemoryProvider` interface, providing comprehensive session management, conversation state tracking, and processing event logging for the qi-v2 agent framework.

## Features

### 🔧 **Three Storage Modes**
- **Memory**: In-memory only (fast, non-persistent)
- **File**: File-based persistence (persistent, slower)
- **Hybrid**: In-memory with file backup (fast + persistent)

### 📊 **Session Management**
- Create, retrieve, update, and delete user sessions
- Session metadata and context tracking
- Automatic session cleanup based on TTL (Time-To-Live)

### 💬 **Conversation State**
- Store and retrieve conversation messages
- Track current cognitive patterns
- Maintain conversation context

### 📈 **Processing Events**
- Log all processing events (input, pattern detection, tool execution, etc.)
- Retrieve processing history with optional limits
- Automatic event limiting per session

### 🧹 **Automatic Cleanup**
- Configurable session TTL
- Automatic cleanup timer
- Manual cleanup support
- Orphaned data cleanup

## Quick Start

### Basic Usage (In-Memory)

```typescript
import { createInMemoryProvider } from '@qi/lib';

const memoryProvider = createInMemoryProvider({
  maxSessions: 1000,
  maxEventsPerSession: 500,
  sessionTTL: 24 * 60 * 60 * 1000 // 24 hours
});

await memoryProvider.initialize();

// Create a session
const session = await memoryProvider.createSession('coding', 
  new Map([['userId', 'user123']])
);

// Save conversation state
const conversationState = {
  sessionId: session.sessionId,
  messages: [
    { role: 'user', content: 'Hello!', metadata: new Map() },
    { role: 'assistant', content: 'Hi there!', metadata: new Map() }
  ],
  context: new Map([['lastAction', 'greeting']]),
  lastUpdated: new Date()
};

await memoryProvider.saveConversationState(conversationState);

// Add processing events
await memoryProvider.addProcessingEvent({
  eventId: 'evt-001',
  sessionId: session.sessionId,
  timestamp: new Date(),
  type: 'input',
  data: new Map([['content', 'Hello!']])
});
```

### File-Based Persistence

```typescript
import { createFileBasedProvider } from '@qi/lib';

const memoryProvider = createFileBasedProvider('./agent-memory', {
  maxSessions: 10000,
  autoCleanup: true,
  cleanupInterval: 60 * 60 * 1000 // 1 hour
});

await memoryProvider.initialize();
// Provider will automatically load existing sessions from disk
```

### Hybrid Mode (Best of Both)

```typescript
import { createHybridProvider } from '@qi/lib';

const memoryProvider = createHybridProvider('./agent-memory', {
  maxSessions: 1000,
  sessionTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  enableCompression: true
});

await memoryProvider.initialize();
// Fast in-memory access with automatic file backup
```

## Configuration Options

```typescript
interface MemoryProviderConfig {
  readonly type: 'memory' | 'file' | 'hybrid';
  readonly persistenceDir?: string;           // Directory for file storage
  readonly maxSessions?: number;              // Max sessions to keep (default: 1000)
  readonly maxEventsPerSession?: number;      // Max events per session (default: 1000)
  readonly sessionTTL?: number;               // Session TTL in ms (default: 24h)
  readonly enableCompression?: boolean;       // Enable file compression (default: false)
  readonly autoCleanup?: boolean;             // Enable auto cleanup (default: true)
  readonly cleanupInterval?: number;          // Cleanup interval in ms (default: 1h)
}
```

## API Reference

### Session Management

```typescript
// Create a new session
const session = await memoryProvider.createSession(
  domain: string,
  metadata?: ReadonlyMap<string, unknown>
): Promise<SessionContext>

// Get existing session
const session = await memoryProvider.getSession(
  sessionId: string
): Promise<SessionContext | null>

// Update session metadata
await memoryProvider.updateSession(
  sessionId: string,
  metadata: ReadonlyMap<string, unknown>
): Promise<void>

// Delete session
await memoryProvider.deleteSession(sessionId: string): Promise<void>
```

### Conversation State

```typescript
// Save conversation state
await memoryProvider.saveConversationState(
  state: ConversationState
): Promise<void>

// Get conversation state
const state = await memoryProvider.getConversationState(
  sessionId: string
): Promise<ConversationState | null>
```

### Processing Events

```typescript
// Add processing event
await memoryProvider.addProcessingEvent(
  event: ProcessingEvent
): Promise<void>

// Get processing history
const history = await memoryProvider.getProcessingHistory(
  sessionId: string,
  limit?: number
): Promise<readonly ProcessingEvent[]>
```

### Maintenance

```typescript
// Manual cleanup
await memoryProvider.cleanup(): Promise<void>

// Get statistics
const stats = memoryProvider.getStatistics(): {
  activeSessions: number;
  totalConversationStates: number;
  totalProcessingEvents: number;
  memoryUsage: { sessions: number; conversations: number; events: number };
}

// Shutdown (clean up resources)
await memoryProvider.shutdown(): Promise<void>
```

## Integration with Agent

```typescript
import { PracticalAgent, createHybridProvider } from '@qi/lib';

const memoryProvider = createHybridProvider('./agent-memory');
await memoryProvider.initialize();

const agent = new PracticalAgent({
  // ... other configuration
  memoryProvider
});

// The agent will automatically use the memory provider for:
// - Session tracking
// - Conversation state persistence
// - Processing event logging
```

## File Storage Structure

When using file or hybrid mode, the storage structure is:

```
agent-memory/
├── sessions/
│   ├── session-id-1.json
│   ├── session-id-2.json
│   └── ...
├── conversations/
│   ├── session-id-1.json
│   ├── session-id-2.json
│   └── ...
└── events/
    ├── session-id-1.json
    ├── session-id-2.json
    └── ...
```

## Performance Considerations

### Memory Mode
- **Pros**: Very fast access, no I/O overhead
- **Cons**: Data lost on restart, limited by RAM
- **Use case**: Development, testing, temporary sessions

### File Mode
- **Pros**: Full persistence, unlimited storage
- **Cons**: I/O overhead, slower access
- **Use case**: Production with strong persistence requirements

### Hybrid Mode (Recommended)
- **Pros**: Fast access + persistence, best of both worlds
- **Cons**: More complex, higher memory usage
- **Use case**: Production environments

## Testing

The memory provider includes comprehensive tests covering:

- Session management (CRUD operations)
- Conversation state persistence
- Processing event logging
- TTL and cleanup functionality
- Statistics and monitoring
- All three storage modes

Run tests with:
```bash
bun test src/impl/__tests__/memory-provider.test.ts
```

## Error Handling

The memory provider handles common error scenarios:

- **Missing sessions**: Returns `null` instead of throwing
- **File system errors**: Graceful degradation with logging
- **Corrupted data**: Skip invalid entries, continue operation
- **Resource limits**: Automatic cleanup when limits exceeded

## Security Considerations

- **File permissions**: Ensure storage directory has appropriate permissions
- **Data sensitivity**: Consider encryption for sensitive conversation data
- **Session isolation**: Each session is isolated, no cross-session data leakage
- **Cleanup**: Automatic cleanup prevents data accumulation

## Monitoring and Debugging

The memory provider provides extensive logging:

```typescript
// Enable debug logging in your agent configuration
const memoryProvider = createHybridProvider('./agent-memory', {
  // ... configuration
});

// Monitor statistics
setInterval(() => {
  const stats = memoryProvider.getStatistics();
  console.log('Memory Provider Stats:', stats);
}, 60000); // Every minute
```

Log levels include:
- Session creation/deletion
- Conversation state updates
- Processing event additions
- Cleanup operations
- Error conditions

This comprehensive memory provider ensures reliable session management and data persistence for the qi-v2 agent framework.