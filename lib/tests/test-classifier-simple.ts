#!/usr/bin/env node

/**
 * Simple test to verify classifier methods work
 */

import { createStateManager } from '@qi/agent/state/index.js';

async function testClassifierMethods() {
  console.log('🔍 Testing Classifier Methods...\n');

  try {
    // Test rule-based
    const { RuleBasedClassificationMethod } = await import('@qi/lib/classifier/impl/rule-based.js');
    const ruleClassifier = new RuleBasedClassificationMethod({
      commandPrefix: '/',
      promptIndicators: ['hi', 'hello', 'what', 'write'],
      workflowIndicators: ['fix', 'refactor', 'build'],
      complexityThresholds: new Map([
        ['command', 1.0],
        ['prompt', 0.8],
        ['workflow', 0.7]
      ])
    });

    const testInput = "write a snake program";
    console.log(`Input: "${testInput}"`);
    
    const ruleResult = await ruleClassifier.classify(testInput);
    console.log(`Rule-based: ${ruleResult.type} (${ruleResult.confidence})`);

    // Test LangChain function calling method  
    const { LangChainFunctionCallingClassificationMethod } = await import('@qi/lib/classifier/impl/langchain-function-calling.js');
    const llmClassifier = new LangChainFunctionCallingClassificationMethod({
      baseUrl: 'http://172.18.144.1:11434',
      modelId: 'qwen3:14b',
      temperature: 0.1,
      schemaName: 'minimal'
    });

    const llmResult = await llmClassifier.classify(testInput);
    console.log(`LangChain function calling: ${llmResult.type} (${llmResult.confidence})`);

    // Simulate hybrid
    const useRule = ruleResult.confidence >= 0.8;
    const hybridResult = useRule ? ruleResult : llmResult;
    console.log(`Hybrid: ${hybridResult.type} (${hybridResult.confidence}) [used ${useRule ? 'rule' : 'LLM'}]`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testClassifierMethods().catch(console.error);