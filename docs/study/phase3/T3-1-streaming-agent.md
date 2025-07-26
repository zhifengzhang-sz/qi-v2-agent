# T3-1: Streaming Agent Implementation

## Overview

This guide implements enhanced LangGraph agent with real-time streaming capabilities using v0.3.11. Based on research findings, LangGraph provides first-class streaming support with multiple modes and excellent TypeScript integration.

## Prerequisites

- Phase 2 complete with basic LangGraph agent
- @langchain/langgraph v0.3.11+ installed
- Understanding of existing agent architecture

## Current Technology Status (Research-Based)

**LangGraph v0.3.11 Status:**
- ✅ Current version (published days ago from research)
- ✅ First-class streaming support built-in
- ✅ Excellent TypeScript support with type inference
- ✅ Multiple JS runtime support (Node, Deno, Cloudflare Workers, Vercel Edge)

## Implementation Strategy

### Step 1: Extend Existing qi-v2 agentFactory

**File: `lib/src/agent/factory.ts` (Enhancement)**
```typescript
// Add to existing qi-v2 agentFactory class

export class qi-v2 agentFactory {
  // ... existing properties ...
  private streamingModes = ['messages', 'values', 'updates', 'custom'] as const;
  private currentStreamMode: typeof this.streamingModes[number] = 'messages';

  // ... existing constructor and methods ...

  // Enhanced streaming method with multiple modes
  async streamWithMode(
    messages: AgentMessage[],
    streamMode: 'messages' | 'values' | 'updates' | 'custom' = 'messages',
    options: StreamingOptions = {},
    threadId?: string
  ): Promise<void> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const { onToken, onUpdate, onComplete, onError, controller } = options;
    this.currentStreamMode = streamMode;

    try {
      const langchainMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const config = {
        ...(threadId && this.memorySaver && { configurable: { thread_id: threadId } }),
        ...(controller && { signal: controller.signal }),
      };

      // Use the specified streaming mode
      const stream = await this.agent.stream(
        { messages: langchainMessages },
        { ...config, streamMode }
      );

      await this.processStreamByMode(stream, streamMode, { onToken, onUpdate, onComplete });
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
      throw errorObj;
    }
  }

  private async processStreamByMode(
    stream: any,
    mode: 'messages' | 'values' | 'updates' | 'custom',
    callbacks: { onToken?: (token: string) => void; onUpdate?: (update: any) => void; onComplete?: (result: any) => void }
  ) {
    const { onToken, onUpdate, onComplete } = callbacks;
    let fullResponse = '';

    for await (const chunk of stream) {
      switch (mode) {
        case 'messages':
          // Token-by-token streaming with LLM metadata
          if (chunk.messages && chunk.messages.length > 0) {
            const lastMessage = chunk.messages[chunk.messages.length - 1];
            if (lastMessage.content) {
              const content = lastMessage.content;
              fullResponse += content;
              onToken?.(content);
            }
          }
          break;
          
        case 'values':
          // Full state value after each step
          onUpdate?.({
            type: 'state',
            value: chunk,
            timestamp: new Date().toISOString()
          });
          break;
          
        case 'updates':
          // State updates after each step
          onUpdate?.({
            type: 'update',
            delta: chunk,
            timestamp: new Date().toISOString()
          });
          break;
          
        case 'custom':
          // Custom data from graph nodes
          onUpdate?.({
            type: 'custom',
            data: chunk,
            timestamp: new Date().toISOString()
          });
          break;
      }
    }

    onComplete?.(fullResponse || chunk);
  }

  // Get current streaming mode info
  getStreamingInfo(): { availableModes: string[]; currentMode: string } {
    return {
      availableModes: [...this.streamingModes],
      currentMode: this.currentStreamMode
    };
  }
```

### Step 2: Streaming Modes Implementation

**File: `src/agents/streaming-handler.ts`**
```typescript
import type { StateGraph } from '@langchain/langgraph';

export class StreamingHandler {
  private agent: StateGraph;
  private streamMode: 'messages' | 'values' | 'updates' | 'custom';

  constructor(agent: StateGraph, streamMode: 'messages' | 'values' | 'updates' | 'custom') {
    this.agent = agent;
    this.streamMode = streamMode;
  }

  async *streamResponse(input: any, config?: any) {
    console.log(`🔄 Starting stream with mode: ${this.streamMode}`);
    
    try {
      // LangGraph v0.3.11 streaming with specified mode
      const stream = this.agent.stream(input, {
        ...config,
        streamMode: this.streamMode,
        configurable: {
          thread_id: config?.thread_id || 'default-thread'
        }
      });

      for await (const chunk of stream) {
        yield this.processStreamChunk(chunk);
      }
    } catch (error) {
      console.error('❌ Streaming error:', error);
      throw error;
    }
  }

  private processStreamChunk(chunk: any) {
    switch (this.streamMode) {
      case 'messages':
        // Token-by-token streaming with LLM metadata
        return {
          type: 'message',
          content: chunk.messages?.[0]?.content || '',
          metadata: chunk.metadata || {}
        };
        
      case 'values':
        // Full state value after each step
        return {
          type: 'state',
          value: chunk,
          timestamp: new Date().toISOString()
        };
        
      case 'updates':
        // State updates after each step
        return {
          type: 'update',
          delta: chunk,
          timestamp: new Date().toISOString()
        };
        
      case 'custom':
        // Custom data from graph nodes
        return {
          type: 'custom',
          data: chunk,
          timestamp: new Date().toISOString()
        };
        
      default:
        return chunk;
    }
  }
}
```

