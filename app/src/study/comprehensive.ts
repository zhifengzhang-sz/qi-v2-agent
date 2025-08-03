#!/usr/bin/env node

/**
 * Comprehensive Classification Study
 * 
 * Cross-method comparison of all classification approaches.
 * Unified test runner for rule-based, LLM, and LangChain methods.
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { 
  createInputClassifier,
  InputClassifier
} from '@qi/agent/classifier';
import { createStateManager } from '@qi/agent/state';
import { 
  calculateConfidenceInterval,
  compareMultipleMethods,
  calculateRequiredSampleSize,
  type ClassificationResult as StatClassificationResult
} from './statistical-analysis.js';

interface TestCase {
  input: string;
  expected: 'command' | 'prompt' | 'workflow';
  source?: string;
}

interface BalancedDataset {
  samples: TestCase[];
  metadata: {
    totalSamples: number;
    sources: Record<string, number>;
    distribution: Record<string, number>;
  };
}

interface MethodResult {
  name: string;
  description: string;
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

interface MethodConfig {
  name: string;
  description: string;
  classifier?: InputClassifier;
  config?: any;
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
  console.log(`📋 Total samples: ${dataset.metadata.totalSamples}`);
  console.log(`📋 Sources: ${Object.keys(dataset.metadata.sources).join(', ')}`);
  console.log(`📊 Distribution:`);
  for (const [type, count] of Object.entries(dataset.metadata.distribution)) {
    const percentage = ((count / dataset.metadata.totalSamples) * 100).toFixed(1);
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

  // Helper function to create Zod schema for LangChain (modern approach)
  const { z } = await import('zod');
  const createZodClassificationSchema = () => {
    return z.object({
      type: z.enum(['command', 'prompt', 'workflow'])
        .describe('The input type classification'),
      confidence: z.number()
        .min(0)
        .max(1)
        .describe('Confidence score from 0.0 to 1.0'),
      reasoning: z.string()
        .describe('Brief explanation of why this classification was chosen')
    });
  };

  // Helper function for JSON schema (legacy approach)
  const createJsonSchema = () => {
    return {
      type: 'object',
      properties: {
        type: { 
          type: 'string', 
          enum: ['command', 'prompt', 'workflow'],
          description: 'The input type classification'
        },
        confidence: { 
          type: 'number', 
          minimum: 0, 
          maximum: 1,
          description: 'Confidence score from 0.0 to 1.0'
        },
        reasoning: { 
          type: 'string',
          description: 'Brief explanation of why this classification was chosen'
        }
      },
      required: ['type', 'confidence', 'reasoning']
    };
  };

  const langchainConfig = {
    modelId: modelId,
    baseUrl: baseUrl + '/v1',
    apiKey: 'ollama',
    temperature: 0.1,
    maxTokens: 1000
  };

  // Define classification methods to test - ALL LangChain variants now enabled
  const methods: MethodConfig[] = [
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
      name: 'langchain-structured',
      description: 'LangChain withStructuredOutput',
      config: { 
        method: 'langchain-structured' as const,
        baseUrl: baseUrl + '/v1',
        modelId: modelId,
        temperature: 0.1,
        apiKey: 'ollama'
      }
    },
    {
      name: 'fewshot-langchain',
      description: 'LangChain with few-shot examples',
      config: { 
        method: 'fewshot-langchain' as const,
        baseUrl: baseUrl + '/v1',
        modelId: modelId,
        temperature: 0.1,
        apiKey: 'ollama'
      }
    },
    {
      name: 'chatprompt-langchain',
      description: 'LangChain with chat prompt template',
      config: { 
        method: 'chatprompt-langchain' as const,
        baseUrl: baseUrl + '/v1',
        modelId: modelId,
        temperature: 0.1,
        apiKey: 'ollama'
      }
    },
    {
      name: 'outputparser-langchain',
      description: 'LangChain with output parser',
      config: { 
        method: 'outputparser-langchain' as const,
        baseUrl: baseUrl + '/v1',
        modelId: modelId,
        temperature: 0.1,
        apiKey: 'ollama'
      }
    },
    {
      name: 'outputfixing-langchain',
      description: 'LangChain with output fixing parser',
      config: { 
        method: 'outputfixing-langchain' as const,
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
      // Use pre-created classifier or create one from config
      const classifier = method.classifier || createInputClassifier(method.config!);
      
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
        description: method.description,
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
  console.log('| Method               | Description                    | Accuracy | Confidence | Latency | Errors |');
  console.log('|----------------------|--------------------------------|----------|------------|---------|--------|');
  
  sortedMethods.forEach(method => {
    const name = method.name.padEnd(20);
    const desc = method.description.substring(0, 30).padEnd(30);
    const accuracy = `${(method.accuracy * 100).toFixed(1)}%`.padStart(8);
    const confidence = `${(method.avgConfidence * 100).toFixed(1)}%`.padStart(10);
    const latency = `${method.avgLatency.toFixed(0)}ms`.padStart(7);
    const errors = method.errors.toString().padStart(6);
    
    console.log(`| ${name} | ${desc} | ${accuracy} | ${confidence} | ${latency} | ${errors} |`);
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
    console.log(`  Description: ${method.description}`);
    
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
    } else if (method.name.startsWith('langchain')) {
      if (method.accuracy < 0.7) {
        console.log('• ⚠️  Underperforming - likely function calling issues');
        console.log('• Check model compatibility with ./scripts/test-function-calling.sh');
        console.log('• Consider using function calling models (qwen3:8b, llama3.1:8b)');
      } else {
        console.log('• ✅ Working correctly with structured output');
        console.log('• Good performance for function calling models');
        console.log('• Structured output provides reliable format');
      }
      console.log(`• Error rate: ${((method.errors / dataset.samples.length) * 100).toFixed(1)}%`);
      console.log(`• Average latency: ${method.avgLatency.toFixed(0)}ms`);
      
      // Special insights for specific LangChain variants
      if (method.name === 'fewshot-langchain') {
        console.log('• Uses examples to guide classification');
        console.log('• Should perform better on edge cases');
      } else if (method.name === 'chatprompt-langchain') {
        console.log('• Uses chat prompt templates for conversational context');
        console.log('• Better handling of context and user experience levels');
      } else if (method.name === 'outputparser-langchain') {
        console.log('• Custom parsing logic for output processing');
        console.log('• More flexible than structured output for legacy models');
      } else if (method.name === 'outputfixing-langchain') {
        console.log('• Self-fixing parser for malformed outputs');
        console.log('• Higher reliability at cost of latency');
      }
    }
  });

  // Statistical Analysis
  console.log('\\n📊 STATISTICAL SIGNIFICANCE ANALYSIS');
  console.log('======================================\\n');

  // Convert method results to statistical format
  const statResults: Record<string, StatClassificationResult> = {};
  methodResults.forEach(method => {
    statResults[method.name] = {
      correct: Math.round(method.accuracy * dataset.samples.length),
      total: dataset.samples.length,
      accuracy: method.accuracy,
      confidences: method.results.map(r => r.confidence),
      latencies: method.results.map(r => r.latency)
    };
  });

  // Calculate confidence intervals for each method
  console.log('📏 Confidence Intervals (95%)');
  console.log('------------------------------');
  methodResults.forEach(method => {
    const correct = Math.round(method.accuracy * dataset.samples.length);
    const ci = calculateConfidenceInterval(correct, dataset.samples.length, 0.95);
    const lowerPercent = (ci.lower * 100).toFixed(1);
    const upperPercent = (ci.upper * 100).toFixed(1);
    const accuracyPercent = (method.accuracy * 100).toFixed(1);
    
    console.log(`${method.name.padEnd(20)}: ${accuracyPercent}% [${lowerPercent}% - ${upperPercent}%]`);
  });

  // Perform comprehensive statistical comparison
  const statisticalComparison = compareMultipleMethods(statResults);

  console.log('\\n🔬 Pairwise Method Comparisons');
  console.log('--------------------------------');
  
  Object.entries(statisticalComparison.pairwiseComparisons).forEach(([comparison, result]) => {
    const [method1, method2] = comparison.split('_vs_');
    const significance = result.significant ? '✅ SIGNIFICANT' : '❌ Not significant';
    const pValue = result.pValue.toFixed(4);
    const effectSize = result.effectSize.toFixed(3);
    
    console.log(`\\n${method1} vs ${method2}:`);
    console.log(`  ${significance} (p = ${pValue})`);
    console.log(`  Effect size: ${effectSize} (${interpretEffectSize(result.effectSize)})`);
    console.log(`  ${result.interpretation}`);
  });

  console.log('\\n📈 Statistical Power Analysis');
  console.log('-------------------------------');
  
  const powerAnalysis = statisticalComparison.overallAnalysis;
  console.log(`Sample Size: ${powerAnalysis.sampleSize}`);
  console.log(`Statistical Power: ${(powerAnalysis.statisticalPower * 100).toFixed(1)}%`);
  
  // Sample size recommendations
  const smallEffectSize = calculateRequiredSampleSize(0.05, 0.8, 0.05, 0.8); // 5% difference
  const mediumEffectSize = calculateRequiredSampleSize(0.1, 0.8, 0.05, 0.8);  // 10% difference
  const largeEffectSize = calculateRequiredSampleSize(0.2, 0.8, 0.05, 0.8);   // 20% difference
  
  console.log('\\n📊 Sample Size Recommendations:');
  console.log(`  Small effect (5% difference): ${smallEffectSize.recommendedSampleSize} samples`);
  console.log(`  Medium effect (10% difference): ${mediumEffectSize.recommendedSampleSize} samples`);
  console.log(`  Large effect (20% difference): ${largeEffectSize.recommendedSampleSize} samples`);
  
  console.log('\\n🔍 Statistical Recommendations:');
  powerAnalysis.recommendations.forEach(rec => console.log(`  ${rec}`));

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
  console.log(`• Function Calling Models: Best LangChain variant based on results above`);

  // LangChain method comparison
  const langchainMethods = methodResults.filter(m => m.name.startsWith('langchain')).sort((a, b) => b.accuracy - a.accuracy);
  if (langchainMethods.length > 0) {
    console.log('\\n🏆 LangChain Method Ranking:');
    langchainMethods.forEach((method, index) => {
      const rank = index + 1;
      const accuracy = (method.accuracy * 100).toFixed(1);
      const latency = method.avgLatency.toFixed(0);
      console.log(`   ${rank}. ${method.name}: ${accuracy}% accuracy, ${latency}ms avg`);
    });
  }

  console.log('\\n📝 Next Research Priorities:');
  const bestLangChain = langchainMethods[0];
  if (!bestLangChain || bestLangChain.accuracy < 0.7) {
    console.log('1. 🔧 Investigate LangChain underperformance across all variants');
    console.log('2. ✅ Verify model function calling support');  
    console.log('3. 🧪 Test different models with function calling');
    console.log('4. 📝 Optimize prompts and schemas for best variant');
  } else {
    console.log(`1. 🔬 Optimize best LangChain method (${bestLangChain.name})`);
    console.log('2. 📊 Scale testing to larger datasets');
    console.log('3. 🚀 Implement production monitoring');
    console.log('4. 🧪 Fine-tune configurations for top performers');
  }
}

/**
 * Interpret effect size according to Cohen's conventions
 */
function interpretEffectSize(effectSize: number): string {
  if (effectSize < 0.1) return 'negligible';
  if (effectSize < 0.3) return 'small';
  if (effectSize < 0.5) return 'medium';
  return 'large';
}

// Execute if run directly
if (import.meta.main) {
  runComprehensiveStudy().catch(console.error);
}

export { runComprehensiveStudy };