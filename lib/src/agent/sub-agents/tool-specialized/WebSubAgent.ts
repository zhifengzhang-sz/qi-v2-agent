/**
 * Web Sub-Agent - Tool-Specialized Implementation
 *
 * Specializes in web operations by coordinating WebFetch and WebSearch tools.
 * Follows the v-0.10.0 roadmap specification exactly without creating new interfaces.
 */

import type { Result } from '@qi/base';
import { failure, success } from '@qi/base';
import type { QiError } from '@qi/core';
import { BaseSubAgent } from '../core/BaseSubAgent.js';
import type {
  SubAgentArtifact,
  SubAgentCapability,
  SubAgentConfig,
  SubAgentProgress,
  SubAgentTask,
} from '../core/types.js';

/**
 * Creates QiCore-compatible error for web operations
 */
function createWebError(code: string, message: string, context?: Record<string, unknown>): QiError {
  return {
    code,
    message,
    category: 'NETWORK',
    context: context || {},
  } as QiError;
}

export class WebSubAgent extends BaseSubAgent {
  public readonly capabilities: SubAgentCapability[] = [
    {
      type: 'custom',
      name: 'web_fetcher',
      description: 'Fetch and process content from web URLs',
      confidence: 0.9,
      domains: ['web', 'http', 'content_retrieval'],
      toolRequirements: ['WebFetch'],
      workflowPatterns: ['research', 'data_gathering'],
    },
    {
      type: 'custom',
      name: 'web_searcher',
      description: 'Search the web for information and content',
      confidence: 0.85,
      domains: ['web', 'search', 'information_retrieval'],
      toolRequirements: ['WebSearch'],
      workflowPatterns: ['research', 'analytical'],
    },
    {
      type: 'custom',
      name: 'content_extractor',
      description: 'Extract and analyze content from web pages',
      confidence: 0.8,
      domains: ['web', 'content_analysis', 'data_extraction'],
      toolRequirements: ['WebFetch'],
      workflowPatterns: ['analytical', 'data_processing'],
    },
  ];

  constructor() {
    super('web-agent', 'Web Operations Agent', '1.0.0');
  }