### Step 2: Update Types for Enhanced Streaming

**File: `lib/src/utils/types.ts` (Enhancement)**
```typescript
// Add to existing types

export interface EnhancedStreamingOptions extends StreamingOptions {
  streamMode?: 'messages' | 'values' | 'updates' | 'custom';
  onUpdate?: (update: StreamUpdate) => void;
}

export interface StreamUpdate {
  type: 'state' | 'update' | 'custom';
  value?: any;
  delta?: any;
  data?: any;
  timestamp: string;
}

export interface StreamingCapabilities {
  availableModes: string[];
  currentMode: string;
  supportsRealTime: boolean;
}
```

### Step 3: Enhanced CLI Integration

**File: `app/src/cli/commands.ts` (Enhancement)**
```typescript
// Add streaming mode option to existing CLI commands

export function createCLI() {
  const program = new Command();
  
  // ... existing commands ...

  // Add streaming mode option to chat command
  program
    .command('chat')
    .description('Start interactive chat session')
    .option('-m, --stream-mode <mode>', 'Streaming mode: messages, values, updates, custom', 'messages')
    .option('--show-updates', 'Show internal state updates', false)
    .action(async (options) => {
      const config = await loadConfig();
      const agentFactory = new QiV2AgentFactory(config);
      await agentFactory.initialize();

      // Use enhanced streaming with selected mode
      await startInteractiveChat(agentFactory, {
        streamMode: options.streamMode,
        showUpdates: options.showUpdates
      });
    });

  return program;
}
```

### Step 4: Real-time Streaming Interface

**File: `src/streaming/real-time-interface.ts`**
```typescript
export class RealTimeInterface {
  private agent: any;
  
  constructor(agent: any) {
    this.agent = agent;
  }

  async processStreamingQuery(query: string, options?: {
    threadId?: string;
    streamMode?: 'messages' | 'values' | 'updates' | 'custom';
    onToken?: (token: string) => void;
    onUpdate?: (update: any) => void;
    onComplete?: (result: any) => void;
    onError?: (error: Error) => void;
  }) {
    const {
      threadId = 'default-thread',
      streamMode = 'messages',
      onToken,
      onUpdate,
      onComplete,
      onError
    } = options || {};

    try {
      console.log(`🚀 Processing streaming query: "${query}"`);
      console.log(`📡 Stream mode: ${streamMode}, Thread: ${threadId}`);

      const stream = this.agent.stream({
        messages: [{ role: 'user', content: query }]
      }, {
        streamMode,
        configurable: { thread_id: threadId }
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        // Process different chunk types
        if (streamMode === 'messages' && chunk.messages) {
          const token = chunk.messages[0]?.content || '';
          fullResponse += token;
          onToken?.(token);
        } else {
          onUpdate?.(chunk);
        }
        
        // Yield control for UI updates
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      onComplete?.({ content: fullResponse, threadId });
      
    } catch (error) {
      console.error('❌ Real-time streaming error:', error);
      onError?.(error as Error);
      throw error;
    }
  }
}
```

### Step 5: Terminal Integration Preparation

**File: `src/ui/streaming-components.ts`**
```typescript
// Preparation for Phase 4 terminal UI integration
import type { RealTimeInterface } from '../streaming/real-time-interface.js';

export interface StreamingUIOptions {
  showTokens: boolean;
  showMetadata: boolean;
  showProgress: boolean;
}

export class StreamingUIAdapter {
  private interface: RealTimeInterface;
  private options: StreamingUIOptions;

  constructor(interface: RealTimeInterface, options: StreamingUIOptions) {
    this.interface = interface;
    this.options = options;
  }

  async handleStreamingQuery(query: string) {
    // This will be integrated with Ink components in Phase 4
    return this.interface.processStreamingQuery(query, {
      onToken: (token) => {
        if (this.options.showTokens) {
          process.stdout.write(token);
        }
      },
      onUpdate: (update) => {
        if (this.options.showMetadata) {
          console.log('📊 Update:', JSON.stringify(update, null, 2));
        }
      },
      onComplete: (result) => {
        console.log('\n✅ Stream complete');
      },
      onError: (error) => {
        console.error('\n❌ Stream error:', error.message);
      }
    });
  }
}
```

## Testing & Validation

### Unit Tests

