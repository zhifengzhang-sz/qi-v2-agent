#!/usr/bin/env bun

// Test script to validate LLM is working directly (bypassing LangGraph agent)
import { ConfigLoader } from './lib/dist/index.js';
import { ChatOllama } from '@langchain/ollama';

async function testLLMDirectly() {
  console.log('🧪 Testing LLM Directly (No LangGraph)...');
  console.log('=========================================');
  
  try {
    // Load configuration
    const configLoader = new ConfigLoader('./config/qi-config.yaml');
    const config = configLoader.loadConfig();
    
    // Create LLM directly
    console.log('🚀 Creating Ollama LLM directly...');
    const llm = new ChatOllama({
      model: config.model.name,
      baseUrl: 'http://localhost:11434',
      temperature: config.model.temperature,
    });
    
    console.log(`✅ LLM created with model: ${config.model.name}`);
    
    // Test simple invoke
    console.log('\n📤 Testing direct LLM invoke...');
    const testMessage = [{ role: 'user', content: 'Say hello briefly' }];
    
    const response = await llm.invoke(testMessage);
    console.log(`✅ LLM invoke successful!`);
    console.log(`📝 Response: "${response.content}"`);
    
    // Test streaming
    console.log('\n📤 Testing direct LLM streaming...');
    let streamedContent = '';
    let tokenCount = 0;
    
    const stream = await llm.stream(testMessage);
    
    for await (const chunk of stream) {
      tokenCount++;
      const content = chunk.content;
      streamedContent += content;
      if (tokenCount <= 5) {
        console.log(`📝 Token ${tokenCount}: "${content}"`);
      }
    }
    
    console.log(`✅ LLM streaming successful!`);
    console.log(`📊 Total tokens: ${tokenCount}`);
    console.log(`📝 Full response: "${streamedContent}"`);
    
    if (streamedContent.length > 0 && !streamedContent.includes('Say hello briefly')) {
      console.log('\n🎉 SUCCESS: LLM is working correctly!');
      console.log('✅ LLM generates proper responses');
      console.log('✅ Streaming works correctly');
      console.log('❌ Issue is in LangGraph agent wrapper');
    } else {
      console.log('\n⚠️  LLM might have issues or is echoing input');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testLLMDirectly().catch(console.error);