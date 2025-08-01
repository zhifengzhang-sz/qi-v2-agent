#!/usr/bin/env node

/**
 * Direct Ollama Test
 * Test if we can actually call Ollama directly before using LangChain
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOllama } from '@langchain/ollama';
import { createStateManager } from '@qi/agent/state';

async function testDirectOllama() {
  console.log('🧪 Testing Direct Ollama Connection');
  console.log('═'.repeat(50));
  
  // Load configuration through StateManager (proper way)
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

  // Get classifier config from StateManager
  const classifierConfig = stateManager.getClassifierConfig();
  const llmConfig = stateManager.getLLMConfigForPromptModule();
  
  if (!classifierConfig || !llmConfig) {
    console.error('❌ No classifier or LLM configuration available');
    process.exit(1);
  }

  const ollamaProvider = llmConfig.llm?.providers?.ollama;
  if (!ollamaProvider) {
    console.error('❌ No Ollama provider configuration found');
    process.exit(1);
  }

  console.log(`🔗 Using configured Ollama URL: ${ollamaProvider.baseURL}`);
  console.log(`🧠 Using configured model: ${classifierConfig.model}`);
  
  try {
    // First, test basic Ollama connection
    console.log('1️⃣ Testing basic Ollama chat...');
    const model = new ChatOllama({
      baseUrl: ollamaProvider.baseURL,
      model: classifierConfig.model,
      temperature: classifierConfig.temperature,
      maxTokens: classifierConfig.maxTokens,
    });
    
    const simpleResponse = await model.invoke('What is 2+2?');
    console.log('✅ Basic response received:');
    console.log(`   "${simpleResponse.content}"`);
    
    // Test classification without structured output first
    console.log('\n2️⃣ Testing classification prompt...');
    const classificationPrompt = `
Classify this input into one of three types:
- command: system functions (like /help, /status)
- prompt: simple requests (like "what is X?", "write Y")  
- workflow: multi-step tasks (like "fix bug and run tests")

Input: "/help"
Type:`;

    const classificationResponse = await model.invoke(classificationPrompt);
    console.log('✅ Classification response:');
    console.log(`   "${classificationResponse.content}"`);
    
    // Test JSON output
    console.log('\n3️⃣ Testing JSON output...');
    const jsonPrompt = `
Classify this input and respond with ONLY valid JSON:

Input: "write a hello world function"

Respond with this exact format:
{"type": "prompt", "confidence": 0.9}`;

    const jsonResponse = await model.invoke(jsonPrompt);
    console.log('✅ JSON response:');
    console.log(`   "${jsonResponse.content}"`);
    
    // Try to parse it
    try {
      const parsed = JSON.parse(jsonResponse.content as string);
      console.log('✅ JSON parsing successful:', parsed);
    } catch (e) {
      console.log('❌ JSON parsing failed:', e);
    }
    
  } catch (error) {
    console.error('❌ Direct Ollama test failed:', error);
  }
}

if (import.meta.main) {
  testDirectOllama().catch(console.error);
}