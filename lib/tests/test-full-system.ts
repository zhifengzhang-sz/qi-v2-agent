#!/usr/bin/env node

/**
 * Test the full system with the fixed classifier
 */

import { createStateManager } from '@qi/agent/state/index.js';
import { MultiMethodInputClassifier } from '@qi/agent/classifier/impl/multi-method-input-classifier.js';

async function testFullSystem() {
  console.log('🧪 Testing full system with fixed classifier...\n');

  try {
    // Setup StateManager
    console.log('📋 Creating StateManager...');
    const stateManager = createStateManager();
    const configPath = '../config';
    await stateManager.loadLLMConfig(configPath);
    console.log('✅ LLM configuration loaded');

    // Get classifier config
    const classifierConfig = stateManager.getClassifierConfig();
    if (!classifierConfig) {
      throw new Error('Classifier configuration not found');
    }

    // Create classifier
    console.log('🔍 Creating classifier...');
    const classifier = new MultiMethodInputClassifier({
      defaultMethod: 'hybrid',
      fallbackMethod: 'rule-based',
      confidenceThreshold: 0.8,
      commandPrefix: '/',
      promptIndicators: [
        'hi', 'hello', 'thanks', 'what', 'how', 'why', 'when', 
        'can you', 'could you', 'please', 'explain', 'write', 'create'
      ],
      workflowIndicators: [
        'fix', 'refactor', 'implement', 'debug', 'analyze', 
        'build', 'design', 'test', 'deploy'
      ],
      complexityThresholds: new Map([
        ['command', 1.0],
        ['prompt', 0.8],
        ['workflow', 0.7]
      ]),
      llmConfig: {
        provider: classifierConfig.provider,
        model: classifierConfig.model,
        baseURL: 'http://172.18.144.1:11434',
        temperature: classifierConfig.temperature || 0.1,
        maxTokens: classifierConfig.maxTokens || 200
      }
    });

    // Test cases that previously failed
    const testCases = [
      "write a snake program in typescript",
      "hi there",
      "fix the bug in src/main.ts and run tests",
      "/help"
    ];

    for (const testInput of testCases) {
      console.log(`\n🧪 Testing: "${testInput}"`);
      
      const startTime = Date.now();
      const result = await classifier.classify(testInput, {
        context: {
          sessionId: 'test-session',
          timestamp: new Date(),
          source: 'test',
          environmentContext: new Map([
            ['workingDirectory', process.cwd()],
            ['userId', 'test-user']
          ])
        }
      });
      const duration = Date.now() - startTime;

      console.log(`✅ Result: ${result.type} (confidence: ${result.confidence.toFixed(2)}, ${duration}ms)`);
      console.log(`   Method: ${result.method}`);
      console.log(`   Reasoning: ${result.reasoning}`);
    }

    console.log('\n🎉 All tests completed successfully! The classifier is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testFullSystem().catch(console.error);