**File: `src/agents/__tests__/streaming-agent.test.ts`**
```typescript
import { describe, test, expect, vi } from 'vitest';
import { createStreamingAgent } from '../streaming-agent.js';

describe('StreamingAgent', () => {
  test('creates agent with streaming configuration', async () => {
    const mockConfig = {
      model: { name: 'llama3.2', temperature: 0.1 },
      mcp: { servers: {} },
      ui: { theme: 'dark', showTimestamps: true }
    };

    const { agent, streamMode } = await createStreamingAgent({
      config: mockConfig,
      tools: [],
      streamMode: 'messages'
    });

    expect(agent).toBeDefined();
    expect(streamMode).toBe('messages');
  });

  test('handles different streaming modes', async () => {
    const modes = ['messages', 'values', 'updates', 'custom'] as const;
    
    for (const mode of modes) {
      const mockConfig = {
        model: { name: 'llama3.2', temperature: 0.1 },
        mcp: { servers: {} },
        ui: { theme: 'dark', showTimestamps: true }
      };

      const { streamMode } = await createStreamingAgent({
        config: mockConfig,
        tools: [],
        streamMode: mode
      });

      expect(streamMode).toBe(mode);
    }
  });
});
```

### Integration Tests

**File: `src/agents/__tests__/streaming-integration.test.ts`**
```typescript
import { describe, test, expect } from 'vitest';
import { createEnhancedAgent } from '../enhanced-core-agent.js';

describe('Enhanced Streaming Agent Integration', () => {
  test('processes streaming queries end-to-end', async () => {
    const mockConfig = {
      model: { name: 'llama3.2', temperature: 0.1 },
      mcp: { servers: {} },
      ui: { theme: 'dark', showTimestamps: true }
    };

    const enhancedAgent = await createEnhancedAgent(mockConfig);
    
    // Test basic invocation
    const result = await enhancedAgent.invoke({
      messages: [{ role: 'user', content: 'Hello, test streaming' }]
    });

    expect(result).toBeDefined();
    expect(result.messages).toBeDefined();
  }, 10000); // Allow 10s for LLM response

  test('streaming handler processes chunks correctly', async () => {
    const mockConfig = {
      model: { name: 'llama3.2', temperature: 0.1 },
      mcp: { servers: {} },
      ui: { theme: 'dark', showTimestamps: true }
    };

    const enhancedAgent = await createEnhancedAgent(mockConfig);
    const chunks = [];

    // Collect streaming chunks
    const stream = enhancedAgent.stream({
      messages: [{ role: 'user', content: 'Stream test' }]
    });

    for await (const chunk of stream) {
      chunks.push(chunk);
      if (chunks.length >= 3) break; // Limit for testing
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toHaveProperty('type');
  }, 15000);
});
```

## Performance Considerations

### Streaming Optimization

```typescript
// Optimized streaming configuration
export const STREAMING_CONFIG = {
  // Buffer size for token accumulation
  TOKEN_BUFFER_SIZE: 10,
  
  // Streaming delay to prevent UI flooding
  STREAM_DELAY_MS: 50,
  
  // Maximum chunk size for processing
  MAX_CHUNK_SIZE: 1024,
  
  // Timeout for streaming operations
  STREAM_TIMEOUT_MS: 30000
};
```

### Memory Management

```typescript
export class StreamingMemoryManager {
  private activeStreams = new Map<string, any>();
  private readonly MAX_CONCURRENT_STREAMS = 5;

  registerStream(threadId: string, stream: any) {
    if (this.activeStreams.size >= this.MAX_CONCURRENT_STREAMS) {
      throw new Error('Maximum concurrent streams exceeded');
    }
    this.activeStreams.set(threadId, stream);
  }

  cleanupStream(threadId: string) {
    this.activeStreams.delete(threadId);
  }

  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }
}
```

## Success Criteria

### Functional Requirements
- [ ] **Multiple Streaming Modes**: Agent supports messages, values, updates, and custom streaming
- [ ] **Real-time Response**: Token-by-token streaming with <200ms latency
- [ ] **TypeScript Integration**: Full type safety with LangGraph v0.3.11 features
- [ ] **Error Handling**: Graceful handling of streaming errors and reconnection
- [ ] **Memory Management**: Thread-scoped state persistence and cleanup

### Performance Requirements
- [ ] **Streaming Latency**: <200ms between tokens
- [ ] **Memory Usage**: <50MB additional overhead for streaming
- [ ] **Concurrent Streams**: Support 5+ concurrent streaming sessions
- [ ] **Error Recovery**: Automatic reconnection within 5 seconds

### Integration Requirements
- [ ] **Phase 2 Compatibility**: Works with existing MCP integration
- [ ] **Configuration Support**: Configurable via YAML settings
- [ ] **Terminal UI Ready**: Prepared for Phase 4 Ink integration
- [ ] **Testing Coverage**: >90% test coverage for streaming components

## Next Steps

1. **Complete T3-2**: Integrate ChromaDB RAG system with streaming agent
2. **Prepare for T3-3**: Context retrieval integration points identified
3. **Phase 4 Integration**: Terminal UI components ready for streaming data
4. **Performance Optimization**: Benchmark and optimize streaming performance

This implementation provides the foundation for real-time AI assistant interaction, leveraging LangGraph v0.3.11's built-in streaming capabilities while maintaining compatibility with the existing Phase 2 architecture.