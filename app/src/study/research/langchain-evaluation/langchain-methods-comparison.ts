#!/usr/bin/env node

/**
 * LangChain Methods Comparison Test
 * 
 * Comprehensive performance testing of all LangChain classification methods:
 * 1. GenericLangChainClassifier (withStructuredOutput)
 * 2. FewShotLangChainClassifier
 * 3. OutputParserLangChainClassifier  
 * 4. ChatPromptTemplateLangChainClassifier
 * 5. OutputFixingParserLangChainClassifier
 */

import { 
  createInputClassifier,
  type ClassificationResult,
  type IClassifier
} from '@qi/agent/classifier';

interface TestCase {
  input: string;
  expected: 'command' | 'prompt' | 'workflow';
  category: string;
}

interface MethodResult {
  name: string;
  accuracy: number;
  avgLatency: number;
  avgConfidence: number;
  errors: number;
  results: Array<{
    input: string;
    expected: string;
    predicted: string;
    confidence: number;
    latency: number;
    correct: boolean;
    error?: string;
  }>;
}

const TEST_CASES: TestCase[] = [
  // Commands - should be 100% accurate
  { input: '/help', expected: 'command', category: 'command' },
  { input: '/status', expected: 'command', category: 'command' },
  { input: '/config', expected: 'command', category: 'command' },
  { input: '/reset', expected: 'command', category: 'command' },
  
  // Clear prompts - single requests
  { input: 'hello', expected: 'prompt', category: 'greeting' },
  { input: 'what is recursion?', expected: 'prompt', category: 'question' },
  { input: 'write a quicksort function', expected: 'prompt', category: 'coding' },
  { input: 'explain machine learning', expected: 'prompt', category: 'explanation' },
  { input: 'hi there', expected: 'prompt', category: 'greeting' },
  
  // Clear workflows - multi-step tasks
  { input: 'fix the bug in auth.js and run tests', expected: 'workflow', category: 'multi-step' },
  { input: 'create API endpoint with docs and tests', expected: 'workflow', category: 'multi-step' },
  { input: 'debug login issue in src/auth.ts and update README', expected: 'workflow', category: 'multi-step' },
  { input: 'implement feature X, write tests, and deploy', expected: 'workflow', category: 'multi-step' },
  
  // Ambiguous cases - harder to classify
  { input: 'write tests for the auth module', expected: 'prompt', category: 'ambiguous' },
  { input: 'create a new component', expected: 'prompt', category: 'ambiguous' },
  { input: 'fix this bug', expected: 'prompt', category: 'ambiguous' },
  { input: 'review and merge the PR', expected: 'workflow', category: 'ambiguous' },
];

async function testMethod(
  name: string,
  classifierFactory: () => Promise<IClassifier>,
  testCases: TestCase[]
): Promise<MethodResult> {
  console.log(`\n🧪 Testing ${name}...`);
  
  const results: MethodResult['results'] = [];
  let totalLatency = 0;
  let totalConfidence = 0;
  let errors = 0;
  
  try {
    const classifier = await classifierFactory();
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      process.stdout.write(`  Progress: ${i + 1}/${testCases.length} (${((i + 1) / testCases.length * 100).toFixed(1)}%)\r`);
      
      try {
        const startTime = Date.now();
        const result: ClassificationResult = await classifier.classify(testCase.input);
        const latency = Date.now() - startTime;
        
        const correct = result.type === testCase.expected;
        
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: result.type,
          confidence: result.confidence,
          latency,
          correct
        });
        
        totalLatency += latency;
        totalConfidence += result.confidence;
        
      } catch (error) {
        errors++;
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: 'error',
          confidence: 0,
          latency: 0,
          correct: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const correctPredictions = results.filter(r => r.correct).length;
    const accuracy = correctPredictions / testCases.length;
    const avgLatency = totalLatency / testCases.length;
    const avgConfidence = totalConfidence / (testCases.length - errors);
    
    console.log(`  ✅ Completed: ${accuracy * 100}% accuracy, ${avgLatency.toFixed(0)}ms avg latency`);
    
    return {
      name,
      accuracy,
      avgLatency,
      avgConfidence,
      errors,
      results
    };
    
  } catch (initError) {
    console.log(`  ❌ Failed to initialize: ${initError instanceof Error ? initError.message : String(initError)}`);
    
    return {
      name,
      accuracy: 0,
      avgLatency: 0,
      avgConfidence: 0,
      errors: testCases.length,
      results: testCases.map(tc => ({
        input: tc.input,
        expected: tc.expected,
        predicted: 'error',
        confidence: 0,
        latency: 0,
        correct: false,
        error: 'Initialization failed'
      }))
    };
  }
}

