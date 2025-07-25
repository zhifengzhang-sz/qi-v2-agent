#!/usr/bin/env bun

// Test script to demonstrate token batching performance improvement
import { QiAgentFactory, ConfigLoader } from './lib/dist/index.js';

async function testTokenBatching() {
  try {
    console.log('🔧 Loading configuration...');
    const configLoader = new ConfigLoader('./config/qi-config.yaml');
    const config = configLoader.loadConfig();

    console.log('🚀 Initializing agent...');
    const agentFactory = new QiAgentFactory(config);
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

    await agentFactory.stream(
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
          
          process.exit(0);
        },
        onError: (error) => {
          clearInterval(batchTimer);
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

testTokenBatching();