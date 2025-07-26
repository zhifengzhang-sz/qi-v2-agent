import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '@qi/agent';
import { ChatOllama } from '@langchain/ollama';
import { resolve } from 'node:path';

describe('LLM Direct Implementation Test', () => {
  it('should load real config and create ChatOllama instance', async () => {
    console.log('🧪 Testing LLM Directly (No LangGraph)...');
    console.log('=========================================');
    
    // Load real config using lib/src ConfigLoader (tests run from app directory)
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
    
    // Create ChatOllama with real config (this is what lib/src uses internally)
    const chatOllama = new ChatOllama({
      model: config.model.name,
      baseUrl: config.model.baseUrl,
      temperature: config.model.temperature,
    });
    
    console.log('🚀 ChatOllama instance created');
    
    // Test ChatOllama instance creation
    expect(chatOllama).toBeDefined();
    expect(typeof chatOllama.invoke).toBe('function');
    expect(typeof chatOllama.stream).toBe('function');
    
    console.log('✅ lib/src ChatOllama integration test passed!');
  });
  
  it('should perform real invoke test with ChatOllama', async () => {
    // Real invoke test with ChatOllama - enabled since Ollama is running
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    
    const chatOllama = new ChatOllama({
      model: config.model.name,
      baseUrl: config.model.baseUrl,
      temperature: config.model.temperature,
    });
    
    console.log('💬 Testing direct invoke (non-streaming)...');
    const startTime = Date.now();
    const testMessage = [{ role: 'user', content: 'Say hello in exactly 2 words' }];
    
    const response = await chatOllama.invoke(testMessage);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Direct invoke successful (${duration}ms)`);
    console.log(`📝 Response: "${response.content}"`);
    
    // Validate response
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(response.content.length).toBeGreaterThan(0);
    expect(typeof response.content).toBe('string');
    
    console.log('🎯 Direct invoke validation passed');
  }, 15000);
  
  it.skip('should perform real streaming test with ChatOllama', async () => {
    // This test is skipped by default since it requires Ollama to be running
    // To enable: change it.skip to it and make sure Ollama is running
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    
    const chatOllama = new ChatOllama({
      model: config.model.name,
      baseUrl: config.model.baseUrl,
      temperature: config.model.temperature,
    });
    
    console.log('💨 Testing streaming...');
    const streamStartTime = Date.now();
    const testMessage = [{ role: 'user', content: 'Say hello in exactly 2 words' }];
    
    const stream = await chatOllama.stream(testMessage);
    
    let streamedContent = '';
    let chunkCount = 0;
    
    for await (const chunk of stream) {
      chunkCount++;
      if (chunk.content) {
        streamedContent += chunk.content;
        console.log(`📦 Chunk ${chunkCount}: "${chunk.content}"`);
      }
    }
    
    const streamDuration = Date.now() - streamStartTime;
    console.log(`✅ Streaming successful (${streamDuration}ms, ${chunkCount} chunks)`);
    console.log(`📝 Full streamed response: "${streamedContent}"`);
    
    // Validate streaming response
    expect(streamedContent).toBeDefined();
    expect(streamedContent.length).toBeGreaterThan(0);
    expect(chunkCount).toBeGreaterThan(0);
    expect(typeof streamedContent).toBe('string');
    
    console.log('🎯 Streaming validation passed');
  }, 15000);
});