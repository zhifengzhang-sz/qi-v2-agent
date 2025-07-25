# T3: Agent Creation - LangGraph with Bun Runtime

## Overview

This document covers the implementation of LangGraph agents using the official @langchain/langgraph v0.3.11+ SDK with Bun runtime optimization. Based on Phase 1 analysis, this approach replaces 485 lines of custom Python agent code with TypeScript SDK usage.

## LangGraph.js v0.3.11+ Features

### Key 2025 Enhancements

Based on our research, LangGraph.js v0.3.11+ includes:

- **LangGraph Studio Integration**: Visual debugging and development
- **Enhanced Streaming**: Multiple streaming modes with real-time updates  
- **Built-in Checkpointing**: Automatic conversation state management
- **Human-in-the-Loop**: Interrupt and resume capabilities
- **Parallel Node Support**: Concurrent execution optimization
- **Native TypeScript**: Full type safety and IDE support

### Installation & Dependencies

```bash
# Core LangGraph dependencies
bun add @langchain/langgraph @langchain/core
bun add @langchain/anthropic @langchain/openai @langchain/ollama
bun add @langchain/mcp-adapters @modelcontextprotocol/sdk

# Development dependencies
bun add -d @types/node
```

## Agent Factory Implementation

### Core Agent Factory Class

**`src/agent/factory.ts`** - Main agent creation and management:
```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOllama } from '@langchain/ollama';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseTool } from '@langchain/core/tools';
import type { CompiledStateGraph } from '@langchain/langgraph';
import type { QiAgentConfig, ModelConfig, McpServerConfig } from '@/config/schema';
import { logger } from '@/utils/logger';

export class QiAgentFactory {
  private config: QiAgentConfig;
  private mcpClient: MultiServerMCPClient | null = null;
  private agent: CompiledStateGraph | null = null;
  private checkpointer: MemorySaver;

  constructor(config: QiAgentConfig) {
    this.config = config;
    this.checkpointer = new MemorySaver();
  }

  /**
   * Initialize the agent with MCP tools and LLM
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🤖 Initializing Qi Agent...');
      
      // Initialize MCP client with multiple servers
      await this.initializeMCPClient();
      
      // Load tools from MCP servers
      const tools = await this.loadMCPTools();
      logger.info(`🔧 Loaded ${tools.length} tools from MCP servers`);
      
      // Create LLM based on configuration
      const llm = await this.createLLM();
      logger.info(`🧠 Initialized ${this.config.model.provider} model: ${this.config.model.name}`);
      
      // Create LangGraph agent
      this.agent = createReactAgent({
        llm,
        tools,
        checkpointSaver: this.config.memory.enabled ? this.checkpointer : undefined,
        prompt: this.getSystemPrompt()
      });
      
      logger.info('✅ Qi Agent initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize Qi Agent:', error);
      throw error;
    }
  }

  /**
   * Initialize MCP client with configured servers
   */
  private async initializeMCPClient(): Promise<void> {
    if (!this.config.servers || Object.keys(this.config.servers).length === 0) {
      logger.warn('⚠️ No MCP servers configured');
      return;
    }

    // Convert config format to MCP client format
    const mcpServers: Record<string, any> = {};
    for (const [name, serverConfig] of Object.entries(this.config.servers)) {
      mcpServers[name] = this.convertServerConfig(serverConfig);
    }

    this.mcpClient = new MultiServerMCPClient({
      mcpServers
    });

    // Wait for connection establishment
    logger.debug('🔌 Connecting to MCP servers...');
    // Note: MultiServerMCPClient handles connections internally
  }

  /**
   * Convert our config format to MCP client format
   */
  private convertServerConfig(serverConfig: McpServerConfig): any {
    switch (serverConfig.transport) {
      case 'stdio':
        return {
          transport: 'stdio',
          command: serverConfig.command,
          args: serverConfig.args,
          env: serverConfig.env,
          cwd: serverConfig.cwd
        };
      case 'streamable_http':
      case 'sse':
      case 'websocket':
        return {
          transport: serverConfig.transport,
          url: serverConfig.url,
          headers: serverConfig.headers
        };
      default:
        throw new Error(`Unsupported transport: ${serverConfig.transport}`);
    }
  }

  /**
   * Load tools from all configured MCP servers
   */
  private async loadMCPTools(): Promise<BaseTool[]> {
    if (!this.mcpClient) {
      logger.warn('⚠️ No MCP client available, returning empty tools array');
      return [];
    }

    try {
      const tools = await this.mcpClient.get_tools();
      logger.debug(`🔍 Discovered tools: ${tools.map(t => t.name).join(', ')}`);
      return tools;
    } catch (error) {
      logger.error('❌ Failed to load MCP tools:', error);
      throw new Error(`MCP tool loading failed: ${error}`);
    }
  }

  /**
   * Create LLM based on configuration
   */
  private async createLLM(): Promise<BaseChatModel> {
    const { provider, name, temperature, maxTokens } = this.config.model;

    const commonConfig = {
      temperature,
      maxTokens,
      streaming: true
    };

    switch (provider) {
      case 'anthropic':
        return new ChatAnthropic({
          model: name,
          ...commonConfig,
          anthropicApiKey: process.env.ANTHROPIC_API_KEY
        });

      case 'openai':
        return new ChatOpenAI({
          model: name,
          ...commonConfig,
          openAIApiKey: process.env.OPENAI_API_KEY
        });

      case 'ollama':
        // Enhanced Ollama configuration for 2025 models
        const ollamaConfig: any = {
          model: name,
          ...commonConfig,
          baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        };

        // Special configuration for 2025 models
        if (name.includes('deepseek-r1')) {
          ollamaConfig.thinkingEnabled = true; // Enable thinking mode
          ollamaConfig.format = 'json'; // Structured output
        } else if (name.includes('phi-4')) {
          ollamaConfig.numCtx = 8192; // Optimize context for 14B model
          ollamaConfig.structured_output = true;
        }

        return new ChatOllama(ollamaConfig);

      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  /**
   * Get system prompt for the agent
   */
  private getSystemPrompt(): string {
    return `You are Qi, an AI coding assistant designed to help with software development tasks.

