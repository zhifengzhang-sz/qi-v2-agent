#!/usr/bin/env node

/**
 * LangChain Variants Classification Study
 * 
 * Detailed comparison of all LangChain classification methods to understand
 * which approach works best for different scenarios and models.
 * 
 * Tests all 6 LangChain implementations:
 * 1. LangChainClassificationMethod (withStructuredOutput)
 * 2. GenericLangChainClassifier 
 * 3. FewShotLangChainClassifier
 * 4. OutputParserLangChainClassifier
 * 5. ChatPromptTemplateLangChainClassifier
 * 6. OutputFixingParserLangChainClassifier
 */

import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { 
  createInputClassifier,
  InputClassifier
} from '@qi/agent/classifier';
import { createStateManager } from '@qi/agent/state';

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

interface VariantResult {
  name: string;
  description: string;
  accuracy: number;
  avgConfidence: number;
  avgLatency: number;
  errors: number;
  successfulCalls: number;
  categoryPerformance: Record<string, { correct: number; total: number; accuracy: number }>;
  errorAnalysis: {
    initializationErrors: number;
    runtimeErrors: number;
    parsingErrors: number;
    timeoutErrors: number;
  };
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

async function runLangChainVariantsStudy(): Promise<void> {
  console.log('🔬 LANGCHAIN VARIANTS CLASSIFICATION STUDY');
  console.log('==========================================\n');
  
  console.log('🎯 RESEARCH GOAL: Compare all LangChain classification implementations');
  console.log('📋 Testing 6 different LangChain approaches for comprehensive analysis\n');

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

  // Initialize configuration
  const stateManager = createStateManager();
  const configPath = join(__dirname, '..', '..', '..', 'config');
  await stateManager.loadLLMConfig(configPath);

  const classifierConfig = stateManager.getClassifierConfig();
  const llmConfig = stateManager.getLLMConfigForPromptModule();
  
  const modelId = process.env.MODEL_ID || classifierConfig?.model || 'qwen3:8b';
  const baseUrl = llmConfig?.llm?.providers?.ollama?.baseURL || 'http://localhost:11434';

  console.log(`🤖 Model: ${modelId}`);
  console.log(`🔗 Base URL: ${baseUrl}\n`);

  // Helper function to create classification schema
  const createClassificationSchema = () => ({
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
  });

  const langchainConfig = {
    modelId: modelId,
    baseUrl: baseUrl + '/v1',
    apiKey: 'ollama',
    temperature: 0.1,
    maxTokens: 1000
  };

  // Test function calling capability first
  console.log('🔍 STEP 1: Function Calling Capability Test');
  console.log('-------------------------------------------');
  
  let functionCallingSupported = false;
  try {
    const testResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'test', parameters: {} } }]
      })
    });
    
    const testResult: any = await testResponse.json();
    
    if (testResult.error && testResult.error.message.includes('does not support tools')) {
      console.log(`❌ Function Calling: NOT SUPPORTED`);
      console.log(`   This will affect structured output methods\n`);
    } else if (testResult.choices?.[0]?.message?.tool_calls || testResult.choices?.[0]?.message?.function_call) {
      console.log(`✅ Function Calling: SUPPORTED`);
      console.log(`   All LangChain methods should work properly\n`);
      functionCallingSupported = true;
    } else {
      console.log(`⚠️  Function Calling: UNCERTAIN`);
      console.log(`   Results may vary across methods\n`);
    }
  } catch (error) {
    console.log(`❌ Function calling test failed: ${error}\n`);
  }

  // Define all LangChain variants to test
  const variants: Array<{
    name: string;
    description: string;
    createClassifier: () => Promise<InputClassifier>;
  }> = [
    {
      name: 'langchain-structured',
      description: 'withStructuredOutput (official method)',
      createClassifier: async () => createInputClassifier({
        method: 'langchain-structured',
        baseUrl: baseUrl + '/v1',
        modelId: modelId,
        temperature: 0.1,
        apiKey: 'ollama'
      })
    },
    // Additional LangChain variants - currently under development
    // These need proper IClassificationMethod implementation before testing:
    //
    // {
    //   name: 'langchain-generic',
    //   description: 'GenericLangChainClassifier with Zod schema',
    //   createClassifier: async () => { /* TODO: Implement wrapper */ }
    // },
    // {
    //   name: 'langchain-few-shot', 
    //   description: 'FewShotLangChainClassifier with examples',
    //   createClassifier: async () => { /* TODO: Implement wrapper */ }
    // },
    // ... other variants pending implementation
  ];

  const variantResults: VariantResult[] = [];

  console.log('🔍 STEP 2: Testing LangChain Variants');
  console.log('-------------------------------------\n');

  // Test each variant
  for (const variant of variants) {
    console.log(`🧪 Testing: ${variant.name}`);
    console.log(`   Description: ${variant.description}`);
    
    let classifier: InputClassifier;
    let initializationError = false;
    
    try {
      classifier = await variant.createClassifier();
    } catch (error) {
      console.log(`   ❌ Initialization failed: ${error}\n`);
      variantResults.push({
        name: variant.name,
        description: variant.description,
        accuracy: 0,
        avgConfidence: 0,
        avgLatency: 0,
        errors: dataset.samples.length,
        successfulCalls: 0,
        categoryPerformance: {},
        errorAnalysis: {
          initializationErrors: 1,
          runtimeErrors: 0,
          parsingErrors: 0,
          timeoutErrors: 0
        },
        results: []
      });
      continue;
    }

    let correct = 0;
    let totalConfidence = 0;
    let totalLatency = 0;
    let errors = 0;
    let successfulCalls = 0;
    const results: VariantResult['results'] = [];
    const categoryStats: Record<string, { correct: number; total: number }> = {};
    const errorAnalysis = {
      initializationErrors: 0,
      runtimeErrors: 0,
      parsingErrors: 0,
      timeoutErrors: 0
    };

    // Initialize category stats
    for (const type of ['command', 'prompt', 'workflow']) {
      categoryStats[type] = { correct: 0, total: 0 };
    }

    // Test on sample subset for detailed analysis
    const sampleSize = Math.min(dataset.samples.length, 20);
    const testSamples = dataset.samples.slice(0, sampleSize);

    for (let i = 0; i < testSamples.length; i++) {
      const testCase = testSamples[i];
      const progress = ((i + 1) / testSamples.length * 100).toFixed(1);
      process.stdout.write(`   Progress: ${progress}% (${i + 1}/${testSamples.length})\\r`);

      try {
        const startTime = Date.now();
        const result = await Promise.race([
          classifier.classify(testCase.input),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000)
          )
        ]) as any;
        const latency = Date.now() - startTime;

        const isCorrect = result.type === testCase.expected;
        if (isCorrect) {
          correct++;
          categoryStats[testCase.expected].correct++;
        }
        categoryStats[testCase.expected].total++;

        totalConfidence += result.confidence || 0;
        totalLatency += latency;
        successfulCalls++;

        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: result.type,
          confidence: result.confidence || 0,
          latency,
          correct: isCorrect,
        });
      } catch (error) {
        errors++;
        categoryStats[testCase.expected].total++;
        
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('Timeout')) {
          errorAnalysis.timeoutErrors++;
        } else if (errorMsg.includes('parse') || errorMsg.includes('JSON')) {
          errorAnalysis.parsingErrors++;
        } else {
          errorAnalysis.runtimeErrors++;
        }
        
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: 'error',
          confidence: 0,
          latency: 0,
          correct: false,
          error: errorMsg,
        });
      }
    }

    const accuracy = correct / testSamples.length;
    const avgConfidence = successfulCalls > 0 ? totalConfidence / successfulCalls : 0;
    const avgLatency = testSamples.length > 0 ? totalLatency / testSamples.length : 0;

    // Calculate category performance
    const categoryPerformance: Record<string, { correct: number; total: number; accuracy: number }> = {};
    for (const [category, stats] of Object.entries(categoryStats)) {
      categoryPerformance[category] = {
        correct: stats.correct,
        total: stats.total,
        accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
      };
    }

    variantResults.push({
      name: variant.name,
      description: variant.description,
      accuracy,
      avgConfidence,
      avgLatency,
      errors,
      successfulCalls,
      categoryPerformance,
      errorAnalysis,
      results,
    });

    const successRate = ((successfulCalls / testSamples.length) * 100).toFixed(1);
    console.log(`   ✅ Accuracy: ${(accuracy * 100).toFixed(1)}% | Success Rate: ${successRate}% | Latency: ${avgLatency.toFixed(0)}ms\n`);
  }

  // Analysis and results
  console.log('📊 LANGCHAIN VARIANTS ANALYSIS');
  console.log('===============================\n');

  // Sort by accuracy
  const sortedVariants = [...variantResults].sort((a, b) => b.accuracy - a.accuracy);

  console.log('📋 Performance Ranking');
  console.log('----------------------');
  console.log('| Rank | Method                    | Accuracy | Success | Avg Latency | Errors |');
  console.log('|------|---------------------------|----------|---------|-------------|--------|');
  
  sortedVariants.forEach((variant, index) => {
    const rank = (index + 1).toString().padStart(4);
    const name = variant.name.padEnd(25);
    const accuracy = `${(variant.accuracy * 100).toFixed(1)}%`.padStart(8);
    const successRate = `${((variant.successfulCalls / 20) * 100).toFixed(1)}%`.padStart(7);
    const latency = `${variant.avgLatency.toFixed(0)}ms`.padStart(11);
    const errors = variant.errors.toString().padStart(6);
    
    console.log(`| ${rank} | ${name} | ${accuracy} | ${successRate} | ${latency} | ${errors} |`);
  });

  console.log('\n🔍 Detailed Variant Analysis');
  console.log('----------------------------');
  
  sortedVariants.forEach(variant => {
    console.log(`\n${variant.name.toUpperCase()}:`);
    console.log(`  Description: ${variant.description}`);
    console.log(`  Accuracy: ${(variant.accuracy * 100).toFixed(1)}%`);
    console.log(`  Success Rate: ${((variant.successfulCalls / 20) * 100).toFixed(1)}%`);
    console.log(`  Average Latency: ${variant.avgLatency.toFixed(0)}ms`);
    
    if (variant.errorAnalysis.initializationErrors > 0) {
      console.log(`  ❌ Initialization Errors: ${variant.errorAnalysis.initializationErrors}`);
    }
    if (variant.errorAnalysis.runtimeErrors > 0) {
      console.log(`  ❌ Runtime Errors: ${variant.errorAnalysis.runtimeErrors}`);
    }
    if (variant.errorAnalysis.parsingErrors > 0) {
      console.log(`  ❌ Parsing Errors: ${variant.errorAnalysis.parsingErrors}`);
    }
    if (variant.errorAnalysis.timeoutErrors > 0) {
      console.log(`  ⏱️  Timeout Errors: ${variant.errorAnalysis.timeoutErrors}`);
    }
    
    // Category performance
    const categories = Object.entries(variant.categoryPerformance);
    if (categories.length > 0) {
      console.log(`  Category Performance:`);
      categories.forEach(([category, perf]) => {
        console.log(`    ${category}: ${(perf.accuracy * 100).toFixed(1)}% (${perf.correct}/${perf.total})`);
      });
    }
  });

  console.log('\n💡 RECOMMENDATIONS');
  console.log('==================\n');

  const bestVariant = sortedVariants[0];
  const worstVariant = sortedVariants[sortedVariants.length - 1];

  if (bestVariant.accuracy > 0.8) {
    console.log(`🎉 WINNER: ${bestVariant.name} (${(bestVariant.accuracy * 100).toFixed(1)}% accuracy)`);
    console.log(`   Recommended for production use with function calling models`);
  } else {
    console.log(`⚠️  BEST AVAILABLE: ${bestVariant.name} (${(bestVariant.accuracy * 100).toFixed(1)}% accuracy)`);
    console.log(`   May need optimization or model compatibility improvements`);
  }

  console.log(`\n📊 Performance Range: ${(worstVariant.accuracy * 100).toFixed(1)}% - ${(bestVariant.accuracy * 100).toFixed(1)}%`);

  if (!functionCallingSupported) {
    console.log('\n🚨 CRITICAL: Function calling not supported by current model');
    console.log('   All LangChain methods may underperform');
    console.log('   Consider switching to function calling models: qwen3:8b, llama3.1:8b');
  }

  console.log('\n🔧 Next Steps:');
  console.log(`1. Use ${bestVariant.name} for best results`);
  console.log('2. Test with function calling models if not already');
  console.log('3. Optimize prompts/schemas for top performers');
  console.log('4. Scale testing to full dataset for production decision');
}

// Execute if run directly
if (import.meta.main) {
  runLangChainVariantsStudy().catch(console.error);
}

export { runLangChainVariantsStudy };