import type { QiError, Result } from '@qi/base';
import { failure, success, systemError, validationError } from '@qi/base';
import type { MCPServiceManager } from '../mcp/MCPServiceManager.js';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebFetchResult {
  url: string;
  content: string;
  contentType?: string;
  statusCode?: number;
  title?: string;
}

export interface WebFetchOptions {
  timeout?: number;
  maxLength?: number;
  followRedirects?: boolean;
  headers?: Record<string, string>;
}

/**
 * Real Web integration using MCP fetch server via SDK Client
 */
export class WebTool {
  private readonly defaultTimeout = 30000;
  private readonly maxContentLength = 100000; // 100KB default limit

  constructor(private serviceManager: MCPServiceManager) {}

  /**
   * Fetch web content using MCP fetch server
   */
  async fetchWebContent(
    url: string,
    options: WebFetchOptions = {}
  ): Promise<Result<WebFetchResult, QiError>> {
    // Validate URL format
    const urlValidation = this.validateUrl(url);
    if (urlValidation.tag === 'failure') {
      return urlValidation;
    }

    // Check if fetch service is available
    if (!this.serviceManager.isConnected('fetch')) {
      return failure(systemError('Fetch service not available for web content retrieval'));
    }

    try {
      // Get SDK client directly
      const client = this.serviceManager.getClient('fetch');
      if (!client) {
        return failure(systemError('Fetch service client not available'));
      }

      // Use SDK client directly
      const fetchResult = await client.callTool({
        name: 'fetch_url',
        arguments: {
          url,
          timeout: options.timeout || this.defaultTimeout,
          max_length: options.maxLength || this.maxContentLength,
          follow_redirects: options.followRedirects ?? true,
          headers: options.headers || {},
        },
      });

      // Process MCP SDK response format
      let content = '';
      let title = '';
      let contentType = '';
      let statusCode = 200;

      if (fetchResult.content && Array.isArray(fetchResult.content)) {
        for (const contentItem of fetchResult.content) {
          if (contentItem.type === 'text' && contentItem.text) {
            try {
              const responseData = JSON.parse(contentItem.text);
              content = responseData.content || contentItem.text;
              title = responseData.title || '';
              contentType = responseData.content_type || '';
              statusCode = responseData.status_code || 200;
            } catch {
              // If not JSON, treat as plain text content
              content = contentItem.text;
            }
          }
        }
      }

      const result: WebFetchResult = {
        url,
        content,
        contentType,
        statusCode,
        title,
      };

      return success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return failure(systemError(`Error fetching ${url}: ${errorMessage}`));
    }
  }

  /**
   * Search the web using Brave Search MCP server (if available)
   */
  async searchWeb(
    query: string,
    maxResults: number = 5
  ): Promise<Result<WebSearchResult[], QiError>> {
    // Check if brave-search service is available
    if (!this.serviceManager.isConnected('brave-search')) {
      // Graceful degradation - return empty results
      console.warn('Web search not available - Brave Search service not connected');
      return success([]);
    }

    try {
      // Get SDK client directly
      const client = this.serviceManager.getClient('brave-search');
      if (!client) {
        return success([]); // Graceful degradation
      }

      // Use SDK client directly
      const searchResult = await client.callTool({
        name: 'brave_web_search',
        arguments: {
          query,
          count: maxResults,
        },
      });

      // Process search results from MCP SDK response
      const results: WebSearchResult[] = [];

      if (searchResult.content && Array.isArray(searchResult.content)) {
        for (const contentItem of searchResult.content) {
          if (contentItem.type === 'text' && contentItem.text) {
            try {
              const searchData = JSON.parse(contentItem.text);

              if (searchData.web?.results) {
                for (const item of searchData.web.results.slice(0, maxResults)) {
                  results.push({
                    title: item.title || '',
                    url: item.url || '',
                    snippet: item.description || '',
                    source: 'brave',
                  });
                }
              }
            } catch {}
          }
        }
      }

      return success(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Web search error: ${errorMessage}`);
      return success([]); // Graceful degradation
    }
  }

  /**
   * Extract text content from HTML
   */
  extractTextContent(htmlContent: string): string {
    // Simple HTML tag removal - in a real implementation, you might want to use a proper HTML parser
    return htmlContent
      .replace(/<script[^>]*>.*?<\/script>/gis, '') // Remove scripts
      .replace(/<style[^>]*>.*?<\/style>/gis, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Check if the web tool is available for fetching
   */
  isWebFetchAvailable(): boolean {
    return this.serviceManager.isConnected('fetch');
  }

  /**
   * Check if web search is available
   */
  isWebSearchAvailable(): boolean {
    return this.serviceManager.isConnected('brave-search');
  }

  /**
   * Get web tool capabilities
   */
  getCapabilities(): { fetch: boolean; search: boolean; services: string[] } {
    return {
      fetch: this.isWebFetchAvailable(),
      search: this.isWebSearchAvailable(),
      services: this.serviceManager
        .getConnectedServices()
        .filter((name) => ['fetch', 'brave-search'].includes(name)),
    };
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): Result<void, QiError> {
    try {
      const urlObj = new URL(url);

      // Only allow http and https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return failure(
          validationError(`Invalid protocol: ${urlObj.protocol}. Only HTTP and HTTPS are allowed.`)
        );
      }

      return success(undefined);
    } catch (_error) {
      return failure(validationError(`Invalid URL format: ${url}`));
    }
  }

  /**
   * Check if a query suggests web content is needed
   */
  static needsWebContent(query: string): boolean {
    const webIndicators = [
      'latest',
      'current',
      'recent',
      'news',
      'update',
      'search',
      'what is',
      'who is',
      'when did',
      'how to',
      'documentation',
      'github',
      'npm',
      'website',
      'url',
      'link',
    ];

    const lowerQuery = query.toLowerCase();
    return webIndicators.some((indicator) => lowerQuery.includes(indicator));
  }
}
