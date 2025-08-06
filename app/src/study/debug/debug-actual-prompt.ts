/**
 * Show the actual prompt being sent to Ollama
 */

import { createOllamaNativeClassificationMethod } from './lib/src/classifier/impl/ollama-native.js';

async function showActualPrompt() {
  const method = createOllamaNativeClassificationMethod({
    baseUrl: 'http://localhost:11434',
    modelId: 'llama3.2:3b',
    temperature: 0.1,
  });

  // Access private method via any to see actual prompt
  const methodAny = method as any;
  const promptResult = methodAny.buildPrompt("What is recursion?");
  const prompt = promptResult.tag === 'success' ? promptResult.value : 'Failed to build';
  
  const schemaResult = methodAny.createOllamaJsonSchema();
  
  console.log('🔍 ACTUAL PROMPT SENT TO OLLAMA:');
  console.log('='.repeat(80));
  console.log(prompt);
  console.log();
  console.log('🔍 ACTUAL SCHEMA:');
  console.log('='.repeat(80));
  console.log(JSON.stringify(schemaResult, null, 2));
  console.log();
  console.log('🔍 CURL COMMAND TO TEST:');
  console.log('='.repeat(80));
  
  const requestBody = {
    model: 'llama3.2:3b',
    prompt: prompt,
    format: schemaResult,
    stream: false,
    options: { temperature: 0.1 }
  };
  
  console.log(`curl -X POST http://localhost:11434/api/generate \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestBody, null, 2)}'`);
}

if (import.meta.main) {
  showActualPrompt().catch(console.error);
}