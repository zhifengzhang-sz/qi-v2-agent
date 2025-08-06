#!/usr/bin/env bun

// Quick test of the new Ollama native method
import { createInputClassifier } from '@qi/agent/classifier';

async function testOllamaNative() {
  console.log('🔍 Testing Ollama native classification method...');
  
  try {
    const classifier = createInputClassifier({ 
      method: 'ollama-native',
      modelId: 'llama3.2:3b',
      baseUrl: 'http://localhost:11434',
      temperature: 0.1,
      schemaName: 'minimal'
    });
    
    console.log('✅ Classifier created successfully');
    
    const testInput = "What is recursion and how does it work?";
    console.log(`\nTesting input: "${testInput}"`);
    console.log('Expected: prompt (single question)');
    
    const startTime = Date.now();
    const result = await classifier.classify(testInput);
    const duration = Date.now() - startTime;
    
    console.log('\n📊 Results:');
    console.log(`Type: ${result.type}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Method: ${result.method}`);
    console.log(`Reasoning: ${result.reasoning}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Correct: ${result.type === 'prompt' ? '✅ YES' : '❌ NO - should be prompt'}`);
    
    // Test command detection
    console.log('\n--- Testing command detection ---');
    const commandResult = await classifier.classify('/exit');
    console.log(`Command result: ${commandResult.type} (${commandResult.confidence})`);
    console.log(`Correct: ${commandResult.type === 'command' ? '✅ YES' : '❌ NO'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOllamaNative().catch(console.error);