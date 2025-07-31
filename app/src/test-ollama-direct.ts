#!/usr/bin/env node

// Direct ChatOllama test to isolate the issue

import { ChatOllama } from '@langchain/ollama'
import { HumanMessage } from '@langchain/core/messages'

async function testDirectOllama(): Promise<void> {
  console.log('🧪 Testing direct ChatOllama call...')
  
  const model = new ChatOllama({
    baseUrl: 'http://172.18.144.1:11434',
    model: 'qwen2.5-coder:7b',
    temperature: 0.1,
    keepAlive: -1, // Fix for @langchain/ollama 0.2.3 hanging issues
    verbose: true
  })

  try {
    console.log('📞 Making direct ChatOllama.invoke() call...')
    const response = await model.invoke([new HumanMessage('hi')])
    console.log('✅ Success!')
    console.log('Response:', response.content)
  } catch (error) {
    console.error('❌ Direct ChatOllama call failed:', error)
  }
}

testDirectOllama().catch(console.error)