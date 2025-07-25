import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPClient } from '@qi/agent/mcp/client';

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'test_tool',
          description: 'A test tool',
          inputSchema: { type: 'object', properties: { input: { type: 'string' } } }
        }
      ]
    }),
    callTool: vi.fn().mockResolvedValue({
      content: 'Tool executed successfully'
    }),
    close: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({}))
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => ({}))
}));

describe('MCPClient', () => {
  let mcpClient: MCPClient;

  beforeEach(() => {
    mcpClient = new MCPClient();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await mcpClient.disconnect();
  });

  describe('connectServer', () => {
    it('should connect to stdio server successfully', async () => {
      const serverConfig = {
        transport: 'stdio' as const,
        command: 'test-command',
        args: ['arg1', 'arg2']
      };

      await mcpClient.connectServer('test-server', serverConfig);
      const connectedServers = await mcpClient.getConnectedServers();
      
      expect(connectedServers).toContain('test-server');
    });

    it('should connect to SSE server successfully', async () => {
      const serverConfig = {
        transport: 'sse' as const,
        url: 'http://localhost:8000/mcp'
      };

      await mcpClient.connectServer('sse-server', serverConfig);
      const connectedServers = await mcpClient.getConnectedServers();
      
      expect(connectedServers).toContain('sse-server');
    });

    it('should throw error for unsupported transport', async () => {
      const serverConfig = {
        transport: 'websocket' as any,
        url: 'ws://localhost:8000'
      };

      await expect(
        mcpClient.connectServer('ws-server', serverConfig)
      ).rejects.toThrow('Unsupported transport: websocket');
    });
  });

  describe('listTools', () => {
    it('should list tools from connected servers', async () => {
      const serverConfig = {
        transport: 'stdio' as const,
        command: 'test-command'
      };

      await mcpClient.connectServer('test-server', serverConfig);
      const tools = await mcpClient.listTools();
      
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('test_tool');
      expect(tools[0].description).toBe('A test tool');
      expect(tools[0].server).toBe('test-server');
    });

    it('should return empty array when no servers connected', async () => {
      const tools = await mcpClient.listTools();
      expect(tools).toHaveLength(0);
    });
  });

  describe('executeTool', () => {
    it('should execute tool successfully', async () => {
      const serverConfig = {
        transport: 'stdio' as const,
        command: 'test-command'
      };

      await mcpClient.connectServer('test-server', serverConfig);
      const result = await mcpClient.executeTool('test_tool', { input: 'test' });
      
      expect(result).toBe('Tool executed successfully');
    });

    it('should throw error for non-existent tool', async () => {
      await expect(
        mcpClient.executeTool('nonexistent_tool', {})
      ).rejects.toThrow('Tool nonexistent_tool not found on any server');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from all servers', async () => {
      const serverConfig = {
        transport: 'stdio' as const,
        command: 'test-command'
      };

      await mcpClient.connectServer('test-server', serverConfig);
      expect(await mcpClient.getConnectedServers()).toHaveLength(1);
      
      await mcpClient.disconnect();
      expect(await mcpClient.getConnectedServers()).toHaveLength(0);
    });
  });
});