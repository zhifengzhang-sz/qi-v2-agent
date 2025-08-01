#!/usr/bin/env node

/**
 * FP-Style Classifier Performance Test
 * Tests the actual classifier module with different methods
 */

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InputClassifier } from '@qi/classifier/impl/input-classifier';
import { LLMClassificationMethod } from '@qi/classifier/impl/llm-classification-method';
import type { ClassificationResult } from '@qi/classifier/abstractions';
import { createStateManager } from '@qi/agent/state';

// Types
type TestCase = readonly [string, 'command' | 'prompt' | 'workflow'];
type TestResult = { 
  input: string; 
  expected: string; 
  predicted: string; 
  correct: boolean; 
  latency: number; 
  confidence: number;
  method: string;
};

// Test Data
const testCases: readonly TestCase[] = [
  ['/help', 'command'], ['/status', 'command'], ['/config', 'command'],
  ['what is TypeScript?', 'prompt'], ['write a function', 'prompt'], ['explain closures', 'prompt'],
  ['fix bug in auth.ts and run tests', 'workflow'], ['implement OAuth with tests and docs', 'workflow']
] as const;

// Core Functions
const measure = <T extends readonly unknown[], R>(fn: (...args: T) => Promise<R>) =>
  async (...args: T): Promise<{ result: R; latency: number }> => {
    const start = Date.now();
    const result = await fn(...args);
    return { result, latency: Date.now() - start };
  };

// Create classifiers using the actual classifier module
const createRuleBasedClassifier = (): InputClassifier => {
  return new InputClassifier({
    defaultMethod: 'rule-based',
    confidenceThreshold: 0.8,
  });
};

const createLLMClassificationMethod = (stateManager: any, modelOverride?: string): LLMClassificationMethod => {
  const classifierConfig = stateManager.getClassifierConfig();
  const llmConfig = stateManager.getLLMConfigForPromptModule();
  
  if (!classifierConfig || !llmConfig?.llm?.providers?.ollama) {
    throw new Error('No LLM configuration found');
  }

  const modelToUse = modelOverride || classifierConfig.model;
  console.log(`🔗 Using Ollama at: ${llmConfig.llm.providers.ollama.baseURL}`);
  console.log(`🧠 Using model: ${modelToUse}${modelOverride ? ' (override)' : ''}`);

  return new LLMClassificationMethod({
    modelId: modelToUse,
    baseUrl: llmConfig.llm.providers.ollama.baseURL,
    temperature: classifierConfig.temperature,
    maxTokens: classifierConfig.maxTokens,
  });
};

// Test Runners
const runRuleBasedTest = (classifier: InputClassifier) =>
  measure(async ([input, expected]: TestCase): Promise<TestResult> => {
    const result = await classifier.classify(input);
    return {
      input, 
      expected, 
      predicted: result.type, 
      correct: result.type === expected,
      latency: 0, 
      confidence: result.confidence,
      method: result.method
    };
  });

const runLLMTest = (llmMethod: LLMClassificationMethod) =>
  measure(async ([input, expected]: TestCase): Promise<TestResult> => {
    const result = await llmMethod.classify(input);
    return {
      input, 
      expected, 
      predicted: result.type, 
      correct: result.type === expected,
      latency: 0, 
      confidence: result.confidence,
      method: result.method
    };
  });

const calculateStats = (results: readonly TestResult[]) => {
  const correct = results.filter(r => r.correct).length;
  const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  
  return {
    accuracy: (correct / results.length) * 100,
    avgLatency: Math.round(avgLatency),
    avgConfidence: Number(avgConfidence.toFixed(3)),
    total: results.length,
    correct
  };
};

const formatResults = (name: string, stats: ReturnType<typeof calculateStats>) =>
  `| ${name.padEnd(12)} | ${stats.accuracy.toFixed(1)}% | ${stats.avgLatency}ms | ${stats.avgConfidence} | ${stats.correct}/${stats.total} |`;

