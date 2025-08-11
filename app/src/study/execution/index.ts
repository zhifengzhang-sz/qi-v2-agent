/**
 * Classification test execution
 */

import { createInputClassifier } from '@qi/agent/classifier';
import { detectProviderFromModel } from '@qi/agent/classifier/shared/provider-map';
import type { Logger } from '@qi/core';
import type { ClassificationResult, StudyConfig, TestParams, TestResult } from '../types/index.js';

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
    
    testLogger?.debug('Starting classification test', { 
      model, 
      method, 
      inputPreview: input.substring(0, 50) + (input.length > 50 ? '...' : '')
    });
    
    // Auto-detect provider and use appropriate configuration
    const providerInfo = detectProviderFromModel(model);
    
    let finalBaseUrl = this.config.llm.baseUrl;
    let finalApiKey = this.config.llm.apiKey;
    
    // Override with provider-specific settings if detected
    if (providerInfo) {
      // Use provider's default baseUrl if not explicitly overridden in config
      if (this.config.llm.baseUrl === 'http://localhost:11434') {
        finalBaseUrl = providerInfo.baseUrl;
      }
      
      // Use provider-specific API key from environment if available
      const envApiKey = process.env[providerInfo.apiKeyEnv];
      if (envApiKey) {
        finalApiKey = envApiKey;
      }
      
      testLogger?.debug('Provider detected for model', { 
        model,
        provider: providerInfo.providerName,
        baseUrl: finalBaseUrl,
        apiKeyEnv: providerInfo.apiKeyEnv,
        hasApiKey: !!envApiKey
      });
    }
    
    // Create classifier - configuration errors should crash immediately, not be caught
    const classifier = createInputClassifier({ 
      method: method as any, 
      modelId: model, 
      baseUrl: finalBaseUrl,
      apiKey: finalApiKey,
      temperature: this.config.llm.temperature,
      schemaName: this.config.schema?.name,
      schemaSelectionCriteria: this.config.schema?.selectionCriteria
    });
    
    try {
      
      // Add timeout isolation - each method gets max 30s, no more
      const result = await Promise.race([
        classifier.classify(input),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error(`Method timeout after 30s`)), 30000)
        )
      ]) as ClassificationResult;
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

    // SEQUENTIAL execution to avoid overwhelming Ollama with concurrent requests
    const testParams = this.config.models
      .flatMap(model => this.config.methods.map(method => ({ model, method })))
      .flatMap(({ model, method }) => 
        testInputs.map((input: string) => ({ model, method, input })));

    const results: TestResult[] = [];
    
    executionLogger?.info('Executing tests sequentially to prevent Ollama overload', {
      totalTests: testParams.length,
      executionMode: 'sequential'
    });

    for (let i = 0; i < testParams.length; i++) {
      const params = testParams[i];
      executionLogger?.debug(`Executing test ${i + 1}/${testParams.length}`, {
        model: params.model,
        method: params.method,
        progress: `${Math.round((i / testParams.length) * 100)}%`
      });
      
      const result = await this.executeTest(params);
      results.push(result);
    }
    
    executionLogger?.info('Test execution completed', { 
      completedTests: results.length,
      errorCount: results.filter(r => r.error).length,
      executionMode: 'sequential'
    });
    
    return results;
  }
}