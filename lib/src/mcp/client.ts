import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { ServerConfig } from '../config/schema.js';
import type { MCPTool } from '../utils/types.js';

export class MCPClient {
  private clients = new Map<string, Client>();
  private reconnectAttempts = new Map<string, number>();
  private readonly maxReconnectAttempts = 3;

  async connectServer(serverName: string, config: ServerConfig): Promise<void> {
    try {
      const transport = this.createTransport(config);
      
      const client = new Client(
        { name: 'qi-agent', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      await client.connect(transport);
      this.clients.set(serverName, client);
      this.reconnectAttempts.set(serverName, 0);
      
      console.log(`✅ Connected to MCP server: ${serverName}`);
    } catch (error) {
      await this.handleConnectionError(serverName, config, error);
    }
  }

  async listTools(): Promise<MCPTool[]> {
    const allTools: MCPTool[] = [];
    
    for (const [serverName, client] of this.clients) {
      try {
        const response = await client.listTools();
        const tools = response.tools.map((tool) => ({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema,
          server: serverName,
        }));
        allTools.push(...tools);
      } catch (error) {
        console.warn(`Failed to list tools from ${serverName}:`, error);
      }
    }
    
    return allTools;
  }

  async executeTool(toolName: string, parameters: Record<string, unknown>): Promise<unknown> {
    for (const [serverName, client] of this.clients) {
      try {
        const tools = await client.listTools();
        const tool = tools.tools.find((t) => t.name === toolName);
        
        if (tool) {
          const result = await client.callTool({
            name: toolName,
            arguments: parameters,
          });
          return result.content;
        }
      } catch (error) {
        console.warn(`Tool execution failed on ${serverName}:`, error);
      }
    }
    
    throw new Error(`Tool ${toolName} not found on any server`);
  }

  async getConnectedServers(): Promise<string[]> {
    return Array.from(this.clients.keys());
  }

  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.entries()).map(
      async ([serverName, client]) => {
        try {
          await client.close();
          console.log(`✅ Disconnected from MCP server: ${serverName}`);
        } catch (error) {
          console.warn(`Failed to disconnect from ${serverName}:`, error);
        }
      }
    );

    await Promise.allSettled(disconnectPromises);
    this.clients.clear();
    this.reconnectAttempts.clear();
  }

  private createTransport(config: ServerConfig) {
    switch (config.transport) {
      case 'stdio':
        if (!config.command) {
          throw new Error('Command is required for stdio transport');
        }
        return new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env,
        });
      
      case 'sse':
        if (!config.url) {
          throw new Error('URL is required for SSE transport');
        }
        return new SSEClientTransport(new URL(config.url));
      
      default:
        throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }

  private async handleConnectionError(
    serverName: string, 
    config: ServerConfig, 
    error: unknown
  ): Promise<void> {
    const attempts = this.reconnectAttempts.get(serverName) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(serverName, attempts + 1);
      console.log(
        `Retrying connection to ${serverName} (${attempts + 1}/${this.maxReconnectAttempts})`
      );
      
      // Exponential backoff
      await new Promise((resolve) => 
        setTimeout(resolve, 1000 * Math.pow(2, attempts))
      );
      
      return this.connectServer(serverName, config);
    }
    
    console.error(
      `Failed to connect to ${serverName} after ${this.maxReconnectAttempts} attempts:`,
      error
    );
    throw error;
  }
}