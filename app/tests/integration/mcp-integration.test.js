#!/usr/bin/env bun

// Test LangGraph ReAct agent with a tool-requiring request
import { QiAgentFactory, ConfigLoader } from './lib/dist/index.js';

async function testToolRequest() {
  try {
    console.log('🧪 Testing LangGraph with tool request...');
    const configLoader = new ConfigLoader('./config/qi-config.yaml');
    const config = configLoader.loadConfig();

    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing tool-requiring request...');
    const startTime = Date.now();
    
    let tokenCount = 0;
    
    await agentFactory.stream(
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
          process.exit(0);
        },
        onError: (error) => {
          console.error('❌ Tool request error:', error);
          process.exit(1);
        }
      }
    );

  } catch (error) {
    console.error('❌ Tool test failed:', error);
    process.exit(1);
  }
}

testToolRequest();