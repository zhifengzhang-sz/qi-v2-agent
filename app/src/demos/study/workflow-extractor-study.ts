#!/usr/bin/env node

/**
 * Workflow Extractor Research Study
 * 
 * Comprehensive study of workflow extraction performance across different models
 * to understand workflow generation quality, validation success rates, and complexity handling.
 */

import { QiWorkflowExtractor } from '../../workflow/impl/QiWorkflowExtractor.js';
import type { IWorkflowExtractorConfig } from '../../workflow/interfaces/IWorkflowExtractor.js';
import type { WorkflowExtractionResult, WorkflowSpec } from '../../workflow/interfaces/IWorkflow.js';

interface WorkflowTestCase {
  input: string;
  complexity: 'simple' | 'moderate' | 'complex';
  category: string;
  expectedMode: string;
  minNodes: number;
  maxNodes: number;
}

interface WorkflowStudyResult {
  model: string;
  successRate: number;
  avgLatency: number;
  avgConfidence: number;
  avgNodeCount: number;
  avgEdgeCount: number;
  validationSuccessRate: number;
  successfulCases: number;
  totalCases: number;
  errors: string[];
  detailedResults: Array<{
    input: string;
    success: boolean;
    mode: string;
    confidence: number;
    latency: number;
    nodeCount: number;
    edgeCount: number;
    validationPassed: boolean;
    workflowName?: string;
    error?: string;
  }>;
}

export class WorkflowExtractorStudy {
  private testCases: WorkflowTestCase[] = [
    // Simple workflow cases
    {
      input: 'fix the bug in main.ts',
      complexity: 'simple',
      category: 'bug-fix',
      expectedMode: 'problem-solving',
      minNodes: 2,
      maxNodes: 5
    },
    {
      input: 'run the tests',
      complexity: 'simple', 
      category: 'testing',
      expectedMode: 'analytical',
      minNodes: 2,
      maxNodes: 4
    },
    {
      input: 'deploy to staging',
      complexity: 'simple',
      category: 'deployment',
      expectedMode: 'general',
      minNodes: 2,
      maxNodes: 4
    },

    // Moderate workflow cases
    {
      input: 'fix the bug in src/main.ts and run tests',
      complexity: 'moderate',
      category: 'bug-fix-test',
      expectedMode: 'problem-solving',
      minNodes: 3,
      maxNodes: 6
    },
    {
      input: 'refactor the authentication module and update documentation',  
      complexity: 'moderate',
      category: 'refactoring',
      expectedMode: 'creative',
      minNodes: 3,
      maxNodes: 7
    },
    {
      input: 'implement user registration with email validation',
      complexity: 'moderate',
      category: 'feature-development',
      expectedMode: 'creative',
      minNodes: 4,
      maxNodes: 8
    },
    {
      input: 'analyze database performance and generate report',
      complexity: 'moderate',
      category: 'analysis',
      expectedMode: 'analytical', 
      minNodes: 3,
      maxNodes: 6
    },

    // Complex workflow cases
    {
      input: 'create a new user authentication system with tests and documentation',
      complexity: 'complex',
      category: 'full-feature-development',
      expectedMode: 'creative',
      minNodes: 5,
      maxNodes: 12
    },
    {
      input: 'analyze the performance bottlenecks in the database and optimize queries',
      complexity: 'complex',
      category: 'performance-optimization',
      expectedMode: 'analytical',
      minNodes: 5,
      maxNodes: 10
    },
    {
      input: 'build a REST API for user management with validation and error handling',
      complexity: 'complex',
      category: 'api-development',
      expectedMode: 'creative',
      minNodes: 6,
      maxNodes: 12
    },
    {
      input: 'implement CI/CD pipeline with testing, linting, security scanning, and deployment',
      complexity: 'complex',
      category: 'devops',
      expectedMode: 'analytical',
      minNodes: 7,
      maxNodes: 15
    },
    {
      input: 'migrate legacy authentication system to OAuth2 with backward compatibility and testing',
      complexity: 'complex',
      category: 'migration',
      expectedMode: 'problem-solving',
      minNodes: 6,
      maxNodes: 12
    },

    // Edge cases
    {
      input: 'create microservices architecture with service discovery, load balancing, and monitoring',
      complexity: 'complex',
      category: 'architecture',
      expectedMode: 'analytical',
      minNodes: 8,
      maxNodes: 18
    },
    {
      input: 'setup development environment',
      complexity: 'simple',
      category: 'setup',
      expectedMode: 'general',
      minNodes: 2,
      maxNodes: 5
    }
  ];

  private models: string[];

  constructor(models?: string[]) {
    this.models = models || ['qwen2.5-coder:7b']; // Default benchmark model
  }

  private config: IWorkflowExtractorConfig = {
    supportedModes: [
      { name: 'creative', description: 'Creative and generative tasks' },
      { name: 'analytical', description: 'Analysis and reasoning tasks' },
      { name: 'problem-solving', description: 'Problem solving and debugging' },
      { name: 'general', description: 'General purpose tasks' }
    ],
    patternMapping: [
      ['creative', 'generate-implement-validate'],
      ['analytical', 'analyze-reason-conclude'],
      ['problem-solving', 'identify-debug-fix'],
      ['general', 'input-process-output']
    ],
    baseUrl: 'http://172.18.144.1:11434',
    temperature: 0.2,
    maxTokens: 3000
  };

