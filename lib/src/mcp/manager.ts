import { MCPClient } from './client.js';
import type { QiConfig } from '../config/schema.js';
import type { MCPTool } from '../utils/types.js';

export class MCPManager {
  private client: MCPClient;
  private config: QiConfig;

  constructor(config: QiConfig) {
    this.config = config;
    this.client = new MCPClient();
  }

  async initialize(): Promise<void> {
    const serverEntries = Object.entries(this.config.mcp.servers);
    
    if (serverEntries.length === 0) {
      console.warn('⚠️  No MCP servers configured, agent will run without tools');
      return;
    }

    console.log(`🔌 Initializing ${serverEntries.length} MCP server(s)...`);

    // Connect to all configured servers with graceful degradation
    const connectionPromises = serverEntries.map(async ([serverName, serverConfig]) => {
      try {
        await this.client.connectServer(serverName, serverConfig);
      } catch (error) {
        console.warn(`Failed to connect to ${serverName}, continuing without it:`, error);
      }
    });

    await Promise.allSettled(connectionPromises);

    const connectedServers = await this.client.getConnectedServers();
    console.log(`✅ Successfully connected to ${connectedServers.length} MCP server(s)`);
  }

  async getTools(): Promise<MCPTool[]> {
    try {
      return await this.client.listTools();
    } catch (error) {
      console.error('Failed to list MCP tools:', error);
      return [];
    }
  }

  async executeTool(toolName: string, parameters: Record<string, unknown>): Promise<unknown> {
    try {
      return await this.client.executeTool(toolName, parameters);
    } catch (error) {
      console.error(`Failed to execute tool ${toolName}:`, error);
      return {
        error: `Tool ${toolName} is currently unavailable`,
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getConnectedServers(): Promise<string[]> {
    return this.client.getConnectedServers();
  }

  async cleanup(): Promise<void> {
    console.log('🔌 Disconnecting from MCP servers...');
    await this.client.disconnect();
  }

  // Convert MCP tools to LangChain tool format
  convertToLangChainTools(mcpTools: MCPTool[]) {
    return mcpTools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.inputSchema,
      func: async (input: Record<string, unknown>) => {
        return await this.executeTool(tool.name, input);
      },
    }));
  }
}