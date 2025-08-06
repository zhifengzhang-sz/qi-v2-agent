/**
 * Prompt Swap Test
 * 
 * Tests the hypothesis that prompt format (not endpoint) is causing LangChain failures.
 * 
 * Controlled experiment:
 * - Test A: LangChain complex prompt → Simple API (/api/generate)  
 * - Test B: Simple prompt → OpenAI endpoint (/v1/chat/completions)
 * 
 * Single data point approach - get conclusion before moving forward.
 */

interface TestResult {
  testName: string;
  prompt: string;
  endpoint: string;
  success: boolean;
  rawResponse: string;
  parsedResult: any;
  error?: string;
  latencyMs: number;
}

interface ExperimentResults {
  testInput: string;
  testA: TestResult;  // LangChain prompt → Simple API
  testB: TestResult;  // Simple prompt → OpenAI endpoint  
  conclusion: string;
}

const TEST_INPUT = "What is recursion and how does it work?";
const MODEL_ID = "llama3.2:3b";
const BASE_URL = "http://localhost:11434";
const TIMEOUT_MS = 30000;

/**
 * Simple API prompt (from ollama-native.ts buildPrompt method)
 */
const SIMPLE_PROMPT = `Classify the following user input into one of two categories:

**Categories:**
1. **prompt** - Single questions, explanations, greetings, or direct requests that can be answered immediately
   Examples: "Hi", "What is recursion?", "Explain machine learning", "How does JavaScript work?", "Write a function"
   
2. **workflow** - Multi-step tasks requiring coordination of multiple actions or tools
   Examples: "Fix bug in auth.js AND run tests", "Create feature WITH validation AND tests", "Analyze codebase AND suggest improvements"

**Key Classification Rules:**
- **prompt**: Simple questions, explanations, single coding requests, greetings, concept explanations
- **workflow**: Contains coordinating words (AND, then, with), multiple file operations, testing + code changes, analysis + recommendations

**Important:** 
- Questions asking "what is X?" or "explain Y" are ALWAYS prompts, even if complex topics
- Only classify as workflow if there are genuinely multiple coordinated steps

**User Input:** "${TEST_INPUT}"

Respond with valid JSON matching the required schema.`;

/**
 * LangChain complex prompt (from langchain-json-schema.ts buildPrompt method)
 */
const LANGCHAIN_PROMPT = `Classify the following user input into one of two categories with high accuracy:

**Categories:**
1. **prompt** - Single-step requests, questions, or conversational inputs (e.g., "hi", "what is recursion?", "write a function", "explain this concept")  
2. **workflow** - Multi-step tasks requiring orchestration (e.g., "fix the bug in auth.js and run tests", "create a new feature with tests and documentation", "analyze this codebase and suggest improvements")

**Classification Rules:**
- Prompts are single-step requests, questions, or conversational inputs that can be answered directly
- Workflows involve multiple steps, file operations, testing, analysis, or complex task orchestration
- Look for indicators like: multiple actions, file references, testing requirements, "and then", coordination needs

**User Input:** "${TEST_INPUT}"

**Instructions:**
- Analyze the input carefully for complexity and multi-step indicators
- Consider whether this requires orchestration across multiple tools/steps
- Provide a confidence score based on how clear the classification is
- Give specific reasoning for your choice`;

/**
 * JSON schema for structured output (minimal version)
 */
const JSON_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['prompt', 'workflow'],
      description: 'Classification: prompt (single-step) or workflow (multi-step)'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Confidence score from 0.0 to 1.0'
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of the classification decision'
    }
  },
  required: ['type', 'confidence']
};

/**
 * Test A: LangChain complex prompt via simple API (/api/generate)
 */
async function testA_LangChainPromptViaSimpleAPI(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const requestBody = {
      model: MODEL_ID,
      prompt: LANGCHAIN_PROMPT,
      format: JSON_SCHEMA,
      stream: false,
      options: {
        temperature: 0.1,
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        testName: "Test A: LangChain Prompt → Simple API",
        prompt: LANGCHAIN_PROMPT,
        endpoint: "/api/generate",
        success: false,
        rawResponse: errorText,
        parsedResult: null,
        error: `HTTP ${response.status}: ${errorText}`,
        latencyMs
      };
    }

    const result = await response.json();
    const rawResponse = result.response || JSON.stringify(result);
    
    // Try to parse the JSON response
    let parsedResult: any = null;
    let parseError: string | undefined;
    
    try {
      if (typeof result.response === 'string') {
        parsedResult = JSON.parse(result.response);
      } else {
        parsedResult = result;
      }
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    return {
      testName: "Test A: LangChain Prompt → Simple API",
      prompt: LANGCHAIN_PROMPT,
      endpoint: "/api/generate",
      success: !parseError && parsedResult?.type && parsedResult?.confidence,
      rawResponse,
      parsedResult,
      error: parseError,
      latencyMs
    };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      testName: "Test A: LangChain Prompt → Simple API",
      prompt: LANGCHAIN_PROMPT,
      endpoint: "/api/generate",
      success: false,
      rawResponse: "",
      parsedResult: null,
      error: error instanceof Error ? error.message : String(error),
      latencyMs
    };
  }
}

