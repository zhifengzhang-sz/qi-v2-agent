/**
 * Search Sub-Agent - Tool-Specialized Implementation
 *
 * Specializes in search operations by coordinating Grep and Glob tools.
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
 * Creates QiCore-compatible error for search operations
 */
function createSearchError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): QiError {
  return {
    code,
    message,
    category: 'SYSTEM',
    context: context || {},
  } as QiError;
}

export class SearchSubAgent extends BaseSubAgent {
  public readonly capabilities: SubAgentCapability[] = [
    {
      type: 'search_operations',
      name: 'content_searcher',
      description: 'Search file contents using patterns and regular expressions',
      confidence: 0.9,
      domains: ['search', 'pattern_matching', 'content_analysis'],
      toolRequirements: ['Grep'],
      workflowPatterns: ['analytical', 'problem-solving'],
    },
    {
      type: 'search_operations',
      name: 'file_finder',
      description: 'Find files using glob patterns and directory traversal',
      confidence: 0.85,
      domains: ['filesystem', 'search', 'discovery'],
      toolRequirements: ['Glob'],
      workflowPatterns: ['analytical', 'general'],
    },
    {
      type: 'search_operations',
      name: 'code_searcher',
      description: 'Search for code patterns and language-specific constructs',
      confidence: 0.8,
      domains: ['code_analysis', 'search', 'programming'],
      toolRequirements: ['Grep', 'Glob'],
      workflowPatterns: ['analytical', 'problem-solving'],
    },
  ];

  constructor() {
    super('search-agent', 'Search Operations Agent', '1.0.0');
  }

