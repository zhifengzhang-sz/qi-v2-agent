#!/usr/bin/env node

/**
 * Debug Ollama Requests - Verify actual HTTP calls are being made
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatOllama } from '@langchain/ollama';
import { createStateManager } from '@qi/agent/state';

// Enable request logging
process.env.DEBUG = 'axios';
process.env.NODE_DEBUG = 'http';

async function debugOllamaRequests() {
  console.log('🔍 Debug: Testing actual Ollama HTTP requests');
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
  
  // First, test direct HTTP call
  console.log('\n1️⃣ Direct HTTP call to Ollama...');
  try {
    const response = await fetch(`${ollamaProvider.baseURL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: classifierConfig.model,
        prompt: 'What is 2+2?',
        stream: false
      })
    });
    
    const data = await response.json();
    console.log('✅ Direct HTTP call successful:');
    console.log(`   Response: "${data.response?.substring(0, 100)}..."`);
  } catch (error) {
    console.log('❌ Direct HTTP call failed:', error);
  }
  
  // Test LangChain ChatOllama
  console.log('\n2️⃣ LangChain ChatOllama call...');
  
  // Add request interceptor to see actual HTTP calls
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    console.log(`🌐 HTTP Request: ${options?.method || 'GET'} ${url}`);
    console.log(`   Headers:`, options?.headers);
    if (options?.body) {
      console.log(`   Body:`, typeof options.body === 'string' ? options.body.substring(0, 200) + '...' : options.body);
    }
    
    const response = await originalFetch(url, options);
    console.log(`   Response Status: ${response.status}`);
    return response;
  };
  
  try {
    const model = new ChatOllama({
      baseUrl: ollamaProvider.baseURL,
      model: classifierConfig.model,
      temperature: classifierConfig.temperature,
      maxTokens: classifierConfig.maxTokens,
    });
    
    console.log('📞 Making LangChain call...');
    const response = await model.invoke('What is 2+2?');
    console.log('✅ LangChain call successful:');
    console.log(`   Response: "${response.content}"`);
    
  } catch (error) {
    console.log('❌ LangChain call failed:', error);
  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
  
  console.log('\n3️⃣ Testing classification...');
  try {
    const model = new ChatOllama({
      baseUrl: ollamaProvider.baseURL,
      model: classifierConfig.model,
      temperature: classifierConfig.temperature,
      maxTokens: classifierConfig.maxTokens,
    });
    
    // Re-enable request logging for this call
    global.fetch = async (url, options) => {
      console.log(`🌐 Classification Request: ${options?.method || 'GET'} ${url}`);
      const response = await originalFetch(url, options);
      console.log(`   Status: ${response.status}`);
      return response;
    };
    
    const classificationPrompt = `Classify this input: "/help"
Respond with only: command`;
    
    console.log('📞 Making classification call...');
    const response = await model.invoke(classificationPrompt);
    console.log('✅ Classification successful:');
    console.log(`   Response: "${response.content}"`);
    
  } catch (error) {
    console.log('❌ Classification failed:', error);
  } finally {
    global.fetch = originalFetch;
  }
}

if (import.meta.main) {
  debugOllamaRequests().catch(console.error);
}