async function main(): Promise<void> {
  console.log('🔬 CLASSIFIER METHODS COMPARISON TEST');
  console.log('=====================================\n');

  const config = {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    modelId: process.env.MODEL_ID || 'qwen3:8b',
  };

  console.log(`🤖 Model: ${config.modelId}`);
  console.log(`🔗 Endpoint: ${config.baseUrl}`);
  console.log(`📊 Test cases: ${TEST_CASES.length}\n`);

  // Test available methods through InputClassifier interface
  const methodResults: MethodResult[] = [];

  // 1. Rule-based Classification (fast)
  methodResults.push(await testMethod(
    'Rule-based (pattern matching)',
    async () => createInputClassifier({ method: 'rule-based' }),
    TEST_CASES
  ));

  // 2. LangChain Structured Output (accurate)
  methodResults.push(await testMethod(
    'LangChain (withStructuredOutput)',
    async () => createInputClassifier({
      method: 'langchain-structured',
      baseUrl: config.baseUrl,
      modelId: config.modelId,
    }),
    TEST_CASES
  ));

  // Display results
  console.log('\n📊 COMPREHENSIVE COMPARISON RESULTS');
  console.log('===================================\n');

  // Sort by accuracy
  methodResults.sort((a, b) => b.accuracy - a.accuracy);

  // Summary table
  console.log('📋 Method Performance Summary');
  console.log('----------------------------');
  console.log('| Method                           | Accuracy | Avg Latency | Avg Confidence | Errors |');
  console.log('|----------------------------------|----------|-------------|----------------|--------|');
  
  methodResults.forEach(result => {
    const name = result.name.padEnd(32);
    const accuracy = `${(result.accuracy * 100).toFixed(1)}%`.padStart(8);
    const latency = `${result.avgLatency.toFixed(0)}ms`.padStart(11);
    const confidence = `${(result.avgConfidence * 100).toFixed(1)}%`.padStart(14);
    const errors = result.errors.toString().padStart(6);
    
    console.log(`| ${name} | ${accuracy} | ${latency} | ${confidence} | ${errors} |`);
  });

  // Category-wise analysis
  console.log('\n📈 Category-wise Performance Analysis');
  console.log('------------------------------------');

  const categories = [...new Set(TEST_CASES.map(tc => tc.category))];
  
  for (const category of categories) {
    console.log(`\n${category.toUpperCase()}:`);
    const categoryTests = TEST_CASES.filter(tc => tc.category === category);
    
    methodResults.forEach(methodResult => {
      const categoryResults = methodResult.results.filter(r => 
        categoryTests.some(ct => ct.input === r.input)
      );
      const categoryAccuracy = categoryResults.filter(r => r.correct).length / categoryResults.length;
      
      console.log(`  ${methodResult.name}: ${(categoryAccuracy * 100).toFixed(1)}%`);
    });
  }

  // Detailed error analysis
  console.log('\n🔍 Error Analysis');
  console.log('-----------------');

  methodResults.forEach(methodResult => {
    const errors = methodResult.results.filter(r => !r.correct);
    if (errors.length > 0) {
      console.log(`\n${methodResult.name} errors (${errors.length}):`);
      errors.forEach(error => {
        console.log(`  "${error.input}" → expected: ${error.expected}, got: ${error.predicted}`);
        if (error.error) {
          console.log(`    Error: ${error.error}`);
        }
      });
    }
  });

  // Best method recommendation
  console.log('\n🏆 RECOMMENDATIONS');
  console.log('==================');

  const bestAccuracy = methodResults[0];
  const bestLatency = methodResults.reduce((best, current) => 
    current.avgLatency < best.avgLatency ? current : best
  );

  console.log(`🎯 Best Accuracy: ${bestAccuracy.name} (${(bestAccuracy.accuracy * 100).toFixed(1)}%)`);
  console.log(`⚡ Best Latency: ${bestLatency.name} (${bestLatency.avgLatency.toFixed(0)}ms)`);
  
  const balanced = methodResults.find(r => r.accuracy > 0.8 && r.avgLatency < 1000);
  if (balanced) {
    console.log(`⚖️  Best Balanced: ${balanced.name} (${(balanced.accuracy * 100).toFixed(1)}% accuracy, ${balanced.avgLatency.toFixed(0)}ms latency)`);
  }

  console.log('\n✅ LangChain methods comparison completed!');
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main as testClassifierMethodsComparison };