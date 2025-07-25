#!/usr/bin/env bun

// Detailed delay analysis to find where slowness occurs
import { QiAgentFactory, ConfigLoader } from './lib/dist/index.js';

async function analyzeDelays() {
  try {
    console.log('🔧 Starting delay analysis...');
    const overallStart = Date.now();
    
    // Step 1: Configuration loading
    const configStart = Date.now();
    const configLoader = new ConfigLoader('./config/qi-config.yaml');
    const config = configLoader.loadConfig();
    console.log(`✅ Config loaded in ${Date.now() - configStart}ms`);

    // Step 2: Agent initialization
    const initStart = Date.now();
    const agentFactory = new QiAgentFactory(config);
    await agentFactory.initialize();
    console.log(`✅ Agent initialized in ${Date.now() - initStart}ms`);

    // Step 3: First message processing
    console.log('💬 Testing first message (may include model loading)...');
    const firstMsgStart = Date.now();
    
    let firstTokenReceived = false;
    let tokenCount = 0;
    
    await agentFactory.stream(
      [{ role: 'user', content: 'Say hello' }],
      {
        onToken: (token) => {
          tokenCount++;
          if (!firstTokenReceived) {
            firstTokenReceived = true;
            const firstTokenTime = Date.now() - firstMsgStart;
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
          
          // Step 4: Second message (should be faster)
          console.log('💬 Testing second message (model should be warm)...');
          const secondMsgStart = Date.now();
          
          agentFactory.stream(
            [
              { role: 'user', content: 'Say hello' },
              { role: 'assistant', content: response },
              { role: 'user', content: 'Say goodbye' }
            ],
            {
              onToken: (token) => {
                const secondFirstToken = Date.now() - secondMsgStart;
                console.log(`🔥 SECOND MESSAGE first token after ${secondFirstToken}ms`);
                
                if (secondFirstToken > 200) {
                  console.log('❌ ISSUE: Second message still slow - not model loading');
                } else {
                  console.log('✅ GOOD: Second message fast - was model loading delay');
                }
                
                const overallTime = Date.now() - overallStart;
                console.log(`📊 ANALYSIS COMPLETE in ${overallTime}ms total`);
                process.exit(0);
              },
              onComplete: () => process.exit(0),
              onError: (error) => {
                console.error('❌ Second message error:', error);
                process.exit(1);
              }
            }
          );
        },
        onError: (error) => {
          console.error('❌ First message error:', error);
          process.exit(1);
        }
      }
    );

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

analyzeDelays();