/**
 * Simple Response Comparison Tool
 * 
 * Directly compares raw Ollama API responses vs method outputs
 * Usage: bun run simple-response-comparison.ts <model> <method> <input>
 */

import { createInputClassifier } from '@qi/agent/classifier';

async function directOllamaCall(model: string, input: string): Promise<string> {
  const prompt = `Classify this input as "prompt" or "workflow". Respond in JSON format:
{"type": "prompt or workflow", "confidence": 0.95, "reasoning": "your reasoning"}

Input: "${input}"`;

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      format: 'json',
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 500
      }
    })
  });

  const result = await response.json() as { response?: string; [key: string]: unknown };
  return result.response || '';
}

async function methodCall(model: string, method: string, input: string): Promise<any> {
  const classifier = createInputClassifier({ 
    method: method as any, 
    modelId: model,
    baseUrl: 'http://localhost:11434',
    apiKey: 'ollama',
    temperature: 0.1,
    timeout: 30000
  });
  
  try {
    return await classifier.classify(input);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function compareResponses(model: string, method: string, input: string) {
  console.log(`🔬 Comparing Raw LLM vs Method Output`);
  console.log(`Model: ${model}`);
  console.log(`Method: ${method}`);  
  console.log(`Input: "${input}"`);
  console.log('='.repeat(60));
  
  // Get raw Ollama response
  console.log('📡 Getting raw Ollama response...');
  const rawResponse = await directOllamaCall(model, input);
  console.log('Raw LLM Response:');
  console.log(rawResponse);
  console.log('');
  
  // Parse raw response to see what model intended
  let parsedRaw = null;
  try {
    parsedRaw = JSON.parse(rawResponse);
    console.log('✅ Raw response parses as valid JSON');
    console.log('Parsed:', JSON.stringify(parsedRaw, null, 2));
  } catch (e) {
    console.log('❌ Raw response is NOT valid JSON');
    console.log('Parse error:', e instanceof Error ? e.message : String(e));
  }
  console.log('');
  
  // Get method output
  console.log('⚙️  Getting method output...');
  const methodOutput = await methodCall(model, method, input);
  console.log('Method Output:');
  console.log(JSON.stringify(methodOutput, null, 2));
  console.log('');
  
  // Compare
  console.log('📊 COMPARISON:');
  console.log('-'.repeat(40));
  
  if (parsedRaw && methodOutput && !methodOutput.error) {
    const rawType = parsedRaw.type;
    const methodType = methodOutput.type;
    console.log(`Raw LLM says: ${rawType}`);
    console.log(`Method says: ${methodType}`);
    console.log(`Match: ${rawType === methodType ? '✅' : '❌'}`);
    
    if (parsedRaw.reasoning && methodOutput.reasoning) {
      console.log(`\nReasoning match: ${parsedRaw.reasoning === methodOutput.reasoning ? '✅' : '❌'}`);
      console.log(`Raw reasoning: ${parsedRaw.reasoning}`);
      console.log(`Method reasoning: ${methodOutput.reasoning}`);
    }
  } else {
    console.log('❌ Cannot compare - one or both responses failed');
    if (!parsedRaw) console.log('- Raw response parse failed');
    if (methodOutput?.error) console.log(`- Method failed: ${methodOutput.error}`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('Usage: bun run simple-response-comparison.ts <model> <method> <input>');
    console.error('');
    console.error('Examples:');
    console.error('  bun run simple-response-comparison.ts llama3.2:3b langchain-json-schema "Hello there"');
    console.error('  bun run simple-response-comparison.ts qwen3:0.6b ollama-native "Fix the bug and run tests"');
    process.exit(1);
  }
  
  const [model, method, input] = args;
  
  try {
    await compareResponses(model, method, input);
  } catch (error) {
    console.error('❌ Comparison failed:', error instanceof Error ? error.message : String(error));
    console.error(error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}