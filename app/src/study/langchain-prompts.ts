#!/usr/bin/env node

/**
 * LangChain Prompts Study
 * 
 * Systematic investigation of prompt engineering for LangChain classification.
 * Tests different system prompts, few-shot examples, and template structures.
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

// INVALID RESEARCH METHODOLOGY DETECTED
// This study was testing the same implementation multiple times
// pretending they were different strategies. This is scientifically invalid.

// VALID RESEARCH: Test actual different LangChain classification variants
const ACTUAL_CLASSIFICATION_METHODS = {
  'langchain-structured': 'Standard LangChain with structured output',
  'fewshot-langchain': 'LangChain with few-shot examples',
  'chatprompt-langchain': 'LangChain with chat prompt template',
  'outputparser-langchain': 'LangChain with output parser',
  'outputfixing-langchain': 'LangChain with output fixing parser',
};

async function runLangChainClassificationMethodsStudy(): Promise<void> {
  console.log('📝 LANGCHAIN CLASSIFICATION METHODS STUDY');
  console.log('==========================================\\n');
  
  console.log('🎯 RESEARCH GOAL: Compare different LangChain classification method implementations\\n');
  console.log('⚠️  NOTE: Previous version had invalid methodology (testing same implementation multiple times)\\n');

  // Load dataset (smaller for prompt testing)
  const datasetName = process.env.DATASET || 'balanced-10x3.json';
  const datasetPath = join(__dirname, 'datasets', datasetName);
  
  if (!existsSync(datasetPath)) {
    console.error(`❌ Dataset not found: ${datasetName}`);
    process.exit(1);
  }

  const dataset: BalancedDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  
  console.log(`📊 Dataset: ${datasetName} (${dataset.metadata.total} samples)`);
  console.log(`📋 Testing ${Object.keys(ACTUAL_CLASSIFICATION_METHODS).length} LangChain classification methods\\n`);

  // Initialize configuration
  const stateManager = createStateManager();
  const configPath = join(__dirname, '..', '..', '..', 'config');
  await stateManager.loadLLMConfig(configPath);

  const classifierConfig = stateManager.getClassifierConfig();
  const llmConfig = stateManager.getLLMConfigForPromptModule();
  
  if (!classifierConfig || !llmConfig?.llm?.providers?.ollama) {
    console.error('❌ Configuration not available');
    process.exit(1);
  }

  const modelId = process.env.MODEL_ID || classifierConfig.model || 'qwen3:8b';
  const baseUrl = llmConfig.llm.providers.ollama.baseURL;

  console.log(`🤖 Model: ${modelId}`);
  console.log(`🔗 Base URL: ${baseUrl}\\n`);

  // Test each LangChain classification method
  const methodResults: Record<string, {
    accuracy: number;
    avgConfidence: number;
    avgLatency: number;
    errors: number;
    results: Array<{ input: string; expected: string; predicted: string; correct: boolean }>;
  }> = {};

  for (const [methodName, description] of Object.entries(ACTUAL_CLASSIFICATION_METHODS)) {
    console.log(`🧪 Testing Method: ${methodName}`);
    console.log(`   Description: ${description}`);
    
    // Test each ACTUAL different classification method implementation
    const classifier = createInputClassifier({
      method: methodName as any, // Use the actual method name
      baseUrl: baseUrl + '/v1',
      modelId: modelId,
      temperature: 0.1,
      maxTokens: 1000,
      apiKey: 'ollama',
    });

    let correct = 0;
    let totalConfidence = 0;
    let totalLatency = 0;
    let errors = 0;
    const results: Array<{ input: string; expected: string; predicted: string; correct: boolean }> = [];

    // Test on a subset for prompt comparison (faster iteration)
    const testSamples = dataset.samples.slice(0, Math.min(10, dataset.samples.length));
    
    for (let i = 0; i < testSamples.length; i++) {
      const testCase = testSamples[i];
      process.stdout.write(`   Progress: ${i + 1}/${testSamples.length}\\r`);

      try {
        const startTime = Date.now();
        const result = await classifier.classify(testCase.input);
        const latency = Date.now() - startTime;

        const isCorrect = result.type === testCase.expected;
        if (isCorrect) correct++;

        totalConfidence += result.confidence;
        totalLatency += latency;

        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: result.type,
          correct: isCorrect,
        });
      } catch (error) {
        errors++;
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: 'error',
          correct: false,
        });
      }
    }

    const accuracy = correct / testSamples.length;
    const avgConfidence = errors < testSamples.length ? totalConfidence / (testSamples.length - errors) : 0;
    const avgLatency = totalLatency / testSamples.length;

    methodResults[methodName] = {
      accuracy,
      avgConfidence,
      avgLatency,
      errors,
      results,
    };

    console.log(`   ✅ Accuracy: ${(accuracy * 100).toFixed(1)}% | Confidence: ${(avgConfidence * 100).toFixed(1)}% | Latency: ${avgLatency.toFixed(0)}ms`);
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\\n📊 LANGCHAIN METHOD COMPARISON');
  console.log('================================\\n');

  // Sort methods by accuracy
  const sortedMethods = Object.entries(methodResults)
    .sort(([, a], [, b]) => b.accuracy - a.accuracy);

  console.log('📋 Performance Ranking');
  console.log('----------------------');
  sortedMethods.forEach(([method, metrics], index) => {
    const rank = index + 1;
    const badge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
    console.log(`${badge} ${rank}. ${method}: ${(metrics.accuracy * 100).toFixed(1)}% accuracy`);
    console.log(`     Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}% | Latency: ${metrics.avgLatency.toFixed(0)}ms | Errors: ${metrics.errors}`);
  });

  console.log('\\n📈 Detailed Analysis');
  console.log('--------------------');
  
  const bestMethod = sortedMethods[0];
  const worstMethod = sortedMethods[sortedMethods.length - 1];
  
  console.log(`🥇 Best Method: ${bestMethod[0]} (${(bestMethod[1].accuracy * 100).toFixed(1)}% accuracy)`);
  console.log(`🔻 Worst Method: ${worstMethod[0]} (${(worstMethod[1].accuracy * 100).toFixed(1)}% accuracy)`);
  console.log(`📊 Performance Difference: ${((bestMethod[1].accuracy - worstMethod[1].accuracy) * 100).toFixed(1)}% points`);

  // Error pattern analysis
  console.log('\\n🔍 Error Pattern Analysis');
  console.log('--------------------------');
  
  const errorsByCategory: Record<string, Record<string, number>> = {};
  
  for (const [method, metrics] of Object.entries(methodResults)) {
    errorsByCategory[method] = { command: 0, prompt: 0, workflow: 0 };
    
    metrics.results.forEach(result => {
      if (!result.correct) {
        errorsByCategory[method][result.expected]++;
      }
    });
  }

  for (const [category, label] of [['command', 'Commands'], ['prompt', 'Prompts'], ['workflow', 'Workflows']]) {
    console.log(`\\n${label} Classification Errors:`);
    Object.entries(errorsByCategory).forEach(([method, errors]) => {
      console.log(`  ${method}: ${errors[category]} errors`);
    });
  }

  console.log('\\n📝 LANGCHAIN METHOD INSIGHTS');
  console.log('=============================\\n');

  // Generate insights based on results
  const avgAccuracy = Object.values(methodResults).reduce((sum, r) => sum + r.accuracy, 0) / Object.keys(methodResults).length;
  
  if (avgAccuracy < 0.7) {
    console.log('🚨 CRITICAL: All LangChain methods showing low accuracy');
    console.log('   This suggests fundamental issues with LangChain setup:');
    console.log('   • Model may lack function calling support');
    console.log('   • Schema design problems');
    console.log('   • API configuration issues');
    console.log('   \\n💡 Recommendation: Fix core LangChain setup before comparing methods');
  } else {
    console.log('✅ POSITIVE: LangChain methods are functional, optimization possible');
    console.log(`   Average accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
    console.log(`   Best method: ${bestMethod[0]} (+${((bestMethod[1].accuracy - avgAccuracy) * 100).toFixed(1)}% vs average)`);
    console.log('   \\n💡 Recommendations:');
    console.log(`   • Deploy ${bestMethod[0]} method in production`);
    console.log('   • Test with larger datasets for confirmation');
    console.log('   • Consider ensemble methods using top performers');
  }

  console.log('\\n🔬 Next Research Steps:');
  console.log('1. 🧪 Test winning method on full dataset');
  console.log('2. 🔧 Implement missing LangChain method variants');
  console.log('3. 📊 Compare with schema optimizations');
  console.log('4. ⚖️  Validate against rule-based classification methods');

  console.log('\\n✅ METHODOLOGY FIXED:');
  console.log('Previous version tested identical implementations with fake strategy names.');
  console.log('Now tests actual different LangChain classification method implementations.');
}

// Execute if run directly
if (import.meta.main) {
  runLangChainClassificationMethodsStudy().catch(console.error);
}

export { runLangChainClassificationMethodsStudy as runLangChainPromptsStudy };