# Sub-Agent Development Guide

## Table of Contents
- [Getting Started](#getting-started)
- [Creating Your First Sub-Agent](#creating-your-first-sub-agent)
- [Tool-Specialized Sub-Agents](#tool-specialized-sub-agents)
- [Workflow-Specialized Sub-Agents](#workflow-specialized-sub-agents)
- [Testing Sub-Agents](#testing-sub-agents)
- [Performance Optimization](#performance-optimization)
- [Publishing and Distribution](#publishing-and-distribution)

## Getting Started

This guide walks you through creating custom sub-agents for the qi-v2-agent system. Sub-agents are specialized components that handle specific domains of work within the larger agent ecosystem.

### Prerequisites

- TypeScript knowledge
- Familiarity with QiCore Result<T, QiError> patterns
- Understanding of async generators and streaming patterns
- Basic knowledge of the tools your sub-agent will coordinate

### Development Environment Setup

```bash
# Clone the qi-v2-agent repository
git clone https://github.com/qi/qi-v2-agent
cd qi-v2-agent

# Install dependencies
bun install

# Set up development environment
bun run setup:dev

# Run tests to ensure everything works
bun run test
```

## Creating Your First Sub-Agent

Let's create a simple sub-agent that specializes in text processing operations.

### Step 1: Define the Sub-Agent Structure

```typescript
// lib/src/agent/sub-agents/text-processing/TextProcessingSubAgent.ts

import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { BaseSubAgent } from '../core/BaseSubAgent.js';
import { 
  SubAgentCapability, 
  SubAgentTask, 
  SubAgentProgress, 
  SubAgentConfig 
} from '../core/types.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';
import { AgentLogger } from '../../config/logger.js';

export class TextProcessingSubAgent extends BaseSubAgent {
  public readonly capabilities: SubAgentCapability[] = [
    {
      type: 'custom',
      name: 'text_analyzer',
      description: 'Analyze text content for patterns and metrics',
      confidence: 0.9,
      domains: ['text', 'analysis', 'nlp'],
      toolRequirements: ['Read', 'Write'],
      workflowPatterns: ['analytical']
    },
    {
      type: 'custom',
      name: 'text_transformer',
      description: 'Transform text content (format, clean, extract)',
      confidence: 0.85,
      domains: ['text', 'transformation', 'formatting'],
      toolRequirements: ['Read', 'Write', 'Edit'],
      workflowPatterns: ['creative', 'general']
    }
  ];

  constructor(logger: AgentLogger) {
    super('text-processing-agent', 'Text Processing Agent', '1.0.0', logger);
  }

  protected async onInitialize(config: SubAgentConfig): Promise<Result<void, QiError>> {
    try {
      this.logger.info('Text processing sub-agent initialized');
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to initialize text processing sub-agent',
          { error }
        )
      );
    }
  }

  protected async onCleanup(): Promise<Result<void, QiError>> {
    return createResult(undefined);
  }

  protected async canHandleCustom(task: SubAgentTask): Promise<Result<boolean, QiError>> {
    try {
      const description = task.description.toLowerCase();
      const textProcessingKeywords = [
        'text', 'analyze', 'count', 'extract', 'format', 
        'clean', 'transform', 'parse', 'process'
      ];

      const hasTextProcessing = textProcessingKeywords.some(keyword => 
        description.includes(keyword)
      );

      return createResult(hasTextProcessing);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to check text processing capability',
          { taskId: task.id, error }
        )
      );
    }
  }

  protected async* executeTask(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const taskType = task.type;
    const input = task.input as any;

    switch (taskType) {
      case 'analyze_text':
        yield* this.executeTextAnalysis(task, input);
        break;
      case 'transform_text':
        yield* this.executeTextTransformation(task, input);
        break;
      case 'extract_patterns':
        yield* this.executePatternExtraction(task, input);
        break;
      default:
        yield* this.executeInferredTextProcessing(task);
    }
  }

  private async* executeTextAnalysis(
    task: SubAgentTask,
    input: { text?: string; filePath?: string }
  ): AsyncGenerator<SubAgentProgress> {
    
    yield {
      taskId: task.id,
      stage: 'reading_content',
      progress: 0.1,
      message: 'Reading text content for analysis'
    };

    // Get text content
    let textContent = input.text;
    if (!textContent && input.filePath) {
      const readResult = await this.executeToolSafely('Read', {
        file_path: input.filePath
      });
      
      if (!readResult.success) {
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `Failed to read file: ${readResult.error.message}`
        };
        return;
      }
      
      textContent = readResult.value as string;
    }

    if (!textContent) {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: 'No text content provided for analysis'
      };
      return;
    }

    yield {
      taskId: task.id,
      stage: 'analyzing',
      progress: 0.5,
      message: 'Analyzing text content'
    };

    // Perform text analysis
    const analysis = this.performTextAnalysis(textContent);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: 'Text analysis completed',
      intermediateResults: {
        analysis,
        originalText: textContent.substring(0, 200) + '...',
        toolUsed: 'text_analysis'
      }
    };
  }

  private async* executeTextTransformation(
    task: SubAgentTask,
    input: { 
      text?: string; 
      filePath?: string; 
      transformation: 'uppercase' | 'lowercase' | 'title_case' | 'clean' | 'extract_emails';
      outputPath?: string;
    }
  ): AsyncGenerator<SubAgentProgress> {
    
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing ${input.transformation} transformation`
    };

    // Get text content (similar to analysis)
    let textContent = input.text;
    if (!textContent && input.filePath) {
      const readResult = await this.executeToolSafely('Read', {
        file_path: input.filePath
      });
      
      if (!readResult.success) {
        yield {
          taskId: task.id,
          stage: 'failed', 
          progress: 0,
          message: `Failed to read file: ${readResult.error.message}`
        };
        return;
      }
      
      textContent = readResult.value as string;
    }

    yield {
      taskId: task.id,
      stage: 'transforming',
      progress: 0.5,
      message: 'Applying text transformation'
    };

    // Apply transformation
    const transformedText = this.applyTextTransformation(textContent!, input.transformation);

    // Save result if output path provided
    if (input.outputPath) {
      yield {
        taskId: task.id,
        stage: 'saving',
        progress: 0.8,
        message: 'Saving transformed text'
      };

      const writeResult = await this.executeToolSafely('Write', {
        file_path: input.outputPath,
        content: transformedText
      });

      if (!writeResult.success) {
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `Failed to save transformed text: ${writeResult.error.message}`
        };
        return;
      }
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Text transformation (${input.transformation}) completed`,
      intermediateResults: {
        originalText: textContent?.substring(0, 100) + '...',
        transformedText: transformedText.substring(0, 100) + '...',
        transformation: input.transformation,
        outputPath: input.outputPath,
        toolUsed: 'text_transformation'
      }
    };
  }

  private async* executeInferredTextProcessing(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const description = task.description.toLowerCase();
    
    if (description.includes('analyze') || description.includes('count')) {
      yield* this.executeTextAnalysis(task, task.input as any);
    } else if (description.includes('transform') || description.includes('format')) {
      // Infer transformation type from description
      let transformation: any = 'clean';
      if (description.includes('uppercase')) transformation = 'uppercase';
      else if (description.includes('lowercase')) transformation = 'lowercase';
      
      yield* this.executeTextTransformation(task, {
        ...task.input as any,
        transformation
      });
    } else {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Could not infer text processing operation from: ${task.description}`
      };
    }
  }

  // Helper methods for text processing logic

  private performTextAnalysis(text: string): {
    wordCount: number;
    characterCount: number;
    lineCount: number;
    paragraphCount: number;
    averageWordsPerSentence: number;
    readabilityScore: number;
    topWords: Array<{ word: string; count: number }>;
  } {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const lines = text.split('\n');
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Count word frequency
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Get top 10 words
    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    // Simple readability score (Flesch formula approximation)
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = this.estimateAverageSyllables(words);
    const readabilityScore = Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord)
    ));

    return {
      wordCount: words.length,
      characterCount: text.length,
      lineCount: lines.length,
      paragraphCount: paragraphs.length,
      averageWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
      readabilityScore: Math.round(readabilityScore * 100) / 100,
      topWords
    };
  }

  private applyTextTransformation(text: string, transformation: string): string {
    switch (transformation) {
      case 'uppercase':
        return text.toUpperCase();
      case 'lowercase':
        return text.toLowerCase();
      case 'title_case':
        return text.replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
      case 'clean':
        return text
          .replace(/\s+/g, ' ')           // Multiple spaces to single space
          .replace(/\n\s*\n/g, '\n\n')    // Multiple newlines to double newline
          .trim();                        // Remove leading/trailing whitespace
      case 'extract_emails':
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = text.match(emailRegex) || [];
        return emails.join('\n');
      default:
        return text;
    }
  }

  private estimateAverageSyllables(words: string[]): number {
    const syllableCount = words.reduce((total, word) => {
      // Simple syllable estimation: count vowel groups
      const vowels = word.match(/[aeiouy]+/g) || [];
      return total + Math.max(1, vowels.length);
    }, 0);
    
    return syllableCount / words.length;
  }
}
```

### Step 2: Register the Sub-Agent

```typescript
// lib/src/agent/sub-agents/index.ts

