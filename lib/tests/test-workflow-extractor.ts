#!/usr/bin/env node

/**
 * Test the QiWorkflowExtractor to see what it generates and verify it works
 */

import { QiWorkflowExtractor } from '@qi/agent/workflow/impl/QiWorkflowExtractor.js';
import type { IWorkflowExtractorConfig } from '@qi/agent/workflow/interfaces/IWorkflowExtractor.js';

async function testWorkflowExtractor() {
  console.log('🔍 Testing QiWorkflowExtractor...\n');

  try {
    // Create workflow extractor with same config structure
    console.log('📋 Creating QiWorkflowExtractor...');
    const config: IWorkflowExtractorConfig = {
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
      modelId: 'qwen3:14b',
      temperature: 0.2,
      maxTokens: 2000
    };

    const extractor = new QiWorkflowExtractor(config);

    // Test complex workflow extraction cases
    const testCases = [
      "fix the bug in src/main.ts and run tests",
      "create a new user authentication system with tests and documentation", 
      "analyze the performance bottlenecks in the database and optimize queries",
      "build a REST API for user management with validation and error handling"
    ];

    for (const testInput of testCases) {
      console.log(`\n🧪 Testing: "${testInput}"`);
      console.log('=' + '='.repeat(testInput.length + 12));

      const startTime = Date.now();
      const result = await extractor.extractWorkflow(testInput, {
        sessionId: 'test-session',
        timestamp: new Date(),
        source: 'test',
        environmentContext: new Map([
          ['workingDirectory', process.cwd()],
          ['userId', 'test-user']
        ])
      });
      const duration = Date.now() - startTime;

      if (result.success && result.workflowSpec) {
        console.log(`✅ Success: ${result.mode} mode (confidence: ${result.confidence}, ${duration}ms)`);
        console.log(`   Pattern: ${result.pattern}`);
        console.log(`   Workflow: ${result.workflowSpec.name}`);
        console.log(`   Description: ${result.workflowSpec.description}`);
        console.log(`   Nodes: ${result.workflowSpec.nodes.length}`);
        console.log(`   Node types: ${result.workflowSpec.nodes.map(n => n.type).join(', ')}`);
        console.log(`   Edges: ${result.workflowSpec.edges.length}`);
        
        // Show first few nodes as example
        if (result.workflowSpec.nodes.length > 0) {
          console.log('\n   📋 Sample Nodes:');
          result.workflowSpec.nodes.slice(0, 3).forEach((node, i) => {
            console.log(`     ${i + 1}. ${node.name} (${node.type})`);
          });
        }

        // Show execution flow
        if (result.workflowSpec.edges.length > 0) {
          console.log('\n   🔄 Execution Flow:');
          result.workflowSpec.edges.slice(0, 3).forEach(edge => {
            const fromNode = result.workflowSpec!.nodes.find(n => n.id === edge.from);
            const toNode = result.workflowSpec!.nodes.find(n => n.id === edge.to);
            console.log(`     ${fromNode?.name || edge.from} → ${toNode?.name || edge.to}`);
          });
        }
      } else {
        console.log(`❌ Failed: ${result.error || 'Unknown error'} (${duration}ms)`);
        console.log(`   Mode: ${result.mode}, Confidence: ${result.confidence}`);
      }
    }

    console.log('\n📊 Workflow Extractor Test Summary:');
    console.log('   • Converts natural language to structured workflows');
    console.log('   • Generates nodes with types: input, processing, tool, reasoning, output, decision, validation');
    console.log('   • Creates execution flow with edges between nodes');
    console.log('   • Provides mode detection and confidence scoring');
    console.log('   • Validates workflow specifications');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('This indicates the workflow extractor has issues');
  }
}

testWorkflowExtractor().catch(console.error);