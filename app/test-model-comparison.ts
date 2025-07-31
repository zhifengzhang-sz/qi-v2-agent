#!/usr/bin/env node

/**
 * Compare structured output quality between different models
 */

import { createOllamaStructuredWrapper } from './src/llm/index.js';

const classificationSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["command", "prompt", "workflow"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reasoning: { type: "string" },
    indicators: { type: "array", items: { type: "string" } },
    extracted_data: { type: "object" }
  },
  required: ["type", "confidence", "reasoning", "indicators", "extracted_data"]
};

async function testModel(modelName: string, testInput: string) {
  console.log(`\n🧪 Testing ${modelName}:`);
  
  try {
    const wrapper = createOllamaStructuredWrapper({
      model: modelName,
      baseURL: 'http://172.18.144.1:11434',
      temperature: 0.1
    });

    const prompt = `Classify this user input: "${testInput}"

Categories:
1. command - System commands starting with "/" 
2. prompt - Simple conversational requests
3. workflow - Complex multi-step tasks

Analyze the input and classify it appropriately.`;

    const startTime = Date.now();
    const result = await wrapper.generateStructured(prompt, classificationSchema);
    const duration = Date.now() - startTime;

    console.log(`   ✅ ${modelName}: ${result.type} (confidence: ${result.confidence}, ${duration}ms)`);
    console.log(`   Reasoning: ${result.reasoning}`);
    
    return { model: modelName, result, duration, success: true };
  } catch (error) {
    console.log(`   ❌ ${modelName}: Failed - ${error}`);
    return { model: modelName, error, success: false };
  }
}

async function compareModels() {
  console.log('🔍 Comparing structured output quality across models...\n');

  const models = [
    'qwen2.5-coder:7b',  // Current model
    'qwen2.5-coder:14b', // Larger qwen, should be fast on your system
    'llama3.2:3b'        // Llama with native tool calling support
  ];

  const testCases = [
    "write a snake program in typescript",
    "fix the bug in src/main.ts and run tests",
    "hello there"
  ];

  for (const testInput of testCases) {
    console.log(`\n📝 Test Input: "${testInput}"`);
    console.log('=' + '='.repeat(testInput.length + 15));

    const results = [];
    for (const model of models) {
      const result = await testModel(model, testInput);
      results.push(result);
    }

    // Compare results
    const successful = results.filter(r => r.success);
    if (successful.length > 0) {
      const fastest = successful.reduce((prev, curr) => 
        prev.duration < curr.duration ? prev : curr
      );
      const mostConfident = successful.reduce((prev, curr) => 
        prev.result.confidence > curr.result.confidence ? prev : curr
      );
      
      console.log(`\n   🏆 Fastest: ${fastest.model} (${fastest.duration}ms)`);
      console.log(`   🎯 Most Confident: ${mostConfident.model} (${mostConfident.result.confidence})`);
    }
  }

  console.log('\n📊 Summary:');
  console.log('   qwen2.5-coder:7b  - Current model, good for coding');
  console.log('   qwen2.5-coder:14b - Larger qwen, should be fast on your system');  
  console.log('   llama3.2:3b       - Has native tool calling support for structured output');
  console.log('');
  console.log('💡 Recommendation: Compare speed vs structured output quality');
}

compareModels().catch(console.error);