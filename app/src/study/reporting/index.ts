/**
 * Results reporting and metrics calculation
 */

import type { Logger } from '@qi/core';
import type { TestResult, AccuracyMetrics, StudyConfig } from '../types/index.js';

export class MetricsCalculator {
  static calculate(results: TestResult[], expectedTypes: string[]): AccuracyMetrics {
    const correct = results.filter((r, i) => !r.error && r.result.type === expectedTypes[i]);
    const incorrect = results.filter((r, i) => !r.error && r.result.type !== expectedTypes[i]);
    const errors = results.filter(r => r.error);
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

    return {
      totalTests: results.length,
      correct: correct.length,
      incorrect: incorrect.length,
      errors: errors.length,
      accuracyRate: (correct.length / results.length) * 100,
      averageLatency: Math.round(avgLatency)
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
    
    console.log('\n📊 CLASSIFICATION RESULTS');
    console.log('========================');
    
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
    
    console.log('\nDetailed Results:');
    results.forEach((r, i) => {
      const confidence = (r.result.confidence * 100).toFixed(1);
      const expectedType = expectedTypes[i];
      const isCorrect = !r.error && r.result.type === expectedType;
      const status = r.error ? 'ERROR' : isCorrect ? 'CORRECT' : 'WRONG';
      const schemaUsed = r.result.metadata?.get('schema_used') || 'unknown';
      // Debug metadata
      if (i === 1) { // Only log for second result to avoid spam
        console.log('DEBUG - Metadata type:', typeof r.result.metadata);
        console.log('DEBUG - Metadata is Map:', r.result.metadata instanceof Map);
        console.log('DEBUG - Metadata keys:', r.result.metadata ? Array.from(r.result.metadata.keys()) : 'no metadata');
        console.log('DEBUG - Full metadata:', r.result.metadata);
      }
      console.log(`${i+1}. "${r.input.substring(0, 30)}..." → ${r.result.type} (${confidence}%) [${status}] (expected: ${expectedType}) [schema: ${schemaUsed}]`);
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