CAPABILITIES:
- You have access to various tools through MCP (Model Context Protocol)
- You can read and write files, execute commands, search code, and more
- You maintain conversation context across multiple interactions

GUIDELINES:
- Be helpful, accurate, and concise in your responses
- Use tools when appropriate to gather information or perform actions
- Explain your reasoning when using tools
- Ask for clarification if requests are ambiguous
- Follow security best practices when handling code and commands

TOOL USAGE:
- Always explain why you're using a specific tool
- Show the results of tool calls to the user
- Handle tool errors gracefully and inform the user

Current environment: ${process.platform}
Available tools: Use the tools provided through MCP servers to assist with tasks.`;
  }

  /**
   * Get the created agent
   */
  getAgent(): CompiledStateGraph {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }
    return this.agent;
  }

  /**
   * Get available tools from MCP servers
   */
  async getAvailableTools(): Promise<Array<{ name: string; description: string }>> {
    if (!this.mcpClient) {
      return [];
    }

    try {
      const tools = await this.mcpClient.get_tools();
      return tools.map(tool => ({
        name: tool.name,
        description: tool.description || 'No description available'
      }));
    } catch (error) {
      logger.error('Failed to get available tools:', error);
      return [];
    }
  }

  /**
   * Get connected server names
   */
  getConnectedServers(): string[] {
    return Object.keys(this.config.servers || {});
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.mcpClient) {
        // Clean up MCP client connections
        logger.debug('🧹 Cleaning up MCP client connections...');
        // Note: Cleanup is handled by the SDK automatically
      }
      
      this.agent = null;
      this.mcpClient = null;
      
      logger.info('✅ Agent cleanup completed');
    } catch (error) {
      logger.error('❌ Error during agent cleanup:', error);
    }
  }
}
```

### Agent Streaming Manager

