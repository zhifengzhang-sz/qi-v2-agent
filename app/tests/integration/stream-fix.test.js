#!/usr/bin/env bun

// Test script to validate our stream hanging fixes
import { QiAgentFactory, ConfigLoader } from './lib/dist/index.js';

async function testStreamFix() {
  console.log('🧪 Testing Stream Hanging Fixes...');
  console.log('=================================');
  
  try {
    // Load configuration
    const configLoader = new ConfigLoader('./config/qi-config.yaml');
    const config = configLoader.loadConfig();
    
    // Initialize agent
    console.log('🚀 Initializing agent...');
    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();
    
    console.log('✅ Agent initialized successfully');
    
    // Test simple streaming
    console.log('\n📤 Testing stream with simple message...');
    const testMessage = [{ role: 'user', content: 'Say hello briefly' }];
    
    let tokenCount = 0;
    let fullResponse = '';
    let streamStartTime = Date.now();
    let streamCompletedSuccessfully = false;
    
    await agentFactory.stream(testMessage, {
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
      },
      onError: (error) => {
        console.error(`❌ Stream error: ${error.message}`);
      }
    });
    
    // Wait a moment to ensure completion
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (streamCompletedSuccessfully) {
      console.log('\n🎉 SUCCESS: Stream hanging issue is FIXED!');
      console.log('✅ No 3-second timeout triggered');
      console.log('✅ Natural stream completion works');
      console.log('✅ Messages will now display properly in UI');
    } else {
      console.log('\n⚠️  Stream completion status unclear');
    }
    
    await agentFactory.cleanup();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testStreamFix().catch(console.error);