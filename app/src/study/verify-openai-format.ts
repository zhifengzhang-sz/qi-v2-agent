/**
 * Verify OpenAI Format Requirements
 * 
 * Test if OpenAI endpoint works when we follow the correct format:
 * 1. Include "JSON" in system message
 * 2. Use proper message array format with roles
 */

const TEST_INPUT = "What is recursion and how does it work?";
const MODEL_ID = "llama3.2:3b";
const BASE_URL = "http://localhost:11434";

async function testCorrectOpenAIFormat(): Promise<void> {
  console.log('🧪 VERIFYING OPENAI FORMAT REQUIREMENTS');
  console.log('='.repeat(50));
  console.log(`Test Input: "${TEST_INPUT}"`);
  
  const startTime = Date.now();
  
  try {
    // Correct OpenAI format with JSON instruction in system message
    const requestBody = {
      model: MODEL_ID,
      messages: [
        {
          role: "system", 
          content: "You are a helpful assistant designed to output JSON. Classify user input as 'prompt' or 'workflow'."
        },
        {
          role: "user",
          content: `Classify this input as "prompt" (single-step question) or "workflow" (multi-step task): "${TEST_INPUT}"`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    };

    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ollama'
      },
      body: JSON.stringify(requestBody),
    });

    const latencyMs = Date.now() - startTime;
    console.log(`Latency: ${latencyMs}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ FAILED - HTTP Error:', response.status, errorText);
      return;
    }

    const result = await response.json();
    const messageContent = result.choices?.[0]?.message?.content || "";
    
    console.log('Raw response:', messageContent);
    
    // Try to parse JSON
    try {
      const parsed = JSON.parse(messageContent);
      console.log('✅ SUCCESS - Parsed JSON:', parsed);
    } catch (error) {
      console.log('❌ FAILED - JSON parsing error:', error);
      console.log('Message content was:', messageContent);
    }

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.log(`❌ FAILED - Network error after ${latencyMs}ms:`, error);
  }
}

if (import.meta.main) {
  testCorrectOpenAIFormat();
}