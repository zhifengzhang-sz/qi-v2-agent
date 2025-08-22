import type { QiError, Result } from '@qi/base';
import { failure, success, systemError } from '@qi/base';
import type { MCPServiceManager } from '../mcp/MCPServiceManager.js';

export interface DocumentMetadata {
  type: 'conversation' | 'code' | 'documentation' | 'knowledge';
  timestamp: string;
  source?: string;
  tags?: string[];
  [key: string]: any;
}

export interface SearchResult {
  content: string;
  metadata: DocumentMetadata;
  relevanceScore?: number;
}

/**
 * Real RAG integration using MCP memory server via SDK Client
 */
export class RAGIntegration {
  constructor(private serviceManager: MCPServiceManager) {}

  /**
   * Add a document to the knowledge base using MCP memory server
   */
  async addDocument(
    content: string,
    metadata: DocumentMetadata = { type: 'knowledge', timestamp: new Date().toISOString() }
  ): Promise<Result<void, QiError>> {
    // Check if memory service is available
    if (!this.serviceManager.isConnected('memory')) {
      return failure(systemError('Memory service not available for document storage'));
    }

    try {
      // Get SDK client directly
      const client = this.serviceManager.getClient('memory');
      if (!client) {
        return failure(systemError('Memory service client not available'));
      }

      // Create unique document ID
      const docId = this.generateDocumentId(content, metadata);

      // Store document using SDK client directly
      await client.callTool({
        name: 'create_entities',
        arguments: {
          entities: [
            {
              name: docId,
              entityType: metadata.type,
              observations: [content],
            },
          ],
        },
      });

      return success(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return failure(systemError(`Error storing document: ${errorMessage}`));
    }
  }

  /**
   * Search for relevant documents using semantic search
   */
  async searchRelevantContext(
    query: string,
    maxResults: number = 5
  ): Promise<Result<SearchResult[], QiError>> {
    // Check if memory service is available
    if (!this.serviceManager.isConnected('memory')) {
      // Graceful degradation - return empty results
      return success([]);
    }

    try {
      // Get SDK client directly
      const client = this.serviceManager.getClient('memory');
      if (!client) {
        return success([]); // Graceful degradation
      }

      // Use SDK client directly for search
      const searchResult = await client.callTool({
        name: 'search_nodes',
        arguments: { query },
      });

      // Process search results - MCP SDK returns content array with text
      const results: SearchResult[] = [];

      // Extract data from MCP response format
      if (searchResult.content && Array.isArray(searchResult.content)) {
        for (const contentItem of searchResult.content) {
          if (contentItem.type === 'text' && contentItem.text) {
            try {
              const searchData = JSON.parse(contentItem.text);

              if (searchData.entities && Array.isArray(searchData.entities)) {
                for (const entity of searchData.entities.slice(0, maxResults)) {
                  if (entity.observations && entity.observations.length > 0) {
                    const content = entity.observations[0];

                    const metadata: DocumentMetadata = {
                      type: entity.entityType || 'knowledge',
                      timestamp: new Date().toISOString(),
                    };

                    results.push({ content, metadata });
                  }
                }
              }
            } catch {
              // If not JSON, treat as plain text result
              results.push({
                content: contentItem.text,
                metadata: {
                  type: 'knowledge',
                  timestamp: new Date().toISOString(),
                },
              });
            }
          }
        }
      }

      return success(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`RAG search error: ${errorMessage}`);
      return success([]); // Graceful degradation
    }
  }

  /**
   * Store conversation turn for future reference
   */
  async storeConversationTurn(
    userMessage: string,
    assistantResponse: string,
    context?: string
  ): Promise<Result<void, QiError>> {
    let conversationContent = `User: ${userMessage}\n\nAssistant: ${assistantResponse}`;

    if (context) {
      conversationContent += `\n\nContext: ${context}`;
    }

    const metadata: DocumentMetadata = {
      type: 'conversation',
      timestamp: new Date().toISOString(),
      source: 'qi-prompt-session',
      tags: ['conversation', 'history'],
    };

    return this.addDocument(conversationContent, metadata);
  }

  /**
   * Check if RAG integration is available
   */
  isAvailable(): boolean {
    return this.serviceManager.isConnected('memory');
  }

  /**
   * Generate a unique document ID based on content and metadata
   */
  private generateDocumentId(content: string, metadata: DocumentMetadata): string {
    const contentHash = this.simpleHash(content);
    const timestamp = metadata.timestamp.replace(/[^0-9]/g, '');
    return `${metadata.type}_${timestamp}_${contentHash}`;
  }

  /**
   * Simple hash function for generating document IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
