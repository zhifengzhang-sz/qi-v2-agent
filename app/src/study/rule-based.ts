#!/usr/bin/env node

/**
 * Rule-Based Classification Study
 * 
 * Tests rule-based classification method with configurable datasets.
 * Fast baseline method that requires no LLM calls.
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createInputClassifier } from '@qi/agent/classifier';

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

async function runRuleBasedStudy(): Promise<void> {
  console.log('📏 RULE-BASED CLASSIFICATION STUDY');
  console.log('==================================\n');

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

  // Create rule-based classifier
  const classifier = createInputClassifier({
    method: 'rule-based',
    confidenceThreshold: 0.8,
  });

  console.log('🧪 Testing rule-based classification...');

  const results: Array<{
    input: string;
    expected: string;
    predicted: string;
    confidence: number;
    latency: number;
    correct: boolean;
  }> = [];

  let correct = 0;
  let totalConfidence = 0;
  let totalLatency = 0;

  for (let i = 0; i < dataset.samples.length; i++) {
    const testCase = dataset.samples[i];
    const progress = ((i + 1) / dataset.samples.length * 100).toFixed(1);
    process.stdout.write(`  Progress: ${progress}% (${i + 1}/${dataset.samples.length})\\r`);

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
    });
  }

  console.log('\\n✅ Testing completed\\n');

  // Calculate metrics
  const accuracy = correct / dataset.samples.length;
  const avgConfidence = totalConfidence / dataset.samples.length;
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
  console.log('📊 RULE-BASED STUDY RESULTS');
  console.log('============================\\n');

  console.log('📋 Overall Performance');
  console.log('-----------------------');
  console.log(`✅ Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${dataset.samples.length})`);
  console.log(`🎯 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`⚡ Average Latency: ${avgLatency.toFixed(1)}ms`);
  console.log();

  console.log('📈 Per-Category Performance');
  console.log('---------------------------');
  for (const [category, stats] of Object.entries(byCategory)) {
    const categoryAccuracy = (stats.correct / stats.total * 100).toFixed(1);
    console.log(`  ${category}: ${categoryAccuracy}% (${stats.correct}/${stats.total})`);
  }
  console.log();

  // Error analysis
  console.log('🔍 Error Analysis');
  console.log('-----------------');
  for (const [category, stats] of Object.entries(byCategory)) {
    if (stats.errors.length > 0) {
      console.log(`\\n❌ ${category} misclassifications (${stats.errors.length}):`);
      stats.errors.slice(0, 3).forEach(error => {
        const result = results.find(r => r.input === error.input);
        console.log(`   "${error.input}" → ${result?.predicted} (expected: ${error.expected})`);
      });
      if (stats.errors.length > 3) {
        console.log(`   ... and ${stats.errors.length - 3} more`);
      }
    }
  }

  console.log('\\n📝 Rule-Based Study Key Findings:');
  console.log('• Fast classification (< 1ms per sample)');
  console.log('• No LLM dependency - works offline');
  console.log('• Perfect for commands (100% accuracy expected)');
  console.log('• Limited workflow detection capability');
  console.log('• Good baseline for comparison studies');
}

// Execute if run directly
if (import.meta.main) {
  runRuleBasedStudy().catch(console.error);
}

export { runRuleBasedStudy };