export { TextProcessingSubAgent } from './text-processing/TextProcessingSubAgent.js';

// Update the registry
import { SubAgentRegistry } from './core/SubAgentRegistry.js';
import { TextProcessingSubAgent } from './text-processing/TextProcessingSubAgent.js';

export function registerDefaultSubAgents(registry: SubAgentRegistry, logger: AgentLogger): void {
  // Existing registrations...
  
  // Register text processing sub-agent
  registry.registerSubAgent({
    id: 'text-processing-agent',
    name: 'Text Processing Agent',
    version: '1.0.0',
    constructor: TextProcessingSubAgent,
    capabilities: [
      {
        type: 'custom',
        name: 'text_processing',
        description: 'Comprehensive text analysis and transformation',
        confidence: 0.9,
        domains: ['text', 'nlp', 'analysis'],
        toolRequirements: ['Read', 'Write', 'Edit']
      }
    ],
    defaultConfig: {
      maxRetries: 3,
      defaultTimeout: 30000
    },
    metadata: {
      author: 'Your Name',
      description: 'Handles text analysis and transformation tasks',
      documentation: 'https://docs.example.com/text-processing-agent',
      tags: ['text', 'nlp', 'analysis']
    }
  });
}
```

### Step 3: Create Unit Tests

```typescript
// lib/src/agent/sub-agents/text-processing/__tests__/TextProcessingSubAgent.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TextProcessingSubAgent } from '../TextProcessingSubAgent.js';
import { SubAgentTask, SubAgentContext } from '../../core/types.js';
import { AgentLogger } from '../../../config/logger.js';
import { MockToolExecutor } from '../../../__tests__/mocks/MockToolExecutor.js';

describe('TextProcessingSubAgent', () => {
  let subAgent: TextProcessingSubAgent;
  let logger: AgentLogger;
  let mockToolExecutor: MockToolExecutor;

  beforeEach(async () => {
    logger = new AgentLogger({ level: 'debug' });
    mockToolExecutor = new MockToolExecutor();
    subAgent = new TextProcessingSubAgent(logger);
    
    await subAgent.initialize({
      toolProvider: mockToolExecutor,
      logger
    });
  });

  afterEach(async () => {
    await subAgent.cleanup();
  });

  it('should handle text analysis tasks', async () => {
    const task: SubAgentTask = {
      id: 'test-task-1',
      type: 'analyze_text',
      description: 'Analyze the provided text content',
      input: {
        text: 'This is a sample text for analysis. It contains multiple sentences. The text is used for testing purposes.'
      },
      context: {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        availableTools: ['Read', 'Write'],
        workingDirectory: '/tmp'
      },
      priority: 'normal'
    };

    const canHandle = await subAgent.canHandle(task);
    expect(canHandle.success).toBe(true);
    expect(canHandle.value).toBe(true);

    // Execute the task
    const results = [];
    for await (const progress of subAgent.execute(task)) {
      results.push(progress);
    }

    const finalResult = results[results.length - 1];
    expect(finalResult.stage).toBe('completed');
    expect(finalResult.progress).toBe(1.0);
    expect(finalResult.intermediateResults).toHaveProperty('analysis');
    
    const analysis = finalResult.intermediateResults.analysis;
    expect(analysis.wordCount).toBeGreaterThan(0);
    expect(analysis.characterCount).toBeGreaterThan(0);
    expect(analysis.topWords).toBeInstanceOf(Array);
  });

  it('should handle text transformation tasks', async () => {
    const task: SubAgentTask = {
      id: 'test-task-2',
      type: 'transform_text',
      description: 'Transform text to uppercase',
      input: {
        text: 'hello world',
        transformation: 'uppercase'
      },
      context: {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        availableTools: ['Read', 'Write'],
        workingDirectory: '/tmp'
      },
      priority: 'normal'
    };

    const results = [];
    for await (const progress of subAgent.execute(task)) {
      results.push(progress);
    }

    const finalResult = results[results.length - 1];
    expect(finalResult.stage).toBe('completed');
    expect(finalResult.intermediateResults.transformedText).toContain('HELLO WORLD');
  });

  it('should handle file-based text processing', async () => {
    // Mock file reading
    mockToolExecutor.setMockResult('Read', 'Sample file content for testing.');

    const task: SubAgentTask = {
      id: 'test-task-3',
      type: 'analyze_text',
      description: 'Analyze text from file',
      input: {
        filePath: '/tmp/test.txt'
      },
      context: {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        availableTools: ['Read', 'Write'],
        workingDirectory: '/tmp'
      },
      priority: 'normal'
    };

    const results = [];
    for await (const progress of subAgent.execute(task)) {
      results.push(progress);
    }

    const finalResult = results[results.length - 1];
    expect(finalResult.stage).toBe('completed');
    expect(mockToolExecutor.getCallHistory('Read')).toHaveLength(1);
  });

  it('should reject tasks it cannot handle', async () => {
    const task: SubAgentTask = {
      id: 'test-task-4',
      type: 'compile_code',  // Not a text processing task
      description: 'Compile TypeScript code',
      input: {},
      context: {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        availableTools: ['Read', 'Write'],
        workingDirectory: '/tmp'
      },
      priority: 'normal'
    };

    const canHandle = await subAgent.canHandle(task);
    expect(canHandle.success).toBe(true);
    expect(canHandle.value).toBe(false);
  });

  it('should provide health status', async () => {
    const health = await subAgent.getHealth();
    expect(health.success).toBe(true);
    expect(health.value.status).toBe('healthy');
    expect(health.value.lastCheck).toBeInstanceOf(Date);
  });
});
```

## Tool-Specialized Sub-Agents

Tool-specialized sub-agents focus on optimizing the use of specific tools or tool categories.

### Key Design Principles

1. **Tool Expertise**: Deep understanding of tool capabilities and limitations
2. **Performance Optimization**: Caching, batching, and intelligent tool usage
3. **Error Recovery**: Tool-specific error handling and retry strategies
4. **Resource Management**: Efficient tool resource allocation

### Example: Advanced File Tool Sub-Agent

```typescript
export class AdvancedFileToolSubAgent extends BaseSubAgent {
  private fileCache = new LRUCache<string, { content: string; lastModified: Date }>(100);
  private batchOperations = new Map<string, BatchOperation>();