  protected async onInitialize(config: SubAgentConfig): Promise<Result<void, QiError>> {
    try {
      this.logger.info('Search operations sub-agent initialized', {
        capabilities: this.capabilities.length,
        workingDirectory: config.workingDirectory,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createSearchError('SEARCH_INIT_FAILED', 'Failed to initialize search sub-agent', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  protected async onCleanup(): Promise<Result<void, QiError>> {
    // No specific cleanup needed for search operations
    return success(undefined);
  }

  protected async canHandleCustom(task: SubAgentTask): Promise<Result<boolean, QiError>> {
    try {
      // Check if task involves search operations
      const description = task.description.toLowerCase();
      const searchKeywords = [
        'search',
        'find',
        'grep',
        'pattern',
        'match',
        'locate',
        'lookup',
        'query',
        'filter',
        'scan',
      ];

      const hasSearchOperation = searchKeywords.some((keyword) => description.includes(keyword));

      return success(hasSearchOperation);
    } catch (error) {
      return failure(
        createSearchError(
          'SEARCH_CAN_HANDLE_CHECK_FAILED',
          'Failed to check custom search capability',
          {
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  protected async *executeTask(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const taskType = task.type;
    const input = task.input as any;

    switch (taskType) {
      case 'content_search':
        yield* this.executeContentSearch(task, input);
        break;
      case 'pattern_match':
        yield* this.executePatternMatch(task, input);
        break;
      case 'code_search':
        yield* this.executeCodeSearch(task, input);
        break;
      case 'file_find':
        yield* this.executeFileFind(task, input);
        break;
      case 'multi_pattern_search':
        yield* this.executeMultiPatternSearch(task, input);
        break;
      default:
        // Try to infer search operation from description
        yield* this.executeInferredSearch(task);
    }
  }

  private async *executeContentSearch(
    task: SubAgentTask,
    input: {
      pattern: string;
      path?: string;
      fileType?: string;
      caseSensitive?: boolean;
      contextLines?: number;
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to search for pattern: ${input.pattern}`,
    };

    // Execute Grep tool
    const grepParams: any = {
      pattern: input.pattern,
      output_mode: 'content',
      '-n': true, // Show line numbers
    };

    if (input.path) {
      grepParams.path = input.path;
    }

    if (input.fileType) {
      grepParams.type = input.fileType;
    }

    if (!input.caseSensitive) {
      grepParams['-i'] = true;
    }

    if (input.contextLines) {
      grepParams['-C'] = input.contextLines;
    }

    yield {
      taskId: task.id,
      stage: 'searching',
      progress: 0.5,
      message: 'Searching content with pattern',
    };

    const searchResult = await this.executeToolSafely('Grep', grepParams);

    if (searchResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Content search failed: ${searchResult.error.message}`,
        intermediateResults: { error: searchResult.error },
      };
      return;
    }

    const matches = this.parseGrepOutput(searchResult.value as string);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Found ${matches.length} matches for pattern`,
      intermediateResults: {
        toolUsed: 'Grep',
        pattern: input.pattern,
        matches,
        totalMatches: matches.length,
      },
    };
  }

  private async *executePatternMatch(
    task: SubAgentTask,
    input: {
      patterns: string[];
      path?: string;
      fileTypes?: string[];
      logicalOperator?: 'AND' | 'OR';
    }
  ): AsyncGenerator<SubAgentProgress> {
    const totalPatterns = input.patterns.length;
    const allMatches: any[] = [];

    for (let i = 0; i < totalPatterns; i++) {
      const pattern = input.patterns[i];
      const progress = (i + 1) / totalPatterns;

      yield {
        taskId: task.id,
        stage: 'pattern_matching',
        progress: progress * 0.9, // Reserve 0.1 for completion
        message: `Searching pattern ${i + 1} of ${totalPatterns}: ${pattern}`,
      };

      const grepParams: any = {
        pattern,
        output_mode: 'content',
        '-n': true,
      };

      if (input.path) {
        grepParams.path = input.path;
      }

      if (input.fileTypes && input.fileTypes.length > 0) {
        // Use first file type for this search
        grepParams.type = input.fileTypes[0];
      }

      const searchResult = await this.executeToolSafely('Grep', grepParams);

      if (searchResult.tag === 'success') {
        const matches = this.parseGrepOutput(searchResult.value as string);
        allMatches.push({
          pattern,
          matches,
          count: matches.length,
        });
      } else {
        allMatches.push({
          pattern,
          matches: [],
          count: 0,
          error: searchResult.error.message,
        });
      }
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Pattern matching completed for ${totalPatterns} patterns`,
      intermediateResults: {
        toolUsed: 'Grep',
        patterns: input.patterns,
        results: allMatches,
        totalMatches: allMatches.reduce((sum, result) => sum + result.count, 0),
      },
    };
  }

  private async *executeCodeSearch(
    task: SubAgentTask,
    input: {
      codePattern: string;
      language?: string;
      path?: string;
      includeTests?: boolean;
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to search code for pattern: ${input.codePattern}`,
    };

    // First, find relevant files
    let filePattern = '**/*';
    if (input.language) {
      const extensions = this.getFileExtensionsForLanguage(input.language);
      filePattern = extensions.length > 0 ? `**/*.{${extensions.join(',')}}` : '**/*';
    }

    yield {
      taskId: task.id,
      stage: 'finding_files',
      progress: 0.3,
      message: 'Finding relevant source files',
    };

    const globResult = await this.executeToolSafely('Glob', {
      pattern: filePattern,
      path: input.path,
    });

    if (globResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Failed to find files: ${globResult.error.message}`,
      };
      return;
    }

    const files = globResult.value as string[];
    let relevantFiles = files;

    // Filter out test files if requested
    if (!input.includeTests) {
      relevantFiles = files.filter((file) => !this.isTestFile(file));
    }

    yield {
      taskId: task.id,
      stage: 'searching_code',
      progress: 0.6,
      message: `Searching ${relevantFiles.length} files for code pattern`,
    };

    // Search for the code pattern in the relevant files
    const searchResult = await this.executeToolSafely('Grep', {
      pattern: input.codePattern,
      output_mode: 'content',
      '-n': true,
      path: input.path,
      type: input.language || undefined,
    });

    if (searchResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Code search failed: ${searchResult.error.message}`,
      };
      return;
    }

    const matches = this.parseGrepOutput(searchResult.value as string);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Found ${matches.length} code matches`,
      intermediateResults: {
        toolUsed: 'Grep',
        codePattern: input.codePattern,
        language: input.language,
        filesScanned: relevantFiles.length,
        matches,
        totalMatches: matches.length,
      },
    };
  }

  private async *executeFileFind(
    task: SubAgentTask,
    input: { pattern: string; path?: string; maxResults?: number }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'searching',
      progress: 0.3,
      message: `Finding files matching pattern: ${input.pattern}`,
    };

    const globResult = await this.executeToolSafely('Glob', {
      pattern: input.pattern,
      path: input.path,
    });

    if (globResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `File search failed: ${globResult.error.message}`,
        intermediateResults: { error: globResult.error },
      };
      return;
    }

    let files = globResult.value as string[];

    // Limit results if specified
    if (input.maxResults && files.length > input.maxResults) {
      files = files.slice(0, input.maxResults);
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Found ${files.length} files matching pattern`,
      intermediateResults: {
        toolUsed: 'Glob',
        pattern: input.pattern,
        files,
        totalFiles: files.length,
        truncated: input.maxResults && (globResult.value as string[]).length > input.maxResults,
      },
    };
  }

  private async *executeMultiPatternSearch(
    task: SubAgentTask,
    input: {
      patterns: { pattern: string; description?: string }[];
      path?: string;
      fileType?: string;
    }
  ): AsyncGenerator<SubAgentProgress> {
    const totalPatterns = input.patterns.length;
    const searchResults: any[] = [];

    for (let i = 0; i < totalPatterns; i++) {
      const patternInfo = input.patterns[i];
      const progress = (i + 1) / totalPatterns;

      yield {
        taskId: task.id,
        stage: 'multi_search',
        progress: progress * 0.9,
        message: `Searching pattern ${i + 1} of ${totalPatterns}: ${patternInfo.pattern}`,
      };

      const searchResult = await this.executeToolSafely('Grep', {
        pattern: patternInfo.pattern,
        output_mode: 'files_with_matches',
        path: input.path,
        type: input.fileType,
      });

      if (searchResult.tag === 'success') {
        const files = (searchResult.value as string).split('\n').filter((f) => f.trim());
        searchResults.push({
          pattern: patternInfo.pattern,
          description: patternInfo.description,
          files,
          count: files.length,
        });
      } else {
        searchResults.push({
          pattern: patternInfo.pattern,
          description: patternInfo.description,
          files: [],
          count: 0,
          error: searchResult.error.message,
        });
      }
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Multi-pattern search completed for ${totalPatterns} patterns`,
      intermediateResults: {
        toolUsed: 'Grep',
        totalPatterns,
        results: searchResults,
        totalFiles: searchResults.reduce((sum, result) => sum + result.count, 0),
      },
    };
  }

  private async *executeInferredSearch(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const description = task.description.toLowerCase();

    yield {
      taskId: task.id,
      stage: 'inferring',
      progress: 0.1,
      message: 'Inferring search operation from task description',
    };

    // Simple inference logic based on description keywords
    if (description.includes('content') || description.includes('text')) {
      yield* this.executeContentSearch(task, task.input as any);
    } else if (description.includes('pattern') || description.includes('regex')) {
      yield* this.executePatternMatch(task, { patterns: [task.input as any] });
    } else if (description.includes('code') || description.includes('function')) {
      yield* this.executeCodeSearch(task, task.input as any);
    } else if (description.includes('file') || description.includes('find')) {
      yield* this.executeFileFind(task, task.input as any);
    } else {
      // Default to content search
      yield* this.executeContentSearch(task, task.input as any);
    }
  }

  // Helper methods

  private parseGrepOutput(output: string): any[] {
    const lines = output.split('\n').filter((line) => line.trim());
    const matches: any[] = [];

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const beforeColon = line.substring(0, colonIndex);
        const afterColon = line.substring(colonIndex + 1);

        // Try to extract file and line number
        const parts = beforeColon.split(':');
        if (parts.length >= 2) {
          matches.push({
            file: parts[0],
            line: parseInt(parts[1]) || 0,
            content: afterColon.trim(),
          });
        } else {
          matches.push({
            file: beforeColon,
            content: afterColon.trim(),
          });
        }
      } else {
        matches.push({
          content: line.trim(),
        });
      }
    }

    return matches;
  }

  private getFileExtensionsForLanguage(language: string): string[] {
    const languageMap: Record<string, string[]> = {
      typescript: ['ts', 'tsx'],
      javascript: ['js', 'jsx', 'mjs'],
      python: ['py', 'pyx'],
      java: ['java'],
      cpp: ['cpp', 'cc', 'cxx', 'h', 'hpp'],
      rust: ['rs'],
      go: ['go'],
      php: ['php'],
      ruby: ['rb'],
      swift: ['swift'],
      kotlin: ['kt', 'kts'],
      scala: ['scala', 'sc'],
      clojure: ['clj', 'cljs'],
      haskell: ['hs', 'lhs'],
    };

    return languageMap[language.toLowerCase()] || [];
  }

  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /\/tests?\//,
      /\/spec\//,
      /__tests__\//,
      /test_.*\.py$/,
      /.*_test\.go$/,
    ];

    return testPatterns.some((pattern) => pattern.test(filePath));
  }

  protected async collectArtifacts(task: SubAgentTask): Promise<SubAgentArtifact[]> {
    const artifacts: SubAgentArtifact[] = [];

    // Generate search report as artifact
    artifacts.push({
      type: 'report',
      name: 'search_results.md',
      content: this.generateSearchReport(task),
      metadata: {
        taskId: task.id,
        searchType: task.type,
        timestamp: new Date().toISOString(),
      },
    });

    return artifacts;
  }

  protected generateRecommendations(task: SubAgentTask, output: unknown): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on search results
    if (task.type === 'code_search') {
      recommendations.push('Consider using more specific code patterns for better precision');
      recommendations.push('Review search results for potential code quality improvements');
    } else if (task.type === 'content_search') {
      recommendations.push('Use regular expressions for more complex pattern matching');
      recommendations.push('Consider case-sensitive vs case-insensitive search based on context');
    }

    recommendations.push('Cache frequent search patterns for improved performance');
    recommendations.push('Consider indexing large codebases for faster search operations');

    return recommendations;
  }

  private generateSearchReport(task: SubAgentTask): string {
    return `# Search Results Report

## Task: ${task.description}

## Search Type: ${task.type}

## Parameters:
${JSON.stringify(task.input, null, 2)}

## Generated: ${new Date().toISOString()}
`;
  }
}
