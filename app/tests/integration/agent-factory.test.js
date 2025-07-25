#!/usr/bin/env bun

// Simple test script to check response times without UI
import { QiAgentFactory, ConfigLoader } from './lib/dist/index.js';

async function testResponse() {
  try {
    console.log('🔧 Loading configuration...');
    const configLoader = new ConfigLoader('./config/qi-config.yaml');
    const config = configLoader.loadConfig();

    console.log('🚀 Initializing agent...');
    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing message response...');
    const startTime = Date.now();

    await agentFactory.stream(
      [{ role: 'user', content: 'Hello! Just say "Hi" back.' }],
      {
        onToken: (token) => {
          const elapsed = Date.now() - startTime;
          console.log(`📦 Token received after ${elapsed}ms: "${token}"`);
        },
        onComplete: (response) => {
          const totalTime = Date.now() - startTime;
          console.log(`✅ Complete response in ${totalTime}ms: "${response}"`);
          process.exit(0);
        },
        onError: (error) => {
          console.error('❌ Error:', error);
          process.exit(1);
        }
      }
    );

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testResponse();