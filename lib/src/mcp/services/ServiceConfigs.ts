import type { MCPServiceConfig } from '../MCPServiceManager.js';

export type { MCPServiceConfig };

/**
 * Predefined configurations for common MCP services
 * These connect to existing, real MCP servers
 */
export const CORE_MCP_SERVICES: MCPServiceConfig[] = [
  {
    name: 'memory',
    command: ['npx', '@modelcontextprotocol/server-memory'],
    environment: {
      // Memory server configuration
    },
    autoConnect: false, // Only connect when needed
  },
  {
    name: 'filesystem',
    command: ['npx', '@modelcontextprotocol/server-filesystem', process.cwd()],
    environment: {
      // Filesystem server configuration
    },
    autoConnect: false, // Security consideration - only when explicitly needed
  },
  {
    name: 'fetch',
    command: ['npx', '@modelcontextprotocol/server-fetch'],
    environment: {
      FETCH_TIMEOUT: '30000',
    },
    autoConnect: true, // Web fetching is commonly needed
  },
  {
    name: 'sqlite',
    command: ['npx', '@modelcontextprotocol/server-sqlite'],
    environment: {
      // SQLite server configuration
    },
    autoConnect: false, // Only connect when database access is needed
  },
];

/**
 * Development/testing MCP services
 * These might not be available in all environments
 */
export const DEV_MCP_SERVICES: MCPServiceConfig[] = [
  {
    name: 'brave-search',
    command: ['npx', '@modelcontextprotocol/server-brave-search'],
    environment: {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
    },
    autoConnect: false, // Requires API key
  },
  {
    name: 'github',
    command: ['npx', '@modelcontextprotocol/server-github'],
    environment: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '',
    },
    autoConnect: false, // Requires auth token
  },
];

/**
 * Get service configurations based on environment
 */
export function getAvailableServices(): MCPServiceConfig[] {
  const services = [...CORE_MCP_SERVICES];

  // Add dev services if their dependencies are available
  for (const devService of DEV_MCP_SERVICES) {
    if (isServiceAvailable(devService)) {
      services.push(devService);
    }
  }

  return services;
}

/**
 * Check if a service's dependencies are available
 */
function isServiceAvailable(service: MCPServiceConfig): boolean {
  switch (service.name) {
    case 'brave-search':
      return !!process.env.BRAVE_API_KEY;
    case 'github':
      return !!process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    default:
      return true;
  }
}

/**
 * Get services that should auto-connect on startup
 */
export function getAutoConnectServices(): MCPServiceConfig[] {
  return getAvailableServices().filter((service) => service.autoConnect);
}

/**
 * Custom service configurations for project-specific needs
 */
export const PROJECT_SPECIFIC_SERVICES: MCPServiceConfig[] = [
  // Example: Custom knowledge base server
  // {
  //   name: 'qi-knowledge',
  //   command: ['node', './custom-servers/qi-knowledge-server.js'],
  //   environment: {
  //     KNOWLEDGE_DB_PATH: './data/knowledge.db',
  //   },
  //   autoConnect: true,
  // },
];
