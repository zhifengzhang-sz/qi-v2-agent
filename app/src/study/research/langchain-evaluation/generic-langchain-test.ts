#!/usr/bin/env node

/**
 * Generic LangChain Classifier Test
 * 
 * Demonstrates the new schema-configurable LangChain classifier
 * with multiple classification methods and reusable schemas.
 */

import { 
  createInputClassifier,
  type ClassificationResult,
  type IClassifier
} from '@qi/agent/classifier';

async function main(): Promise<void> {
  console.log('🧪 GENERIC LANGCHAIN CLASSIFIER TEST');
  console.log('====================================\n');

  const config = {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    modelId: process.env.MODEL_ID || 'qwen3:8b',
  };

  console.log(`🤖 Using model: ${config.modelId}`);
  console.log(`🔗 Connecting to: ${config.baseUrl}\n`);

  // Test 1: Three-Type Classification (Using InputClassifier)
  console.log('📋 Test 1: Three-Type Classification');
  console.log('-----------------------------------');
  
  const threeTypeClassifier = createInputClassifier({
    method: 'langchain-structured',
    baseUrl: config.baseUrl,
    modelId: config.modelId,
  });

  const testInputs = [
    'write a function',
    '/help',
    'fix the bug in auth.js and run tests',
    'what is recursion?',
    '/status',
    'create a new feature with documentation and tests'
  ];

  console.log('Testing different classification methods:\n');

  for (const input of testInputs) {
    console.log(`Input: "${input}"`);
    
    try {
      // InputClassifier interface only has classify method
      const result: ClassificationResult = await threeTypeClassifier.classify(input);
      console.log(`  Classification: ${result.type} (${(result.confidence * 100).toFixed(1)}%)`);
      console.log(`  Reasoning: ${result.reasoning || 'N/A'}\n`);
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // Test 2: Additional Classification Examples
  console.log('📊 Test 2: Additional Examples');
  console.log('------------------------------');

  const additionalInputs = [
    'create API docs and tests',
    'I love this new feature!',
    'This is broken and frustrating',
    'Amazing work on this project!'
  ];

  for (const input of additionalInputs) {
    console.log(`Input: "${input}"`);
    
    try {
      const result: ClassificationResult = await threeTypeClassifier.classify(input);
      console.log(`  Classification: ${result.type} (${(result.confidence * 100).toFixed(1)}%)`);
      console.log(`  Reasoning: ${result.reasoning || 'N/A'}\n`);
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  console.log('✅ Generic LangChain Classifier test completed!');
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main as testGenericLangChainClassifier };