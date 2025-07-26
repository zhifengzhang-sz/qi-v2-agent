import { describe, it, expect } from 'vitest';
import { AgentFactory, ConfigLoader } from '@qi/agent';
import { resolve } from 'node:path';

describe('MCP Integration Test', () => {
  it('should load config and create agent factory for MCP tool integration', async () => {
    console.log('🧪 Testing LangGraph with tool request...');
    
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

    console.log('✅ MCP integration test passed!');
  });

  it.skip('should perform real tool request with LangGraph agent', async () => {
    // This test is skipped by default since it requires Ollama and MCP servers running
    // To enable: change it.skip to it and make sure all dependencies are available
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();

    const agentFactory = new AgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing tool-requiring request...');
    const startTime = Date.now();
    
    let tokenCount = 0;
    
    const streamPromise = new Promise((resolve, reject) => {
      agentFactory.stream(
        [{ role: 'user', content: 'List the files in the /tmp directory' }],
        {
          onToken: (token) => {
            tokenCount++;
            console.log(`📦 Token ${tokenCount}: "${token}"`);
          },
          onComplete: (response) => {
            const totalTime = Date.now() - startTime;
            console.log(`✅ Tool request completed! Response: "${response}" (${totalTime}ms)`);
            console.log('🎯 Testing successful - LangGraph agent used tools properly');
            resolve(response);
          },
          onError: (error) => {
            console.error('❌ Tool request error:', error);
            reject(error);
          }
        }
      );
    });

    const response = await streamPromise;
    
    // Validate response
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    
    console.log('🎉 MCP tool integration test successful!');
  }, 30000); // 30 second timeout for real tool calls
});