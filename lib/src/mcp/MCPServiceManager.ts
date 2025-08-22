import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { QiError, Result } from '@qi/base';
import { failure, success, systemError } from '@qi/base';

export interface MCPServiceConfig {
  name: string;
  command: string[];
  environment?: Record<string, string>;
  autoConnect?: boolean;
}

export interface MCPServiceConnection {
  client: Client;
  transport: StdioClientTransport;
  config: MCPServiceConfig;
  status: 'connected' | 'disconnected' | 'error';
}

/**
 * Simple service manager that uses MCP SDK Client directly
 * No wrapper classes - just connection management
 */
export class MCPServiceManager {
  private connections: Map<string, MCPServiceConnection> = new Map();

  /**
   * Connect to an MCP service using SDK Client directly
   */
  async connectToService(config: MCPServiceConfig): Promise<Result<void, QiError>> {
    try {
      // Create transport using SDK
      const transport = new StdioClientTransport({
        command: config.command[0],
        args: config.command.slice(1),
        env: config.environment,
      });

      // Create client using SDK
      const client = new Client(
        {
          name: 'qi-v2-agent',
          version: '0.8.3',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
          },
        }
      );

      // Connect using SDK
      await client.connect(transport);

      // Store connection
      this.connections.set(config.name, {
        client,
        transport,
        config,
        status: 'connected',
      });

      return success(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return failure(systemError(`Failed to connect to ${config.name}: ${errorMessage}`));
    }
  }

  /**
   * Get SDK Client for direct use
   */
  getClient(serviceName: string): Client | null {
    const connection = this.connections.get(serviceName);
    return connection?.status === 'connected' ? connection.client : null;
  }

  /**
   * Check if service is connected
   */
  isConnected(serviceName: string): boolean {
    return this.connections.get(serviceName)?.status === 'connected' || false;
  }

  /**
   * Get list of connected services
   */
  getConnectedServices(): string[] {
    return Array.from(this.connections.entries())
      .filter(([_, conn]) => conn.status === 'connected')
      .map(([name]) => name);
  }

  /**
   * Shutdown all connections
   */
  async shutdown(): Promise<void> {
    for (const [name, connection] of this.connections) {
      try {
        await connection.transport.close();
      } catch (error) {
        console.error(`Error closing connection to ${name}:`, error);
      }
    }
    this.connections.clear();
  }
}
