/**
 * Results reporting and metrics calculation
 */

import type { Logger } from '@qi/core';
import type { TestResult, AccuracyMetrics, StudyConfig, CategoryMetrics } from '../types/index.js';

export class MetricsCalculator {
  static calculate(results: TestResult[], expectedTypes: string[]): AccuracyMetrics {
    const correct = results.filter((r, i) => !r.error && r.result.type === expectedTypes[i]);
    const incorrect = results.filter((r, i) => !r.error && r.result.type !== expectedTypes[i]);
    const errors = results.filter(r => r.error);
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

    // Calculate per-category breakdown
    const categories = [...new Set(expectedTypes)];
    const categoryBreakdown: CategoryMetrics[] = categories.map(category => {
      const categoryIndices = expectedTypes
        .map((type, i) => ({ type, i }))
        .filter(item => item.type === category)
        .map(item => item.i);
      
      const categoryResults = categoryIndices.map(i => results[i]);
      const categoryCorrect = categoryResults.filter(r => !r.error && r.result.type === category);
      const categoryIncorrect = categoryResults.filter(r => !r.error && r.result.type !== category);
      const categoryErrors = categoryResults.filter(r => r.error);
      const categoryLatency = categoryResults.reduce((sum, r) => sum + r.latency, 0) / categoryResults.length;

      return {
        category,
        totalTests: categoryResults.length,
        correct: categoryCorrect.length,
        incorrect: categoryIncorrect.length,
        errors: categoryErrors.length,
        accuracyRate: categoryResults.length > 0 ? (categoryCorrect.length / categoryResults.length) * 100 : 0,
        averageLatency: Math.round(categoryLatency)
      };
    });

    return {
      totalTests: results.length,
      correct: correct.length,
      incorrect: incorrect.length,
      errors: errors.length,
      accuracyRate: (correct.length / results.length) * 100,
      averageLatency: Math.round(avgLatency),
      categoryBreakdown
    };
  }
}

export class ResultsReporter {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  reportParameters(config: StudyConfig, testInputs: string[]): void {
    const log = this.logger 
      ? (msg: string) => this.logger!.info(msg.replace(/^[📋]/g, '').trim())
      : (msg: string) => process.stdout.write(msg + '\n');
    
    log('\n📋 STUDY PARAMETERS');
    log('==================');
    log(`Dataset File: ${config.dataPath}`);
    log(`Test Samples: ${testInputs.length}`);
    log(`Models: ${config.models.join(', ')}`);
    log(`Methods: ${config.methods.join(', ')}`);
    log(`LLM Endpoint: ${config.llm.baseUrl}`);
    log(`Temperature: ${config.llm.temperature || 'default'}`);
    log(`Timeout: ${config.llm.timeout || 'default'}ms`);
    
    const totalTests = config.models.length * config.methods.length * testInputs.length;
    log(`Total Tests: ${totalTests} (${config.models.length} models × ${config.methods.length} methods × ${testInputs.length} inputs)`);
    log('');
  }

