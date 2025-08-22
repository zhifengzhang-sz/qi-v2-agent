import type { QiError, Result } from '@qi/base';
import { create, failure, success } from '@qi/base';
import { RAGIntegration } from '../context/RAGIntegration.js';
import { WebTool } from '../tools/WebTool.js';
import { MCPServiceManager } from './MCPServiceManager.js';
import {
  getAutoConnectServices,
  getAvailableServices,
  type MCPServiceConfig,
} from './services/ServiceConfigs.js';

export interface MCPIntegrationConfig {
  autoConnect?: boolean;
  services?: string[];
  timeout?: number;
  enableRAG?: boolean;
  enableWeb?: boolean;
}

export interface MCPCapabilities {
  memory: boolean;
  web: boolean;
  search: boolean;
  connectedServices: string[];
}

/**
 * Main MCP Integration class that orchestrates all MCP services
 * Uses MCP SDK Client directly through service manager
 */
export class MCPIntegration {
  private serviceManager: MCPServiceManager;
  private ragIntegration?: RAGIntegration;
  private webTool?: WebTool;
  private isInitialized = false;
  private config: MCPIntegrationConfig;

  constructor(config: MCPIntegrationConfig = {}) {
    this.config = {
      autoConnect: true,
      enableRAG: true,
      enableWeb: true,
      timeout: 30000,
      ...config,
    };

    this.serviceManager = new MCPServiceManager();
  }

  /**
   * Initialize MCP integration and connect to services
   */
  async initialize(): Promise<Result<void, QiError>> {
    if (this.isInitialized) {
      return success(undefined);
    }

    try {
      console.log('🔌 Initializing MCP Integration...');

      // Determine which services to connect to
      const servicesToConnect = this.config.autoConnect
        ? getAutoConnectServices()
        : this.getFilteredServices();

      // Connect to services using service manager
      const connectionResults = await Promise.allSettled(
        servicesToConnect.map(async (service) => {
          console.log(`  Connecting to ${service.name}...`);
          const result = await this.serviceManager.connectToService(service);

          if (result.tag === 'success') {
            console.log(`  ✅ Connected to ${service.name}`);
          } else {
            console.warn(`  ⚠️ Failed to connect to ${service.name}: ${result.error.message}`);
          }

          return { service: service.name, result };
        })
      );

      // Log connection results
      const connected = connectionResults
        .filter((r) => r.status === 'fulfilled' && r.value.result.tag === 'success')
        .map((r) => (r.status === 'fulfilled' ? r.value.service : ''));

      if (connected.length > 0) {
        console.log(`🎉 MCP services connected: ${connected.join(', ')}`);
      }

      // Initialize integrations based on connected services
      if (this.config.enableRAG) {
        this.ragIntegration = new RAGIntegration(this.serviceManager);
        console.log('🧠 RAG integration initialized');
      }

      if (this.config.enableWeb) {
        this.webTool = new WebTool(this.serviceManager);
        console.log('🌐 Web integration initialized');
      }

      this.isInitialized = true;
      console.log('✅ MCP Integration initialized successfully');

      return success(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return failure(
        create(
          'MCP_INIT_FAILED',
          `MCP integration initialization failed: ${errorMessage}`,
          'SYSTEM'
        )
      );
    }
  }

  /**
   * Enhance a user message with relevant context from MCP services
   */
  async enhanceMessageWithContext(message: string): Promise<Result<string, QiError>> {
    if (!this.isInitialized) {
      return success(message); // Graceful degradation
    }

    let enhancedMessage = message;
    const contextParts: string[] = [];

    try {
      // Check if we need web content
      if (this.webTool && WebTool.needsWebContent(message)) {
        const webCapabilities = this.webTool.getCapabilities();

        // Try web search first if available
        if (webCapabilities.search) {
          const searchResults = await this.webTool.searchWeb(message, 3);
          if (searchResults.tag === 'success' && searchResults.value.length > 0) {
            const searchContext = searchResults.value
              .map((r) => `${r.title}: ${r.snippet} (${r.url})`)
              .join('\n');
            contextParts.push(`Recent web results:\n${searchContext}`);
          }
        }
      }

      // Get relevant context from RAG
      if (this.ragIntegration && this.ragIntegration.isAvailable()) {
        const ragResults = await this.ragIntegration.searchRelevantContext(message, 3);
        if (ragResults.tag === 'success' && ragResults.value.length > 0) {
          const ragContext = ragResults.value
            .map((r) => `${r.metadata.type}: ${r.content.substring(0, 200)}...`)
            .join('\n');
          contextParts.push(`Relevant context from knowledge:\n${ragContext}`);
        }
      }

      // Combine context with original message
      if (contextParts.length > 0) {
        enhancedMessage = `${contextParts.join('\n\n')}\n\nUser query: ${message}`;
      }

      return success(enhancedMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to enhance message with MCP context: ${errorMessage}`);
      return success(message); // Graceful degradation
    }
  }

  /**
   * Store a conversation turn for future reference
   */
  async storeConversationTurn(
    userMessage: string,
    assistantResponse: string
  ): Promise<Result<void, QiError>> {
    if (!this.ragIntegration || !this.ragIntegration.isAvailable()) {
      return success(undefined); // Graceful degradation
    }

    // Only store meaningful conversations (not just greetings or simple queries)
    if (this.shouldStoreConversation(userMessage, assistantResponse)) {
      return this.ragIntegration.storeConversationTurn(userMessage, assistantResponse);
    }

    return success(undefined);
  }

  /**
   * Get current MCP capabilities
   */
  getCapabilities(): MCPCapabilities {
    return {
      memory: this.ragIntegration?.isAvailable() ?? false,
      web: this.webTool?.isWebFetchAvailable() ?? false,
      search: this.webTool?.isWebSearchAvailable() ?? false,
      connectedServices: this.serviceManager.getConnectedServices(),
    };
  }

  /**
   * Get service manager for direct SDK client access
   */
  getServiceManager(): MCPServiceManager {
    return this.serviceManager;
  }

  /**
   * Check if MCP integration is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown all MCP services
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      console.log('🔌 Shutting down MCP Integration...');
      await this.serviceManager.shutdown();
      this.isInitialized = false;
      console.log('✅ MCP Integration shutdown complete');
    }
  }

  /**
   * Get filtered services based on config
   */
  private getFilteredServices(): MCPServiceConfig[] {
    const availableServices = getAvailableServices();

    if (this.config.services && this.config.services.length > 0) {
      return availableServices.filter((service) => this.config.services!.includes(service.name));
    }

    return availableServices;
  }

  /**
   * Determine if a conversation should be stored in RAG
   */
  private shouldStoreConversation(userMessage: string, assistantResponse: string): boolean {
    // Don't store very short interactions
    if (userMessage.length < 20 || assistantResponse.length < 50) {
      return false;
    }

    // Don't store simple greetings or acknowledgments
    const simplePatterns = /^(hi|hello|thanks|ok|yes|no|sure|great)\.?$/i;
    if (simplePatterns.test(userMessage.trim()) || simplePatterns.test(assistantResponse.trim())) {
      return false;
    }

    // Don't store error messages
    if (
      assistantResponse.toLowerCase().includes('sorry') ||
      assistantResponse.toLowerCase().includes('error') ||
      assistantResponse.toLowerCase().includes("don't know")
    ) {
      return false;
    }

    return true;
  }
}
