/**
 * Pure Functional Programming Approach
 * 
 * Simple, direct YAML loading with minimal abstractions.
 */

import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { testClassification, reportResults, runStudy, type StudyConfig } from './classification.js';

// Simple YAML loader - no Result types, just direct loading
const loadConfig = (): StudyConfig => {
  const yamlContent = readFileSync('./classification-config.yaml', 'utf-8');
  return parseYaml(yamlContent) as StudyConfig;
};

// Pure FP workflow: load → study → report (3 lines!)
(async () => {
  const config = loadConfig();
  const results = await runStudy(config);
  reportResults(results);
})();