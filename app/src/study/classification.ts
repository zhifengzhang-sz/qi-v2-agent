/**
 * Classification Study
 * 
 * Clean FP-style classifier performance testing with YAML config and schema validation.
 */

import { createInputClassifier } from '@qi/agent/classifier';

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
  testInputs: string[];
  llm: {
    baseUrl: string;
    apiKey: string;
    temperature?: number;
    timeout?: number;
  };
}

const testClassification = (config: StudyConfig) => async ({ model, method, input }: TestParams): Promise<TestResult> => {
  const startTime = Date.now();
  try {
    const classifier = createInputClassifier({ 
      method: method as any, 
      modelId: model, 
      baseUrl: config.llm.baseUrl,
      apiKey: config.llm.apiKey
    });
    const result = await classifier.classify(input);
    const latency = Date.now() - startTime;
    return { model, method, input, result, latency };
  } catch (error) {
    const latency = Date.now() - startTime;
    return { 
      model, 
      method, 
      input, 
      result: { type: 'error', confidence: 0, method: method },
      latency,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

const reportResults = (results: TestResult[]) => {
  console.log('\n🔬 SIMPLE STUDY RESULTS');
  console.log('========================\n');
  
  console.table(results.map(r => ({
    Model: r.model,
    Method: r.method,
    Input: r.input.length > 30 ? r.input.substring(0, 27) + '...' : r.input,
    Type: r.result.type,
    Confidence: r.error ? 'ERROR' : `${(r.result.confidence * 100).toFixed(1)}%`,
    Latency: `${r.latency}ms`,
    Error: r.error ? r.error.substring(0, 30) + '...' : ''
  })));

  // Summary by method
  console.log('\n📊 SUMMARY BY METHOD');
  console.log('=====================\n');
  
  const methodSummary = results.reduce((acc, r) => {
    if (!acc[r.method]) {
      acc[r.method] = { total: 0, errors: 0, avgLatency: 0 };
    }
    acc[r.method].total++;
    if (r.error) acc[r.method].errors++;
    acc[r.method].avgLatency += r.latency;
    return acc;
  }, {} as Record<string, { total: number; errors: number; avgLatency: number }>);

  Object.entries(methodSummary).forEach(([method, stats]) => {
    const successRate = ((stats.total - stats.errors) / stats.total * 100).toFixed(1);
    const avgLatency = (stats.avgLatency / stats.total).toFixed(0);
    console.log(`${method.padEnd(20)}: ${successRate}% success, ${avgLatency}ms avg`);
  });
};

const runStudy = async (config: StudyConfig): Promise<TestResult[]> => {
  const testFn = testClassification(config);
  
  return Promise.all(
    config.models.flatMap((model: string) => 
      config.methods.map((method: string) => ({ model, method })))
      .flatMap(({ model, method }: { model: string; method: string }) => 
        config.testInputs.map((input: string) => ({ model, method, input })))
      .map(testFn)
  );
};

// Shared utility functions
export { testClassification, reportResults, runStudy };