/**
 * Test B: Simple prompt via OpenAI endpoint (/v1/chat/completions)
 */
async function testB_SimplePromptViaOpenAIEndpoint(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Format simple prompt for chat completions format
    const requestBody = {
      model: MODEL_ID,
      messages: [
        {
          role: "user",
          content: SIMPLE_PROMPT
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ollama'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        testName: "Test B: Simple Prompt → OpenAI Endpoint",
        prompt: SIMPLE_PROMPT,
        endpoint: "/v1/chat/completions",
        success: false,
        rawResponse: errorText,
        parsedResult: null,
        error: `HTTP ${response.status}: ${errorText}`,
        latencyMs
      };
    }

    const result = await response.json();
    const messageContent = result.choices?.[0]?.message?.content || "";
    const rawResponse = JSON.stringify(result, null, 2);
    
    // Try to parse the JSON response
    let parsedResult: any = null;
    let parseError: string | undefined;
    
    try {
      if (messageContent) {
        parsedResult = JSON.parse(messageContent);
      }
    } catch (error) {
      parseError = error instanceof Error ? error.message : String(error);
    }

    return {
      testName: "Test B: Simple Prompt → OpenAI Endpoint",
      prompt: SIMPLE_PROMPT,
      endpoint: "/v1/chat/completions",
      success: !parseError && parsedResult?.type && parsedResult?.confidence,
      rawResponse,
      parsedResult,
      error: parseError,
      latencyMs
    };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      testName: "Test B: Simple Prompt → OpenAI Endpoint",
      prompt: SIMPLE_PROMPT,
      endpoint: "/v1/chat/completions",
      success: false,
      rawResponse: "",
      parsedResult: null,
      error: error instanceof Error ? error.message : String(error),
      latencyMs
    };
  }
}

/**
 * Analyze results and draw conclusion
 */
function analyzeResults(testA: TestResult, testB: TestResult): string {
  if (testA.success && testB.success) {
    return "INCONCLUSIVE: Both tests succeeded. Issue may be in LangChain's parsing/middleware layer.";
  }
  
  if (testA.success && !testB.success) {
    return "CONCLUSION: Problem is OpenAI endpoint corruption. LangChain's complex prompt works fine with direct API.";
  }
  
  if (!testA.success && testB.success) {
    return "CONCLUSION: Problem is LangChain's complex prompt format. Simple prompts work fine with OpenAI endpoint.";
  }
  
  if (!testA.success && !testB.success) {
    return "MULTIPLE ISSUES: Both prompt format AND OpenAI endpoint have problems.";
  }
  
  return "UNKNOWN: Unexpected result combination.";
}

/**
 * Print formatted test result
 */
function printTestResult(result: TestResult): void {
  console.log(`\n📋 ${result.testName}`);
  console.log(`   Endpoint: ${result.endpoint}`);
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
  console.log(`   Latency: ${result.latencyMs}ms`);
  
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
  
  if (result.success && result.parsedResult) {
    console.log(`   Type: ${result.parsedResult.type}`);
    console.log(`   Confidence: ${result.parsedResult.confidence}`);
    if (result.parsedResult.reasoning) {
      console.log(`   Reasoning: ${result.parsedResult.reasoning.substring(0, 100)}...`);
    }
  }
  
  if (!result.success && result.rawResponse) {
    console.log(`   Raw Response (first 200 chars): ${result.rawResponse.substring(0, 200)}...`);
  }
}

/**
 * Main experiment execution
 */
async function runPromptSwapExperiment(): Promise<ExperimentResults> {
  console.log('🧪 PROMPT SWAP EXPERIMENT');
  console.log('='.repeat(50));
  console.log(`Test Input: "${TEST_INPUT}"`);
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');
  
  console.log('Running Test A: LangChain complex prompt → Simple API...');
  const testA = await testA_LangChainPromptViaSimpleAPI();
  printTestResult(testA);
  
  console.log('\nRunning Test B: Simple prompt → OpenAI endpoint...');
  const testB = await testB_SimplePromptViaOpenAIEndpoint();
  printTestResult(testB);
  
  const conclusion = analyzeResults(testA, testB);
  
  console.log('\n📊 EXPERIMENT RESULTS');
  console.log('='.repeat(50));
  console.log(conclusion);
  console.log('');
  
  return {
    testInput: TEST_INPUT,
    testA,
    testB,
    conclusion
  };
}

// Main execution
if (import.meta.main) {
  runPromptSwapExperiment()
    .then((results) => {
      console.log('✅ Experiment completed successfully');
    })
    .catch((error) => {
      console.error('❌ Experiment failed:', error);
      process.exit(1);
    });
}

export { runPromptSwapExperiment, type ExperimentResults, type TestResult };