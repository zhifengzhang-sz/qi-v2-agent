#!/usr/bin/env node

/**
 * Debug LangChain Classifier Issues
 * 
 * Simple test to see what's actually failing in the LangChain method
 */

import { createInputClassifier } from '@qi/agent/classifier';

async function debugLangChain() {
  console.log('🔍 DEBUGGING LANGCHAIN CLASSIFIER');
  console.log('===================================\n');
  
  try {
    console.log('1️⃣ Creating LangChain classifier...');
    const classifier = createInputClassifier({
      method: 'langchain-structured',
      baseUrl: 'http://172.18.144.1:11434/v1',
      modelId: 'qwen3:8b',
      temperature: 0.1,
      maxTokens: 1000,
      apiKey: 'ollama',
    });
    console.log('✅ Classifier created successfully\n');
    
    console.log('2️⃣ Testing simple command classification...');
    const start = Date.now();
    const result = await classifier.classify('/help');
    const latency = Date.now() - start;
    
    console.log('📊 RESULT:');
    console.log('   Type:', result.type);
    console.log('   Confidence:', result.confidence);
    console.log('   Method:', result.method);
    console.log('   Latency:', latency + 'ms');
    console.log('   Reasoning:', result.reasoning || 'N/A');
    
    if (result.metadata?.has('error')) {
      console.log('❌ ERROR:', result.metadata.get('error'));
    }
    
    if (result.metadata?.has('fallback')) {
      console.log('⚠️  FALLBACK MODE: true');
    }
    
    console.log('\n3️⃣ Testing prompt classification...');
    const result2 = await classifier.classify('hello world');
    console.log('   Type:', result2.type, '| Confidence:', result2.confidence);
    
    console.log('\n4️⃣ Testing workflow classification...');
    const result3 = await classifier.classify('find restaurants in San Jose');
    console.log('   Type:', result3.type, '| Confidence:', result3.confidence);
    
  } catch (error) {
    console.error('💥 FATAL ERROR:', error);
  }
}

// Execute
if (import.meta.main) {
  debugLangChain().catch(console.error);
}