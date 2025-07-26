import { describe, it, expect } from 'vitest';
import { AgentFactory, ConfigLoader } from '@qi/agent';
import { resolve } from 'node:path';

describe('Stream Fix Integration Test', () => {
  it('should load config and create agent factory for stream testing', async () => {
    console.log('🧪 Testing Stream Hanging Fixes...');
    console.log('=================================');
    
    // Fix config path for test runner
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();

    console.log('✅ Config loaded successfully');
    console.log(`🤖 Model: ${config.model.name}`);

    // Test config structure
    expect(config).toBeDefined();
    expect(config.model).toBeDefined();
    expect(config.model.name).toBeDefined();

    console.log('🚀 Creating AgentFactory...');
    const agentFactory = new AgentFactory(config);

    // Test AgentFactory creation
    expect(agentFactory).toBeDefined();
    expect(typeof agentFactory.initialize).toBe('function');
    expect(typeof agentFactory.stream).toBe('function');
    expect(typeof agentFactory.cleanup).toBe('function');

    console.log('✅ Stream fix integration test passed!');
  });

  it.skip('should validate stream hanging fixes with real streaming', async () => {
    // This test is skipped by default since it requires Ollama running
    // To enable: change it.skip to it and make sure all dependencies are available
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    
    // Initialize agent
    console.log('🚀 Initializing agent...');
    const agentFactory = new AgentFactory(config);
    await agentFactory.initialize();
    
    console.log('✅ Agent initialized successfully');
    
    // Test simple streaming
    console.log('\n📤 Testing stream with simple message...');
    const testMessage = [{ role: 'user', content: 'Say hello briefly' }];
    
    let tokenCount = 0;
    let fullResponse = '';
    let streamStartTime = Date.now();
    let streamCompletedSuccessfully = false;
    
    const streamPromise = new Promise((resolve, reject) => {
      agentFactory.stream(testMessage, {
        onToken: (token) => {
          tokenCount++;
          fullResponse += token;
          if (tokenCount === 1) {
            console.log(`⚡ First token received after ${Date.now() - streamStartTime}ms`);
          }
          if (tokenCount % 10 === 0) {
            console.log(`📊 Received ${tokenCount} tokens, current response: "${fullResponse.substring(0, 50)}..."`);
          }
        },
        onComplete: (response) => {
          const totalTime = Date.now() - streamStartTime;
          console.log(`✅ Stream completed successfully!`);
          console.log(`📊 Total time: ${totalTime}ms`);
          console.log(`📊 Total tokens: ${tokenCount}`);
          console.log(`📝 Final response: "${response}"`);
          console.log(`🎯 No timeout needed - natural completion worked!`);
          streamCompletedSuccessfully = true;
          resolve(response);
        },
        onError: (error) => {
          console.error(`❌ Stream error: ${error.message}`);
          reject(error);
        }
      });
    });
    
    const response = await streamPromise;
    
    // Wait a moment to ensure completion
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Validate stream completion
    expect(streamCompletedSuccessfully).toBe(true);
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    expect(tokenCount).toBeGreaterThan(0);
    
    if (streamCompletedSuccessfully) {
      console.log('\n🎉 SUCCESS: Stream hanging issue is FIXED!');
      console.log('✅ No 3-second timeout triggered');
      console.log('✅ Natural stream completion works');
      console.log('✅ Messages will now display properly in UI');
    }
    
    await agentFactory.cleanup();
    
    console.log('🎉 Stream fix validation test successful!');
  }, 30000); // 30 second timeout for real streaming
});