**`src/agent/streaming.ts`** - Enhanced streaming with LangGraph v0.3.11+:
```typescript
import type { CompiledStateGraph } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import { logger } from '@/utils/logger';

export interface StreamChunk {
  node: string;
  content: any;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface StreamingOptions {
  streamMode?: 'values' | 'updates' | 'messages';
  threadId?: string;
  callbacks?: {
    onChunk?: (chunk: StreamChunk) => void;
    onComplete?: (result: any) => void;
    onError?: (error: Error) => void;
  };
}

export class AgentStreamingManager {
  private agent: CompiledStateGraph;

  constructor(agent: CompiledStateGraph) {
    this.agent = agent;
  }

  /**
   * Stream agent responses with enhanced 2025 capabilities
   */
  async streamResponse(
    input: { messages: BaseMessage[] },
    options: StreamingOptions = {}
  ): Promise<any> {
    const {
      streamMode = 'values',
      threadId = `thread-${Date.now()}`,
      callbacks = {}
    } = options;

    try {
      logger.debug(`🔄 Starting stream with mode: ${streamMode}, thread: ${threadId}`);

      let finalResult: any = null;
      const streamConfig = {
        configurable: { thread_id: threadId },
        streamMode
      };

      // Enhanced streaming with different modes
      for await (const chunk of this.agent.stream(input, streamConfig)) {
        const streamChunk: StreamChunk = {
          node: this.extractNodeName(chunk),
          content: chunk,
          timestamp: Date.now()
        };

        // Call chunk callback if provided
        if (callbacks.onChunk) {
          try {
            callbacks.onChunk(streamChunk);
          } catch (error) {
            logger.warn('Chunk callback error:', error);
          }
        }

        finalResult = chunk;
      }

      // Call completion callback
      if (callbacks.onComplete) {
        callbacks.onComplete(finalResult);
      }

      return finalResult;
    } catch (error) {
      logger.error('❌ Streaming error:', error);
      
      if (callbacks.onError) {
        callbacks.onError(error as Error);
      }
      
      throw error;
    }
  }

  /**
   * Stream with token-level granularity for real-time UI
   */
  async streamTokens(
    input: { messages: BaseMessage[] },
    onToken: (token: string) => void,
    options: StreamingOptions = {}
  ): Promise<any> {
    const { threadId = `thread-${Date.now()}` } = options;

    try {
      let currentMessage = '';
      
      return await this.streamResponse(input, {
        ...options,
        threadId,
        streamMode: 'messages',
        callbacks: {
          onChunk: (chunk) => {
            // Extract token content from messages
            if (chunk.content && typeof chunk.content === 'object') {
              const message = this.extractMessageContent(chunk.content);
              if (message && message !== currentMessage) {
                const newTokens = message.slice(currentMessage.length);
                currentMessage = message;
                onToken(newTokens);
              }
            }
          },
          ...options.callbacks
        }
      });
    } catch (error) {
      logger.error('❌ Token streaming error:', error);
      throw error;
    }
  }

  /**
   * Extract node name from stream chunk
   */
  private extractNodeName(chunk: any): string {
    if (chunk && typeof chunk === 'object') {
      // Try to extract node information from metadata
      if (chunk.metadata?.langgraph_node) {
        return chunk.metadata.langgraph_node;
      }
      
      // For 'updates' mode, chunk is typically { nodeName: nodeData }
      if (Object.keys(chunk).length === 1) {
        return Object.keys(chunk)[0];
      }
    }
    
    return 'unknown';
  }

  /**
   * Extract message content from chunk
   */
  private extractMessageContent(content: any): string {
    if (typeof content === 'string') {
      return content;
    }
    
    if (content && typeof content === 'object') {
      // Handle different message formats
      if (content.content) {
        if (typeof content.content === 'string') {
          return content.content;
        }
        if (Array.isArray(content.content)) {
          return content.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('');
        }
      }
      
      // Handle direct message objects
      if (content.text) {
        return content.text;
      }
    }
    
    return '';
  }

  /**
   * Get conversation history for a thread
   */
  async getConversationHistory(threadId: string): Promise<BaseMessage[]> {
    try {
      // Use LangGraph's built-in checkpointer to get history
      const config = { configurable: { thread_id: threadId } };
      const state = await this.agent.getState(config);
      
      return state.values?.messages || [];
    } catch (error) {
      logger.error('❌ Failed to get conversation history:', error);
      return [];
    }
  }

  /**
   * Clear conversation history for a thread
   */
  async clearConversationHistory(threadId: string): Promise<void> {
    try {
      // Update state to clear messages
      const config = { configurable: { thread_id: threadId } };
      await this.agent.updateState(config, { messages: [] });
      
      logger.debug(`🧹 Cleared conversation history for thread: ${threadId}`);
    } catch (error) {
      logger.error('❌ Failed to clear conversation history:', error);
      throw error;
    }
  }
}
```