  reportResults(results: TestResult[], expectedTypes: string[], config?: StudyConfig): void {
    const metrics = MetricsCalculator.calculate(results, expectedTypes);
    
    // Executive Summary
    console.log('\n🎯 EXECUTIVE SUMMARY');
    console.log('==================');
    console.log(`✅ Overall Accuracy: ${metrics.accuracyRate.toFixed(1)}% (${metrics.correct}/${metrics.totalTests})`);
    console.log(`❌ Error Rate: ${(metrics.errors/metrics.totalTests*100).toFixed(1)}% (${metrics.errors} errors)`);
    console.log(`⚡ Average Response: ${metrics.averageLatency}ms`);
    if (config?.schema?.name) {
      console.log(`📋 Schema: ${config.schema.name}`);
    }
    if (config?.models && config?.methods) {
      console.log(`🔧 Setup: ${config.models.join(', ')} + ${config.methods.join(', ')}`);
    }
    
    // Category Performance Summary
    if (metrics.categoryBreakdown && metrics.categoryBreakdown.length > 0) {
      console.log('\n📊 CATEGORY PERFORMANCE');
      console.log('=====================');
      metrics.categoryBreakdown.forEach(cat => {
        console.log(`${cat.category.toUpperCase()}: ${cat.accuracyRate.toFixed(1)}% accuracy (${cat.correct}/${cat.totalTests} total: ${cat.correct} correct, ${cat.incorrect} wrong, ${cat.errors} errors)`);
      });
    }
    
    console.log('\n📊 DETAILED RESULTS');
    console.log('==================');
    
    if (config) {
      console.log(`📁 Dataset: ${config.dataPath}`);
      console.log(`🤖 Model: ${config.models.join(', ')}`);
      console.log(`⚙️  Method: ${config.methods.join(', ')}`);
      console.log(`🔗 Provider: ${config.llm.baseUrl}`);
      console.log(`🌡️  Temperature: ${config.llm.temperature}`);
      if (config.schema?.name) {
        console.log(`📋 Schema: ${config.schema.name}`);
      }
      console.log('');
    }
    
    console.log(`Total tests: ${metrics.totalTests}`);
    console.log(`Correct: ${metrics.correct} (${metrics.accuracyRate.toFixed(1)}%)`);
    console.log(`Incorrect: ${metrics.incorrect} (${(metrics.incorrect/metrics.totalTests*100).toFixed(1)}%)`);
    console.log(`Errors: ${metrics.errors} (${(metrics.errors/metrics.totalTests*100).toFixed(1)}%)`);
    
    // Show error summary if there are errors
    if (metrics.errors > 0) {
      const errorTypes: Record<string, number> = {};
      results.filter(r => r.error).forEach(r => {
        const errorType = r.error || 'Unknown error';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });
      
      console.log('\n❌ ERROR BREAKDOWN:');
      Object.entries(errorTypes)
        .sort(([,a], [,b]) => b - a) // Sort by frequency
        .forEach(([error, count]) => {
          console.log(`   ${count}x: ${error}`);
        });
    }
    
    // Display per-category breakdown
    if (metrics.categoryBreakdown && metrics.categoryBreakdown.length > 0) {
      console.log('\n📋 PER-CATEGORY BREAKDOWN');
      console.log('=========================');
      metrics.categoryBreakdown.forEach(cat => {
        console.log(`${cat.category.toUpperCase()}: ${cat.correct}/${cat.totalTests} correct (${cat.accuracyRate.toFixed(1)}%), ${cat.errors} errors, ${cat.incorrect} wrong, ${cat.averageLatency}ms avg`);
      });
    }
    
    console.log('\nDetailed Results:');
    results.forEach((r, i) => {
      const expectedType = expectedTypes[i];
      
      if (r.error) {
        console.log(`${i+1}. "${r.input.substring(0, 30)}..." → [ERROR: ${r.error}] (expected: ${expectedType})`);
      } else {
        const confidence = (r.result.confidence * 100).toFixed(1);
        const isCorrect = r.result.type === expectedType;
        const status = isCorrect ? 'CORRECT' : 'WRONG';
        const schemaUsed = r.result.metadata?.get('schema_used') || 'unknown';
        console.log(`${i+1}. "${r.input.substring(0, 30)}..." → ${r.result.type} (${confidence}%) [${status}] (expected: ${expectedType}) [schema: ${schemaUsed}]`);
      }
    });
    
    console.log(`\nAverage latency: ${metrics.averageLatency}ms`);
    
    if (this.logger) {
      const resultsLogger = this.logger.child({ phase: 'results-reporting' });
      resultsLogger.info('Method performance summary', {
        method: results[0]?.method,
        accuracy: metrics.accuracyRate,
        averageLatency: metrics.averageLatency,
        totalTests: metrics.totalTests,
        errorCount: metrics.errors
      });
    }
  }
}