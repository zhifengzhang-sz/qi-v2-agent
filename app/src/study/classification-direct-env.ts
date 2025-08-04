/**
 * Classification Study with Direct Environment Variable Access
 * 
 * Bypasses broken QiCore fromEnv() and uses direct process.env access
 */

import { createLogger, type ValidatedConfig } from '@qi/core';
import { flatMap, match, success, type Result, type QiError } from '@qi/base';
import { reportResults, runStudy, type StudyConfig } from './classification.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Direct environment variable override function
function applyEnvironmentOverrides(config: any): any {
  const overrides = { ...config };
  
  // Override model if MODEL_ID or STUDY_MODELS_0 is set
  if (process.env.MODEL_ID) {
    overrides.models = [process.env.MODEL_ID];
  } else if (process.env.STUDY_MODELS_0) {
    overrides.models = [process.env.STUDY_MODELS_0];
  }
  
  // Override dataset path if DATASET or STUDY_DATAPATH is set
  if (process.env.DATASET) {
    overrides.dataPath = process.env.DATASET;
  } else if (process.env.STUDY_DATAPATH) {
    overrides.dataPath = process.env.STUDY_DATAPATH;
  }
  
  // Override methods if STUDY_METHODS_0 is set
  if (process.env.STUDY_METHODS_0) {
    const methods = [];
    let i = 0;
    while (process.env[`STUDY_METHODS_${i}`]) {
      methods.push(process.env[`STUDY_METHODS_${i}`]);
      i++;
    }
    if (methods.length > 0) {
      overrides.methods = methods;
    }
  }
  
  return overrides;
}

(async () => {
  // Initialize logger for study operations
  const loggerResult = createLogger({
    level: 'error',
    name: 'classification-study-direct-env',
    pretty: true
  });

  match(
    async (logger) => {
      const studyLogger = logger.child({ operation: 'classification-study-direct-env' });
      
      const configPath = join(__dirname, 'classification-config.yaml');
      
      studyLogger.info('Loading configuration with direct environment variable support', { 
        configPath,
        envVars: {
          MODEL_ID: process.env.MODEL_ID,
          DATASET: process.env.DATASET,
          STUDY_MODELS_0: process.env.STUDY_MODELS_0,
          STUDY_DATAPATH: process.env.STUDY_DATAPATH
        }
      });
      
      try {
        // Load YAML file directly
        const yamlContent = readFileSync(configPath, 'utf8');
        const baseConfig = YAML.parse(yamlContent);
        
        // Apply environment variable overrides
        const finalConfig = applyEnvironmentOverrides(baseConfig);
        
        studyLogger.info('Configuration loaded and environment overrides applied', {
          originalModels: baseConfig.models,
          finalModels: finalConfig.models,
          originalDataPath: baseConfig.dataPath,
          finalDataPath: finalConfig.dataPath,
          methods: finalConfig.methods
        });
        
        const studyResults = await runStudy(finalConfig as StudyConfig, studyLogger);
        reportResults(studyResults, finalConfig as StudyConfig, studyLogger);
      } catch (error) {
        studyLogger.error('Configuration loading failed', error instanceof Error ? error : new Error(String(error)), {
          configPath,
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        });
        process.exit(1);
      }
    },
    (error: QiError) => {
      console.error('Failed to initialize logger:', error.message);
      process.exit(1);
    },
    loggerResult
  );
})();