  protected async onInitialize(config: SubAgentConfig): Promise<Result<void, QiError>> {
    try {
      this.logger.info('Web operations sub-agent initialized', {
        capabilities: this.capabilities.length,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createWebError('WEB_INIT_FAILED', 'Failed to initialize web sub-agent', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  protected async onCleanup(): Promise<Result<void, QiError>> {
    // No specific cleanup needed for web operations
    return success(undefined);
  }

  protected async canHandleCustom(task: SubAgentTask): Promise<Result<boolean, QiError>> {
    try {
      // Check if task involves web operations
      const description = task.description.toLowerCase();
      const webKeywords = [
        'web',
        'http',
        'url',
        'fetch',
        'download',
        'search',
        'browse',
        'scrape',
        'extract',
        'api',
        'website',
        'page',
      ];

      const hasWebOperation = webKeywords.some((keyword) => description.includes(keyword));

      return success(hasWebOperation);
    } catch (error) {
      return failure(
        createWebError('WEB_CAN_HANDLE_CHECK_FAILED', 'Failed to check custom web capability', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  protected async *executeTask(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const taskType = task.type;
    const input = task.input as any;

    switch (taskType) {
      case 'web_fetch':
        yield* this.executeWebFetch(task, input);
        break;
      case 'web_search':
        yield* this.executeWebSearch(task, input);
        break;
      case 'content_extraction':
        yield* this.executeContentExtraction(task, input);
        break;
      case 'multi_url_fetch':
        yield* this.executeMultiUrlFetch(task, input);
        break;
      case 'web_research':
        yield* this.executeWebResearch(task, input);
        break;
      default:
        // Try to infer web operation from description
        yield* this.executeInferredWebOperation(task);
    }
  }

  private async *executeWebFetch(
    task: SubAgentTask,
    input: { url: string; prompt?: string; followRedirects?: boolean }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to fetch content from: ${input.url}`,
    };

    // Validate URL format
    if (!this.isValidUrl(input.url)) {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Invalid URL format: ${input.url}`,
      };
      return;
    }

    yield {
      taskId: task.id,
      stage: 'fetching',
      progress: 0.5,
      message: 'Fetching web content',
    };

    // Execute WebFetch tool
    const fetchParams: any = {
      url: input.url,
    };

    if (input.prompt) {
      fetchParams.prompt = input.prompt;
    }

    const fetchResult = await this.executeToolSafely('WebFetch', fetchParams);

    if (fetchResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Web fetch failed: ${fetchResult.error.message}`,
        intermediateResults: { error: fetchResult.error },
      };
      return;
    }

    const content = fetchResult.value as string;

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Successfully fetched content from ${input.url}`,
      intermediateResults: {
        toolUsed: 'WebFetch',
        url: input.url,
        content,
        contentLength: content.length,
        contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
      },
    };
  }

  private async *executeWebSearch(
    task: SubAgentTask,
    input: {
      query: string;
      maxResults?: number;
      allowedDomains?: string[];
      blockedDomains?: string[];
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to search for: ${input.query}`,
    };

    yield {
      taskId: task.id,
      stage: 'searching',
      progress: 0.5,
      message: 'Performing web search',
    };

    // Execute WebSearch tool
    const searchParams: any = {
      query: input.query,
    };

    if (input.allowedDomains) {
      searchParams.allowed_domains = input.allowedDomains;
    }

    if (input.blockedDomains) {
      searchParams.blocked_domains = input.blockedDomains;
    }

    const searchResult = await this.executeToolSafely('WebSearch', searchParams);

    if (searchResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Web search failed: ${searchResult.error.message}`,
        intermediateResults: { error: searchResult.error },
      };
      return;
    }

    const searchResults = this.parseSearchResults(searchResult.value as string);

    // Limit results if specified
    let finalResults = searchResults;
    if (input.maxResults && searchResults.length > input.maxResults) {
      finalResults = searchResults.slice(0, input.maxResults);
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Found ${finalResults.length} search results`,
      intermediateResults: {
        toolUsed: 'WebSearch',
        query: input.query,
        results: finalResults,
        totalResults: finalResults.length,
        truncated: finalResults.length < searchResults.length,
      },
    };
  }

  private async *executeContentExtraction(
    task: SubAgentTask,
    input: {
      url: string;
      extractionPrompt: string;
      targetElements?: string[];
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to extract content from: ${input.url}`,
    };

    yield {
      taskId: task.id,
      stage: 'fetching',
      progress: 0.4,
      message: 'Fetching web page for content extraction',
    };

    // First fetch the content
    const fetchResult = await this.executeToolSafely('WebFetch', {
      url: input.url,
      prompt: input.extractionPrompt,
    });

    if (fetchResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Failed to fetch content for extraction: ${fetchResult.error.message}`,
      };
      return;
    }

    yield {
      taskId: task.id,
      stage: 'extracting',
      progress: 0.8,
      message: 'Extracting specific content elements',
    };

    const rawContent = fetchResult.value as string;
    const extractedData = this.processContentExtraction(rawContent, input.extractionPrompt);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: 'Content extraction completed',
      intermediateResults: {
        toolUsed: 'WebFetch',
        url: input.url,
        extractionPrompt: input.extractionPrompt,
        extractedContent: extractedData,
        originalContentLength: rawContent.length,
      },
    };
  }

  private async *executeMultiUrlFetch(
    task: SubAgentTask,
    input: { urls: string[]; concurrent?: boolean; prompt?: string }
  ): AsyncGenerator<SubAgentProgress> {
    const totalUrls = input.urls.length;
    const results: any[] = [];

    for (let i = 0; i < totalUrls; i++) {
      const url = input.urls[i];
      const progress = (i + 1) / totalUrls;

      yield {
        taskId: task.id,
        stage: 'multi_fetch',
        progress: progress * 0.9, // Reserve 0.1 for completion
        message: `Fetching URL ${i + 1} of ${totalUrls}: ${url}`,
      };

      if (!this.isValidUrl(url)) {
        results.push({
          url,
          success: false,
          error: 'Invalid URL format',
        });
        continue;
      }

      const fetchParams: any = { url };
      if (input.prompt) {
        fetchParams.prompt = input.prompt;
      }

      const fetchResult = await this.executeToolSafely('WebFetch', fetchParams);

      if (fetchResult.tag === 'success') {
        results.push({
          url,
          success: true,
          content: fetchResult.value,
          contentLength: (fetchResult.value as string).length,
        });
      } else {
        results.push({
          url,
          success: false,
          error: fetchResult.error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Multi-URL fetch completed: ${successCount}/${totalUrls} successful`,
      intermediateResults: {
        toolUsed: 'WebFetch',
        totalUrls,
        successfulFetches: successCount,
        failedFetches: totalUrls - successCount,
        results,
      },
    };
  }

  private async *executeWebResearch(
    task: SubAgentTask,
    input: {
      topic: string;
      searchQueries?: string[];
      maxSourcesPerQuery?: number;
      synthesizeResults?: boolean;
    }
  ): AsyncGenerator<SubAgentProgress> {
    const queries = input.searchQueries || [input.topic];
    const allSources: any[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const progress = ((i + 1) / queries.length) * 0.8; // Reserve 0.2 for synthesis

      yield {
        taskId: task.id,
        stage: 'researching',
        progress,
        message: `Researching query ${i + 1} of ${queries.length}: ${query}`,
      };

      // Search for sources
      const searchResult = await this.executeToolSafely('WebSearch', { query });

      if (searchResult.tag === 'success') {
        const sources = this.parseSearchResults(searchResult.value as string);
        let limitedSources = sources;

        if (input.maxSourcesPerQuery && sources.length > input.maxSourcesPerQuery) {
          limitedSources = sources.slice(0, input.maxSourcesPerQuery);
        }

        allSources.push({
          query,
          sources: limitedSources,
          sourceCount: limitedSources.length,
        });
      } else {
        allSources.push({
          query,
          sources: [],
          sourceCount: 0,
          error: searchResult.error.message,
        });
      }
    }

    if (input.synthesizeResults) {
      yield {
        taskId: task.id,
        stage: 'synthesizing',
        progress: 0.9,
        message: 'Synthesizing research results',
      };
    }

    const totalSources = allSources.reduce((sum, item) => sum + item.sourceCount, 0);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Research completed: ${totalSources} sources found across ${queries.length} queries`,
      intermediateResults: {
        toolUsed: 'WebSearch',
        topic: input.topic,
        queries: queries.length,
        totalSources,
        researchResults: allSources,
        synthesis: input.synthesizeResults ? this.synthesizeResearchResults(allSources) : undefined,
      },
    };
  }

  private async *executeInferredWebOperation(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const description = task.description.toLowerCase();

    yield {
      taskId: task.id,
      stage: 'inferring',
      progress: 0.1,
      message: 'Inferring web operation from task description',
    };

    // Simple inference logic based on description keywords
    if (description.includes('search') && !description.includes('url')) {
      yield* this.executeWebSearch(task, task.input as any);
    } else if (description.includes('fetch') || description.includes('url')) {
      yield* this.executeWebFetch(task, task.input as any);
    } else if (description.includes('extract') || description.includes('scrape')) {
      yield* this.executeContentExtraction(task, task.input as any);
    } else if (description.includes('research')) {
      yield* this.executeWebResearch(task, task.input as any);
    } else {
      // Default to web fetch if input looks like a URL
      const input = task.input as any;
      if (input && typeof input === 'object' && input.url) {
        yield* this.executeWebFetch(task, input);
      } else if (input && typeof input === 'string' && this.isValidUrl(input)) {
        yield* this.executeWebFetch(task, { url: input });
      } else {
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `Could not infer web operation from description: ${task.description}`,
        };
      }
    }
  }

  // Helper methods

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return url.startsWith('http://') || url.startsWith('https://');
    } catch {
      return false;
    }
  }

  private parseSearchResults(rawResults: string): any[] {
    // This is a simplified parser - actual implementation would depend on WebSearch tool output format
    try {
      if (rawResults.trim().startsWith('[') || rawResults.trim().startsWith('{')) {
        return JSON.parse(rawResults);
      }

      // Parse line-based results
      const lines = rawResults.split('\n').filter((line) => line.trim());
      return lines.map((line, index) => ({
        id: index + 1,
        title: line.substring(0, 100),
        url: this.extractUrlFromLine(line),
        snippet: line,
      }));
    } catch (error) {
      this.logger.warn('Failed to parse search results', {
        error,
        rawResults: rawResults.substring(0, 200),
      });
      return [];
    }
  }

  private extractUrlFromLine(line: string): string {
    // Simple URL extraction - look for http/https patterns
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : '';
  }

  private processContentExtraction(content: string, prompt: string): any {
    // This would typically involve more sophisticated content processing
    // For now, return a simple analysis
    return {
      extractionPrompt: prompt,
      contentLength: content.length,
      wordCount: content.split(/\s+/).length,
      extractedText: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      timestamp: new Date().toISOString(),
    };
  }

  private synthesizeResearchResults(researchResults: any[]): any {
    const totalSources = researchResults.reduce((sum, result) => sum + result.sourceCount, 0);
    const allSources = researchResults.flatMap((result) => result.sources);

    return {
      summary: `Research synthesis of ${totalSources} sources across ${researchResults.length} queries`,
      topDomains: this.getTopDomains(allSources),
      keyFindings: this.extractKeyFindings(allSources),
      recommendedSources: allSources.slice(0, 5), // Top 5 sources
      synthesisTimestamp: new Date().toISOString(),
    };
  }

  private getTopDomains(sources: any[]): string[] {
    const domainCount = new Map<string, number>();

    for (const source of sources) {
      if (source.url) {
        try {
          const domain = new URL(source.url).hostname;
          domainCount.set(domain, (domainCount.get(domain) || 0) + 1);
        } catch {
          // Skip invalid URLs
        }
      }
    }

    return Array.from(domainCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);
  }

  private extractKeyFindings(sources: any[]): string[] {
    // Simple key findings extraction based on titles and snippets
    return sources
      .slice(0, 3)
      .map(
        (source, index) =>
          `Finding ${index + 1}: ${source.title || source.snippet || 'Content found'}`
      );
  }

  protected async collectArtifacts(task: SubAgentTask): Promise<SubAgentArtifact[]> {
    const artifacts: SubAgentArtifact[] = [];

    // Generate web operation report as artifact
    artifacts.push({
      type: 'report',
      name: 'web_operation_report.md',
      content: this.generateWebReport(task),
      metadata: {
        taskId: task.id,
        operationType: task.type,
        timestamp: new Date().toISOString(),
      },
    });

    return artifacts;
  }

  protected generateRecommendations(task: SubAgentTask, output: unknown): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on web operation type
    if (task.type === 'web_search') {
      recommendations.push('Consider refining search queries for more specific results');
      recommendations.push('Use domain filtering to focus on authoritative sources');
    } else if (task.type === 'web_fetch') {
      recommendations.push('Implement caching for frequently accessed URLs');
      recommendations.push('Consider rate limiting for multiple URL fetches');
    } else if (task.type === 'content_extraction') {
      recommendations.push('Use more specific extraction prompts for better results');
      recommendations.push('Consider structured data extraction for complex content');
    }

    recommendations.push(
      'Monitor web operation performance and implement retries for failed requests'
    );
    recommendations.push('Respect robots.txt and rate limiting policies');

    return recommendations;
  }

  private generateWebReport(task: SubAgentTask): string {
    return `# Web Operation Report

## Task: ${task.description}

## Operation Type: ${task.type}

## Parameters:
${JSON.stringify(task.input, null, 2)}

## Generated: ${new Date().toISOString()}
`;
  }
}
