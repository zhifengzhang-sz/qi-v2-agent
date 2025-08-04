/**
 * Classification Study
 * 
 * Clean FP-style classifier performance testing with YAML config and schema validation.
 */

import { createInputClassifier } from '@qi/agent/classifier';
import type { Logger } from '@qi/core';

interface TestParams {
  model: string;
  method: string;
  input: string;
}

interface TestResult extends TestParams {
  result: {
    type: string;
    confidence: number;
    method: string;
  };
  latency: number;
  error?: string;
}

export interface StudyConfig {
  models: string[];
  methods: string[];
  dataPath: string;
  llm: {
    baseUrl: string;
    apiKey: string;
    temperature?: number;
    timeout?: number;
  };
}

const testClassification = (config: StudyConfig, logger?: Logger) => async ({ model, method, input }: TestParams): Promise<TestResult> => {
  const startTime = Date.now();
  const testLogger = logger?.child({ 
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
      baseUrl: config.llm.baseUrl,
      apiKey: config.llm.apiKey,
      temperature: config.llm.temperature
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
};

const reportResults = (results: TestResult[], expectedTypes: string[], logger?: Logger) => {
  
  console.log('\n📊 CLASSIFICATION RESULTS');
  console.log('========================');
  
  const correct = results.filter((r, i) => !r.error && r.result.type === expectedTypes[i]);
  const incorrect = results.filter((r, i) => !r.error && r.result.type !== expectedTypes[i]);
  const errors = results.filter(r => r.error);
  
  console.log(`Total tests: ${results.length}`);
  console.log(`Correct: ${correct.length} (${(correct.length/results.length*100).toFixed(1)}%)`);
  console.log(`Incorrect: ${incorrect.length} (${(incorrect.length/results.length*100).toFixed(1)}%)`);
  console.log(`Errors: ${errors.length} (${(errors.length/results.length*100).toFixed(1)}%)`);
  
  console.log('\nDetailed Results:');
  results.forEach((r, i) => {
    const confidence = (r.result.confidence * 100).toFixed(1);
    const expectedType = expectedTypes[i];
    const isCorrect = !r.error && r.result.type === expectedType;
    const status = r.error ? 'ERROR' : isCorrect ? 'CORRECT' : 'WRONG';
    console.log(`${i+1}. "${r.input.substring(0, 30)}..." → ${r.result.type} (${confidence}%) [${status}] (expected: ${expectedType})`);
  });
  
  const avgLatency = (results.reduce((sum, r) => sum + r.latency, 0) / results.length).toFixed(0);
  console.log(`\nAverage latency: ${avgLatency}ms`);
  
  if (logger) {
    // Minimal structured logging
    const resultsLogger = logger?.child({ phase: 'results-reporting' });
    resultsLogger?.info('Method performance summary', {
      method: results[0]?.method,
      accuracy: parseFloat((correct.length/results.length*100).toFixed(1)),
      averageLatency: parseInt(avgLatency),
      totalTests: results.length,
      errorCount: errors.length
    });
  }
};

const reportStudyParameters = (config: StudyConfig, testInputs: string[], logger?: Logger) => {
  const log = logger 
    ? (msg: string) => logger.info(msg.replace(/^[📋]/g, '').trim())
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
};

const runStudy = async (config: StudyConfig, logger?: Logger): Promise<{ results: TestResult[], expectedTypes: string[] }> => {
  const studyLogger = logger?.child({ phase: 'data-loading' });
  
  // Load test inputs from data file
  const { readFile } = await import('node:fs/promises');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dataFilePath = join(__dirname, config.dataPath);
  
  studyLogger?.info('Loading test data', { dataFilePath });
  
  const testInputsData = await readFile(dataFilePath, 'utf-8');
  const data = JSON.parse(testInputsData);
  
  // Simple validation - QiCore ConfigBuilder is for YAML configs
  if (!data.samples || !Array.isArray(data.samples)) {
    throw new Error('Invalid data format: Missing "samples" array property');
  }
  
  for (let i = 0; i < data.samples.length; i++) {
    const sample = data.samples[i];
    if (!sample.input || !sample.expected) {
      throw new Error(`Invalid sample ${i + 1}: Must have "input" and "expected" properties`);
    }
    if (!['command', 'prompt', 'workflow'].includes(sample.expected)) {
      throw new Error(`Invalid sample ${i + 1}: Expected type must be "command", "prompt", or "workflow", got "${sample.expected}"`);
    }
  }
  const testInputs: string[] = data.samples.map((s: any) => s.input);
  const expectedTypes: string[] = data.samples.map((s: any) => s.expected);
  
  studyLogger?.info('Test data loaded successfully', { 
    sampleCount: testInputs.length,
    dataSize: testInputsData.length 
  });
  
  // Report study parameters
  reportStudyParameters(config, testInputs, logger);
  
  const testFn = testClassification(config, logger);
  
  const executionLogger = logger?.child({ phase: 'test-execution' });
  const totalTests = config.models.length * config.methods.length * testInputs.length;
  
  executionLogger?.info('Starting test execution', { 
    totalTests,
    models: config.models,
    methods: config.methods 
  });
  
  const results = await Promise.all(
    config.models.flatMap((model: string) => 
      config.methods.map((method: string) => ({ model, method })))
      .flatMap(({ model, method }: { model: string; method: string }) => 
        testInputs.map((input: string) => ({ model, method, input })))
      .map(testFn)
  );
  
  executionLogger?.info('Test execution completed', { 
    completedTests: results.length,
    errorCount: results.filter(r => r.error).length 
  });
  
  return { results, expectedTypes };
};

// Shared utility functions
export { testClassification, reportResults, runStudy };