#!/usr/bin/env node

/**
 * LangChain Schemas Study
 * 
 * Tests different schema designs for LangChain structured output.
 * Investigates optimal balance between schema complexity and accuracy.
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { createInputClassifier } from '@qi/agent/classifier';
import { createStateManager } from '@qi/agent/state';
import { globalSchemaRegistry, type SchemaComplexity } from '@qi/agent/classifier/schema-registry';

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

// Schema strategies from the registry
const getSchemaStrategies = () => {
  const schemaEntries = globalSchemaRegistry.listSchemas();
  const strategies: Record<string, string> = {};
  
  schemaEntries.forEach(entry => {
    strategies[entry.metadata.name] = entry.metadata.description;
  });
  
  return strategies;
};

async function runLangChainSchemasStudy(): Promise<void> {
  console.log('🏗️  LANGCHAIN SCHEMAS STUDY');
  console.log('===========================\\n');
  
  console.log('🎯 RESEARCH GOAL: Find optimal schema design for classification accuracy\\n');

  // Load dataset
  const datasetName = process.env.DATASET || 'balanced-10x3.json';
  const datasetPath = join(__dirname, 'datasets', datasetName);
  
  if (!existsSync(datasetPath)) {
    console.error(`❌ Dataset not found: ${datasetName}`);
    process.exit(1);
  }

  const dataset: BalancedDataset = JSON.parse(readFileSync(datasetPath, 'utf-8'));
  
  console.log(`📊 Dataset: ${datasetName} (${dataset.metadata.totalSamples} samples)`);
  
  const SCHEMA_STRATEGIES = getSchemaStrategies();
  console.log(`📋 Testing ${Object.keys(SCHEMA_STRATEGIES).length} schema strategies\\n`);

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

  // Test schema complexity impact
  const schemaResults: Record<string, {
    accuracy: number;
    avgConfidence: number;
    avgLatency: number;
    errors: number;
    schemaComplexity: number;
    parseErrors: number;
    results: Array<{ input: string; expected: string; predicted: string; correct: boolean; latency: number }>;
    schemaMetadata: any;
  }> = {};

  for (const [schemaName, description] of Object.entries(SCHEMA_STRATEGIES)) {
    console.log(`🧪 Testing Schema: ${schemaName}`);
    console.log(`   Description: ${description}`);
    
    // Get schema details from registry
    const schemaResult = globalSchemaRegistry.getSchema(schemaName);
    if (schemaResult.tag === 'failure') {
      console.log(`   ❌ Schema not found in registry: ${schemaName}\\n`);
      continue;
    }
    
    const schemaEntry = schemaResult.value;
    
    // Create classifier with specific schema
    const classifier = createInputClassifier({
      method: 'langchain-structured',
      baseUrl: baseUrl + '/v1',
      modelId: modelId,
      temperature: 0.1,
      maxTokens: 1000,
      apiKey: 'ollama',
      schemaName: schemaName, // Use specific schema from registry
    });

    let correct = 0;
    let totalConfidence = 0;
    let totalLatency = 0;
    let errors = 0;
    let parseErrors = 0;
    const results: Array<{ input: string; expected: string; predicted: string; correct: boolean; latency: number }> = [];

    // Test on subset for schema comparison (filter out commands since they're handled by rule-based)
    const nonCommandSamples = dataset.samples.filter(sample => sample.expected !== 'command');
    const testSamples = nonCommandSamples.slice(0, Math.min(15, nonCommandSamples.length));
    
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
          latency,
        });
      } catch (error) {
        errors++;
        parseErrors++;
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: 'error',
          correct: false,
          latency: 0,
        });
      }
    }

    const accuracy = correct / testSamples.length;
    const avgConfidence = errors < testSamples.length ? totalConfidence / (testSamples.length - errors) : 0;
    const avgLatency = totalLatency / testSamples.length;
    
    // Use actual schema complexity from registry
    const complexityMap: Record<string, number> = {
      'minimal': 0.2,
      'standard': 0.4, 
      'detailed': 0.7,
      'optimized': 0.5,
    };
    const schemaComplexity = complexityMap[schemaEntry.metadata.complexity] || 0.5;

    schemaResults[schemaName] = {
      accuracy,
      avgConfidence,
      avgLatency,
      errors,
      schemaComplexity,
      parseErrors,
      results,
      schemaMetadata: schemaEntry.metadata,
    };

    console.log(`   ✅ Accuracy: ${(accuracy * 100).toFixed(1)}% | Complexity: ${(schemaComplexity * 100).toFixed(0)}% | Latency: ${avgLatency.toFixed(0)}ms`);
    
    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\\n📊 SCHEMA DESIGN ANALYSIS');
  console.log('==========================\\n');

  // Sort by accuracy
  const sortedSchemas = Object.entries(schemaResults)
    .sort(([, a], [, b]) => b.accuracy - a.accuracy);

  console.log('📋 Schema Registry Information')
  console.log('------------------------------')
  console.log('Available schemas in registry:')
  const allSchemas = globalSchemaRegistry.listSchemas();
  allSchemas.forEach(schema => {
    console.log(`• ${schema.metadata.name}: ${schema.metadata.description}`);
    console.log(`  Complexity: ${schema.metadata.complexity} | Expected accuracy: ${(schema.metadata.performance_profile.baseline_accuracy_estimate * 100).toFixed(1)}%`);
  });
  console.log();

  console.log('📋 Schema Performance Ranking');
  console.log('-----------------------------');
  console.log('| Schema     | Accuracy | Complexity | Latency | Parse Errors |');
  console.log('|------------|----------|------------|---------|--------------|');
  
  sortedSchemas.forEach(([schema, metrics]) => {
    const name = schema.padEnd(10);
    const accuracy = `${(metrics.accuracy * 100).toFixed(1)}%`.padStart(8);
    const complexity = `${(metrics.schemaComplexity * 100).toFixed(0)}%`.padStart(10);
    const latency = `${metrics.avgLatency.toFixed(0)}ms`.padStart(7);
    const parseErrors = metrics.parseErrors.toString().padStart(12);
    
    console.log(`| ${name} | ${accuracy} | ${complexity} | ${latency} | ${parseErrors} |`);
  });

  console.log('\\n📈 Complexity vs Performance Analysis');
  console.log('-------------------------------------');
  
  // Find optimal complexity/accuracy balance
  let bestBalance = { schema: '', score: 0 };
  
  for (const [schema, metrics] of Object.entries(schemaResults)) {
    // Balance score: accuracy / complexity (higher is better)
    const balanceScore = metrics.accuracy / Math.max(metrics.schemaComplexity, 0.1);
    
    if (balanceScore > bestBalance.score) {
      bestBalance = { schema, score: balanceScore };
    }
    
    console.log(`${schema}: Balance Score = ${balanceScore.toFixed(2)} (accuracy: ${(metrics.accuracy * 100).toFixed(1)}%, complexity: ${(metrics.schemaComplexity * 100).toFixed(0)}%)`);
  }

  console.log(`\\n🏆 Best Balance: ${bestBalance.schema} (score: ${bestBalance.score.toFixed(2)})`);

  // Error pattern analysis by schema
  console.log('\\n🔍 Schema Error Analysis');
  console.log('-------------------------');
  
  for (const [schema, metrics] of Object.entries(schemaResults)) {
    const categoryErrors = { command: 0, prompt: 0, workflow: 0 };
    
    metrics.results.forEach(result => {
      if (!result.correct) {
        categoryErrors[result.expected as keyof typeof categoryErrors]++;
      }
    });
    
    console.log(`\\n${schema} errors by category:`);
    console.log(`  Commands: ${categoryErrors.command} errors`);
    console.log(`  Prompts: ${categoryErrors.prompt} errors`);
    console.log(`  Workflows: ${categoryErrors.workflow} errors`);
  }

  // Performance vs complexity correlation
  console.log('\\n📊 Schema Design Insights');
  console.log('==========================\\n');

  const avgAccuracy = Object.values(schemaResults).reduce((sum, r) => sum + r.accuracy, 0) / Object.keys(schemaResults).length;
  const avgComplexity = Object.values(schemaResults).reduce((sum, r) => sum + r.schemaComplexity, 0) / Object.keys(schemaResults).length;
  
  console.log(`📈 Average Performance: ${(avgAccuracy * 100).toFixed(1)}% accuracy`);
  console.log(`📊 Average Complexity: ${(avgComplexity * 100).toFixed(0)}%`);

  const bestAccuracy = sortedSchemas[0];
  const bestComplexity = Object.entries(schemaResults)
    .sort(([, a], [, b]) => a.schemaComplexity - b.schemaComplexity)[0];

  console.log(`\\n🥇 Highest Accuracy: ${bestAccuracy[0]} (${(bestAccuracy[1].accuracy * 100).toFixed(1)}%)`);
  console.log(`🎯 Lowest Complexity: ${bestComplexity[0]} (${(bestComplexity[1].schemaComplexity * 100).toFixed(0)}%)`);
  console.log(`⚖️  Best Balance: ${bestBalance.schema}`);

  console.log('\\n💡 SCHEMA OPTIMIZATION RECOMMENDATIONS');
  console.log('=======================================\\n');

  if (avgAccuracy < 0.7) {
    console.log('🚨 LOW ACCURACY ACROSS ALL SCHEMAS');
    console.log('   Issue is likely NOT schema design but:');
    console.log('   • Function calling compatibility');
    console.log('   • Model selection');
    console.log('   • Core LangChain configuration');
    console.log('   \\n🔧 Fix fundamental issues before schema optimization');
  } else {
    console.log('✅ SCHEMAS FUNCTIONAL - OPTIMIZATION VIABLE');
    console.log(`   Recommended schema: ${bestBalance.schema}`);
    console.log(`   Expected improvement: ${((bestAccuracy[1].accuracy - avgAccuracy) * 100).toFixed(1)}% points`);
    console.log('   \\n🎯 Implementation priorities:');
    console.log(`   1. Implement ${bestBalance.schema} schema in production`);
    console.log('   2. A/B test against current implementation');
    console.log('   3. Monitor parse error rates in production');
  }

  console.log('\\n🔬 Technical Implementation Notes:');
  console.log('• Simpler schemas = faster parsing + lower error rates');
  console.log('• Complex schemas = more structured data but higher failure risk');
  console.log('• Optimal balance depends on model capabilities');
  console.log('• Parse errors indicate schema-model compatibility issues');

  console.log('\\n📋 Schema Registry Implementation Status:');
  console.log('✅ Schema registry implemented with 4 distinct schemas');
  console.log('✅ LangChainClassificationMethod updated to use dynamic schema selection');
  console.log('✅ Real schema variations now tested (no longer mock data)');
  console.log('✅ Performance profiles tracked per schema complexity level');

  console.log('\\n🎯 Schema Selection Recommendations:');
  const bestSchema = sortedSchemas[0];
  if (bestSchema) {
    const [name, results] = bestSchema;
    console.log(`🥇 Best performing schema: ${name}`);
    console.log(`   Actual accuracy: ${(results.accuracy * 100).toFixed(1)}%`);
    console.log(`   Expected accuracy: ${(results.schemaMetadata.performance_profile.expected_accuracy * 100).toFixed(1)}%`);
    console.log(`   Performance delta: ${((results.accuracy - results.schemaMetadata.performance_profile.expected_accuracy) * 100).toFixed(1)}% points`);
    console.log(`   Recommended for: ${results.schemaMetadata.recommended_for.join(', ')}`);
  }
}

// Execute if run directly
if (import.meta.main) {
  runLangChainSchemasStudy().catch(console.error);
}

export { runLangChainSchemasStudy };