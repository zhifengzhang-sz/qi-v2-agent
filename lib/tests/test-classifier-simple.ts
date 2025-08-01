#!/usr/bin/env node

/**
 * Simple test to verify classifier methods work
 */

import { createStateManager } from '@qi/agent/state/index.js';

async function testClassifierMethods() {
  console.log('🔍 Testing Classifier Methods...\n');

  try {
    // Test rule-based
    const { RuleBasedClassificationMethod } = await import('./src/classifier/impl/rule-based-classification-method.js');
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

    // Test LLM-based  
    const { LLMClassificationMethod } = await import('./src/classifier/impl/llm-classification-method.js');
    const llmClassifier = new LLMClassificationMethod({
      baseUrl: 'http://172.18.144.1:11434',
      modelId: 'qwen3:14b',
      temperature: 0.1,
      maxTokens: 200
    });

    const llmResult = await llmClassifier.classify(testInput);
    console.log(`LLM-based: ${llmResult.type} (${llmResult.confidence})`);

    // Simulate hybrid
    const useRule = ruleResult.confidence >= 0.8;
    const hybridResult = useRule ? ruleResult : llmResult;
    console.log(`Hybrid: ${hybridResult.type} (${hybridResult.confidence}) [used ${useRule ? 'rule' : 'LLM'}]`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testClassifierMethods().catch(console.error);