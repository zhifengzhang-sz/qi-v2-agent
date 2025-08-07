/**
 * QiCore Approach
 * 
 * Uses actual @qi/base and @qi/core from the qi-v2-qicore project via path aliasing.
 */

import { ConfigBuilder, createLogger, type ValidatedConfig } from '@qi/core';
import { flatMap, match, success, type Result, type QiError } from '@qi/base';
import { reportResults, runStudy, type StudyConfig } from './classification.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// QiCore workflow: clean functional composition
(async () => {
  // Initialize logger for study operations
  const loggerResult = createLogger({
    level: 'info',
    name: 'classification-study',
    pretty: true
  });

  match(
    async (logger) => {
      const studyLogger = logger.child({ operation: 'classification-study' });
      
      const configPath = join(__dirname, 'classification-config.yaml');
      const schemaPath = join(__dirname, 'classification-schema.json');
      
      studyLogger.info('Starting classification study', { 
        configPath, 
        schemaPath 
      });
      
      const builderResult = await ConfigBuilder.fromYamlFile(configPath);
      
      const configResult = flatMap(
        (builder: ConfigBuilder) => flatMap(
          (config: ValidatedConfig) => success(config.getAll()),
          builder
            .merge(ConfigBuilder.fromEnv(''))
            .validateWithSchemaFile(schemaPath)
            .buildValidated()
        ),
        builderResult
      );

      match(
        async (config: any) => {
          // Handle environment variable override logic
          // QiCore config merges env vars as additional keys, we need to process them
          
          // If MODEL_ID was set, use it as single model (env vars become lowercase)
          if (config.model_id) {
            config.models = [config.model_id];
          }
          
          // If DATASET was set, use it as dataPath
          if (config.dataset) {
            config.dataPath = config.dataset;
          }
          
          // If METHOD was set, use it as single method
          if (config.method) {
            config.methods = [config.method];
          }
          
          // If SCHEMA_NAME was set, use it as schema name
          if (config.schema_name) {
            config.schema = { name: config.schema_name };
          }
          
          studyLogger.info('Configuration loaded and validated successfully', {
            models: config.models,
            methods: config.methods,
            dataPath: config.dataPath,
            schema: config.schema,
            envOverrides: {
              model_id: config.model_id,
              method: config.method,
              dataset: config.dataset,
              schema_name: config.schema_name
            },
            allConfigKeys: Object.keys(config)
          });
          
          const configLogger = studyLogger.child({ 
            dataset: config.dataPath,
            modelCount: config.models?.length,
            methodCount: config.methods?.length
          });
          
          const studyResults = await runStudy(config as StudyConfig, configLogger);
          reportResults(studyResults, config as StudyConfig, configLogger);
        },
        (error: QiError) => {
          studyLogger.error('Configuration validation failed', new Error(error.message), {
            configPath,
            schemaPath,
            errorType: error.code || 'unknown'
          });
          process.exit(1);
        },
        configResult
      );
    },
    (error: QiError) => {
      console.error('Failed to initialize logger:', error.message);
      process.exit(1);
    },
    loggerResult
  );
})();