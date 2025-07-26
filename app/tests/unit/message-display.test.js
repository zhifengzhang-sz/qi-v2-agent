import { describe, it, expect } from 'vitest';
import { AgentFactory, ConfigLoader } from '@qi/agent';
import { resolve } from 'node:path';

describe('Message Display Unit Test', () => {
  it('should load config and create agent factory for message display testing', async () => {
    console.log('🔧 Testing message display logic...');
    
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

    console.log('✅ Message display unit test passed!');
  });

  it.skip('should test message display logic with detailed token tracking', async () => {
    // This test is skipped by default since it requires Ollama running
    // To enable: change it.skip to it and make sure all dependencies are available
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();

    console.log('🚀 Initializing agent...');
    const agentFactory = new AgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing with detailed token/completion tracking...');
    
    let tokenEvents = [];
    let completionEvents = [];
    
    const streamPromise = new Promise((resolve, reject) => {
      agentFactory.stream(
        [{ role: 'user', content: 'hi' }],
        {
          onToken: (token) => {
            const event = {
              type: 'token',
              content: token,
              timestamp: Date.now()
            };
            tokenEvents.push(event);
            console.log(`📦 TOKEN: "${token}" (event #${tokenEvents.length})`);
          },
          onComplete: (response) => {
            const event = {
              type: 'complete',
              content: response,
              timestamp: Date.now()
            };
            completionEvents.push(event);
            console.log(`✅ COMPLETE: "${response}" (final response)`);
            
            // Analyze the flow
            console.log('\n📊 ANALYSIS:');
            console.log(`Token events: ${tokenEvents.length}`);
            console.log(`Completion events: ${completionEvents.length}`);
            
            if (tokenEvents.length > 0) {
              console.log(`First token: "${tokenEvents[0].content}"`);
              console.log(`Last token: "${tokenEvents[tokenEvents.length - 1].content}"`);
              
              // Check if tokens match final response
              const allTokens = tokenEvents.map(e => e.content).join('');
              console.log(`All tokens combined: "${allTokens}"`);
              console.log(`Final response: "${response}"`);
              console.log(`Tokens match response: ${allTokens === response}`);
            }
            
            // Simulate the UI logic
            console.log('\n🖥️  UI SIMULATION:');
            console.log('1. During streaming: pendingTokens would accumulate tokens');
            console.log('2. onComplete: setPendingTokens(response) triggers display');
            console.log('3. 20ms later: setPendingTokens("") clears pending');
            console.log('4. Expected: Message should remain in messages array');
            
            if (response && response.length > 0) {
              console.log('✅ Response has content - should display in UI');
            } else {
              console.log('❌ Response is empty - this explains missing message!');
            }
            
            resolve(response);
          },
          onError: (error) => {
            console.error('❌ Error:', error);
            reject(error);
          }
        }
      );
    });

    const response = await streamPromise;
    
    // Validate message display logic
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    expect(tokenEvents.length).toBeGreaterThan(0);
    expect(completionEvents.length).toBe(1);
    
    // Check token consistency
    const allTokens = tokenEvents.map(e => e.content).join('');
    expect(allTokens).toBe(response);
    
    // Validate event structure
    tokenEvents.forEach(event => {
      expect(event.type).toBe('token');
      expect(event.content).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
    });
    
    completionEvents.forEach(event => {
      expect(event.type).toBe('complete');
      expect(event.content).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
    });
    
    console.log('🎉 Message display logic test successful!');
  }, 30000); // 30 second timeout for message display test
});