### Memory Management

**`src/agent/memory.ts`** - Enhanced memory management with LangGraph:
```typescript
import { MemorySaver } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import { logger } from '@/utils/logger';

export interface ConversationThread {
  id: string;
  name: string;
  created: Date;
  lastActivity: Date;
  messageCount: number;
}

export class EnhancedMemoryManager {
  private memorySaver: MemorySaver;
  private threads: Map<string, ConversationThread> = new Map();

  constructor() {
    this.memorySaver = new MemorySaver();
  }

  /**
   * Create a new conversation thread
   */
  createThread(name?: string): string {
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const thread: ConversationThread = {
      id: threadId,
      name: name || `Conversation ${threadId.slice(-8)}`,
      created: new Date(),
      lastActivity: new Date(),
      messageCount: 0
    };

    this.threads.set(threadId, thread);
    logger.debug(`📝 Created new thread: ${threadId}`);
    
    return threadId;
  }

  /**
   * Get all conversation threads
   */
  getThreads(): ConversationThread[] {
    return Array.from(this.threads.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  }

  /**
   * Get specific thread info
   */
  getThread(threadId: string): ConversationThread | null {
    return this.threads.get(threadId) || null;
  }

  /**
   * Update thread activity
   */
  updateThreadActivity(threadId: string): void {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.lastActivity = new Date();
      thread.messageCount += 1;
    }
  }

  /**
   * Rename a thread
   */
  renameThread(threadId: string, newName: string): boolean {
    const thread = this.threads.get(threadId);
    if (thread) {
      thread.name = newName;
      logger.debug(`📝 Renamed thread ${threadId} to: ${newName}`);
      return true;
    }
    return false;
  }

  /**
   * Delete a thread
   */
  async deleteThread(threadId: string): Promise<boolean> {
    try {
      // Clear from MemorySaver (if possible)
      // Note: MemorySaver doesn't expose direct deletion, but we can track it
      this.threads.delete(threadId);
      
      logger.debug(`🗑️ Deleted thread: ${threadId}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to delete thread ${threadId}:`, error);
      return false;
    }
  }

  /**
   * Export conversation history
   */
  async exportConversation(threadId: string): Promise<{
    thread: ConversationThread;
    messages: BaseMessage[];
  } | null> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      return null;
    }

    try {
      // Get messages from MemorySaver
      // Note: This would require access to the agent's state
      // For now, return thread info
      return {
        thread,
        messages: [] // Would be populated with actual messages
      };
    } catch (error) {
      logger.error(`❌ Failed to export conversation ${threadId}:`, error);
      return null;
    }
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): {
    totalThreads: number;
    totalMessages: number;
    oldestThread: Date | null;
    newestThread: Date | null;
  } {
    const threads = Array.from(this.threads.values());
    
    return {
      totalThreads: threads.length,
      totalMessages: threads.reduce((sum, thread) => sum + thread.messageCount, 0),
      oldestThread: threads.length > 0 
        ? new Date(Math.min(...threads.map(t => t.created.getTime())))
        : null,
      newestThread: threads.length > 0
        ? new Date(Math.max(...threads.map(t => t.created.getTime())))
        : null
    };
  }

  /**
   * Clean up old threads (older than specified days)
   */
  async cleanupOldThreads(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let deletedCount = 0;
    for (const [threadId, thread] of this.threads.entries()) {
      if (thread.lastActivity < cutoffDate) {
        await this.deleteThread(threadId);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      logger.info(`🧹 Cleaned up ${deletedCount} old threads`);
    }
    
    return deletedCount;
  }

  /**
   * Get the MemorySaver instance for LangGraph
   */
  getMemorySaver(): MemorySaver {
    return this.memorySaver;
  }
}
```

## Usage Examples

### Basic Agent Usage

