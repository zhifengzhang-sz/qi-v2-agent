#!/usr/bin/env node

// Test native Ollama library (not LangChain wrapper)

async function testNativeOllama(): Promise<void> {
  console.log('🧪 Testing native Ollama API call...');
  
  try {
    const response = await fetch('http://172.18.144.1:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen2.5-coder:7b',
        prompt: 'hi',
        stream: false,
        keep_alive: -1
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json() as {
      response: string
      done: boolean
      context?: number[]
    };
    console.log('✅ Native Ollama API call successful!');
    console.log('Response:', result.response);
    console.log('Done:', result.done);
    console.log('Context length:', result.context?.length || 0);
    
  } catch (error) {
    console.error('❌ Native Ollama API call failed:', error);
  }
}

testNativeOllama().catch(console.error)