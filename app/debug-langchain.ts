#!/usr/bin/env bun

/**
 * Debug script to examine LangChain withStructuredOutput behavior
 * This bypasses the complex study framework to focus on the core issue
 */

import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

// Simple schema
const schema = z.object({
  type: z.enum(['prompt', 'workflow']).describe('Classification: prompt (single-step) or workflow (multi-step)'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0')
});

async function testWithStructuredOutput() {
  console.log('🔍 Testing LangChain withStructuredOutput behavior...\n');
  
  const llm = new ChatOpenAI({
    model: 'llama3.2:3b',
    temperature: 0.1,
    maxTokens: 1000,
    configuration: {
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama',
    },
  });

  const structuredLLM = llm.withStructuredOutput(schema);

  const testInput = "What is recursion and how does it work?";
  const prompt = `Classify the following user input into one of two categories:

**Categories:**
1. **prompt** - Single-step requests, questions, or conversational inputs
2. **workflow** - Multi-step tasks requiring orchestration

**User Input:** "${testInput}"

Analyze carefully - this is a simple question asking for explanation.`;

  console.log('Input:', testInput);
  console.log('Expected: prompt (question asking for explanation)');
  console.log('\n--- Testing withStructuredOutput ---');
  
  const startTime = Date.now();
  const result = await structuredLLM.invoke(prompt);
  const duration = Date.now() - startTime;
  
  console.log('Result:', JSON.stringify(result, null, 2));
  console.log('Duration:', duration + 'ms');
  console.log('Classification:', result.type, '(confidence:', result.confidence + ')');
  console.log('Correct?', result.type === 'prompt' ? '✅ YES' : '❌ NO - should be prompt');

  console.log('\n--- Testing direct model (no structured output) ---');
  
  const directPrompt = prompt + '\n\nRespond with: {"type": "prompt", "confidence": 0.9}';
  const startTime2 = Date.now();
  const directResult = await llm.invoke(directPrompt);
  const duration2 = Date.now() - startTime2;
  
  console.log('Direct result:', directResult.content);
  console.log('Duration:', duration2 + 'ms');
  
  console.log('\n--- Performance Comparison ---');
  console.log('withStructuredOutput:', duration + 'ms');
  console.log('Direct model call:', duration2 + 'ms');
  console.log('Overhead:', (duration - duration2) + 'ms');
}

testWithStructuredOutput().catch(console.error);