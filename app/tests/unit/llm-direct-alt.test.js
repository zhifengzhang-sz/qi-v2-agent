#!/usr/bin/env bun

// Test LLM component directly to isolate the issue
import { ConfigLoader } from './lib/dist/index.js';
import { OllamaLLM } from './lib/dist/llm/ollama.js';

async function testDirectLLM() {
  try {
    console.log('🧪 Testing OllamaLLM directly...');
    
    const configLoader = new ConfigLoader('./config/qi-config.yaml');
    const config = configLoader.loadConfig();
    
    console.log('🚀 Creating OllamaLLM...');
    const ollama = new OllamaLLM(config.model);
    
    console.log('💬 Testing simple streaming...');
    const startTime = Date.now();
    
    let tokenCount = 0;
    let completed = false;
    
    const testPromise = ollama.stream([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Say hello' }
    ], {
      onToken: (token) => {
        tokenCount++;
        console.log(`📦 Token ${tokenCount}: "${token}"`);
        if (tokenCount === 1) {
          console.log(`⚡ First token after ${Date.now() - startTime}ms`);
        }
      },
      onComplete: (response) => {
        console.log(`✅ Completed: "${response}" (${Date.now() - startTime}ms total)`);
        completed = true;
      },
      onError: (error) => {
        console.error('❌ Error:', error);
        completed = true;
      }
    });
    
    // Timeout detection
    setTimeout(() => {
      if (!completed) {
        console.log(`🚨 LLM stream hanging after 10 seconds!`);
        console.log(`📊 Tokens received: ${tokenCount}`);
        process.exit(1);
      }
    }, 10000);
    
    await testPromise;
    
    if (completed) {
      console.log('🎉 LLM direct test successful!');
    }
    
  } catch (error) {
    console.error('❌ Direct LLM test failed:', error);
    process.exit(1);
  }
}

testDirectLLM();