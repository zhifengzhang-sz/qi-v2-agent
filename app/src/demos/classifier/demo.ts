#!/usr/bin/env node

/**
 * Working Classifier Demo
 * 
 * Demonstrates the actual implemented three-type classification system
 * using the rule-based method that exists in the codebase.
 */

import { RuleBasedClassificationMethod } from '../../classifier/impl/rule-based-classification-method.js';
import type { ProcessingContext } from '../../classifier/abstractions/IClassifier.js';

async function main() {
  console.log('🔍 Working Classifier Demo');
  console.log('============================\n');

  // Create rule-based classifier (only working implementation)
  const classifier = new RuleBasedClassificationMethod({
    commandPrefix: '/',
    promptIndicators: ['hi', 'hello', 'what', 'how', 'why', 'can you', 'please'],
    workflowIndicators: ['fix', 'create', 'implement', 'debug', 'build', 'test'],
    confidenceThresholds: new Map([
      ['command', 1.0],
      ['prompt', 0.8], 
      ['workflow', 0.7]
    ])
  });

  // Test cases
  const testInputs = [
    '/help',
    '/status',
    'hi there',
    'what is recursion?', 
    'how do I write a function?',
    'fix the bug in auth.js and run tests',
    'create a new API endpoint with proper validation',
    'debug the performance issue in the database query'
  ];

  console.log('Testing classification accuracy:\n');

  for (const input of testInputs) {
    try {
      const result = await classifier.classify(input);
      
      console.log(`Input: "${input}"`);
      console.log(`  Type: ${result.type}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`  Method: ${result.method}`);
      console.log(`  Reasoning: ${result.reasoning}`);
      console.log('');
    } catch (error) {
      console.error(`Error classifying "${input}":`, error);
    }
  }

  // Test availability
  console.log('Checking classifier availability...');
  const isAvailable = await classifier.isAvailable();
  console.log(`Classifier available: ${isAvailable ? '✅ Yes' : '❌ No'}`);

  // Show performance characteristics
  console.log('\nPerformance Characteristics:');
  console.log(`  Expected Accuracy: ${(classifier.getExpectedAccuracy() * 100).toFixed(1)}%`);
  console.log(`  Average Latency: ${classifier.getAverageLatency()}ms`);
  console.log(`  Method: ${classifier.getMethodName()}`);
}

if (import.meta.main) {
  main().catch(console.error);
}