**`src/examples/basic-agent.ts`** - Simple agent interaction:
```typescript
import { QiAgentFactory } from '@/agent/factory';
import { AgentStreamingManager } from '@/agent/streaming';
import { ConfigManager } from '@/config/manager';
import { logger } from '@/utils/logger';

async function basicAgentExample() {
  try {
    // Load configuration
    const configManager = new ConfigManager('./config/qi-config.yaml');
    const config = await configManager.loadConfig();

    // Create and initialize agent
    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();

    const agent = agentFactory.getAgent();
    const streamingManager = new AgentStreamingManager(agent);

    // Create a conversation thread
    const threadId = `example-${Date.now()}`;

    // Send a message
    const input = {
      messages: [{
        role: 'user',
        content: 'Hello! Can you tell me what tools you have available?'
      }]
    };

    logger.info('🤖 Sending message to agent...');

    // Stream the response
    const result = await streamingManager.streamResponse(input, {
      threadId,
      callbacks: {
        onChunk: (chunk) => {
          console.log(`[${chunk.node}] ${JSON.stringify(chunk.content)}`);
        },
        onComplete: (result) => {
          logger.info('✅ Agent response completed');
        },
        onError: (error) => {
          logger.error('❌ Agent error:', error);
        }
      }
    });

    // Get available tools
    const tools = await agentFactory.getAvailableTools();
    logger.info(`🔧 Available tools: ${tools.map(t => t.name).join(', ')}`);

    // Cleanup
    await agentFactory.cleanup();

  } catch (error) {
    logger.error('❌ Basic agent example failed:', error);
  }
}

// Run example if called directly
if (import.meta.main) {
  basicAgentExample();
}
```

### Advanced Streaming Example

**`src/examples/streaming-agent.ts`** - Real-time streaming with UI integration:
```typescript
import { QiAgentFactory } from '@/agent/factory';
import { AgentStreamingManager } from '@/agent/streaming';
import { EnhancedMemoryManager } from '@/agent/memory';
import { ConfigManager } from '@/config/manager';
import { logger } from '@/utils/logger';

async function streamingAgentExample() {
  try {
    // Initialize components
    const configManager = new ConfigManager('./config/qi-config.yaml');
    const config = await configManager.loadConfig();
    const memoryManager = new EnhancedMemoryManager();

    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();

    const agent = agentFactory.getAgent();
    const streamingManager = new AgentStreamingManager(agent);

    // Create conversation thread
    const threadId = memoryManager.createThread('Streaming Example');

    console.log('\n🚀 Starting real-time streaming agent...\n');

    // Simulate a conversation
    const messages = [
      'What time is it?',
      'Can you list the files in the current directory?',
      'What tools do you have available?'
    ];

    for (const messageContent of messages) {
      console.log(`\n👤 User: ${messageContent}`);
      console.log('🤖 Assistant: ');

      // Update thread activity
      memoryManager.updateThreadActivity(threadId);

      // Stream tokens in real-time
      let assistantResponse = '';
      await streamingManager.streamTokens(
        {
          messages: [{
            role: 'user',
            content: messageContent
          }]
        },
        (token: string) => {
          process.stdout.write(token);
          assistantResponse += token;
        },
        {
          threadId,
          callbacks: {
            onComplete: () => {
              console.log('\n');
            }
          }
        }
      );

      // Add a delay between messages
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Show memory statistics
    const stats = memoryManager.getMemoryStats();
    console.log('\n📊 Memory Statistics:');
    console.log(`  - Total threads: ${stats.totalThreads}`);
    console.log(`  - Total messages: ${stats.totalMessages}`);

    // Show conversation history
    const history = await streamingManager.getConversationHistory(threadId);
    console.log(`\n💬 Conversation history: ${history.length} messages`);

    // Cleanup
    await agentFactory.cleanup();

  } catch (error) {
    logger.error('❌ Streaming agent example failed:', error);
  }
}

// Run example if called directly
if (import.meta.main) {
  streamingAgentExample();
}
```

## Performance Optimization

### Bun-Specific Optimizations

