#!/usr/bin/env node

/**
 * Test Working LLM Classification Method
 * 
 * Tests the original working LLMClassificationMethod with OllamaStructuredWrapper
 * to prove the project has working LLM classification.
 */

import { createInputClassifier } from '@qi/agent/classifier';
import { createStateManager } from '@qi/agent/state';

async function testWorkingLLMMethod(): Promise<void> {
  console.log('🚀 TESTING WORKING LLM CLASSIFICATION METHOD');
  console.log('=============================================\n');

  // Initialize state manager and config
  const stateManager = createStateManager();
  const configPath = join(__dirname, '..', '..', '..', '..', '..', 'config');
  await stateManager.loadLLMConfig(configPath);

  const classifierConfig = stateManager.getClassifierConfig();
  const llmConfig = stateManager.getLLMConfigForPromptModule();
  
  if (!classifierConfig || !llmConfig?.llm?.providers?.ollama) {
    console.error('❌ Configuration not available');
    return;
  }

  // Create the working classifier (uses InputClassifier interface)
  const classifier = createInputClassifier({
    method: 'langchain-structured',
    baseUrl: llmConfig.llm.providers.ollama.baseURL + '/v1',
    modelId: process.env.MODEL_ID || 'qwen2.5-coder:7b',
    temperature: 0.1,
    maxTokens: 1000,
  });

  console.log(`✅ Using InputClassifier with LangChain method`);
  console.log(`🔧 Model: ${process.env.MODEL_ID || 'qwen2.5-coder:7b'}`);
  console.log(`🔧 Base URL: ${llmConfig.llm.providers.ollama.baseURL}\n`);

  // Test cases that should demonstrate real classification
  const testCases = [
    { input: '/help', expected: 'command' },
    { input: 'hi there', expected: 'prompt' },
    { input: 'fix the bug in auth.js and run tests', expected: 'workflow' },
    { input: 'what is recursion?', expected: 'prompt' },
    { input: '/config set theme dark', expected: 'command' },
    { input: 'create a new feature with tests and documentation', expected: 'workflow' }
  ];

  console.log('🧪 Testing classification accuracy...\n');

  let correct = 0;
  let totalConfidence = 0;
  let totalLatency = 0;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    const startTime = Date.now();
    
    try {
      const result = await classifier.classify(testCase.input);
      const latency = Date.now() - startTime;
      const isCorrect = result.type === testCase.expected;
      
      if (isCorrect) correct++;
      totalConfidence += result.confidence;
      totalLatency += latency;
      
      console.log(`[${i + 1}/${testCases.length}] "${testCase.input}"`);
      console.log(`   Expected: ${testCase.expected}, Got: ${result.type} ${isCorrect ? '✅' : '❌'}`);
      console.log(`   Confidence: ${result.confidence.toFixed(3)}, Latency: ${latency}ms`);
      console.log(`   Reasoning: ${result.reasoning}`);
      console.log();
      
    } catch (error) {
      console.log(`[${i + 1}/${testCases.length}] "${testCase.input}"`);
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
    }
  }

  // Results summary
  const accuracy = (correct / testCases.length) * 100;
  const avgConfidence = totalConfidence / testCases.length;
  const avgLatency = totalLatency / testCases.length;

  console.log('📊 RESULTS SUMMARY');
  console.log('==================');
  console.log(`✅ Accuracy: ${correct}/${testCases.length} (${accuracy.toFixed(1)}%)`);
  console.log(`🎯 Average Confidence: ${avgConfidence.toFixed(3)}`);
  console.log(`⚡ Average Latency: ${avgLatency.toFixed(0)}ms`);
  
  if (accuracy >= 70 && avgConfidence > 0.5) {
    console.log('\n🎉 SUCCESS: Working LLM classification confirmed!');
    console.log('   The project has functional LLM-based classification.');
  } else if (avgConfidence === 0.0) {
    console.log('\n⚠️  WARNING: Zero confidence suggests fallback responses');
    console.log('   Check if the model is properly responding');
  } else {
    console.log('\n🔍 MIXED RESULTS: Some classification working but needs improvement');
  }
}

// Add necessary imports
import { join } from 'node:path';

// Execute if run directly
if (import.meta.main) {
  testWorkingLLMMethod().catch(console.error);
}

export { testWorkingLLMMethod };