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

// Different prompt strategies to test
const PROMPT_STRATEGIES = {
  'current': 'Current implementation (baseline)',
  'detailed': 'Detailed definitions with examples',
  'simple': 'Minimal, concise instructions',
  'few-shot': 'Few-shot examples in system prompt',
  'chain-of-thought': 'Step-by-step reasoning approach',
};

async function runLangChainPromptsStudy(): Promise<void> {
  console.log('📝 LANGCHAIN PROMPTS STUDY');
  console.log('==========================\\n');
  
  console.log('🎯 RESEARCH GOAL: Optimize LangChain prompts for better classification accuracy\\n');

  // Load dataset (smaller for prompt testing)
  const datasetName = process.env.DATASET || 'balanced-10x3.json';
  const datasetPath = join(__dirname, 'datasets', datasetName);
  
  if (!existsSync(datasetPath)) {
    console.error(`❌ Dataset not found: ${datasetName}`);
    process.exit(1);
  }

  const dataset: BalancedDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  
  console.log(`📊 Dataset: ${datasetName} (${dataset.metadata.total} samples)`);
  console.log(`📋 Testing ${Object.keys(PROMPT_STRATEGIES).length} prompt strategies\\n`);

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

  // Test each prompt strategy
  const strategyResults: Record<string, {
    accuracy: number;
    avgConfidence: number;
    avgLatency: number;
    errors: number;
    results: Array<{ input: string; expected: string; predicted: string; correct: boolean }>;
  }> = {};

  for (const [strategyName, description] of Object.entries(PROMPT_STRATEGIES)) {
    console.log(`🧪 Testing Strategy: ${strategyName}`);
    console.log(`   Description: ${description}`);
    
    // For now, use the current implementation
    // TODO: Implement different prompt strategies in the classifier
    const classifier = createInputClassifier({
      method: 'langchain-structured',
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

    strategyResults[strategyName] = {
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

  console.log('\\n📊 PROMPT STRATEGY COMPARISON');
  console.log('==============================\\n');

  // Sort strategies by accuracy
  const sortedStrategies = Object.entries(strategyResults)
    .sort(([, a], [, b]) => b.accuracy - a.accuracy);

  console.log('📋 Performance Ranking');
  console.log('----------------------');
  sortedStrategies.forEach(([strategy, metrics], index) => {
    const rank = index + 1;
    const badge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
    console.log(`${badge} ${rank}. ${strategy}: ${(metrics.accuracy * 100).toFixed(1)}% accuracy`);
    console.log(`     Confidence: ${(metrics.avgConfidence * 100).toFixed(1)}% | Latency: ${metrics.avgLatency.toFixed(0)}ms | Errors: ${metrics.errors}`);
  });

  console.log('\\n📈 Detailed Analysis');
  console.log('--------------------');
  
  const bestStrategy = sortedStrategies[0];
  const worstStrategy = sortedStrategies[sortedStrategies.length - 1];
  
  console.log(`🥇 Best Strategy: ${bestStrategy[0]} (${(bestStrategy[1].accuracy * 100).toFixed(1)}% accuracy)`);
  console.log(`🔻 Worst Strategy: ${worstStrategy[0]} (${(worstStrategy[1].accuracy * 100).toFixed(1)}% accuracy)`);
  console.log(`📊 Improvement Potential: ${((bestStrategy[1].accuracy - worstStrategy[1].accuracy) * 100).toFixed(1)}% points`);

  // Error pattern analysis
  console.log('\\n🔍 Error Pattern Analysis');
  console.log('--------------------------');
  
  const errorsByCategory: Record<string, Record<string, number>> = {};
  
  for (const [strategy, metrics] of Object.entries(strategyResults)) {
    errorsByCategory[strategy] = { command: 0, prompt: 0, workflow: 0 };
    
    metrics.results.forEach(result => {
      if (!result.correct) {
        errorsByCategory[strategy][result.expected]++;
      }
    });
  }

  for (const [category, label] of [['command', 'Commands'], ['prompt', 'Prompts'], ['workflow', 'Workflows']]) {
    console.log(`\\n${label} Classification Errors:`);
    Object.entries(errorsByCategory).forEach(([strategy, errors]) => {
      console.log(`  ${strategy}: ${errors[category]} errors`);
    });
  }

  console.log('\\n📝 PROMPT OPTIMIZATION INSIGHTS');
  console.log('=================================\\n');

  // Generate insights based on results
  const avgAccuracy = Object.values(strategyResults).reduce((sum, r) => sum + r.accuracy, 0) / Object.keys(strategyResults).length;
  
  if (avgAccuracy < 0.7) {
    console.log('🚨 CRITICAL: All prompt strategies showing low accuracy');
    console.log('   This suggests fundamental issues beyond prompting:');
    console.log('   • Model may lack function calling support');
    console.log('   • Schema design problems');
    console.log('   • API configuration issues');
    console.log('   \\n💡 Recommendation: Fix core LangChain setup before optimizing prompts');
  } else {
    console.log('✅ POSITIVE: Prompts are functional, optimization possible');
    console.log(`   Average accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
    console.log(`   Best strategy: ${bestStrategy[0]} (+${((bestStrategy[1].accuracy - avgAccuracy) * 100).toFixed(1)}% vs average)`);
    console.log('   \\n💡 Recommendations:');
    console.log(`   • Implement ${bestStrategy[0]} strategy in production`);
    console.log('   • Test with larger datasets for confirmation');
    console.log('   • Consider A/B testing between top strategies');
  }

  console.log('\\n🔬 Next Research Steps:');
  console.log('1. 🧪 Test winning strategy on full dataset');
  console.log('2. 🔧 Implement custom prompt templates in classifier');
  console.log('3. 📊 Compare with schema optimizations');
  console.log('4. ⚖️  Validate against other classification methods');

  console.log('\\n📋 Current Limitation:');
  console.log('This study currently tests the same implementation multiple times.');
  console.log('To get real prompt variations, the classifier module needs custom prompt support.');
  console.log('Consider implementing prompt template parameters in createInputClassifier().');
}

// Execute if run directly
if (import.meta.main) {
  runLangChainPromptsStudy().catch(console.error);
}

export { runLangChainPromptsStudy };