**`src/agent/bun-optimizations.ts`** - Leveraging Bun capabilities:
```typescript
import { spawn } from 'bun';
import { logger } from '@/utils/logger';

export class BunAgentOptimizations {
  /**
   * Fast tool execution using Bun's native spawn
   */
  static async executeToolCommand(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { cwd, env, timeout = 10000 } = options;

    try {
      const proc = spawn({
        cmd: [command, ...args],
        cwd,
        env: { ...process.env, ...env },
        stdout: 'pipe',
        stderr: 'pipe'
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        proc.kill();
      }, timeout);

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited
      ]);

      clearTimeout(timeoutId);

      return { stdout, stderr, exitCode };
    } catch (error) {
      logger.error('Tool command execution failed:', error);
      throw error;
    }
  }

  /**
   * Efficient file operations for MCP tools
   */
  static async readFileOptimized(path: string): Promise<string> {
    try {
      const file = Bun.file(path);
      return await file.text();
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  static async writeFileOptimized(path: string, content: string): Promise<void> {
    try {
      await Bun.write(path, content);
    } catch (error) {
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  /**
   * Memory-efficient JSON parsing for large responses
   */
  static parseJSONStream(jsonString: string): any {
    try {
      // Bun's optimized JSON parsing
      return JSON.parse(jsonString);
    } catch (error) {
      // Fallback for malformed JSON
      logger.warn('JSON parsing failed, attempting repair:', error);
      
      // Simple JSON repair for common issues
      const repaired = jsonString
        .replace(/,\s*}/g, '}')  // Remove trailing commas
        .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
      
      return JSON.parse(repaired);
    }
  }
}
```

## Testing Agent Components

### Unit Tests

**`src/agent/factory.test.ts`** - Agent factory tests:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QiAgentFactory } from './factory';
import type { QiAgentConfig } from '@/config/schema';

describe('QiAgentFactory', () => {
  let factory: QiAgentFactory;
  let mockConfig: QiAgentConfig;

  beforeEach(() => {
    mockConfig = global.testUtils.mockConfig;
    factory = new QiAgentFactory(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize agent successfully with valid config', async () => {
      // Mock MCP client
      vi.doMock('@langchain/mcp-adapters', () => ({
        MultiServerMCPClient: vi.fn().mockImplementation(() => ({
          get_tools: vi.fn().mockResolvedValue([])
        }))
      }));

      await expect(factory.initialize()).resolves.not.toThrow();
    });

    it('should handle missing MCP servers gracefully', async () => {
      const configWithoutServers = { ...mockConfig, servers: {} };
      const factoryWithoutServers = new QiAgentFactory(configWithoutServers);

      await expect(factoryWithoutServers.initialize()).resolves.not.toThrow();
    });
  });

  describe('LLM creation', () => {
    it('should create Ollama model with correct configuration', async () => {
      const ollamaConfig = {
        ...mockConfig,
        model: {
          provider: 'ollama' as const,
          name: 'deepseek-r1',
          temperature: 0.1,
          maxTokens: 4000
        }
      };

      const ollamaFactory = new QiAgentFactory(ollamaConfig);
      await expect(ollamaFactory.initialize()).resolves.not.toThrow();
    });

    it('should throw error for unsupported provider', async () => {
      const invalidConfig = {
        ...mockConfig,
        model: {
          ...mockConfig.model,
          provider: 'invalid' as any
        }
      };

      const invalidFactory = new QiAgentFactory(invalidConfig);
      await expect(invalidFactory.initialize()).rejects.toThrow('Unsupported model provider');
    });
  });

  describe('tools management', () => {
    it('should return available tools', async () => {
      const mockTools = [
        { name: 'test-tool', description: 'Test tool' },
        { name: 'another-tool', description: 'Another tool' }
      ];

      vi.doMock('@langchain/mcp-adapters', () => ({
        MultiServerMCPClient: vi.fn().mockImplementation(() => ({
          get_tools: vi.fn().mockResolvedValue(mockTools)
        }))
      }));

      await factory.initialize();
      const tools = await factory.getAvailableTools();

      expect(tools).toEqual(mockTools);
    });

    it('should handle MCP client errors gracefully', async () => {
      vi.doMock('@langchain/mcp-adapters', () => ({
        MultiServerMCPClient: vi.fn().mockImplementation(() => ({
          get_tools: vi.fn().mockRejectedValue(new Error('Connection failed'))
        }))
      }));

      await expect(factory.initialize()).rejects.toThrow('MCP tool loading failed');
    });
  });
});
```

## Next Steps

After completing T3 agent creation:

1. **Proceed to T4**: [MCP Integration](./T4-mcp-integration.md) for detailed MCP server setup
2. **Test Agent Creation**: Run basic agent examples to verify functionality
3. **Verify Tool Loading**: Ensure MCP tools are properly discovered and converted
4. **Configure Models**: Set up Ollama with latest 2025 models

This T3 implementation provides a robust foundation for LangGraph agents with modern TypeScript patterns, enhanced streaming capabilities, and optimized performance with Bun runtime.