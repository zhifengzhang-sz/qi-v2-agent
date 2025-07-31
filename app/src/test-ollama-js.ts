#!/usr/bin/env node

// Test native ollama JavaScript library

import { Ollama } from 'ollama';

async function testOllamaJS() {
  console.log('🧪 Testing native Ollama JS library...');
  
  const ollama = new Ollama({ host: 'http://172.18.144.1:11434' });
  
  try {
    console.log('📞 Making ollama.generate() call...');
    const response = await ollama.generate({
      model: 'qwen2.5-coder:7b',
      prompt: 'hi',
      stream: false,
    });

    console.log('✅ Success!');
    console.log('Response:', response.response);
    console.log('Done:', response.done);
    console.log('Context length:', response.context?.length || 0);
    
  } catch (error) {
    console.error('❌ Native Ollama JS call failed:', error);
  }
}

testOllamaJS().catch(console.error);