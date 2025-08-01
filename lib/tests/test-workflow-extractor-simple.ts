#!/usr/bin/env node

/**
 * Simple test to demonstrate working workflow extractor
 */

import { QiWorkflowExtractor } from '@qi/agent/workflow/impl/QiWorkflowExtractor.js';

async function testWorkflowExtractorSimple() {
  console.log('🔍 Testing QiWorkflowExtractor - Simple Demo...\n');

  const config = {
    supportedModes: [
      { name: 'creative', description: 'Creative and generative tasks' },
      { name: 'problem-solving', description: 'Problem solving and debugging' }
    ],
    patternMapping: [
      ['creative', 'generate-implement-validate'],
      ['problem-solving', 'identify-debug-fix']
    ],
    baseUrl: 'http://172.18.144.1:11434',
    modelId: 'qwen2.5-coder:7b',
    temperature: 0.2
  };

  const extractor = new QiWorkflowExtractor(config);

  const result = await extractor.extractWorkflow("fix the bug in src/main.ts and run tests");

  if (result.success && result.workflowSpec) {
    console.log('✅ Workflow Extraction Success!');
    console.log(`   Name: ${result.workflowSpec.name}`);
    console.log(`   Mode: ${result.mode} (${result.confidence})`);
    console.log(`   Pattern: ${result.pattern}`);
    console.log(`   Description: ${result.workflowSpec.description}`);
    
    console.log('\n📋 Workflow Nodes:');
    result.workflowSpec.nodes.forEach((node, i) => {
      console.log(`   ${i + 1}. ${node.name} (${node.type})`);
    });
    
    console.log('\n🔄 Execution Flow:');
    result.workflowSpec.edges.forEach(edge => {
      const fromNode = result.workflowSpec!.nodes.find(n => n.id === edge.from);
      const toNode = result.workflowSpec!.nodes.find(n => n.id === edge.to);
      console.log(`   ${fromNode?.name || edge.from} → ${toNode?.name || edge.to}`);
    });

    console.log('\n🎯 What This Shows:');
    console.log('   • Natural language → structured workflow specification');
    console.log('   • Workflow nodes with specific types and responsibilities'); 
    console.log('   • Execution flow between nodes');
    console.log('   • Mode detection and confidence scoring');
    console.log('   • Ready for workflow engine execution');
  } else {
    console.log(`❌ Failed: ${result.error}`);
  }
}

testWorkflowExtractorSimple().catch(console.error);