// Main Test Function
const runAllTests = async (): Promise<void> => {
  console.log('# 🧪 FP-Style Classifier Performance Test\n');
  
  // Get model from command line args
  const modelArg = process.argv[2];
  if (modelArg) {
    console.log(`📝 Using command line model: ${modelArg}\n`);
  }
  
  // Load configuration through StateManager
  console.log('📝 Loading LLM configuration...');
  const stateManager = createStateManager();
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const configPath = join(__dirname, '..', '..', '..', 'config');
    await stateManager.loadLLMConfig(configPath);
    console.log('✅ Configuration loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load configuration:', error);
    process.exit(1);
  }
  
  // Create rule-based classifier
  const ruleClassifier = createRuleBasedClassifier();
  
  // Run rule-based tests
  console.log('Testing Rule-Based Classifier...');
  const ruleResults = await Promise.all(
    testCases.map(async (testCase) => {
      const { result, latency } = await runRuleBasedTest(ruleClassifier)(testCase);
      return { ...result, latency };
    })
  );
  
  let llmResults: TestResult[] = [];
  let llmStats: ReturnType<typeof calculateStats> | null = null;
  
  // Try to test LLM method
  try {
    console.log('Testing LLM-Based Classifier...');
    const llmMethod = createLLMClassificationMethod(stateManager, modelArg);
    
    // Check if LLM method is available
    const isAvailable = await llmMethod.isAvailable();
    console.log(`📊 LLM Method available: ${isAvailable}`);
    
    if (isAvailable) {
      llmResults = await Promise.all(
        testCases.map(async (testCase) => {
          const { result, latency } = await runLLMTest(llmMethod)(testCase);
          return { ...result, latency };
        })
      );
      
      llmStats = calculateStats(llmResults);
    } else {
      console.log('⚠️  LLM method not available (Ollama not ready)');
    }
  } catch (error) {
    console.log(`⚠️  LLM-Based Classifier failed: ${error instanceof Error ? error.message : error}`);
  }
  
  // Calculate and display results
  const ruleStats = calculateStats(ruleResults);
  
  console.log('\n## 📊 Results\n');
  console.log('| Method | Accuracy | Latency | Confidence | Tests |');
  console.log('|--------|----------|---------|------------|-------|');
  console.log(formatResults('Rule-Based', ruleStats));
  
  if (llmStats) {
    console.log(formatResults('LLM-Based', llmStats));
    
    // Error analysis
    const llmErrors = llmResults.filter(r => !r.correct);
    if (llmErrors.length > 0) {
      console.log('\n## ❌ Misclassifications\n');
      llmErrors.forEach(error => 
        console.log(`- "${error.input}" → ${error.predicted} (expected: ${error.expected}) [${error.method}]`)
      );
    }
    
    console.log(`\n## 🏆 Winner: ${llmStats.accuracy > ruleStats.accuracy ? 'LLM-Based' : 'Rule-Based'}\n`);
  } else {
    console.log('| LLM-Based    | N/A      | N/A     | N/A        | N/A   |');
    console.log('\n## 🏆 Winner: Rule-Based (LLM unavailable)\n');
  }
  
  // Clean up Ollama model to prevent performance degradation
  try {
    console.log('\n🧹 Cleaning up Ollama model...');
    const classifierConfig = stateManager.getClassifierConfig();
    const llmConfig = stateManager.getLLMConfigForPromptModule();
    
    if (classifierConfig?.model && llmConfig?.llm?.providers?.ollama?.baseURL) {
      const baseURL = llmConfig.llm.providers.ollama.baseURL;
      const model = modelArg || classifierConfig.model;
      
      console.log(`🛑 Stopping model ${model} on ${baseURL}...`);
      
      const response = await fetch(`${baseURL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: '',
          stream: false,
          keep_alive: 0  // This tells Ollama to unload the model
        })
      });
      
      if (response.ok) {
        console.log(`✅ Model ${model} stopped successfully`);
      } else {
        console.log(`⚠️  Failed to stop model: ${response.status}`);
      }
    }
  } catch (error) {
    console.log(`⚠️  Failed to stop model: ${error}`);
  }
};

// Execute
if (import.meta.main) {
  runAllTests().catch(console.error);
}