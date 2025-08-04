/**
 * Classification test execution
 */

import { createInputClassifier } from '@qi/agent/classifier';
import type { Logger } from '@qi/core';
import type { StudyConfig, TestParams, TestResult } from '../types/index.js';

export class ClassificationExecutor {
  private config: StudyConfig;
  private logger?: Logger;

  constructor(config: StudyConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async executeTest({ model, method, input }: TestParams): Promise<TestResult> {
    const startTime = Date.now();
    const testLogger = this.logger?.child({ 
      test: { model, method, inputLength: input.length }
    });
    
    try {
      testLogger?.debug('Starting classification test', { 
        model, 
        method, 
        inputPreview: input.substring(0, 50) + (input.length > 50 ? '...' : '')
      });
      
      const classifier = createInputClassifier({ 
        method: method as any, 
        modelId: model, 
        baseUrl: this.config.llm.baseUrl,
        apiKey: this.config.llm.apiKey,
        temperature: this.config.llm.temperature,
        schemaName: this.config.schema?.name,
        schemaSelectionCriteria: this.config.schema?.selectionCriteria
      });
      
      const result = await classifier.classify(input);
      const latency = Date.now() - startTime;
      
      testLogger?.debug('Classification completed successfully', {
        model,
        method,
        resultType: result.type,
        confidence: result.confidence,
        latency
      });
      
      return { model, method, input, result, latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      testLogger?.error('Classification test failed', error instanceof Error ? error : new Error(errorMessage), {
        model,
        method,
        latency,
        inputLength: input.length,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      });
      
      return { 
        model, 
        method, 
        input, 
        result: { type: 'error', confidence: 0, method: method },
        latency,
        error: errorMessage
      };
    }
  }

  async executeAll(testInputs: string[]): Promise<TestResult[]> {
    const executionLogger = this.logger?.child({ phase: 'test-execution' });
    const totalTests = this.config.models.length * this.config.methods.length * testInputs.length;
    
    executionLogger?.info('Starting test execution', {
      totalTests,
      models: this.config.models,
      methods: this.config.methods
    });

    const results = await Promise.all(
      this.config.models
        .flatMap(model => this.config.methods.map(method => ({ model, method })))
        .flatMap(({ model, method }) => 
          testInputs.map((input: string) => ({ model, method, input })))
        .map(testParams => this.executeTest(testParams))
    );
    
    executionLogger?.info('Test execution completed', { 
      completedTests: results.length,
      errorCount: results.filter(r => r.error).length 
    });
    
    return results;
  }
}