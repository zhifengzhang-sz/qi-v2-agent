/**
 * Debug Script: Test LangChain withStructuredOutput Truncation Issue
 * 
 * Compare direct Ollama API calls vs LangChain withStructuredOutput
 * to identify if the issue is response truncation/corruption.
 */

async function testDirectOllamaAPI(model: string, input: string) {
  console.log(`\n🔍 Direct Ollama API test with ${model}`);
  console.log(`Input: "${input}"`);
  
  const prompt = `Classify this input as "prompt" or "workflow". Respond in JSON format:
{"type": "prompt or workflow", "confidence": 0.95, "reasoning": "your reasoning"}

Input: "${input}"`;

  try {
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
          num_predict: 200
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`✅ Direct API Response:`, result.response);
    
    try {
      const parsed = JSON.parse(result.response);
      console.log(`✅ Parsed JSON:`, parsed);
      return { success: true, result: parsed, raw: result.response };
    } catch (parseError) {
      console.log(`❌ JSON Parse Error:`, parseError);
      return { success: false, error: 'JSON_PARSE_ERROR', raw: result.response };
    }
  } catch (error) {
    console.log(`❌ Direct API Error:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function testLangChainWithStructuredOutput(model: string, input: string) {
  console.log(`\n🔍 LangChain withStructuredOutput test with ${model}`);
  console.log(`Input: "${input}"`);
  
  try {
    // Import LangChain
    const { ChatOpenAI } = await import('@langchain/openai');
    const { z } = await import('zod');
    
    // Create schema
    const schema = z.object({
      type: z.enum(['prompt', 'workflow']),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional()
    });
    
    // Create LLM
    const llm = new ChatOpenAI({
      model,
      temperature: 0.1,
      maxTokens: 200,
      configuration: {
        baseURL: 'http://localhost:11434/v1',
        apiKey: 'ollama',
      },
    });
    
    // Use withStructuredOutput - test different methods
    const methods = ['functionCalling', 'jsonMode'] as const;
    const results: any = {};
    
    for (const method of methods) {
      try {
        console.log(`  Testing method: ${method}...`);
        
        const structuredLLM = llm.withStructuredOutput(schema, {
          method,
          name: 'classification'
        });
        
        const result = await Promise.race([
          structuredLLM.invoke(`Classify: "${input}"`),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout after 15s')), 15000)
          )
        ]);
        
        console.log(`  ✅ ${method} result:`, result);
        results[method] = { success: true, result };
        
      } catch (error) {
        console.log(`  ❌ ${method} error:`, error instanceof Error ? error.message : String(error));
        results[method] = { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    
    return results;
    
  } catch (error) {
    console.log(`❌ LangChain Error:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function debugTruncationIssue() {
  console.log('🔬 DEBUG: LangChain withStructuredOutput Truncation Analysis');
  console.log('========================================================');
  
  const models = ['qwen3:0.6b', 'llama3.2:3b'];
  const testInputs = [
    'Hello',
    'Fix the bug and run tests',
    'What is recursion?'
  ];
  
  for (const model of models) {
    console.log(`\n📱 Testing Model: ${model}`);
    console.log('='.repeat(50));
    
    for (const input of testInputs) {
      // Test direct API
      const directResult = await testDirectOllamaAPI(model, input);
      
      // Test LangChain
      const langchainResults = await testLangChainWithStructuredOutput(model, input);
      
      // Compare results
      console.log(`\n📊 Comparison for "${input}":`);
      console.log(`  Direct API: ${directResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (langchainResults.functionCalling) {
        console.log(`  LangChain Function Calling: ${langchainResults.functionCalling.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      }
      if (langchainResults.jsonMode) {
        console.log(`  LangChain JSON Mode: ${langchainResults.jsonMode.success ? '✅ SUCCESS' : '❌ FAILED'}`);
      }
      
      // Check for truncation patterns
      if (directResult.success && directResult.result) {
        const directType = directResult.result.type;
        const directReasoning = directResult.result.reasoning;
        
        console.log(`  Direct API classification: ${directType}`);
        if (directReasoning) {
          console.log(`  Direct API reasoning: "${directReasoning.substring(0, 100)}${directReasoning.length > 100 ? '...' : ''}"`);
        }
        
        // Check if LangChain results match
        for (const [method, methodResult] of Object.entries(langchainResults)) {
          if (methodResult.success && methodResult.result) {
            const langchainType = methodResult.result.type;
            const match = directType === langchainType;
            console.log(`  ${method} vs Direct: ${match ? '✅ MATCH' : '❌ MISMATCH'} (${langchainType} vs ${directType})`);
          }
        }
      }
      
      console.log('\n' + '-'.repeat(40));
    }
  }
}

// Run debug if called directly
if (import.meta.main) {
  debugTruncationIssue().catch(console.error);
}

export { debugTruncationIssue };