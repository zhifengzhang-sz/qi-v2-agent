#!/usr/bin/env bun

/**
 * Minimal test to debug LLM-based classification issues
 */

console.log('Testing direct LLM call...');

const testClassifyDirect = async () => {
  const baseUrl = 'http://172.18.144.1:11434';
  const modelId = 'qwen3:8b';
  const prompt = `Classify this input as command, prompt, or workflow. Return JSON only:

{"type": "prompt", "confidence": 0.9}

Input: "hello there"`;

  console.log('Making request to:', `${baseUrl}/api/chat`);
  console.log('Model:', modelId);
  console.log('Prompt length:', prompt.length);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;
    console.log(`Response received in ${latency}ms`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Response data keys:', Object.keys(data));
    console.log('Total duration:', data.total_duration / 1000000, 'ms');
    console.log('Response text:', data.message?.content || 'NO CONTENT');
    
    return data;
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`Request failed after ${latency}ms:`, error);
    throw error;
  }
};

// Run test
testClassifyDirect()
  .then(() => console.log('✅ Test completed successfully'))
  .catch(() => console.log('❌ Test failed'));