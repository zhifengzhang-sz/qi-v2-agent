import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { OllamaLLM } from '../llm/ollama.js';
import { MCPManager } from '../mcp/manager.js';
import type { QiConfig } from '../config/schema.js';
import type { AgentMessage, StreamingOptions, AgentResponse } from '../utils/types.js';

export class QiAgentFactory {
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
    console.log('🤖 Initializing Qi Agent...');

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

    // Create LangGraph agent
    this.agent = createReactAgent({
      llm: this.llm.getModel(),
      tools,
      ...(this.memorySaver && { checkpointSaver: this.memorySaver }),
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
      const langchainMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const config = {
        ...(threadId && this.memorySaver && { configurable: { thread_id: threadId } }),
        ...(controller && { signal: controller.signal }),
      };

      const stream = await this.agent.stream(
        { messages: langchainMessages },
        { ...config, streamMode: 'values' }
      );

      let fullResponse = '';

      for await (const chunk of stream) {
        if (chunk.messages && chunk.messages.length > 0) {
          const lastMessage = chunk.messages[chunk.messages.length - 1];
          if (lastMessage.content) {
            const content = lastMessage.content;
            fullResponse += content;
            onToken?.(content);
          }
        }
      }

      onComplete?.(fullResponse);
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