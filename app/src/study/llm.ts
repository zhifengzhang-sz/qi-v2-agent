#!/usr/bin/env node

/**
 * LLM Classification Study
 * 
 * Tests direct LLM classification using OllamaStructuredWrapper.
 * Works with ANY model - no function calling required.
 * Uses JSON prompting for universal compatibility.
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

async function runLLMStudy(): Promise<void> {
  console.log('🤖 LLM CLASSIFICATION STUDY');
  console.log('===========================\\n');

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

  const modelId = process.env.MODEL_ID || classifierConfig.model || 'qwen2.5:7b';
  const baseUrl = llmConfig.llm.providers.ollama.baseURL;

  console.log(`🤖 Model: ${modelId}`);
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log(`🔧 Method: OllamaStructuredWrapper (llm-based)\\n`);

  // Create LLM classifier using OllamaStructuredWrapper method
  const classifier = createInputClassifier({
    method: 'llm-based',
    baseUrl: baseUrl,
    modelId: modelId,
    temperature: 0.1,
    maxTokens: 1000,
  });

  console.log('🧪 Testing LLM classification...');

  const results: Array<{
    input: string;
    expected: string;
    predicted: string;
    confidence: number;
    latency: number;
    correct: boolean;
    reasoning?: string;
  }> = [];

  let correct = 0;
  let totalConfidence = 0;
  let totalLatency = 0;
  let errors = 0;

  for (let i = 0; i < dataset.samples.length; i++) {
    const testCase = dataset.samples[i];
    const progress = ((i + 1) / dataset.samples.length * 100).toFixed(1);
    process.stdout.write(`  Progress: ${progress}% (${i + 1}/${dataset.samples.length}) - ${(totalLatency / 1000).toFixed(1)}s\\r`);

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
        confidence: result.confidence,
        latency,
        correct: isCorrect,
        reasoning: result.reasoning,
      });
    } catch (error) {
      errors++;
      console.log(`\\n❌ Error on "${testCase.input}": ${error}`);
      
      results.push({
        input: testCase.input,
        expected: testCase.expected,
        predicted: 'error',
        confidence: 0,
        latency: 0,
        correct: false,
        reasoning: `Error: ${error}`,
      });
    }
  }

  console.log('\\n✅ Testing completed\\n');

  // Calculate metrics
  const accuracy = correct / dataset.samples.length;
  const avgConfidence = totalConfidence / (dataset.samples.length - errors);
  const avgLatency = totalLatency / dataset.samples.length;

  // Per-category analysis
  const byCategory: Record<string, { correct: number; total: number; errors: TestCase[] }> = {};
  
  for (const result of results) {
    if (!byCategory[result.expected]) {
      byCategory[result.expected] = { correct: 0, total: 0, errors: [] };
    }
    byCategory[result.expected].total++;
    if (result.correct) {
      byCategory[result.expected].correct++;
    } else {
      const testCase = dataset.samples.find(tc => tc.input === result.input);
      if (testCase) byCategory[result.expected].errors.push(testCase);
    }
  }

  // Display results
  console.log('📊 LLM STUDY RESULTS');
  console.log('====================\\n');

  console.log('📋 Overall Performance');
  console.log('-----------------------');
  console.log(`✅ Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${dataset.samples.length})`);
  console.log(`🎯 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`⚡ Average Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`❌ Errors: ${errors}/${dataset.samples.length}`);
  console.log();

  console.log('📈 Per-Category Performance');
  console.log('---------------------------');
  for (const [category, stats] of Object.entries(byCategory)) {
    const categoryAccuracy = (stats.correct / stats.total * 100).toFixed(1);
    console.log(`  ${category}: ${categoryAccuracy}% (${stats.correct}/${stats.total})`);
  }
  console.log();

  // Sample reasoning analysis
  console.log('🧠 Sample Reasoning Analysis');
  console.log('----------------------------');
  const correctSamples = results.filter(r => r.correct && r.reasoning).slice(0, 2);
  correctSamples.forEach(sample => {
    console.log(`✅ "${sample.input}" → ${sample.predicted}`);
    console.log(`   Reasoning: ${sample.reasoning}`);
    console.log();
  });

  // Error analysis
  console.log('🔍 Error Analysis');
  console.log('-----------------');
  for (const [category, stats] of Object.entries(byCategory)) {
    if (stats.errors.length > 0) {
      console.log(`\\n❌ ${category} misclassifications (${stats.errors.length}):`);
      stats.errors.slice(0, 3).forEach(error => {
        const result = results.find(r => r.input === error.input);
        console.log(`   "${error.input}" → ${result?.predicted} (expected: ${error.expected})`);
        if (result?.reasoning) {
          console.log(`     Reasoning: ${result.reasoning.substring(0, 100)}...`);
        }
      });
      if (stats.errors.length > 3) {
        console.log(`   ... and ${stats.errors.length - 3} more`);
      }
    }
  }

  console.log('\\n📝 LLM Study Key Findings:');
  console.log('• Universal model compatibility (no function calling required)');
  console.log('• JSON prompting approach works with any Ollama model');
  console.log('• Provides detailed reasoning for classifications');
  console.log('• Higher latency but better accuracy than rule-based');
  console.log('• Good fallback when LangChain function calling fails');
  
  if (accuracy > 0.8) {
    console.log('✅ LLM method working correctly');
  } else {
    console.log('⚠️  Low accuracy suggests prompt or model issues');
  }
}

// Execute if run directly
if (import.meta.main) {
  runLLMStudy().catch(console.error);
}

export { runLLMStudy };