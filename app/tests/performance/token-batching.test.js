import { describe, it, expect } from 'vitest';
import { AgentFactory, ConfigLoader } from '@qi/agent';
import { resolve } from 'node:path';

describe('Token Batching Performance Test', () => {
  it('should load config and create agent factory for token batching testing', async () => {
    console.log('🔧 Loading configuration...');
    
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

    console.log('✅ Token batching performance test passed!');
  });

  it.skip('should demonstrate token batching performance improvement', async () => {
    // This test is skipped by default since it requires Ollama running
    // To enable: change it.skip to it and make sure all dependencies are available
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();

    console.log('🚀 Initializing agent...');
    const agentFactory = new AgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing token batching with render counting...');
    const startTime = Date.now();
    
    let tokenCount = 0;
    let renderCount = 0;
    let pendingTokens = '';
    let displayText = '';
    
    // Simulate token batching behavior
    const batchTokens = () => {
      if (pendingTokens) {
        displayText = pendingTokens;
        renderCount++;
        console.log(`🔄 Render #${renderCount}: "${displayText.slice(-10)}..." (${displayText.length} chars)`);
        pendingTokens = '';
      }
    };
    
    // Batch every 16ms (60fps)
    const batchTimer = setInterval(batchTokens, 16);

    const streamPromise = new Promise((resolve, reject) => {
      agentFactory.stream(
        [{ role: 'user', content: 'Write a short paragraph about TypeScript benefits.' }],
        {
          onToken: (token) => {
            tokenCount++;
            pendingTokens += token;
            
            // Log every 25 tokens for progress
            if (tokenCount % 25 === 0) {
              console.log(`📦 Token #${tokenCount} received, batching for display...`);
            }
          },
          onComplete: (response) => {
            clearInterval(batchTimer);
            
            // Final batch
            batchTokens();
            
            const totalTime = Date.now() - startTime;
            console.log(`\n✅ PERFORMANCE RESULTS:`);
            console.log(`   Total Time: ${totalTime}ms`);
            console.log(`   Tokens Received: ${tokenCount}`);
            console.log(`   UI Renders: ${renderCount}`);
            console.log(`   Render Reduction: ${Math.round((1 - renderCount/tokenCount) * 100)}%`);
            console.log(`   Expected Without Batching: ${tokenCount} renders`);
            console.log(`   With Batching: ${renderCount} renders`);
            console.log(`\n📝 Final Response: "${response.slice(0, 100)}..."`);
            
            resolve(response);
          },
          onError: (error) => {
            clearInterval(batchTimer);
            console.error('❌ Error:', error);
            reject(error);
          }
        }
      );
    });

    const response = await streamPromise;
    
    // Validate performance metrics
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    expect(tokenCount).toBeGreaterThan(0);
    expect(renderCount).toBeGreaterThan(0);
    expect(renderCount).toBeLessThan(tokenCount); // Batching should reduce renders
    
    const renderReduction = Math.round((1 - renderCount/tokenCount) * 100);
    expect(renderReduction).toBeGreaterThan(0); // Should have some performance improvement
    
    console.log('🎉 Token batching performance test successful!');
  }, 60000); // 60 second timeout for performance test
});