#!/usr/bin/env bun

// Debug the hanging "Thinking..." issue
import { QiAgentFactory, ConfigLoader } from './lib/dist/index.js';

async function debugHangIssue() {
  try {
    console.log('🔧 Debugging hang issue...');
    const configLoader = new ConfigLoader('/home/zzhang/dev/qi/github/qi-v2-agent/config/qi-config.yaml');
    const config = configLoader.loadConfig();

    console.log('🚀 Initializing agent...');
    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing simple "hi" message...');
    const startTime = Date.now();
    
    let tokenCount = 0;
    let onCompleteCallbacks = [];
    let onErrorCallbacks = [];
    
    const streamPromise = agentFactory.stream(
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
          process.exit(0);
        },
        onError: (error) => {
          console.error('❌ onError called:', error);
          onErrorCallbacks.push(error);
          console.log('💥 Error occurred - this explains the hang');
          process.exit(1);
        }
      }
    );

    // Timeout to detect hanging
    setTimeout(() => {
      console.log('\n🚨 HANG DETECTED after 10 seconds!');
      console.log(`📊 Tokens received: ${tokenCount}`);
      console.log(`📞 onComplete calls: ${onCompleteCallbacks.length}`);
      console.log(`❌ onError calls: ${onErrorCallbacks.length}`);
      
      if (tokenCount > 0 && onCompleteCallbacks.length === 0) {
        console.log('🐛 BUG: Received tokens but onComplete never called');
        console.log('💡 This explains why UI shows response but stays "Thinking..."');
      }
      
      process.exit(1);
    }, 10000);

    await streamPromise;

  } catch (error) {
    console.error('❌ Debug test failed:', error);
    process.exit(1);
  }
}

debugHangIssue();