  public readonly capabilities: SubAgentCapability[] = [
    {
      type: 'file_operations',
      name: 'batch_file_processor',
      description: 'Efficiently process multiple files in batches',
      confidence: 0.95,
      domains: ['filesystem', 'batch_processing'],
      toolRequirements: ['Read', 'Write', 'Edit', 'Glob'],
      workflowPatterns: ['analytical', 'creative']
    }
  ];

  // Batch multiple file operations for efficiency
  private async* executeBatchFileOperations(
    task: SubAgentTask,
    input: { operations: FileOperation[] }
  ): AsyncGenerator<SubAgentProgress> {
    
    const batchId = `batch_${task.id}`;
    const operations = input.operations;
    
    // Group operations by type for optimization
    const operationGroups = this.groupOperationsByType(operations);
    
    let completedOperations = 0;
    const results = [];

    for (const [operationType, ops] of operationGroups) {
      yield {
        taskId: task.id,
        stage: `executing_${operationType}`,
        progress: completedOperations / operations.length,
        message: `Executing ${ops.length} ${operationType} operations`
      };

      switch (operationType) {
        case 'read':
          const readResults = await this.batchRead(ops as ReadOperation[]);
          results.push(...readResults);
          break;
        case 'write': 
          const writeResults = await this.batchWrite(ops as WriteOperation[]);
          results.push(...writeResults);
          break;
        case 'edit':
          const editResults = await this.batchEdit(ops as EditOperation[]);
          results.push(...editResults);
          break;
      }

      completedOperations += ops.length;
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Completed ${operations.length} file operations`,
      intermediateResults: {
        batchId,
        results,
        operationCount: operations.length,
        toolUsed: 'batch_file_operations'
      }
    };
  }

  // Intelligent caching for frequently accessed files
  private async readWithCache(filePath: string): Promise<Result<string, QiError>> {
    const cached = this.fileCache.get(filePath);
    if (cached) {
      // Check if file has been modified since cache
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime <= cached.lastModified) {
          return createResult(cached.content);
        }
      } catch {
        // If stat fails, proceed with fresh read
      }
    }

    // Read from file system
    const readResult = await this.executeToolSafely('Read', { file_path: filePath });
    if (readResult.success) {
      // Cache the result
      this.fileCache.set(filePath, {
        content: readResult.value as string,
        lastModified: new Date()
      });
    }

    return readResult;
  }

  // Batch multiple read operations
  private async batchRead(operations: ReadOperation[]): Promise<BatchResult[]> {
    // Group by directory for efficient reading
    const byDirectory = new Map<string, ReadOperation[]>();
    
    operations.forEach(op => {
      const dir = path.dirname(op.filePath);
      if (!byDirectory.has(dir)) {
        byDirectory.set(dir, []);
      }
      byDirectory.get(dir)!.push(op);
    });

    const results: BatchResult[] = [];
    
    for (const [directory, dirOps] of byDirectory) {
      // Read all files in this directory
      for (const op of dirOps) {
        const result = await this.readWithCache(op.filePath);
        results.push({
          operationId: op.id,
          success: result.success,
          result: result.success ? result.value : result.error
        });
      }
    }

    return results;
  }
}
```

## Workflow-Specialized Sub-Agents

Workflow-specialized sub-agents implement complete domain workflows.

### Key Design Principles

1. **Domain Expertise**: Deep knowledge of domain-specific processes
2. **Adaptive Workflow**: Dynamic execution based on intermediate results
3. **Knowledge Integration**: Leverage domain knowledge for better decisions
4. **End-to-End Ownership**: Responsible for complete workflow success

### Example: Advanced Code Review Sub-Agent

```typescript
export class CodeReviewSubAgent extends BaseSubAgent {
  private reviewTemplates: Map<string, ReviewTemplate>;
  private knowledgeBase: CodeReviewKnowledgeBase;

  public readonly capabilities: SubAgentCapability[] = [
    {
      type: 'custom',
      name: 'comprehensive_code_review',
      description: 'Perform thorough code reviews with multiple analysis dimensions',
      confidence: 0.9,
      domains: ['code_review', 'quality_assurance', 'security'],
      toolRequirements: ['Read', 'Grep', 'Write'],
      workflowPatterns: ['analytical', 'problem-solving']
    }
  ];

  protected async* executeTask(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    if (task.type === 'comprehensive_code_review') {
      yield* this.executeComprehensiveReview(task, task.input as any);
    }
  }

  private async* executeComprehensiveReview(
    task: SubAgentTask,
    input: { filePaths: string[]; reviewType: 'security' | 'performance' | 'quality' | 'comprehensive' }
  ): AsyncGenerator<SubAgentProgress> {
    
    const reviewStages = [
      'code_collection',      // 10%
      'static_analysis',      // 30%
      'security_analysis',    // 50% 
      'performance_analysis', // 70%
      'quality_analysis',     // 85%
      'report_generation'     // 100%
    ];

    let currentStage = 0;

    // Stage 1: Collect code files
    yield {
      taskId: task.id,
      stage: reviewStages[currentStage],
      progress: 0.1,
      message: `Collecting ${input.filePaths.length} files for review`
    };

    const codeFiles = await this.collectCodeFiles(input.filePaths);
    currentStage++;

    // Stage 2: Static analysis
    yield {
      taskId: task.id,
      stage: reviewStages[currentStage],
      progress: 0.3,
      message: 'Performing static code analysis'
    };

    const staticAnalysis = await this.performStaticAnalysis(codeFiles);
    currentStage++;

    // Stage 3: Security analysis
    if (input.reviewType === 'security' || input.reviewType === 'comprehensive') {
      yield {
        taskId: task.id,
        stage: reviewStages[currentStage],
        progress: 0.5,
        message: 'Analyzing security vulnerabilities'
      };

      const securityAnalysis = await this.performSecurityAnalysis(codeFiles);
      currentStage++;
    }

    // Stage 4: Performance analysis
    if (input.reviewType === 'performance' || input.reviewType === 'comprehensive') {
      yield {
        taskId: task.id,
        stage: reviewStages[currentStage],
        progress: 0.7,
        message: 'Analyzing performance patterns'
      };

      const performanceAnalysis = await this.performPerformanceAnalysis(codeFiles);
      currentStage++;
    }

    // Stage 5: Quality analysis
    yield {
      taskId: task.id,
      stage: reviewStages[currentStage],
      progress: 0.85,
      message: 'Analyzing code quality metrics'
    };

    const qualityAnalysis = await this.performQualityAnalysis(codeFiles);
    currentStage++;

    // Stage 6: Generate comprehensive report
    yield {
      taskId: task.id,
      stage: reviewStages[currentStage],
      progress: 0.95,
      message: 'Generating review report'
    };

    const report = await this.generateReviewReport({
      codeFiles,
      staticAnalysis,
      securityAnalysis: input.reviewType !== 'quality' ? securityAnalysis : undefined,
      performanceAnalysis: input.reviewType !== 'security' ? performanceAnalysis : undefined,
      qualityAnalysis
    });

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: 'Code review completed',
      intermediateResults: {
        reviewType: input.reviewType,
        filesReviewed: input.filePaths.length,
        report,
        summary: {
          totalIssues: report.issues.length,
          criticalIssues: report.issues.filter(i => i.severity === 'critical').length,
          recommendations: report.recommendations.length
        },
        toolUsed: 'comprehensive_code_review'
      }
    };
  }

  private async performStaticAnalysis(codeFiles: CodeFile[]): Promise<StaticAnalysisResult> {
    // Use Grep tool to find common patterns
    const patterns = [
      { name: 'TODO_comments', pattern: 'TODO|FIXME|XXX', severity: 'low' },
      { name: 'console_logs', pattern: 'console\\.log', severity: 'medium' },
      { name: 'debugger_statements', pattern: 'debugger', severity: 'high' },
      { name: 'hardcoded_credentials', pattern: 'password\\s*=\\s*["\']', severity: 'critical' }
    ];

    const findings = [];

    for (const pattern of patterns) {
      for (const file of codeFiles) {
        const searchResult = await this.executeToolSafely('Grep', {
          pattern: pattern.pattern,
          path: file.path,
          output_mode: 'content',
          '-n': true
        });

        if (searchResult.success) {
          const matches = (searchResult.value as string).split('\n').filter(Boolean);
          findings.push(...matches.map(match => ({
            file: file.path,
            pattern: pattern.name,
            match,
            severity: pattern.severity,
            line: this.extractLineNumber(match)
          })));
        }
      }
    }

    return {
      totalFindings: findings.length,
      findings,
      categories: this.categorizeFindings(findings)
    };
  }

  private async performSecurityAnalysis(codeFiles: CodeFile[]): Promise<SecurityAnalysisResult> {
    // Security-specific analysis patterns
    const securityPatterns = [
      { name: 'sql_injection', pattern: 'query.*\\+.*req\\.|SELECT.*\\+', severity: 'critical' },
      { name: 'xss_vulnerability', pattern: 'innerHTML.*req\\.|dangerouslySetInnerHTML', severity: 'high' },
      { name: 'weak_crypto', pattern: 'MD5|SHA1(?!\\d)', severity: 'medium' },
      { name: 'hardcoded_secrets', pattern: 'api[_-]?key.*=.*["\'][^"\']{20,}', severity: 'critical' }
    ];

    // Similar implementation to static analysis but with security focus
    const vulnerabilities = [];
    // ... implementation details

    return {
      totalVulnerabilities: vulnerabilities.length,
      vulnerabilities,
      riskScore: this.calculateSecurityRiskScore(vulnerabilities),
      compliance: {
        owasp: this.checkOwaspCompliance(vulnerabilities),
        gdpr: this.checkGdprCompliance(codeFiles)
      }
    };
  }

  private async generateReviewReport(analysisResults: {
    codeFiles: CodeFile[];
    staticAnalysis: StaticAnalysisResult;
    securityAnalysis?: SecurityAnalysisResult;
    performanceAnalysis?: PerformanceAnalysisResult;
    qualityAnalysis: QualityAnalysisResult;
  }): Promise<CodeReviewReport> {
    
    const report: CodeReviewReport = {
      summary: {
        filesReviewed: analysisResults.codeFiles.length,
        totalLines: analysisResults.codeFiles.reduce((sum, f) => sum + f.lineCount, 0),
        reviewTimestamp: new Date(),
        overallScore: 0 // Will be calculated
      },
      issues: [],
      recommendations: [],
      metrics: {}
    };

    // Aggregate issues from all analyses
    report.issues.push(...this.convertFindingsToIssues(analysisResults.staticAnalysis.findings));
    
    if (analysisResults.securityAnalysis) {
      report.issues.push(...this.convertVulnerabilitiesToIssues(analysisResults.securityAnalysis.vulnerabilities));
    }

    // Generate recommendations based on findings
    report.recommendations = this.generateRecommendations(report.issues);

    // Calculate overall score
    report.summary.overallScore = this.calculateOverallScore(report);

    return report;
  }
}

// Supporting interfaces for code review
interface CodeFile {
  path: string;
  content: string;
  lineCount: number;
  language: string;
}

interface ReviewIssue {
  id: string;
  file: string;
  line: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  suggestion?: string;
}

interface CodeReviewReport {
  summary: {
    filesReviewed: number;
    totalLines: number;
    reviewTimestamp: Date;
    overallScore: number;
  };
  issues: ReviewIssue[];
  recommendations: string[];
  metrics: Record<string, number>;
}
```

## Testing Sub-Agents

### Unit Testing Framework

```typescript
// lib/src/agent/sub-agents/__tests__/utils/SubAgentTestUtils.ts

export class SubAgentTestUtils {
  static createMockTask(overrides?: Partial<SubAgentTask>): SubAgentTask {
    return {
      id: 'test-task-' + Math.random().toString(36).substr(2, 9),
      type: 'test_task',
      description: 'Test task for unit testing',
      input: {},
      context: {
        sessionId: 'test-session',
        workflowId: 'test-workflow',
        availableTools: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
        workingDirectory: '/tmp/test'
      },
      priority: 'normal',
      ...overrides
    };
  }

  static createMockLogger(): AgentLogger {
    return new AgentLogger({ 
      level: 'debug',
      silent: true // Prevent test output noise
    });
  }

  static async executeSubAgentTask(
    subAgent: ISubAgent,
    task: SubAgentTask
  ): Promise<{
    progressUpdates: SubAgentProgress[];
    finalResult: SubAgentResult;
    executionTime: number;
  }> {
    const startTime = Date.now();
    const progressUpdates: SubAgentProgress[] = [];
    let finalResult: SubAgentResult;

    for await (const progress of subAgent.execute(task)) {
      progressUpdates.push(progress);
    }

    // The final result should be the return value, but if not available,
    // create one from the last progress update
    const lastProgress = progressUpdates[progressUpdates.length - 1];
    if (lastProgress && lastProgress.progress >= 1.0) {
      finalResult = {
        taskId: task.id,
        success: lastProgress.stage === 'completed',
        output: lastProgress.intermediateResults,
        metadata: {
          executionTime: Date.now() - startTime,
          toolsUsed: [],
          stagesCompleted: progressUpdates.map(p => p.stage),
          resourcesConsumed: {}
        }
      };
    } else {
      throw new Error('Sub-agent execution did not complete properly');
    }

    return {
      progressUpdates,
      finalResult,
      executionTime: Date.now() - startTime
    };
  }

  static assertProgressSequence(
    progressUpdates: SubAgentProgress[],
    expectedStages: string[]
  ): void {
    expect(progressUpdates.length).toBeGreaterThanOrEqual(expectedStages.length);
    
    // Check that progress is monotonically increasing
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i].progress).toBeGreaterThanOrEqual(
        progressUpdates[i - 1].progress
      );
    }

    // Check that expected stages are present
    const actualStages = progressUpdates.map(p => p.stage);
    for (const expectedStage of expectedStages) {
      expect(actualStages).toContain(expectedStage);
    }

    // Final progress should be 1.0
    const finalProgress = progressUpdates[progressUpdates.length - 1];
    expect(finalProgress.progress).toBe(1.0);
  }
}

export class MockToolExecutor implements IToolExecutor {
  private mockResults = new Map<string, unknown>();
  private callHistory = new Map<string, unknown[]>();

  setMockResult(toolName: string, result: unknown): void {
    this.mockResults.set(toolName, result);
  }

  async executeTool(toolName: string, parameters: unknown): Promise<Result<unknown, QiError>> {
    // Record the call
    if (!this.callHistory.has(toolName)) {
      this.callHistory.set(toolName, []);
    }
    this.callHistory.get(toolName)!.push(parameters);

    // Return mock result
    if (this.mockResults.has(toolName)) {
      return createResult(this.mockResults.get(toolName));
    } else {
      return createError(
        createAgentError(
          AgentErrorCategory.VALIDATION,
          `Mock tool ${toolName} not configured`,
          { toolName, parameters }
        )
      );
    }
  }

  isToolAvailable(toolName: string): boolean {
    return this.mockResults.has(toolName) || 
           ['Read', 'Write', 'Edit', 'Grep', 'Glob'].includes(toolName);
  }

  getAvailableTools(): string[] {
    return ['Read', 'Write', 'Edit', 'Grep', 'Glob', ...Array.from(this.mockResults.keys())];
  }

  getCallHistory(toolName: string): unknown[] {
    return this.callHistory.get(toolName) || [];
  }

  clearHistory(): void {
    this.callHistory.clear();
  }
}
```

### Integration Testing

```typescript
// lib/src/agent/sub-agents/__tests__/integration/SubAgentWorkflowIntegration.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { QiWorkflowEngine } from '../../../workflow/impl/QiWorkflowEngine.js';
import { SubAgentRegistry } from '../../core/SubAgentRegistry.js';
import { WorkflowSubAgentOrchestrator } from '../../integration/SubAgentOrchestrator.js';
import { FileToolSubAgent } from '../../tool-specialized/FileToolSubAgent.js';
import { TextProcessingSubAgent } from '../../text-processing/TextProcessingSubAgent.js';

describe('Sub-Agent Workflow Integration', () => {
  let workflowEngine: QiWorkflowEngine;
  let subAgentRegistry: SubAgentRegistry;
  let orchestrator: WorkflowSubAgentOrchestrator;

  beforeEach(async () => {
    workflowEngine = new QiWorkflowEngine({
      enableCheckpointing: false,
      maxExecutionTime: 30000,
      enableStreaming: true
    });

    subAgentRegistry = new SubAgentRegistry();
    
    // Register sub-agents
    await subAgentRegistry.registerSubAgent({
      id: 'file-tool-agent',
      name: 'File Tool Agent', 
      version: '1.0.0',
      constructor: FileToolSubAgent,
      capabilities: [...], // Full capability definitions
      defaultConfig: {},
      metadata: {
        author: 'Test',
        description: 'Test file operations',
        documentation: '',
        tags: ['file']
      }
    });

    await subAgentRegistry.registerSubAgent({
      id: 'text-processing-agent',
      name: 'Text Processing Agent',
      version: '1.0.0', 
      constructor: TextProcessingSubAgent,
      capabilities: [...], // Full capability definitions
      defaultConfig: {},
      metadata: {
        author: 'Test',
        description: 'Test text processing',
        documentation: '',
        tags: ['text']
      }
    });

    orchestrator = new WorkflowSubAgentOrchestrator(workflowEngine, subAgentRegistry);
  });

  it('should execute a workflow with sub-agent nodes', async () => {
    // Define workflow that uses sub-agents
    const workflowSpec = {
      pattern: 'text_analysis_pipeline',
      nodes: [
        {
          id: 'read_file',
          type: 'sub-agent',
          subAgentId: 'file-tool-agent',
          task: {
            type: 'read_file',
            input: { filePath: '/tmp/sample.txt' }
          }
        },
        {
          id: 'analyze_text',
          type: 'sub-agent',
          subAgentId: 'text-processing-agent',
          task: {
            type: 'analyze_text',
            input: { text: '${nodes.read_file.output.content}' }
          }
        }
      ],
      edges: [
        { from: 'read_file', to: 'analyze_text' }
      ]
    };

    const result = await orchestrator.executeWorkflow(workflowSpec, {
      input: 'Analyze the sample text file'
    });

    expect(result.success).toBe(true);
    expect(result.output).toBeDefined();
    
    // Verify both sub-agents were executed
    const subAgentResults = result.subAgentResults;
    expect(subAgentResults.has('read_file')).toBe(true);
    expect(subAgentResults.has('analyze_text')).toBe(true);
    
    // Verify data flow between sub-agents
    const readResult = subAgentResults.get('read_file');
    const analysisResult = subAgentResults.get('analyze_text');
    
    expect(readResult.success).toBe(true);
    expect(analysisResult.success).toBe(true);
    expect(analysisResult.output).toHaveProperty('analysis');
  });

  it('should handle sub-agent failures gracefully', async () => {
    // Test workflow with a failing sub-agent
    const workflowSpec = {
      pattern: 'failing_pipeline',
      nodes: [
        {
          id: 'read_nonexistent',
          type: 'sub-agent',
          subAgentId: 'file-tool-agent',
          task: {
            type: 'read_file',
            input: { filePath: '/nonexistent/file.txt' }
          },
          errorHandling: 'continue'
        },
        {
          id: 'fallback_analysis',
          type: 'sub-agent',
          subAgentId: 'text-processing-agent',
          task: {
            type: 'analyze_text',
            input: { text: 'fallback text for analysis' }
          }
        }
      ],
      edges: [
        { 
          from: 'read_nonexistent', 
          to: 'fallback_analysis',
          condition: 'on_failure'
        }
      ]
    };

    const result = await orchestrator.executeWorkflow(workflowSpec, {
      input: 'Handle failure scenario'
    });

    // Workflow should complete despite sub-agent failure
    expect(result.success).toBe(true);
    
    // First sub-agent should fail, second should succeed
    const readResult = result.subAgentResults.get('read_nonexistent');
    const analysisResult = result.subAgentResults.get('fallback_analysis');
    
    expect(readResult.success).toBe(false);
    expect(analysisResult.success).toBe(true);
  });
});
```

This comprehensive development guide provides everything needed to create, test, and integrate custom sub-agents into the qi-v2-agent system. The modular design allows for easy extension while maintaining consistency and reliability across the entire system.