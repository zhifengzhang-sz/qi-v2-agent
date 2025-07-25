#!/usr/bin/env bun

// Test message display logic to understand why messages aren't showing
import { QiAgentFactory, ConfigLoader } from './lib/dist/index.js';

async function testMessageDisplay() {
  try {
    console.log('🔧 Testing message display logic...');
    const configLoader = new ConfigLoader('/home/zzhang/dev/qi/github/qi-v2-agent/config/qi-config.yaml');
    const config = configLoader.loadConfig();

    console.log('🚀 Initializing agent...');
    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();

    console.log('💬 Testing with detailed token/completion tracking...');
    
    let tokenEvents = [];
    let completionEvents = [];
    
    await agentFactory.stream(
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

testMessageDisplay();