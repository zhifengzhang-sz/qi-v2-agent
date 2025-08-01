#!/usr/bin/env node

/**
 * Comprehensive Classification Test Runner
 * 
 * Runs all classification performance tests and provides comparative analysis
 * between different approaches: rule-based, LLM-based, and structured output
 */

import { performance } from 'perf_hooks';

async function runAllTests() {
  console.log('🚀 COMPREHENSIVE CLASSIFICATION TEST SUITE');
  console.log('═'.repeat(70));
  console.log('📊 Running all classification performance tests...');
  console.log('');
  
  const startTime = performance.now();
  const results: Record<string, any> = {};
  
  try {
    // Test 1: Basic performance comparison
    console.log('1️⃣ Running basic classifier performance test...');
    console.log('─'.repeat(50));
    
    try {
      const { main: runPerformanceTest } = await import('./classifier-performance-test.js');
      await runPerformanceTest();
      results.performance_test = { status: 'completed', error: null };
    } catch (error) {
      console.error('❌ Performance test failed:', error);
      results.performance_test = { status: 'failed', error: String(error) };
    }
    
    console.log('\n');
    
    // Test 2: LangChain structured output
    console.log('2️⃣ Running LangChain structured output test...');
    console.log('─'.repeat(50));
    
    try {
      const { main: runStructuredTest } = await import('./langchain-structured-output-test.js');
      await runStructuredTest();  
      results.structured_test = { status: 'completed', error: null };
    } catch (error) {
      console.error('❌ Structured output test failed:', error);
      results.structured_test = { status: 'failed', error: String(error) };
    }
    
    console.log('\n');
    
    // Test 3: Existing classifier study (if available)
    console.log('3️⃣ Running existing classifier study...');
    console.log('─'.repeat(50));
    
    try {
      // Try to run the existing classifier study
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const studyPath = './src/demos/study/classifier-study.ts';
      await execAsync(`bun run ${studyPath}`);
      results.existing_study = { status: 'completed', error: null };
    } catch (error) {
      console.warn('⚠️ Existing classifier study not available or failed:', error);
      results.existing_study = { status: 'skipped', error: String(error) };
    }
    
    // Summary
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    console.log('📋 TEST SUITE SUMMARY');
    console.log('═'.repeat(40));
    console.log(`⏱️ Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
    console.log('');
    
    Object.entries(results).forEach(([test, result]) => {
      const status = result.status === 'completed' ? '✅' : 
                    result.status === 'failed' ? '❌' : '⚠️';
      console.log(`${status} ${test.replace('_', ' ')}: ${result.status}`);
      if (result.error && result.status === 'failed') {
        console.log(`   Error: ${result.error.substring(0, 100)}...`);
      }
    });
    
    const completedTests = Object.values(results).filter(r => r.status === 'completed').length;
    const totalTests = Object.keys(results).length;
    
    console.log('');
    console.log(`🎯 Test completion rate: ${completedTests}/${totalTests} (${((completedTests/totalTests)*100).toFixed(1)}%)`);
    
    if (completedTests === totalTests) {
      console.log('🏆 All tests completed successfully!');
    } else if (completedTests > 0) {
      console.log('⚠️ Some tests completed, check individual results above');
    } else {
      console.log('❌ All tests failed - check configuration and dependencies');
    }
    
    console.log('\n💡 Next Steps:');
    console.log('  • Review performance metrics and accuracy scores');
    console.log('  • Consider hybrid approaches for best results');
    console.log('  • Fine-tune prompts based on error analysis');
    console.log('  • Implement the best-performing method in production');
    
  } catch (error) {
    console.error('❌ Test suite execution failed:', error);
    process.exit(1);
  }
}

/**
 * Quick test runner for individual components
 */
async function runQuickTest(component?: string) {
  console.log('⚡ QUICK CLASSIFICATION TEST');
  console.log('─'.repeat(40));
  
  const quickTestCases = [
    ['/help', 'command'],
    ['what is TypeScript?', 'prompt'], 
    ['fix bug in auth.ts and run tests', 'workflow']
  ];
  
  console.log(`📊 Testing ${quickTestCases.length} representative cases...`);
  
  try {
    switch (component) {
      case 'rule':
        const { createRuleBasedClassifier } = await import('./classifier-performance-test.js');
        const ruleClassifier = createRuleBasedClassifier();
        for (const [input, expected] of quickTestCases) {
          const result = await ruleClassifier(input);
          console.log(`"${input}" → ${result.type} (expected: ${expected}) ${result.type === expected ? '✅' : '❌'}`);
        }
        break;
        
      case 'llm':
        const { createLLMClassifier } = await import('./classifier-performance-test.js');
        const llmClassifier = createLLMClassifier(); 
        for (const [input, expected] of quickTestCases) {
          const result = await llmClassifier(input);
          console.log(`"${input}" → ${result.type} (expected: ${expected}) ${result.type === expected ? '✅' : '❌'}`);
        }
        break;
        
      case 'structured':
        const { createStructuredClassifier } = await import('./langchain-structured-output-test.js');
        const structuredClassifier = await createStructuredClassifier('ollama');
        for (const [input, expected] of quickTestCases) {
          const result = await structuredClassifier(input);
          console.log(`"${input}" → ${result.type} (expected: ${expected}) ${result.type === expected ? '✅' : '❌'}`);
        }
        break;
        
      default:
        console.log('🔄 Testing all methods...');
        await runAllTests();
        return;
    }
    
    console.log('✅ Quick test completed!');
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
  }
}

/**
 * Benchmark latency specifically
 */
async function benchmarkLatency() {
  console.log('⚡ CLASSIFICATION LATENCY BENCHMARK');
  console.log('─'.repeat(50));
  
  const testInput = 'implement user authentication with tests and documentation';
  const iterations = 10;
  
  console.log(`📊 Benchmarking "${testInput}" (${iterations} iterations)`);
  console.log('');
  
  const methods = [
    { name: 'Rule-Based', createFn: 'createRuleBasedClassifier', module: './classifier-performance-test.js' },
    { name: 'LLM-Based', createFn: 'createLLMClassifier', module: './classifier-performance-test.js' },
    { name: 'Structured', createFn: 'createStructuredClassifier', module: './langchain-structured-output-test.js' }
  ];
  
  for (const method of methods) {
    try {
      console.log(`🔧 Testing ${method.name}...`);
      
      const module = await import(method.module);
      const classifier = method.name === 'Structured' 
        ? await module[method.createFn]('ollama')
        : module[method.createFn]();
      
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await classifier(testInput);
        const end = performance.now();
        times.push(end - start);
      }
      
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      console.log(`  Average: ${avgTime.toFixed(1)}ms`);
      console.log(`  Range: ${minTime.toFixed(1)}ms - ${maxTime.toFixed(1)}ms`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ ${method.name} benchmark failed:`, error);
    }
  }
}

/**
 * Main CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'quick':
      await runQuickTest(args[1]);
      break;
      
    case 'benchmark':
      await benchmarkLatency();
      break;
      
    case 'all':
    default:
      await runAllTests();
      break;
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🧪 Classification Test Runner');
  console.log('');
  console.log('Usage:');
  console.log('  bun run src/study/run-classification-tests.ts [command] [options]');
  console.log('');
  console.log('Commands:');
  console.log('  all (default)  Run all classification tests');
  console.log('  quick          Run quick test with sample cases');
  console.log('  quick rule     Quick test for rule-based classifier only');
  console.log('  quick llm      Quick test for LLM-based classifier only');
  console.log('  quick structured  Quick test for structured output classifier only');
  console.log('  benchmark      Run latency benchmark tests');
  console.log('');
  console.log('Examples:');
  console.log('  bun run src/study/run-classification-tests.ts');
  console.log('  bun run src/study/run-classification-tests.ts quick rule');
  console.log('  bun run src/study/run-classification-tests.ts benchmark');
  process.exit(0);
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}