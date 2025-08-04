/**
 * Classification Study - Clean orchestration
 */

import type { Logger } from '@qi/core';
import { TestDataLoader } from './loaders/index.js';
import { ClassificationExecutor } from './execution/index.js';
import { ResultsReporter } from './reporting/index.js';
import type { StudyConfig, StudyResults } from './types/index.js';

export async function runStudy(config: StudyConfig, logger?: Logger): Promise<StudyResults> {
  const studyLogger = logger?.child({ phase: 'data-loading' });
  
  // Load and validate test data
  studyLogger?.info('Loading test data', { dataPath: config.dataPath });
  
  const dataset = await TestDataLoader.load(config.dataPath);
  const testInputs = dataset.samples.map(s => s.input);
  const expectedTypes = dataset.samples.map(s => s.expected);
  
  studyLogger?.info('Test data loaded successfully', { 
    sampleCount: testInputs.length
  });
  
  // Report study parameters
  const reporter = new ResultsReporter(logger);
  reporter.reportParameters(config, testInputs);
  
  // Execute tests
  const executor = new ClassificationExecutor(config, logger);
  const results = await executor.executeAll(testInputs);
  
  return { results, expectedTypes };
}

export function reportResults(results: StudyResults, config: StudyConfig, logger?: Logger): void {
  const reporter = new ResultsReporter(logger);
  reporter.reportResults(results.results, results.expectedTypes, config);
}

// Re-export types and classes for external use
export type { StudyConfig, StudyResults } from './types/index.js';
export { TestDataLoader } from './loaders/index.js';
export { ClassificationExecutor } from './execution/index.js';
export { ResultsReporter, MetricsCalculator } from './reporting/index.js';