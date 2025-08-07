#!/usr/bin/env node

/**
 * Test classifier debugging to identify the hanging issue
 */

import { createStateManager } from '@qi/agent/state/index.js';
import { createInputClassifier } from '@qi/lib/classifier/index.js';

async function testClassifier() {
  console.log('🧪 Testing classifier with debug output...\n');

  try {
    // Setup StateManager and load LLM config
    console.log('📋 Creating StateManager...');
    const stateManager = createStateManager();
    const configPath = '../config';
    await stateManager.loadLLMConfig(configPath);
    console.log('✅ LLM configuration loaded');

    // Get classifier config from StateManager
    const classifierConfig = stateManager.getClassifierConfig();
    if (!classifierConfig) {
      throw new Error('Classifier configuration not found');
    }
    console.log('🔧 Classifier config:', classifierConfig);

    // Create classifier with role-specific config
    console.log('🔍 Creating classifier...');
    const classifier = createInputClassifier({
      method: 'rule-based',
      confidenceThreshold: 0.8,
      commandPrefix: '/',
      promptIndicators: [
        'hi', 'hello', 'thanks', 'what', 'how', 'why', 'when', 
        'can you', 'could you', 'please', 'explain', 'write', 'create'
      ],
      workflowIndicators: [
        'fix', 'refactor', 'implement', 'debug', 'analyze', 
        'build', 'design', 'test', 'deploy'
      ]
    });

    // Test input that should trigger LLM classification
    const testInput = "write a snake program in typescript";
    console.log(`\n🧪 Testing input: "${testInput}"`);
    console.log('Expected: Should be classified as "prompt" but with low rule confidence (0.7), triggering LLM classification\n');

    // Add timeout to prevent hanging
    const classificationPromise = classifier.classify(testInput, {
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

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Test timeout after 10 seconds')), 10000)
    );

    const result = await Promise.race([classificationPromise, timeoutPromise]);
    
    console.log('\n✅ Classification result:');
    console.log('Type:', result.type);
    console.log('Confidence:', result.confidence);
    console.log('Method:', result.method);
    console.log('Reasoning:', result.reasoning);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('This indicates the classifier is hanging during LLM classification');
  }
}

testClassifier().catch(console.error);