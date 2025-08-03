/**
 * QiCore Approach
 * 
 * Uses actual @qi/base and @qi/core from the qi-v2-qicore project via path aliasing.
 */

import { ConfigBuilder } from '@qi/core';
import { flatMap, match, success, type Result } from '@qi/base';
import { reportResults, runStudy, type StudyConfig } from './classification.js';

// QiCore workflow: clean functional composition
(async () => {
  const builderResult = await ConfigBuilder.fromYamlFile('./classification-config.yaml');
  
  const configResult = flatMap(
    (builder: any) => flatMap(
      (config: any) => success(config.getAll() as StudyConfig),
      builder
        .merge(ConfigBuilder.fromEnv('STUDY_'))
        .validateWithSchemaFile('./classification-schema.json')
        .build()
    ),
    builderResult
  ) as Result<StudyConfig, any>;

  match(
    async (config: StudyConfig) => {
      console.log('✓ QiCore: Configuration loaded and validated successfully!');
      const results = await runStudy(config);
      reportResults(results);
    },
    (error: any) => {
      console.error('❌ Configuration failed:', error.message);
      process.exit(1);
    },
    configResult
  );
})();