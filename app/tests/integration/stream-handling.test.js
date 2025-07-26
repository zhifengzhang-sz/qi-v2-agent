import { describe, it, expect } from 'vitest';
import { AgentFactory, ConfigLoader } from '@qi/agent';
import { resolve } from 'node:path';

describe('Stream Handling Debug Test', () => {
  it('should load config and create agent factory for stream debugging', async () => {
    console.log('🔧 Debugging hang issue...');
    
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

    console.log('✅ Stream handling debug test passed!');
  });

  it.skip('should debug hanging "Thinking..." issue with real streaming', async () => {
    // This test is skipped by default since it requires Ollama running
    // To enable: change it.skip to it and make sure all dependencies are available
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();

    console.log('🚀 Initializing agent...');
    const agentFactory = new AgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing simple "hi" message...');
    const startTime = Date.now();
    
    let tokenCount = 0;
    let onCompleteCallbacks = [];
    let onErrorCallbacks = [];
    
    const streamPromise = new Promise((resolve, reject) => {
      agentFactory.stream(
        [{ role: 'user', content: 'hi' }],
        {
          onToken: (token) => {
            tokenCount++;
            console.log(`📦 Token #${tokenCount}: "${token}"`);
          },
          onComplete: (response) => {
            const totalTime = Date.now() - startTime;
            console.log(`✅ onComplete called! Response: "${response}" (${totalTime}ms)`);
            onCompleteCallbacks.push(response);
            console.log('🎯 Testing completed successfully - onComplete was called');
            resolve(response);
          },
          onError: (error) => {
            console.error('❌ onError called:', error);
            onErrorCallbacks.push(error);
            console.log('💥 Error occurred - this explains the hang');
            reject(error);
          }
        }
      );
    });

    // Set up timeout detection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        console.log('\n🚨 HANG DETECTED after 10 seconds!');
        console.log(`📊 Tokens received: ${tokenCount}`);
        console.log(`📞 onComplete calls: ${onCompleteCallbacks.length}`);
        console.log(`❌ onError calls: ${onErrorCallbacks.length}`);
        
        if (tokenCount > 0 && onCompleteCallbacks.length === 0) {
          console.log('🐛 BUG: Received tokens but onComplete never called');
          console.log('💡 This explains why UI shows response but stays "Thinking..."');
        }
        
        reject(new Error('Stream hanging detected'));
      }, 10000);
    });

    const response = await Promise.race([streamPromise, timeoutPromise]);
    
    // Validate results
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(onCompleteCallbacks.length).toBe(1);
    expect(onErrorCallbacks.length).toBe(0);
    expect(tokenCount).toBeGreaterThan(0);
    
    console.log('🎉 Stream handling debug test successful!');
  }, 15000); // 15 second timeout for debug test
});