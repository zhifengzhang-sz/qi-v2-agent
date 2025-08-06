/**
 * Systematic withStructuredOutput Method Testing
 * 
 * Tests each LangChain withStructuredOutput method option with Ollama
 * to determine what actually works vs. what fails.
 * 
 * Single data point approach - clear empirical results.
 */

import { z } from 'zod';

const TEST_INPUT = "What is recursion and how does it work?";
const MODEL_ID = "llama3.2:3b";
const BASE_URL = "http://localhost:11434";
const TIMEOUT_MS = 30000;

// Simple schema for testing
const classificationSchema = z.object({
  type: z.enum(['prompt', 'workflow']).describe('Classification type'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().optional().describe('Brief explanation')
});

interface MethodTestResult {
  provider: string;
  method: string;
  success: boolean;
  latencyMs: number;
  result?: any;
  error?: string;
  rawResponse?: string;
  actualMethod?: string; // What method LangChain actually used
}

interface TestReport {
  testInput: string;
  model: string;
  timestamp: string;
  results: MethodTestResult[];
  summary: {
    totalTests: number;
    successful: number;
    failed: number;
    workingMethods: string[];
  };
}

/**
 * Test ChatOllama with specific method
 */
async function testChatOllamaMethod(method?: string): Promise<MethodTestResult> {
  const startTime = Date.now();
  const methodName = method || 'default';
  
  try {
    const { ChatOllama } = await import('@langchain/ollama');
    
    const llm = new ChatOllama({
      model: MODEL_ID,
      baseUrl: BASE_URL,
      temperature: 0.1,
    });

    // Configure withStructuredOutput with or without method
    const options: any = { name: "classification" };
    if (method) {
      options.method = method;
    }

    console.log(`🧪 Testing ChatOllama + ${methodName}...`);
    
    const structuredLLM = llm.withStructuredOutput(classificationSchema, options);
    
    const result = await Promise.race([
      structuredLLM.invoke(TEST_INPUT),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      )
    ]);

    const latencyMs = Date.now() - startTime;

    return {
      provider: 'ChatOllama',
      method: methodName,
      success: true,
      latencyMs,
      result,
      actualMethod: method || 'auto-detected'
    };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      provider: 'ChatOllama',
      method: methodName,
      success: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Test ChatOpenAI with /v1 endpoint and specific method
 */
async function testChatOpenAIMethod(method: string): Promise<MethodTestResult> {
  const startTime = Date.now();
  
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    
    const llm = new ChatOpenAI({
      model: MODEL_ID,
      temperature: 0.1,
      configuration: {
        baseURL: `${BASE_URL}/v1`,
        apiKey: 'ollama',
      },
    });

    console.log(`🧪 Testing ChatOpenAI + /v1 + ${method}...`);
    
    const structuredLLM = llm.withStructuredOutput(classificationSchema, {
      method: method as any,
      name: "classification"
    });
    
    const result = await Promise.race([
      structuredLLM.invoke(TEST_INPUT),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS)
      )
    ]);

    const latencyMs = Date.now() - startTime;

    return {
      provider: 'ChatOpenAI+/v1',
      method,
      success: true,
      latencyMs,
      result,
      actualMethod: method
    };

  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      provider: 'ChatOpenAI+/v1',
      method,
      success: false,
      latencyMs,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Print test result
 */
function printResult(result: MethodTestResult): void {
  const status = result.success ? '✅' : '❌';
  console.log(`${status} ${result.provider} + ${result.method}`);
  console.log(`   Latency: ${result.latencyMs}ms`);
  
  if (result.success && result.result) {
    console.log(`   Result: ${JSON.stringify(result.result, null, 2).substring(0, 100)}...`);
  }
  
  if (result.error) {
    console.log(`   Error: ${result.error.substring(0, 200)}...`);
  }
  
  console.log('');
}

/**
 * Run all systematic tests
 */
async function runSystematicTests(): Promise<TestReport> {
  console.log('🔬 SYSTEMATIC withStructuredOutput METHOD TESTING');
  console.log('='.repeat(60));
  console.log(`Test Input: "${TEST_INPUT}"`);
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  const results: MethodTestResult[] = [];

  // Test ChatOllama methods
  console.log('📋 CHATOLLAMA TESTS');
  console.log('-'.repeat(30));
  
  const chatOllamaMethods = [
    undefined,              // Default method
    'functionCalling',
    'jsonMode', 
    'jsonSchema'
  ];

  for (const method of chatOllamaMethods) {
    const result = await testChatOllamaMethod(method);
    printResult(result);
    results.push(result);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Test ChatOpenAI + /v1 methods
  console.log('📋 CHATOPENAI + /v1 TESTS');
  console.log('-'.repeat(30));
  
  const chatOpenAIMethods = [
    'functionCalling',
    'jsonMode',
    'jsonSchema'
  ];

  for (const method of chatOpenAIMethods) {
    const result = await testChatOpenAIMethod(method);
    printResult(result);
    results.push(result);
    
    // Brief pause between tests  
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate summary
  const successful = results.filter(r => r.success);
  const workingMethods = successful.map(r => `${r.provider}+${r.method}`);

  const report: TestReport = {
    testInput: TEST_INPUT,
    model: MODEL_ID,
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalTests: results.length,
      successful: successful.length,
      failed: results.length - successful.length,
      workingMethods
    }
  };

  return report;
}

/**
 * Print final summary report
 */
function printSummary(report: TestReport): void {
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${report.summary.totalTests}`);
  console.log(`Successful: ${report.summary.successful}`);
  console.log(`Failed: ${report.summary.failed}`);
  console.log('');
  
  console.log('✅ WORKING METHODS:');
  if (report.summary.workingMethods.length === 0) {
    console.log('   None - all methods failed');
  } else {
    report.summary.workingMethods.forEach(method => {
      const result = report.results.find(r => `${r.provider}+${r.method}` === method);
      console.log(`   ${method} (${result?.latencyMs}ms)`);
    });
  }
  
  console.log('');
  console.log('❌ FAILED METHODS:');
  const failedResults = report.results.filter(r => !r.success);
  if (failedResults.length === 0) {
    console.log('   None - all methods succeeded');
  } else {
    failedResults.forEach(result => {
      console.log(`   ${result.provider}+${result.method}: ${result.error?.substring(0, 100)}...`);
    });
  }

  console.log('');
  console.log('🎯 CONCLUSION:');
  if (report.summary.successful === 0) {
    console.log('   No withStructuredOutput methods work with this Ollama setup');
  } else if (report.summary.successful === report.summary.totalTests) {
    console.log('   All withStructuredOutput methods work correctly');
  } else {
    console.log(`   ${report.summary.successful}/${report.summary.totalTests} methods work - use the working ones for production`);
  }
}

// Main execution
async function main() {
  try {
    const report = await runSystematicTests();
    printSummary(report);
    
    // Export results for further analysis if needed
    console.log('\n💾 Test results exported to memory for analysis');
    
  } catch (error) {
    console.error('❌ Systematic testing failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

export { runSystematicTests, type MethodTestResult, type TestReport };