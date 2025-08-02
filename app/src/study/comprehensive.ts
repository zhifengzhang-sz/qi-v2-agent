#!/usr/bin/env node

/**
 * Comprehensive Classification Study
 * 
 * Cross-method comparison of all classification approaches.
 * Unified test runner for rule-based, LLM, and LangChain methods.
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createInputClassifier } from '@qi/agent/classifier';
import { createStateManager } from '@qi/agent/state';

interface TestCase {
  input: string;
  expected: 'command' | 'prompt' | 'workflow';
  source?: string;
}

interface BalancedDataset {
  samples: TestCase[];
  metadata: {
    total: number;
    sources: string[];
    distribution: Record<string, number>;
  };
}

interface MethodResult {
  name: string;
  accuracy: number;
  avgConfidence: number;
  avgLatency: number;
  errors: number;
  categoryPerformance: Record<string, { correct: number; total: number; accuracy: number }>;
  results: Array<{
    input: string;
    expected: string;
    predicted: string;
    confidence: number;
    latency: number;
    correct: boolean;
  }>;
}

async function runComprehensiveStudy(): Promise<void> {
  console.log('🔬 COMPREHENSIVE CLASSIFICATION STUDY');
  console.log('=====================================\\n');
  
  console.log('🎯 RESEARCH GOAL: Compare all classification methods on identical dataset\\n');

  // Load dataset
  const datasetName = process.env.DATASET || 'balanced-10x3.json';
  const datasetPath = join(__dirname, 'datasets', datasetName);
  
  if (!existsSync(datasetPath)) {
    console.error(`❌ Dataset not found: ${datasetName}`);
    process.exit(1);
  }

  const dataset: BalancedDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  
  console.log(`📊 Dataset: ${datasetName}`);
  console.log(`📋 Total samples: ${dataset.metadata.total}`);
  console.log(`📋 Sources: ${dataset.metadata.sources.join(', ')}`);
  console.log(`📊 Distribution:`);
  for (const [type, count] of Object.entries(dataset.metadata.distribution)) {
    const percentage = ((count / dataset.metadata.total) * 100).toFixed(1);
    console.log(`   ${type}: ${count} (${percentage}%)`);
  }
  console.log();

  // Initialize configuration for LLM methods
  const stateManager = createStateManager();
  const configPath = join(__dirname, '..', '..', '..', 'config');
  await stateManager.loadLLMConfig(configPath);

  const classifierConfig = stateManager.getClassifierConfig();
  const llmConfig = stateManager.getLLMConfigForPromptModule();
  
  const modelId = process.env.MODEL_ID || classifierConfig?.model || 'qwen3:8b';
  const baseUrl = llmConfig?.llm?.providers?.ollama?.baseURL || 'http://localhost:11434';

  console.log(`🤖 Model: ${modelId}`);
  console.log(`🔗 Base URL: ${baseUrl}\\n`);

  // Define classification methods to test
  const methods = [
    {
      name: 'rule-based',
      description: 'Pattern matching (no LLM)',
      config: { method: 'rule-based' as const }
    },
    {
      name: 'llm-direct',
      description: 'OllamaWrapper (universal)',
      config: { 
        method: 'llm-based' as const,
        baseUrl: baseUrl,
        modelId: modelId,
        temperature: 0.1
      }
    },
    {
      name: 'langchain',
      description: 'LangChain structured output',
      config: { 
        method: 'langchain-structured' as const,
        baseUrl: baseUrl + '/v1',
        modelId: modelId,
        temperature: 0.1,
        apiKey: 'ollama'
      }
    }
  ];

  const methodResults: MethodResult[] = [];

  // Test each method
  for (const method of methods) {
    console.log(`🧪 Testing: ${method.name}`);
    console.log(`   Description: ${method.description}`);
    
    try {
      const classifier = createInputClassifier(method.config);
      
      let correct = 0;
      let totalConfidence = 0;
      let totalLatency = 0;
      let errors = 0;
      const results: MethodResult['results'] = [];
      const categoryStats: Record<string, { correct: number; total: number }> = {};

      // Initialize category stats
      for (const type of ['command', 'prompt', 'workflow']) {
        categoryStats[type] = { correct: 0, total: 0 };
      }

      for (let i = 0; i < dataset.samples.length; i++) {
        const testCase = dataset.samples[i];
        const progress = ((i + 1) / dataset.samples.length * 100).toFixed(1);
        process.stdout.write(`   Progress: ${progress}% (${i + 1}/${dataset.samples.length})\\r`);

        try {
          const startTime = Date.now();
          const result = await classifier.classify(testCase.input);
          const latency = Date.now() - startTime;

          const isCorrect = result.type === testCase.expected;
          if (isCorrect) {
            correct++;
            categoryStats[testCase.expected].correct++;
          }
          categoryStats[testCase.expected].total++;

          totalConfidence += result.confidence;
          totalLatency += latency;

          results.push({
            input: testCase.input,
            expected: testCase.expected,
            predicted: result.type,
            confidence: result.confidence,
            latency,
            correct: isCorrect,
          });
        } catch (error) {
          errors++;
          categoryStats[testCase.expected].total++;
          
          results.push({
            input: testCase.input,
            expected: testCase.expected,
            predicted: 'error',
            confidence: 0,
            latency: 0,
            correct: false,
          });
        }
      }

      const accuracy = correct / dataset.samples.length;
      const avgConfidence = errors < dataset.samples.length ? totalConfidence / (dataset.samples.length - errors) : 0;
      const avgLatency = totalLatency / dataset.samples.length;

      // Calculate category performance
      const categoryPerformance: Record<string, { correct: number; total: number; accuracy: number }> = {};
      for (const [category, stats] of Object.entries(categoryStats)) {
        categoryPerformance[category] = {
          correct: stats.correct,
          total: stats.total,
          accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
        };
      }

      methodResults.push({
        name: method.name,
        accuracy,
        avgConfidence,
        avgLatency,
        errors,
        categoryPerformance,
        results,
      });

      console.log(`   ✅ Accuracy: ${(accuracy * 100).toFixed(1)}% | Confidence: ${(avgConfidence * 100).toFixed(1)}% | Latency: ${avgLatency.toFixed(0)}ms\\n`);

    } catch (error) {
      console.log(`   ❌ Failed to initialize: ${error}\\n`);
    }
  }

  // Comprehensive analysis
  console.log('📊 COMPREHENSIVE ANALYSIS');
  console.log('=========================\\n');

  // Sort methods by accuracy
  const sortedMethods = [...methodResults].sort((a, b) => b.accuracy - a.accuracy);

  console.log('📋 Overall Performance Ranking');
  console.log('------------------------------');
  console.log('| Method      | Accuracy | Confidence | Avg Latency | Errors |');
  console.log('|-------------|----------|------------|-------------|--------|');
  
  sortedMethods.forEach(method => {
    const name = method.name.padEnd(11);
    const accuracy = `${(method.accuracy * 100).toFixed(1)}%`.padStart(8);
    const confidence = `${(method.avgConfidence * 100).toFixed(1)}%`.padStart(10);
    const latency = `${method.avgLatency.toFixed(0)}ms`.padStart(11);
    const errors = method.errors.toString().padStart(6);
    
    console.log(`| ${name} | ${accuracy} | ${confidence} | ${latency} | ${errors} |`);
  });

  console.log('\\n📈 Per-Category Performance');
  console.log('----------------------------');
  
  for (const category of ['command', 'prompt', 'workflow']) {
    console.log(`\\n${category.toUpperCase()} Classification:`);
    methodResults.forEach(method => {
      const perf = method.categoryPerformance[category];
      const accuracy = (perf.accuracy * 100).toFixed(1);
      console.log(`  ${method.name}: ${accuracy}% (${perf.correct}/${perf.total})`);
    });
  }

  // Performance analysis
  console.log('\\n🔍 PERFORMANCE ANALYSIS');
  console.log('========================\\n');

  const bestMethod = sortedMethods[0];
  const worstMethod = sortedMethods[sortedMethods.length - 1];
  const fastestMethod = methodResults.reduce((fastest, current) => 
    current.avgLatency < fastest.avgLatency ? current : fastest
  );

  console.log(`🥇 Best Accuracy: ${bestMethod.name} (${(bestMethod.accuracy * 100).toFixed(1)}%)`);
  console.log(`⚡ Fastest Method: ${fastestMethod.name} (${fastestMethod.avgLatency.toFixed(0)}ms avg)`);
  console.log(`📊 Performance Range: ${(worstMethod.accuracy * 100).toFixed(1)}% - ${(bestMethod.accuracy * 100).toFixed(1)}%`);

  // Method-specific insights
  console.log('\\n🧠 Method-Specific Insights');
  console.log('----------------------------');
  
  methodResults.forEach(method => {
    console.log(`\\n${method.name.toUpperCase()}:`);
    
    if (method.name === 'rule-based') {
      console.log('• Fastest method (< 1ms per classification)');
      console.log('• No LLM dependency - works offline');
      console.log('• Perfect for commands, limited for workflows');
      console.log(`• Command accuracy: ${(method.categoryPerformance.command.accuracy * 100).toFixed(1)}%`);
    } else if (method.name === 'llm-direct') {
      console.log('• Universal model compatibility');
      console.log('• JSON prompting approach');
      console.log('• Good balance of accuracy and reliability');
      console.log(`• Average confidence: ${(method.avgConfidence * 100).toFixed(1)}%`);
    } else if (method.name === 'langchain') {
      if (method.accuracy < 0.7) {
        console.log('• ⚠️  Underperforming - likely function calling issues');
        console.log('• Check model compatibility with ./scripts/test-function-calling.sh');
        console.log('• Consider using function calling models (qwen3:8b, llama3.1:8b)');
      } else {
        console.log('• ✅ Working correctly with structured output');
        console.log('• Best method for function calling models');
        console.log('• Highest potential accuracy when properly configured');
      }
      console.log(`• Error rate: ${((method.errors / dataset.samples.length) * 100).toFixed(1)}%`);
    }
  });

  // Recommendations
  console.log('\\n💡 RECOMMENDATIONS');
  console.log('===================\\n');

  if (bestMethod.accuracy > 0.9) {
    console.log('🎉 EXCELLENT: High-quality classification achieved!');
    console.log(`   Recommended production method: ${bestMethod.name}`);
    console.log('   Focus on optimization and monitoring');
  } else if (bestMethod.accuracy > 0.75) {
    console.log('✅ GOOD: Acceptable classification quality');
    console.log(`   Production recommendation: ${bestMethod.name}`);
    console.log('   Consider improvements through prompt/schema optimization');
  } else {
    console.log('⚠️  NEEDS IMPROVEMENT: All methods showing suboptimal performance');
    console.log('   Priority investigation areas:');
    console.log('   1. Model compatibility (function calling support)');
    console.log('   2. Dataset quality and balance');
    console.log('   3. Prompt engineering');
    console.log('   4. Schema design');
  }

  console.log('\\n🎯 Use Case Recommendations:');
  console.log(`• Development/Testing: rule-based (${methodResults.find(m => m.name === 'rule-based')?.avgLatency.toFixed(0) || '~1'}ms latency)`);
  console.log(`• Universal Production: llm-direct (works with any model)`);
  console.log(`• Function Calling Models: langchain (highest potential accuracy)`);

  console.log('\\n📝 Next Research Priorities:');
  if (methodResults.find(m => m.name === 'langchain')?.accuracy || 0 < 0.7) {
    console.log('1. 🔧 Investigate LangChain underperformance');
    console.log('2. ✅ Verify model function calling support');  
    console.log('3. 🧪 Test LangChain prompt/schema optimizations');
  } else {
    console.log('1. 🔬 Optimize winning method performance');
    console.log('2. 📊 Scale testing to larger datasets');
    console.log('3. 🚀 Implement production monitoring');
  }
}

// Execute if run directly
if (import.meta.main) {
  runComprehensiveStudy().catch(console.error);
}

export { runComprehensiveStudy };