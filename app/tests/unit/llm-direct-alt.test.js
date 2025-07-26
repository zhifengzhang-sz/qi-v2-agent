import { describe, it, expect } from 'vitest';
import { ConfigLoader, OllamaLLM } from '@qi/agent';
import { resolve } from 'node:path';

describe('LLM Direct Alternative Integration Test', () => {
  // Skip these tests if Ollama is not available
  const skipReason = 'Requires Ollama running on localhost:11434';
  
  it('should load real config and create OllamaLLM instance', async () => {
    console.log('🧪 Testing OllamaLLM with real lib/src implementation...');
    
    // Use absolute path to config file from project root (tests run from app directory)
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    console.log(`📁 Loading config from: ${configPath}`);
    
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    
    console.log(`✅ Config loaded successfully`);
    console.log(`🤖 Model: ${config.model.name}`);
    console.log(`🌡️  Temperature: ${config.model.temperature}`);
    console.log(`🔗 Base URL: ${config.model.baseUrl}`);
    
    // Test config structure
    expect(config).toBeDefined();
    expect(config.model).toBeDefined();
    expect(config.model.name).toBeDefined();
    expect(config.model.baseUrl).toBeDefined();
    expect(typeof config.model.temperature).toBe('number');
    
    console.log('🚀 Creating OllamaLLM instance...');
    const ollama = new OllamaLLM(config.model);
    
    // Test OllamaLLM instance creation
    expect(ollama).toBeDefined();
    expect(typeof ollama.stream).toBe('function');
    
    console.log('✅ lib/src integration test passed!');
  });
  
  it('should perform real streaming test with Ollama', async () => {
    // Real streaming test with Ollama - enabled since Ollama is running
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    const ollama = new OllamaLLM(config.model);
    
    console.log('💬 Testing real streaming with Ollama...');
    const startTime = Date.now();
    
    let tokenCount = 0;
    let completed = false;
    let fullResponse = '';
    
    const testPromise = ollama.stream([
      { role: 'system', content: 'You are a helpful assistant. Respond briefly.' },
      { role: 'user', content: 'Say hello in exactly 3 words' }
    ], {
      onToken: (token) => {
        tokenCount++;
        fullResponse += token;
        console.log(`📦 Token ${tokenCount}: "${token}"`);
      },
      onComplete: (response) => {
        const duration = Date.now() - startTime;
        console.log(`✅ Completed: "${response}" (${duration}ms total, ${tokenCount} tokens)`);
        completed = true;
      },
      onError: (error) => {
        console.error('❌ Error:', error);
        completed = true;
        throw error;
      }
    });
    
    await testPromise;
    
    // Validate results
    expect(completed).toBe(true);
    expect(tokenCount).toBeGreaterThan(0);
    expect(fullResponse.length).toBeGreaterThan(0);
    
    console.log('🎉 Real streaming test successful!');
  }, 15000); // 15 second timeout for real network calls
});