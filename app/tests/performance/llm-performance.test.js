import { describe, it, expect } from 'vitest';
import { AgentFactory, ConfigLoader } from '@qi/agent';
import { resolve } from 'node:path';

describe('LLM Performance Analysis Test', () => {
  it('should load config and create agent factory for performance testing', async () => {
    console.log('🔧 Starting delay analysis...');
    
    // Fix config path for test runner
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    
    // Step 1: Configuration loading
    const configStart = Date.now();
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    const configTime = Date.now() - configStart;
    console.log(`✅ Config loaded in ${configTime}ms`);

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

    // Validate performance metrics
    expect(configTime).toBeLessThan(1000); // Config loading should be fast

    console.log('✅ LLM performance analysis test passed!');
  });

  it.skip('should analyze detailed performance delays with real LLM', async () => {
    // This test is skipped by default since it requires Ollama running
    // To enable: change it.skip to it and make sure all dependencies are available
    
    const overallStart = Date.now();
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    
    // Step 1: Configuration loading
    const configStart = Date.now();
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    console.log(`✅ Config loaded in ${Date.now() - configStart}ms`);

    // Step 2: Agent initialization
    const initStart = Date.now();
    const agentFactory = new AgentFactory(config);
    await agentFactory.initialize();
    const initTime = Date.now() - initStart;
    console.log(`✅ Agent initialized in ${initTime}ms`);

    // Step 3: First message processing
    console.log('💬 Testing first message (may include model loading)...');
    const firstMsgStart = Date.now();
    
    let firstTokenReceived = false;
    let tokenCount = 0;
    let firstTokenTime = 0;
    
    const firstMessagePromise = new Promise((resolve, reject) => {
      agentFactory.stream(
        [{ role: 'user', content: 'Say hello' }],
        {
          onToken: (token) => {
            tokenCount++;
            if (!firstTokenReceived) {
              firstTokenReceived = true;
              firstTokenTime = Date.now() - firstMsgStart;
              console.log(`🚀 FIRST TOKEN after ${firstTokenTime}ms`);
              
              if (firstTokenTime > 1000) {
                console.log('⚠️  SLOW: First token took over 1 second');
              } else if (firstTokenTime > 500) {
                console.log('⚠️  MODERATE: First token took over 500ms');
              } else {
                console.log('✅ FAST: First token under 500ms');
              }
            }
          },
          onComplete: (response) => {
            const totalFirstMsg = Date.now() - firstMsgStart;
            console.log(`✅ First message completed in ${totalFirstMsg}ms (${tokenCount} tokens)`);
            resolve(response);
          },
          onError: (error) => {
            console.error('❌ First message error:', error);
            reject(error);
          }
        }
      );
    });

    const firstResponse = await firstMessagePromise;
    
    // Step 4: Second message (should be faster)
    console.log('💬 Testing second message (model should be warm)...');
    const secondMsgStart = Date.now();
    let secondFirstTokenTime = 0;
    
    const secondMessagePromise = new Promise((resolve, reject) => {
      agentFactory.stream(
        [
          { role: 'user', content: 'Say hello' },
          { role: 'assistant', content: firstResponse },
          { role: 'user', content: 'Say goodbye' }
        ],
        {
          onToken: (token) => {
            if (secondFirstTokenTime === 0) {
              secondFirstTokenTime = Date.now() - secondMsgStart;
              console.log(`🔥 SECOND MESSAGE first token after ${secondFirstTokenTime}ms`);
              
              if (secondFirstTokenTime > 200) {
                console.log('❌ ISSUE: Second message still slow - not model loading');
              } else {
                console.log('✅ GOOD: Second message fast - was model loading delay');
              }
            }
          },
          onComplete: (response) => {
            const overallTime = Date.now() - overallStart;
            console.log(`📊 ANALYSIS COMPLETE in ${overallTime}ms total`);
            resolve(response);
          },
          onError: (error) => {
            console.error('❌ Second message error:', error);
            reject(error);
          }
        }
      );
    });

    const secondResponse = await secondMessagePromise;
    const overallTime = Date.now() - overallStart;
    
    // Validate performance metrics
    expect(firstResponse).toBeDefined();
    expect(secondResponse).toBeDefined();
    expect(initTime).toBeLessThan(5000); // Initialization should be reasonable
    expect(firstTokenTime).toBeLessThan(10000); // First token within 10 seconds
    expect(secondFirstTokenTime).toBeLessThan(2000); // Second message should be faster
    expect(tokenCount).toBeGreaterThan(0);
    
    console.log('🎉 LLM performance analysis test successful!');
  }, 60000); // 60 second timeout for performance analysis
});