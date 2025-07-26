import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { MemorySaver } from '@langchain/langgraph';
import { OllamaLLM } from '../llm/ollama.js';
import { MCPManager } from '../mcp/manager.js';
import { createWorkflowTools } from '../tools/workflow-tools.js';
import type { QiConfig } from '../config/schema.js';
import type { AgentMessage, StreamingOptions, AgentResponse, IAgentFactory } from '../utils/types.js';

/**
 * AgentFactory provides a natural language interface that automatically
 * detects user intent and executes appropriate workflows using LangChain function calling.
 * 
 * This agent has full capabilities including chat, file operations, and workflow execution.
 */
export class AgentFactory implements IAgentFactory {
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

    // Get MCP tools
    const mcpTools = await this.mcpManager.getTools();
    const langchainMcpTools = this.mcpManager.convertToLangChainTools(mcpTools);
    
    // Get workflow tools (function calling) - pass direct dependencies
    const workflowTools = createWorkflowTools({
      mcpManager: this.mcpManager, // Direct MCP access
      llm: this.llm,              // Direct LLM access  
      threadId: undefined         // Will be provided per conversation
    });
    
    // Combine all tools
    const allTools = [...langchainMcpTools, ...workflowTools];
    
    console.log(`🔧 Loaded ${allTools.length} tools (${mcpTools.length} MCP + ${workflowTools.length} workflow)`);

    // Create LangGraph agent with function calling capability
    this.agent = createReactAgent({
      llm: this.llm.getModel(),
      tools: allTools,
      ...(this.memorySaver && { checkpointSaver: this.memorySaver }),
      messageModifier: `You are qi-v2 agent, an AI coding assistant with access to powerful workflow tools.

You can handle two types of requests:

## 1. CODE GENERATION & PROGRAMMING HELP
For requests like "write a Python program", "create a function", "show me how to...", provide direct code solutions:
- Write complete, working code with examples
- Include explanations and comments
- Provide multiple approaches when helpful
- Test code and show output examples

## 2. FILE/PROJECT WORKFLOW OPERATIONS
Use tools for working with existing files and projects:

🔧 **edit_files** - Use when users want to modify existing files:
- "Fix the bug in auth.ts", "add error handling to utils.js"
- "refactor the login function", "update the API endpoint"

📊 **analyze_code** - Use when users want insights about existing code:
- "analyze my code complexity", "review the architecture"
- "check dependencies in this project"

📚 **explain_concept** - Use when users want to understand existing code:
- "explain this function in main.py", "how does this algorithm work?"

**Available Tools:** ${langchainMcpTools.map(t => t.name).join(', ')}, edit_files, analyze_code, explain_concept

**Examples:**
- "write a quicksort program" → Generate code directly (no tools needed)
- "fix the null check in auth.ts" → Use edit_files tool
- "analyze my project structure" → Use analyze_code tool

Always provide helpful, complete solutions. Use tools only when working with existing files/projects.`
    });

    console.log('✅ Unified Qi Agent initialized successfully');
  }

  /**
   * Main chat method for unified interface - automatically detects intent and uses tools
   */
  async chat(
    messages: AgentMessage[],
    options: StreamingOptions = {},
    threadId?: string
  ): Promise<void> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const { onToken, onComplete, onError, controller } = options;

    try {
      console.log('🔄 Processing unified chat message...');
      const startTime = Date.now();
      
      const langchainMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const config = {
        ...(threadId && this.memorySaver && { configurable: { thread_id: threadId } }),
        ...(controller && { signal: controller.signal }),
      };

      console.log('🚀 Starting unified agent stream...');
      const stream = await this.agent.stream(
        { messages: langchainMessages },
        { ...config, streamMode: 'values' }
      );
      
      let fullResponse = '';
      let firstChunkTime: number | null = null;
      let streamCompleted = false;
      
      const streamTimeout = setTimeout(() => {
        if (!streamCompleted) {
          console.warn(`⚠️ Stream timeout after 30 seconds - completing with current response`);
          streamCompleted = true;
          onComplete?.(fullResponse);
        }
      }, 30000); // Increased timeout for slow models and tool execution
      
      try {
        for await (const chunk of stream) {
          if (streamCompleted) break;
          
          if (!firstChunkTime) {
            firstChunkTime = Date.now();
            console.log(`⚡ First chunk received after ${firstChunkTime - startTime}ms`);
          }
          
          // Process LangGraph response (may include tool calls)
          if (chunk && chunk.messages && Array.isArray(chunk.messages)) {
            const lastMessage = chunk.messages[chunk.messages.length - 1];
            
            if (lastMessage && typeof lastMessage.content === 'string') {
              const newContent = lastMessage.content;
              
              if (newContent.length > fullResponse.length) {
                const newToken = newContent.slice(fullResponse.length);
                onToken?.(newToken);
                fullResponse = newContent;
              }
            }
          }
        }
        
        clearTimeout(streamTimeout);
        
        if (!streamCompleted) {
          console.log(`🏁 Unified chat completed naturally`);
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

  /**
   * Legacy invoke method for compatibility with existing interfaces
   */
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

  /**
   * Streaming interface - routes to chat method for unified functionality
   * Maintains compatibility with existing qi-v2 agentFactory interface
   */
  async stream(
    messages: AgentMessage[],
    options: StreamingOptions = {},
    threadId?: string
  ): Promise<void> {
    return this.chat(messages, options, threadId);
  }

  // Standard AgentFactory interface methods for compatibility
  async getAvailableTools(): Promise<string[]> {
    const mcpTools = await this.mcpManager.getTools();
    const workflowTools = ['edit_files', 'analyze_code', 'explain_concept'];
    return [...mcpTools.map(t => t.name), ...workflowTools];
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
      console.warn('Unified agent health check failed:', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up unified agent resources...');
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