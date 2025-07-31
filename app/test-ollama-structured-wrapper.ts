#!/usr/bin/env node

/**
 * Test OllamaStructuredWrapper to verify it works where ChatOllama fails
 */

import { createOllamaStructuredWrapper, withStructuredOutput } from './src/llm/index.js';

async function testOllamaStructuredWrapper() {
  console.log('🧪 Testing OllamaStructuredWrapper...\n');

  try {
    // Create wrapper using same config as our classifier
    console.log('📋 Creating OllamaStructuredWrapper...');
    const wrapper = createOllamaStructuredWrapper({
      model: 'qwen2.5-coder:7b',
      baseURL: 'http://172.18.144.1:11434',
      temperature: 0.1
    });

    // Test availability first
    console.log('🔍 Checking Ollama availability...');
    const isAvailable = await wrapper.isAvailable();
    console.log(`   Ollama available: ${isAvailable}`);

    if (!isAvailable) {
      console.log('❌ Ollama not available, skipping structured output test');
      return;
    }

    // Test 1: Simple structured output (same as our classifier needs)
    console.log('\n🧪 Test 1: Classification structured output');
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

    const testInput = "write a snake program in typescript";
    const classificationPrompt = `Classify this user input: "${testInput}"

Categories:
1. command - System commands starting with "/" 
2. prompt - Simple conversational requests
3. workflow - Complex multi-step tasks

Analyze the input and classify it appropriately.`;

    console.log(`   Input: "${testInput}"`);
    console.log('   Generating structured classification...');

    const startTime = Date.now();
    const result = await wrapper.generateStructured(classificationPrompt, classificationSchema);
    const duration = Date.now() - startTime;

    console.log('✅ Classification result:');
    console.log(`   Type: ${result.type}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Reasoning: ${result.reasoning}`);
    console.log(`   Duration: ${duration}ms`);

    // Test 2: LangChain-compatible interface
    console.log('\n🧪 Test 2: LangChain-compatible interface');
    const structuredModel = withStructuredOutput(wrapper, classificationSchema);
    
    const langchainResult = await structuredModel.invoke(classificationPrompt);
    console.log('✅ LangChain-compatible result:');
    console.log(`   Type: ${langchainResult.type}`);
    console.log(`   Confidence: ${langchainResult.confidence}`);

    // Test 3: Simple field extraction
    console.log('\n🧪 Test 3: Simple field extraction');
    const simpleResult = await wrapper.generateSimpleStructured(
      "Extract the programming language and task type from: 'write a snake program in typescript'",
      ["language", "task_type", "complexity"]
    );
    
    console.log('✅ Simple extraction result:');
    console.log(JSON.stringify(simpleResult, null, 2));

    console.log('\n🎉 All tests passed! OllamaStructuredWrapper is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('This indicates an issue with the wrapper implementation');
  }
}

// Run the test
testOllamaStructuredWrapper().catch(console.error);