  async runStudy(): Promise<Map<string, WorkflowStudyResult>> {
    console.log(`🔍 Workflow Extractor Study: ${this.testCases.length} test cases, ${this.models.length} model(s)\n`);

    const results = new Map<string, WorkflowStudyResult>();

    for (const model of this.models) {
      process.stdout.write(`Testing ${model}... `);
      
      try {
        const result = await this.testModel(model);
        results.set(model, result);
        console.log(`✅ ${result.successRate.toFixed(1)}%`);
      } catch (error) {
        console.log(`❌ Failed`);
        results.set(model, {
          model,
          successRate: 0,
          avgLatency: 0,
          avgConfidence: 0,
          avgNodeCount: 0,
          avgEdgeCount: 0,
          validationSuccessRate: 0,
          successfulCases: 0,
          totalCases: this.testCases.length,
          errors: [error instanceof Error ? error.message : String(error)],
          detailedResults: []
        });
      }
    }

    this.generateReport(results);
    return results;
  }

  private async testModel(model: string): Promise<WorkflowStudyResult> {
    // Create extractor with user config but override the model
    const extractor = new QiWorkflowExtractor({
      supportedModes: this.config.supportedModes,
      patternMapping: this.config.patternMapping,
      baseUrl: this.config.baseUrl || 'http://172.18.144.1:11434', // Use user's URL from config
      modelId: model, // Override with command line model parameter
      temperature: this.config.temperature || 0.2,
      maxTokens: this.config.maxTokens || 3000
    });

    const detailedResults = [];
    let successfulCases = 0;
    let validationSuccesses = 0;
    let totalLatency = 0;
    let totalConfidence = 0;
    let totalNodes = 0;
    let totalEdges = 0;
    const errors: string[] = [];

    for (const testCase of this.testCases) {
      try {
        const startTime = Date.now();
        const result = await extractor.extractWorkflow(testCase.input, {
          sessionId: 'study-session',
          timestamp: new Date(),
          source: 'study',
          environmentContext: new Map([
            ['workingDirectory', process.cwd()],
            ['userId', 'study-user']
          ])
        });
        const latency = Date.now() - startTime;

        const nodeCount = result.workflowSpec?.nodes.length || 0;
        const edgeCount = result.workflowSpec?.edges.length || 0;
        const validationPassed = result.success && nodeCount >= testCase.minNodes && nodeCount <= testCase.maxNodes;

        if (result.success) {
          successfulCases++;
          totalNodes += nodeCount;
          totalEdges += edgeCount;
          totalConfidence += result.confidence;
        }

        if (validationPassed) {
          validationSuccesses++;
        }

        detailedResults.push({
          input: testCase.input,
          success: result.success,
          mode: result.mode,
          confidence: result.confidence,
          latency,
          nodeCount,
          edgeCount,
          validationPassed,
          workflowName: result.workflowSpec?.name,
          error: result.error
        });

        totalLatency += latency;
      } catch (error) {
        errors.push(`${testCase.input}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }


    const successRate = (successfulCases / this.testCases.length) * 100;
    const validationSuccessRate = (validationSuccesses / this.testCases.length) * 100;
    const avgLatency = totalLatency / this.testCases.length;
    const avgConfidence = successfulCases > 0 ? totalConfidence / successfulCases : 0;
    const avgNodeCount = successfulCases > 0 ? totalNodes / successfulCases : 0;
    const avgEdgeCount = successfulCases > 0 ? totalEdges / successfulCases : 0;

    return {
      model,
      successRate,
      avgLatency,
      avgConfidence,
      avgNodeCount,
      avgEdgeCount,
      validationSuccessRate,
      successfulCases,
      totalCases: this.testCases.length,
      errors,
      detailedResults
    };
  }

  private generateReport(results: Map<string, WorkflowStudyResult>): void {
    console.log('\n📊 WORKFLOW EXTRACTOR RESULTS');
    console.log('─'.repeat(95));

    // Clean table with essential data
    const colWidths = [25, 10, 10, 12, 12, 10, 15];
    const headers = ['Model', 'Success%', 'Valid%', 'Latency', 'Confidence', 'Nodes', 'Errors'];
    
    // Header
    let header = '';
    headers.forEach((h, i) => {
      header += h.padEnd(colWidths[i]);
    });
    console.log(header);
    console.log('─'.repeat(95));

    // Sort by success rate
    const sortedResults = Array.from(results.entries()).sort((a, b) => b[1].successRate - a[1].successRate);
    
    // Data rows
    for (const [model, result] of sortedResults) {
      const row = [
        model,
        `${result.successRate.toFixed(1)}%`,
        `${result.validationSuccessRate.toFixed(1)}%`,
        `${result.avgLatency.toFixed(0)}ms`,
        result.avgConfidence.toFixed(2),
        result.avgNodeCount.toFixed(1),
        result.errors.length.toString()
      ];
      
      let line = '';
      row.forEach((cell, i) => {
        line += cell.padEnd(colWidths[i]);
      });
      console.log(line);
    }

    console.log('─'.repeat(95));
    
    // Best performer summary
    const best = sortedResults[0];
    if (best && best[1].successRate > 0) {
      console.log(`🏆 Best: ${best[0]} (${best[1].successRate.toFixed(1)}% success, ${best[1].avgLatency.toFixed(0)}ms latency, ${best[1].avgNodeCount.toFixed(1)} avg nodes)`);
    }
  }

}

// Parse command line arguments
function parseArgs(): string[] {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📋 Using default benchmark model: qwen2.5-coder:7b');
    console.log('💡 Usage: bun workflow-extractor-study.ts [model1] [model2] ...');
    console.log('💡 Example: bun workflow-extractor-study.ts qwen3:30b-a3b qwen2.5-coder:14b');
    return ['qwen2.5-coder:7b'];
  }
  
  console.log(`📋 Testing models: ${args.join(', ')}`);
  return args;
}

// Run the study
async function main() {
  const models = parseArgs();
  const study = new WorkflowExtractorStudy(models);
  await study.runStudy();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}