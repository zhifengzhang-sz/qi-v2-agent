#!/usr/bin/env node

/**
 * Comprehensive Classification Test Runner
 * 
 * Advanced testing framework for command/prompt/workflow classification:
 * - Loads large-scale test datasets
 * - Tests multiple models and methods
 * - Statistical analysis with cross-validation
 * - Detailed performance metrics and error analysis
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { InputClassifier } from '@qi/classifier/impl/input-classifier';
import { LLMClassificationMethod } from '@qi/classifier/impl/llm-classification-method';
import type { ClassificationResult } from '@qi/classifier/abstractions';
import { createStateManager } from '@qi/agent/state';
import type { TestCase, AdaptedDataset } from './adapt-datasets.js';
import { dataDir } from './download-datasets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  id: number;
  input: string;
  expected: string;
  predicted: string;
  correct: boolean;
  confidence: number;
  latency: number;
  method: string;
  source: string;
  complexity: string;
}

interface PerformanceMetrics {
  accuracy: number;
  precision: Record<string, number>;
  recall: Record<string, number>;
  f1Score: Record<string, number>;
  macroF1: number;
  microF1: number;
  confusionMatrix: Record<string, Record<string, number>>;
  avgConfidence: number;
  avgLatency: number;
  totalSamples: number;
  correctSamples: number;
}

interface CrossValidationResult {
  foldResults: PerformanceMetrics[];
  meanAccuracy: number;
  stdAccuracy: number;
  meanMacroF1: number;
  stdMacroF1: number;
  confidenceInterval: { lower: number; upper: number };
}

interface ModelEvaluation {
  modelName: string;
  metrics: PerformanceMetrics;
  cvResults?: CrossValidationResult;
  errorAnalysis: {
    byCategory: Record<string, TestResult[]>;
    byComplexity: Record<string, TestResult[]>;
    bySource: Record<string, TestResult[]>;
  };
}

class ComprehensiveTestRunner {
  private stateManager: any;
  private dataset?: AdaptedDataset;
  private models: Map<string, any> = new Map();

  constructor() {
    this.stateManager = createStateManager();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Comprehensive Classification Test Runner');
    console.log('==========================================\n');

    // Suppress multi-llm-ts logging
    process.env.DEBUG = '';
    process.env.VERBOSE = '';
    process.env.SILENT = 'true';
    
    // Load configuration
    console.log('📝 Loading configuration...');
    const configPath = join(__dirname, '..', '..', '..', 'config');
    await this.stateManager.loadLLMConfig(configPath);
    console.log('✅ Configuration loaded\n');

    // Load dataset
    await this.loadDataset();

    // Initialize models
    await this.initializeModels();
  }

  private async loadDataset(): Promise<void> {
    // Use dataset from environment variable or default
    const datasetName = process.env.DATASET || 'balanced-50x3.json';
    const datasetPath = join(__dirname, 'datasets', datasetName);
    
    if (!existsSync(datasetPath)) {
      console.error(`❌ Dataset not found: ${datasetName}`);
      console.error('Available options:');
      console.error('   DATASET=balanced-50x3.json   (150 samples)');
      console.error('   DATASET=balanced-100x3.json  (300 samples)');
      console.error('   DATASET=balanced-700x3.json  (2100 samples)');
      console.error('   DATASET=adapted-prompt-workflow.json  (unbalanced)');
      process.exit(1);
    }

    console.log(`📊 Loading dataset: ${datasetName}...`);
    const content = await readFile(datasetPath, 'utf-8');
    this.dataset = JSON.parse(content);
    
    console.log(`✅ Dataset loaded: ${this.dataset!.metadata.totalSamples.toLocaleString()} samples`);
    console.log(`📋 Sources: ${Object.keys(this.dataset!.metadata.sources).join(', ')}`);
    console.log('📊 Distribution:');
    for (const [category, count] of Object.entries(this.dataset!.metadata.distribution)) {
      const percentage = ((count / this.dataset!.metadata.totalSamples) * 100).toFixed(1);
      console.log(`   ${category}: ${count.toLocaleString()} (${percentage}%)`);
    }
    console.log();
  }

  private async initializeModels(): Promise<void> {
    console.log('🤖 Initializing classification models...');

    // Rule-based classifier - uses centralized InputClassifier
    const ruleClassifier = new InputClassifier({
      defaultMethod: 'rule-based',
      confidenceThreshold: 0.8,
    });
    this.models.set('rule-based', ruleClassifier);
    
    // LLM-based classifier - check availability but wrap in InputClassifier for centralized command detection
    try {
      const classifierConfig = this.stateManager.getClassifierConfig();
      const llmConfig = this.stateManager.getLLMConfigForPromptModule();
      
      if (classifierConfig && llmConfig?.llm?.providers?.ollama) {
        const llmMethod = new LLMClassificationMethod({
          modelId: process.env.MODEL_ID || classifierConfig.model,
          baseUrl: llmConfig.llm.providers.ollama.baseURL,
          temperature: classifierConfig.temperature,
          maxTokens: classifierConfig.maxTokens,
        });
        
        const isAvailable = await llmMethod.isAvailable();
        if (isAvailable) {
          // Store the raw LLM method for direct testing
          this.models.set('llm-based-direct', llmMethod);
          
          // Also create an InputClassifier that delegates to LLM for non-commands
          // Note: This would require InputClassifier to support method injection
          // For now, we'll test the LLM method directly but understand it should be wrapped
          this.models.set('llm-based', llmMethod);
          const modelId = process.env.MODEL_ID || classifierConfig.model;
          console.log(`✅ LLM model available: ${modelId}`);
          console.log(`⚠️  Note: LLM method should be wrapped in InputClassifier for centralized command detection`);
        } else {
          console.log('⚠️  LLM model not available (Ollama not ready)');
        }
      }
    } catch (error) {
      console.log(`⚠️  LLM model initialization failed: ${error}`);
    }

    console.log(`📋 Initialized ${this.models.size} models\n`);
  }

  private async testModel(modelName: string, model: any, testCases: TestCase[]): Promise<TestResult[]> {
    console.log(`🧪 Testing ${modelName}...`);
    console.log(`   Samples: ${testCases.length.toLocaleString()}`);
    
    const results: TestResult[] = [];
    const startTime = Date.now();
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const testStart = Date.now();
      
      try {
        let result: ClassificationResult;
        
        if (modelName === 'rule-based') {
          result = await (model as InputClassifier).classify(testCase.input);
        } else {
          result = await (model as LLMClassificationMethod).classify(testCase.input);
        }
        
        const latency = Date.now() - testStart;
        
        results.push({
          id: testCase.id,
          input: testCase.input,
          expected: testCase.expected,
          predicted: result.type,
          correct: result.type === testCase.expected,
          confidence: result.confidence,
          latency,
          method: modelName,
          source: testCase.source,
          complexity: testCase.complexity,
        });
        
        // Progress indicator - show more frequently for better feedback
        if ((i + 1) % 10 === 0 || i === testCases.length - 1) {
          const progress = ((i + 1) / testCases.length * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`\r   Progress: ${progress}% (${i + 1}/${testCases.length}) - ${elapsed}s`);
          if (i === testCases.length - 1) {
            console.log(); // New line at end
          }
        }
        
      } catch (error) {
        console.error(`   Error testing case ${testCase.id}: ${error}`);
        // Add failed test result
        results.push({
          id: testCase.id,
          input: testCase.input,
          expected: testCase.expected,
          predicted: 'error',
          correct: false,
          confidence: 0,
          latency: Date.now() - testStart,
          method: modelName,
          source: testCase.source,
          complexity: testCase.complexity,
        });
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Completed ${modelName}: ${results.length} tests in ${totalTime}s\n`);
    
    return results;
  }

  private calculateMetrics(results: TestResult[]): PerformanceMetrics {
    const categories = ['command', 'prompt', 'workflow'];
    const confusionMatrix: Record<string, Record<string, number>> = {};
    
    // Initialize confusion matrix
    for (const cat of categories) {
      confusionMatrix[cat] = {};
      for (const pred of categories) {
        confusionMatrix[cat][pred] = 0;
      }
    }
    
    // Fill confusion matrix
    for (const result of results) {
      if (categories.includes(result.expected) && categories.includes(result.predicted)) {
        confusionMatrix[result.expected][result.predicted]++;
      }
    }
    
    // Calculate per-category metrics
    const precision: Record<string, number> = {};
    const recall: Record<string, number> = {};
    const f1Score: Record<string, number> = {};
    
    for (const category of categories) {
      // Precision = TP / (TP + FP)
      const tp = confusionMatrix[category][category];
      const fp = categories.reduce((sum, cat) => cat !== category ? sum + confusionMatrix[cat][category] : sum, 0);
      precision[category] = tp + fp > 0 ? tp / (tp + fp) : 0;
      
      // Recall = TP / (TP + FN)  
      const fn = categories.reduce((sum, cat) => cat !== category ? sum + confusionMatrix[category][cat] : sum, 0);
      recall[category] = tp + fn > 0 ? tp / (tp + fn) : 0;
      
      // F1 Score = 2 * (precision * recall) / (precision + recall)
      f1Score[category] = precision[category] + recall[category] > 0 
        ? 2 * (precision[category] * recall[category]) / (precision[category] + recall[category]) 
        : 0;
    }
    
    // Calculate macro and micro averages
    const macroF1 = categories.reduce((sum, cat) => sum + f1Score[cat], 0) / categories.length;
    
    const totalTp = categories.reduce((sum, cat) => sum + confusionMatrix[cat][cat], 0);
    const microF1 = totalTp / results.length; // For balanced datasets, micro F1 = accuracy
    
    const correctResults = results.filter(r => r.correct);
    const accuracy = correctResults.length / results.length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    
    return {
      accuracy,
      precision,
      recall,
      f1Score,
      macroF1,
      microF1,
      confusionMatrix,
      avgConfidence,
      avgLatency,
      totalSamples: results.length,
      correctSamples: correctResults.length,
    };
  }

  private performErrorAnalysis(results: TestResult[]): ModelEvaluation['errorAnalysis'] {
    const errors = results.filter(r => !r.correct);
    
    const byCategory: Record<string, TestResult[]> = { command: [], prompt: [], workflow: [] };
    const byComplexity: Record<string, TestResult[]> = { low: [], medium: [], high: [] };
    const bySource: Record<string, TestResult[]> = {};
    
    for (const error of errors) {
      // Group by expected category
      if (byCategory[error.expected]) {
        byCategory[error.expected].push(error);
      }
      
      // Group by complexity
      if (byComplexity[error.complexity]) {
        byComplexity[error.complexity].push(error);
      }
      
      // Group by source
      if (!bySource[error.source]) {
        bySource[error.source] = [];
      }
      bySource[error.source].push(error);
    }
    
    return { byCategory, byComplexity, bySource };
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private async performCrossValidation(modelName: string, model: any, testCases: TestCase[], folds: number = 5): Promise<CrossValidationResult> {
    console.log(`🔄 Performing ${folds}-fold cross-validation for ${modelName}...`);
    
    const shuffled = this.shuffleArray(testCases);
    const foldSize = Math.floor(shuffled.length / folds);
    const foldResults: PerformanceMetrics[] = [];
    
    for (let fold = 0; fold < folds; fold++) {
      console.log(`   Fold ${fold + 1}/${folds}...`);
      
      const testStart = fold * foldSize;
      const testEnd = fold === folds - 1 ? shuffled.length : (fold + 1) * foldSize;
      const testSet = shuffled.slice(testStart, testEnd);
      
      const results = await this.testModel(`${modelName}_fold${fold + 1}`, model, testSet);
      const metrics = this.calculateMetrics(results);
      foldResults.push(metrics);
    }
    
    // Calculate cross-validation statistics
    const accuracies = foldResults.map(r => r.accuracy);
    const macroF1s = foldResults.map(r => r.macroF1);
    
    const meanAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / folds;
    const stdAccuracy = Math.sqrt(accuracies.reduce((sum, acc) => sum + Math.pow(acc - meanAccuracy, 2), 0) / folds);
    
    const meanMacroF1 = macroF1s.reduce((sum, f1) => sum + f1, 0) / folds;
    const stdMacroF1 = Math.sqrt(macroF1s.reduce((sum, f1) => sum + Math.pow(f1 - meanMacroF1, 2), 0) / folds);
    
    // 95% confidence interval
    const tValue = 2.776; // t-distribution for 4 degrees of freedom (n-1) at 95% confidence
    const marginOfError = tValue * (stdAccuracy / Math.sqrt(folds));
    const confidenceInterval = {
      lower: meanAccuracy - marginOfError,
      upper: meanAccuracy + marginOfError
    };
    
    console.log(`✅ Cross-validation completed for ${modelName}\n`);
    
    return {
      foldResults,
      meanAccuracy,
      stdAccuracy,
      meanMacroF1,
      stdMacroF1,
      confidenceInterval,
    };
  }

  private async cleanupOllamaModel(modelName: string): Promise<void> {
    try {
      const llmConfig = this.stateManager.getLLMConfigForPromptModule();
      if (llmConfig?.llm?.providers?.ollama?.baseURL) {
        const baseURL = llmConfig.llm.providers.ollama.baseURL;
        const classifierConfig = this.stateManager.getClassifierConfig();
        const model = classifierConfig?.model;
        
        if (model) {
          console.log(`🧹 Cleaning up Ollama model: ${model}...`);
          
          const response = await fetch(`${baseURL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model,
              prompt: '',
              stream: false,
              keep_alive: 0
            })
          });
          
          if (response.ok) {
            console.log(`✅ Model ${model} stopped successfully`);
          }
        }
      }
    } catch (error) {
      console.log(`⚠️  Model cleanup failed: ${error}`);
    }
  }

  private printDetailedResults(evaluations: ModelEvaluation[]): void {
    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('==============================\n');
    
    // Summary table
    console.log('📋 Model Performance Summary');
    console.log('----------------------------');
    console.log('| Model      | Accuracy | Macro-F1 | Avg Latency | Confidence |');
    console.log('|------------|----------|----------|-------------|------------|');
    
    for (const evaluation of evaluations) {
      const acc = (evaluation.metrics.accuracy * 100).toFixed(1);
      const f1 = (evaluation.metrics.macroF1 * 100).toFixed(1);
      const latency = Math.round(evaluation.metrics.avgLatency);
      const conf = evaluation.metrics.avgConfidence.toFixed(3);
      
      console.log(`| ${evaluation.modelName.padEnd(10)} | ${acc.padStart(6)}% | ${f1.padStart(6)}% | ${latency.toString().padStart(9)}ms | ${conf.padStart(8)} |`);
    }
    
    // Detailed per-category results
    for (const evaluation of evaluations) {
      console.log(`\n📈 ${evaluation.modelName} - Detailed Metrics`);
      console.log(''.padEnd(40, '-'));
      
      console.log('Per-category Performance:');
      const categories = ['command', 'prompt', 'workflow'];
      for (const cat of categories) {
        const p = (evaluation.metrics.precision[cat] * 100).toFixed(1);
        const r = (evaluation.metrics.recall[cat] * 100).toFixed(1);
        const f = (evaluation.metrics.f1Score[cat] * 100).toFixed(1);
        console.log(`  ${cat.padEnd(8)}: Precision=${p}%, Recall=${r}%, F1=${f}%`);
      }
      
      // Cross-validation results
      if (evaluation.cvResults) {
        const cv = evaluation.cvResults;
        const meanAcc = (cv.meanAccuracy * 100).toFixed(1);
        const stdAcc = (cv.stdAccuracy * 100).toFixed(1);
        const ciLower = (cv.confidenceInterval.lower * 100).toFixed(1);
        const ciUpper = (cv.confidenceInterval.upper * 100).toFixed(1);
        
        console.log(`\n  Cross-Validation (5-fold):`);
        console.log(`    Mean Accuracy: ${meanAcc}% ± ${stdAcc}%`);
        console.log(`    95% CI: [${ciLower}%, ${ciUpper}%]`);
      }
      
      // Error analysis
      console.log(`\n  Error Analysis:`);
      const totalErrors = Object.values(evaluation.errorAnalysis.byCategory).reduce((sum, errors) => sum + errors.length, 0);
      console.log(`    Total Errors: ${totalErrors}/${evaluation.metrics.totalSamples}`);
      
      for (const [category, errors] of Object.entries(evaluation.errorAnalysis.byCategory)) {
        if (errors.length > 0) {
          console.log(`    ${category} errors: ${errors.length}`);
        }
      }
    }
    
    // Best model recommendation
    const bestModel = evaluations.reduce((best, current) => 
      current.metrics.macroF1 > best.metrics.macroF1 ? current : best
    );
    
    console.log(`\n🏆 RECOMMENDED MODEL: ${bestModel.modelName}`);
    console.log(`   Accuracy: ${(bestModel.metrics.accuracy * 100).toFixed(1)}%`);
    console.log(`   Macro F1: ${(bestModel.metrics.macroF1 * 100).toFixed(1)}%`);
    console.log(`   Avg Latency: ${Math.round(bestModel.metrics.avgLatency)}ms`);
  }

  async runComprehensiveTests(methodFilter?: string): Promise<void> {
    if (!this.dataset) {
      throw new Error('Dataset not loaded');
    }

    // Limit samples for faster testing during development
    const allSamples = this.dataset.samples;
    const sampleLimit = process.env.SAMPLE_LIMIT ? parseInt(process.env.SAMPLE_LIMIT) : allSamples.length;
    const testCases = allSamples.slice(0, sampleLimit);
    const evaluations: ModelEvaluation[] = [];
    
    // Filter models based on methodFilter
    const modelsToTest = methodFilter 
      ? new Map([...this.models.entries()].filter(([name]) => name.toLowerCase().includes(methodFilter.toLowerCase())))
      : this.models;
    
    if (modelsToTest.size === 0) {
      console.error(`❌ No models found matching filter: ${methodFilter}`);
      console.log(`Available models: ${Array.from(this.models.keys()).join(', ')}`);
      return;
    }
    
    console.log(`🎯 Testing ${modelsToTest.size} method(s): ${Array.from(modelsToTest.keys()).join(', ')}\n`);
    
    // Test each filtered model
    for (const [modelName, model] of modelsToTest.entries()) {
      console.log(`\n🎯 Testing ${modelName}...`);
      
      // Run main test
      const results = await this.testModel(modelName, model, testCases);
      const metrics = this.calculateMetrics(results);
      const errorAnalysis = this.performErrorAnalysis(results);
      
      // Run cross-validation for statistical significance
      let cvResults: CrossValidationResult | undefined;
      if (testCases.length >= 100) { // Only if we have enough data
        cvResults = await this.performCrossValidation(modelName, model, testCases);
      }
      
      evaluations.push({
        modelName,
        metrics,
        cvResults,
        errorAnalysis,
      });
    }
    
    // Print comprehensive results
    this.printDetailedResults(evaluations);
    
    // Cleanup
    if (this.models.has('llm-based')) {
      await this.cleanupOllamaModel('llm-based');
    }
    
    console.log('\n✅ Comprehensive testing completed!');
  }
}

async function main(): Promise<void> {
  const runner = new ComprehensiveTestRunner();
  await runner.initialize();
  
  // Check for method filter from command line
  const methodFilter = process.argv[2];
  if (methodFilter) {
    console.log(`🔍 Method filter: ${methodFilter}`);
  }
  
  await runner.runComprehensiveTests(methodFilter);
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { ComprehensiveTestRunner };