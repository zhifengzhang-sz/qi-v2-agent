#!/usr/bin/env node

/**
 * LangChain Classification Study
 * 
 * MAIN INVESTIGATION: Why is LangChain performing worse than simple LLM calls?
 * This is impossible and indicates fundamental usage errors.
 * 
 * Expected: LangChain (structured output) > LLM (JSON prompting) > Rule-based
 * Current:  Rule-based (68%) > LangChain (66%) > ??? (this makes no sense!)
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

async function runLangChainStudy(): Promise<void> {
  console.log('🔍 LANGCHAIN CLASSIFICATION INVESTIGATION');
  console.log('=========================================\\n');
  
  console.log('🎯 RESEARCH QUESTION:');
  console.log('Why is LangChain performing worse than simple LLM calls?');
  console.log('This should be impossible - structured output should be superior!\\n');

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

  const modelId = process.env.MODEL_ID || classifierConfig.model || 'qwen3:8b';
  const baseUrl = llmConfig.llm.providers.ollama.baseURL;

  console.log(`🤖 Model: ${modelId}`);
  console.log(`🔗 Base URL: ${baseUrl}`);
  console.log(`🔧 Method: LangChain withStructuredOutput\\n`);

  // Test function calling capability first
  console.log('🔍 STEP 1: Testing Function Calling Capability');
  console.log('----------------------------------------------');
  
  try {
    const testResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'Test' }],
        tools: [{ type: 'function', function: { name: 'test' } }]
      })
    });
    
    const testResult = await testResponse.json();
    
    if (testResult.error && testResult.error.message.includes('does not support tools')) {
      console.log(`❌ Function Calling: NOT SUPPORTED`);
      console.log(`   Error: ${testResult.error.message}`);
      console.log(`   🚨 This explains poor LangChain performance!`);
      console.log(`   📝 LangChain falls back to text parsing when function calling fails\\n`);
      
      console.log('💡 DIAGNOSIS: Model lacks function calling support');
      console.log('   - LangChain withStructuredOutput requires function calling');
      console.log('   - Without it, LangChain falls back to unreliable text parsing');
      console.log('   - This is why simple LLM calls outperform LangChain');
      console.log('\\n🔧 SOLUTIONS:');
      console.log('   1. Use function calling models: qwen3:8b, llama3.1:8b, mistral:7b');
      console.log('   2. Use OllamaWrapper method for non-function calling models');
      console.log('   3. Test with: MODEL_ID=qwen3:8b (if available)\\n');
      
      return;
    } else if (testResult.choices?.[0]?.message?.tool_calls) {
      console.log(`✅ Function Calling: SUPPORTED`);
      console.log(`   Model returned tool_calls in response`);
      console.log(`   🎯 Function calling works - investigating other issues...\\n`);
    } else {
      console.log(`⚠️  Function Calling: UNCERTAIN`);
      console.log(`   No error but no tool_calls either`);
      console.log(`   This might indicate partial or unreliable support\\n`);
    }
  } catch (error) {
    console.log(`❌ Function calling test failed: ${error}\\n`);
  }

  // Create LangChain classifier
  console.log('🔍 STEP 2: Testing LangChain Classification');
  console.log('-------------------------------------------');
  
  const classifier = createInputClassifier({
    method: 'langchain-structured',
    baseUrl: baseUrl + '/v1',
    modelId: modelId,
    temperature: 0.1,
    maxTokens: 1000,
    apiKey: 'ollama',
  });

  console.log('🧪 Running diagnostic classification tests...');

  const diagnosticTests = [
    { input: '/help', expected: 'command' },
    { input: 'hello world', expected: 'prompt' },
    { input: 'fix bug and run tests', expected: 'workflow' },
  ];

  for (const test of diagnosticTests) {
    try {
      console.log(`\\n🔬 Testing: "${test.input}"`);
      const startTime = Date.now();
      const result = await classifier.classify(test.input);
      const latency = Date.now() - startTime;
      
      const status = result.type === test.expected ? '✅' : '❌';
      console.log(`   ${status} Result: ${result.type} (expected: ${test.expected})`);
      console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   ⚡ Latency: ${latency}ms`);
      if (result.reasoning) {
        console.log(`   🧠 Reasoning: ${result.reasoning.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
  }

  console.log('\\n🔍 STEP 3: Full Dataset Analysis');
  console.log('---------------------------------');

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

  console.log('🧪 Testing full dataset...');

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
  console.log('📊 LANGCHAIN INVESTIGATION RESULTS');
  console.log('===================================\\n');

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

  // INVESTIGATION ANALYSIS
  console.log('🔍 INVESTIGATION ANALYSIS');
  console.log('==========================\\n');

  if (accuracy < 0.7) {
    console.log('🚨 CRITICAL FINDING: LangChain accuracy is abnormally low!');
    console.log('\\nPossible causes:');
    console.log('1. ❌ Model lacks function calling support (most likely)');
    console.log('2. ❌ Incorrect schema design');
    console.log('3. ❌ Poor system prompts');
    console.log('4. ❌ Wrong LangChain configuration');
    console.log('5. ❌ API compatibility issues');
  } else if (accuracy > 0.9) {
    console.log('✅ EXCELLENT: LangChain working as expected!');
    console.log('\\nThis confirms proper usage of:');
    console.log('• Function calling capable model');
    console.log('• Correct schema design');
    console.log('• Proper LangChain configuration');
  } else {
    console.log('⚠️  MODERATE: LangChain working but suboptimal');
    console.log('\\nPotential improvements:');
    console.log('• Schema optimization needed');
    console.log('• Prompt engineering required');
    console.log('• Model selection review');
  }

  console.log('\\n📝 Research Recommendations:');
  if (accuracy < 0.7) {
    console.log('1. 🔧 Verify function calling: ./scripts/test-function-calling.sh ' + modelId);
    console.log('2. 🔄 Try function calling model: MODEL_ID=qwen3:8b');
    console.log('3. 🧪 Test schema variations: bun run study:langchain-schemas');
    console.log('4. 📝 Test prompt variations: bun run study:langchain-prompts');
  } else {
    console.log('1. 🔬 Optimize schemas: bun run study:langchain-schemas');
    console.log('2. 📝 Refine prompts: bun run study:langchain-prompts');  
    console.log('3. ⚖️  Compare methods: bun run study:comprehensive');
  }
}

// Execute if run directly
if (import.meta.main) {
  runLangChainStudy().catch(console.error);
}

export { runLangChainStudy };