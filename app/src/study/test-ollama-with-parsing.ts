#!/usr/bin/env node

/**
 * Test Ollama with response parsing to handle <think> tags
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOllama } from '@langchain/ollama';
import { z } from 'zod';
import { createStateManager } from '@qi/agent/state';

// Simple classification schema
const SimpleClassificationSchema = z.object({
  type: z.enum(['command', 'prompt', 'workflow']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional()
});

type SimpleClassification = z.infer<typeof SimpleClassificationSchema>;

/**
 * Parse Ollama response to extract JSON from <think> tags
 */
function parseOllamaResponse(response: string): string {
  // Remove <think> tags and their content
  const withoutThink = response.replace(/<think>[\s\S]*?<\/think>\s*/g, '');
  
  // Try to extract JSON from the remaining content
  const jsonMatch = withoutThink.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }
  
  return withoutThink.trim();
}

async function testOllamaWithParsing() {
  console.log('🧪 Testing Ollama with Response Parsing');
  console.log('═'.repeat(50));
  
  // Load configuration through StateManager
  console.log('📝 Loading LLM configuration...');
  const stateManager = createStateManager();
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = join(__dirname, '..', '..', '..', 'config');
    await stateManager.loadLLMConfig(configPath);
    console.log('✅ Configuration loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }

  // Get configuration from StateManager
  const classifierConfig = stateManager.getClassifierConfig();
  const llmConfig = stateManager.getLLMConfigForPromptModule();
  
  if (!classifierConfig || !llmConfig?.llm?.providers?.ollama) {
    console.error('❌ No Ollama configuration found');
    process.exit(1);
  }

  const ollamaProvider = llmConfig.llm.providers.ollama;
  console.log(`🔗 Using configured Ollama URL: ${ollamaProvider.baseURL}`);
  console.log(`🧠 Using configured model: ${classifierConfig.model}`);
  
  try {
    const model = new ChatOllama({
      baseUrl: ollamaProvider.baseURL,
      model: classifierConfig.model,
      temperature: classifierConfig.temperature,
      maxTokens: classifierConfig.maxTokens,
    });
    
    const testCases = [
      ['/help', 'command'],
      ['what is TypeScript?', 'prompt'],
      ['fix bug in auth.ts and run tests', 'workflow']
    ];
    
    console.log('🔍 Testing classification with JSON parsing...\n');
    
    for (const [input, expected] of testCases) {
      console.log(`📤 Input: "${input}" (expected: ${expected})`);
      
      const prompt = `Classify this input into one of three types and respond with ONLY valid JSON:

Types:
- "command": system functions that start with / (like /help, /status)
- "prompt": simple requests or questions (like "what is X?", "write Y")  
- "workflow": multi-step tasks (like "fix bug and run tests")

Input: "${input}"

Respond with ONLY this JSON format:
{"type": "command|prompt|workflow", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

      try {
        const response = await model.invoke(prompt);
        console.log(`📥 Raw response: "${response.content}"`);
        
        // Parse the response
        const cleanedResponse = parseOllamaResponse(response.content as string);
        console.log(`🧹 Cleaned response: "${cleanedResponse}"`);
        
        // Try to parse JSON
        const parsed: SimpleClassification = JSON.parse(cleanedResponse);
        const validated = SimpleClassificationSchema.parse(parsed);
        
        const correct = validated.type === expected;
        console.log(`✅ Parsed successfully: ${JSON.stringify(validated)}`);
        console.log(`🎯 Classification: ${validated.type} ${correct ? '✅' : '❌'} (confidence: ${validated.confidence})`);
        if (validated.reasoning) {
          console.log(`💭 Reasoning: ${validated.reasoning}`);
        }
        
      } catch (error) {
        console.log(`❌ Failed to classify: ${error}`);
      }
      
      console.log('');
    }
    
    console.log('✅ Ollama classification test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (import.meta.main) {
  testOllamaWithParsing().catch(console.error);
}