#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

interface TimeServerOptions {
  name: string;
  version: string;
}

class TimeServer {
  private server: Server;

  constructor(options: TimeServerOptions = { name: 'time-server', version: '1.0.0' }) {
    this.server = new Server(
      {
        name: options.name,
        version: options.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'get_current_time',
          description: 'Get the current date and time',
          inputSchema: {
            type: 'object',
            properties: {
              timezone: {
                type: 'string',
                description: 'Timezone (optional, defaults to system timezone)',
              },
              format: {
                type: 'string',
                description: 'Date format (optional, defaults to ISO string)',
                enum: ['iso', 'locale', 'timestamp'],
              },
            },
          },
        },
        {
          name: 'get_unix_timestamp',
          description: 'Get current Unix timestamp',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'get_current_time': {
          const timezone = args?.timezone as string;
          const format = (args?.format as string) || 'iso';

          const now = new Date();
          let timeString: string;

          switch (format) {
            case 'locale':
              timeString = timezone
                ? now.toLocaleString('en-US', { timeZone: timezone })
                : now.toLocaleString();
              break;
            case 'timestamp':
              timeString = now.getTime().toString();
              break;
            case 'iso':
            default:
              timeString = now.toISOString();
              break;
          }

          return {
            content: [
              {
                type: 'text',
                text: `Current time: ${timeString}${timezone ? ` (${timezone})` : ''}`,
              },
            ],
          };
        }

        case 'get_unix_timestamp': {
          const timestamp = Math.floor(Date.now() / 1000);
          return {
            content: [
              {
                type: 'text',
                text: `Unix timestamp: ${timestamp}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Time Server started and listening on stdio');
  }
}

// Start the server if this file is run directly
if (import.meta.main) {
  const server = new TimeServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { TimeServer };