import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { OllamaLLM } from '../llm/ollama.js';
import { MCPManager } from '../mcp/manager.js';
import type { QiConfig } from '../config/schema.js';
import type { AgentMessage, StreamingOptions, AgentResponse, IAgentFactory } from '../utils/types.js';

export class ChatAgentFactory implements IAgentFactory {
  private config: QiConfig;
  private llm: OllamaLLM;
  private mcpManager: MCPManager;
  private agent: any; // LangGraph agent type
  private memorySaver?: MemorySaver;

  constructor(config: QiConfig) {
    this.config = config;
    this.llm = new OllamaLLM(config.model);
    this.mcpManager = new MCPManager(config);
  }

  async initialize(): Promise<void> {
    console.log('🤖 Initializing qi-v2 agent...');

    // Initialize memory if enabled
    if (this.config.memory.enabled) {
      this.memorySaver = new MemorySaver();
      console.log('💾 Memory persistence enabled');
    }

    // Initialize MCP servers
    await this.mcpManager.initialize();

    // Get available tools
    const mcpTools = await this.mcpManager.getTools();
    const tools = this.mcpManager.convertToLangChainTools(mcpTools);
    
    console.log(`🔧 Loaded ${tools.length} tools from MCP servers`);

    // Create LangGraph agent with proper system prompt for conversation
    this.agent = createReactAgent({
      llm: this.llm.getModel(),
      tools,
      ...(this.memorySaver && { checkpointSaver: this.memorySaver }),
      messageModifier: `You are qi-v2 agent, a helpful AI coding assistant. 

For conversational messages, respond naturally and helpfully.
For tasks requiring file operations, use the available tools.

Available tools: ${tools.map(t => t.name).join(', ')}

Always be concise and helpful in your responses.`
    });

    console.log('✅ Qi Agent initialized successfully');
  }

  async invoke(
    messages: AgentMessage[],
    threadId?: string
  ): Promise<AgentResponse> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      const langchainMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const config = threadId && this.memorySaver 
        ? { configurable: { thread_id: threadId } }
        : undefined;

      const response = await this.agent.invoke(
        { messages: langchainMessages },
        config
      );

      const lastMessage = response.messages[response.messages.length - 1];
      
      return {
        content: lastMessage.content,
        toolCalls: response.tool_calls || [],
        metadata: {
          threadId,
          timestamp: new Date(),
          messageCount: response.messages.length,
        },
      };
    } catch (error) {
      console.error('Agent invocation failed:', error);
      throw new Error(`Agent failed to respond: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async stream(
    messages: AgentMessage[],
    options: StreamingOptions = {},
    threadId?: string
  ): Promise<void> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const { onToken, onComplete, onError, controller } = options;

    try {
      console.log('🔧 Agent factory stream started');
      const startTime = Date.now();
      
      // Prepare messages with proper conversational context for ReAct agent
      const langchainMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Smart routing: simple conversation vs tool requests
      const needsTools = messages.some(msg => {
        const content = msg.content.toLowerCase();
        
        // File/directory operations that need tools
        const fileOperations = content.includes('file ') || 
                              content.includes('directory') ||
                              content.includes('folder') ||
                              content.includes('read file') ||
                              content.includes('write file') ||
                              content.includes('create file') ||
                              content.includes('list files') ||
                              content.includes('.js') ||
                              content.includes('.ts') ||
                              content.includes('.py') ||
                              content.includes('.md');
        
        // Exclude programming requests that use "write" but mean code generation
        const codeGeneration = content.includes('write a') ||
                              content.includes('write some') ||
                              content.includes('create a') ||
                              content.includes('show me') ||
                              content.includes('program') ||
                              content.includes('function') ||
                              content.includes('algorithm');
        
        return fileOperations && !codeGeneration;
      });
      
      if (!needsTools) {
        console.log('💬 Simple conversation - using direct LLM');
        try {
          await this.llm.stream([
            { role: 'system', content: 'You are qi-v2 agent, a helpful AI coding assistant. Respond naturally and helpfully.' },
            ...langchainMessages
          ], options);
          return;
        } catch (error) {
          onError?.(error instanceof Error ? error : new Error(String(error)));
          return;
        }
      }
      
      console.log('🔧 Tool request - using LangGraph agent');

      console.log('📋 Prepared messages for LangGraph');
      const config = {
        ...(threadId && this.memorySaver && { configurable: { thread_id: threadId } }),
        ...(controller && { signal: controller.signal }),
      };

      console.log('🚀 Starting LangGraph stream...');
      const stream = await this.agent.stream(
        { messages: langchainMessages },
        { ...config, streamMode: 'values' }
      );
      
      console.log(`🎯 LangGraph stream started after ${Date.now() - startTime}ms`);

      let fullResponse = '';
      let firstChunkTime: number | null = null;
      let chunkCount = 0;
      let lastContent = '';
      let streamCompleted = false;
      
      // Add timeout as fallback, but try to complete naturally first
      const streamTimeout = setTimeout(() => {
        if (!streamCompleted) {
          console.warn(`⚠️ Stream timeout after 30 seconds - completing with current response`);
          streamCompleted = true;
          onComplete?.(fullResponse);
        }
      }, 30000); // Increased timeout for slow models
      
      try {
        for await (const chunk of stream) {
          if (streamCompleted) break;
          
          chunkCount++;
          // Processing chunk (debug disabled for production)
          
          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            // First chunk timing (debug disabled for production)
          }
          
          // LangGraph values mode returns the graph state
          if (chunk && chunk.messages && Array.isArray(chunk.messages)) {
            const lastMessage = chunk.messages[chunk.messages.length - 1];
            
            if (lastMessage && lastMessage.content && typeof lastMessage.content === 'string') {
              const newContent = lastMessage.content;
              
              // Only send the incremental token difference
              if (newContent.length > lastContent.length) {
                const newToken = newContent.slice(lastContent.length);
                onToken?.(newToken);
                // Token streaming (debug disabled for production)
                lastContent = newContent;
                fullResponse = newContent;
              }
            }
          }
          
          // Safety check to prevent infinite loops
          if (chunkCount > 1000) {
            console.warn(`⚠️ Stream exceeded 1000 chunks, forcing completion`);
            break;
          }
        }
        
        clearTimeout(streamTimeout);
        
        if (!streamCompleted) {
          console.log(`🏁 Stream completed naturally after ${chunkCount} chunks`);
          streamCompleted = true;
          onComplete?.(fullResponse);
        }
        
      } catch (streamError) {
        console.error(`❌ Stream error:`, streamError);
        throw streamError;
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      onError?.(errorObj);
      throw errorObj;
    }
  }

  async getAvailableTools(): Promise<string[]> {
    const tools = await this.mcpManager.getTools();
    return tools.map((tool) => tool.name);
  }

  async getConnectedServers(): Promise<string[]> {
    return this.mcpManager.getConnectedServers();
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check LLM health
      const llmHealthy = await this.llm.healthCheck();
      if (!llmHealthy) {
        return false;
      }

      // Check if agent is initialized
      if (!this.agent) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Agent health check failed:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up agent resources...');
    await this.mcpManager.cleanup();
  }

  getConfig(): QiConfig {
    return { ...this.config };
  }

  // Update configuration and reinitialize if necessary
  async updateConfig(newConfig: Partial<QiConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Update LLM config if changed
    if (newConfig.model) {
      this.llm.updateConfig(newConfig.model);
    }

    // Reinitialize if MCP config changed
    if (newConfig.mcp) {
      await this.mcpManager.cleanup();
      this.mcpManager = new MCPManager(this.config);
      await this.initialize();
    }
  }
}