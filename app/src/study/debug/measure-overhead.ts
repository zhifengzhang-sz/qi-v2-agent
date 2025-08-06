/**
 * Measure actual overhead with multiple samples
 */

import { createOllamaNativeClassificationMethod } from './lib/src/classifier/impl/ollama-native.js';

async function measureDirectAPI(runs: number) {
  console.log(`🔍 Direct API - ${runs} runs`);
  const times: number[] = [];
  
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        prompt: 'What is recursion?',
        format: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['prompt', 'workflow'] },
            confidence: { type: 'number' }
          }
        },
        stream: false,
        options: { temperature: 0.1 }
      }),
    });
    
    await response.json();
    const duration = Date.now() - start;
    times.push(duration);
    
    console.log(`Run ${i+1}: ${duration}ms`);
  }
  
  const avg = Math.round(times.reduce((a, b) => a + b) / times.length);
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log(`Direct API: avg=${avg}ms, min=${min}ms, max=${max}ms`);
  return { avg, min, max, times };
}

async function measureOurMethod(runs: number) {
  console.log(`\n🔍 Our Method - ${runs} runs`);
  const times: number[] = [];
  
  const method = createOllamaNativeClassificationMethod({
    baseUrl: 'http://localhost:11434',
    modelId: 'llama3.2:3b',
    temperature: 0.1,
  });
  
  for (let i = 0; i < runs; i++) {
    const start = Date.now();
    
    try {
      await method.classify("What is recursion?");
      const duration = Date.now() - start;
      times.push(duration);
      
      console.log(`Run ${i+1}: ${duration}ms`);
    } catch (error) {
      console.log(`Run ${i+1}: ERROR`);
    }
  }
  
  const avg = Math.round(times.reduce((a, b) => a + b) / times.length);
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  console.log(`Our Method: avg=${avg}ms, min=${min}ms, max=${max}ms`);
  return { avg, min, max, times };
}

async function main() {
  const runs = 5;
  console.log(`📊 OVERHEAD MEASUREMENT - ${runs} runs each\n`);
  
  const directResults = await measureDirectAPI(runs);
  const ourResults = await measureOurMethod(runs);
  
  const overhead = ourResults.avg - directResults.avg;
  const overheadPercent = Math.round((overhead / directResults.avg) * 100);
  
  console.log(`\n📈 RESULTS:`);
  console.log(`Direct API average: ${directResults.avg}ms`);
  console.log(`Our method average: ${ourResults.avg}ms`);
  console.log(`Overhead: ${overhead}ms (${overheadPercent}%)`);
}

if (import.meta.main) {
  main().catch(console.error);
}