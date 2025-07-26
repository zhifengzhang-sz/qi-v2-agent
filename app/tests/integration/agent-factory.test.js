import { describe, it, expect } from 'vitest';
import { AgentFactory, ConfigLoader } from '@qi/agent';
import { resolve } from 'node:path';

describe('Agent Factory Integration Test', () => {
  it('should load config and create agent factory', async () => {
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
    expect(typeof agentFactory.invoke).toBe('function');

    console.log('✅ AgentFactory integration test passed!');
  });

  it('should perform real agent initialization and response test', async () => {
    // Real agent test - enabled since Ollama is running
    
    const configPath = resolve(process.cwd(), '../config/qi-config.yaml');
    const configLoader = new ConfigLoader(configPath);
    const config = configLoader.loadConfig();
    
    const agentFactory = new AgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing message response...');
    const startTime = Date.now();

    let tokenCount = 0;
    let completed = false;

    const testPromise = agentFactory.invoke(
      [{ role: 'user', content: 'Hello! Just say "Hi" back.' }],
      'test-thread'
    );

    const response = await testPromise;
    const duration = Date.now() - startTime;

    console.log(`✅ Response received in ${duration}ms`);
    console.log(`📝 Response: ${JSON.stringify(response)}`);

    // Validate response
    expect(response).toBeDefined();
    expect(duration).toBeLessThan(30000); // Should respond within 30 seconds

    console.log('🎉 Full agent response test successful!');
  }, 30000); // 30 second timeout for real agent calls
});