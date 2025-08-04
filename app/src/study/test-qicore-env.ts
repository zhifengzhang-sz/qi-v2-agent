import { ConfigBuilder } from '@qi/core';

(async () => {
  const builderResult = await ConfigBuilder.fromYamlFile('./src/study/classification-config.yaml');
  
  if (builderResult.tag === 'failure') {
    console.log('YAML load failed:', builderResult.error.message);
    return;
  }
  
  const mergedBuilder = builderResult.value.merge(ConfigBuilder.fromEnv('STUDY_'));
  const configResult = mergedBuilder.build();
  
  if (configResult.tag === 'failure') {
    console.log('Config build failed:', configResult.error.message);
    return;
  }
  
  const config = configResult.value;
  console.log('=== FINAL CONFIG ===');
  console.log(JSON.stringify(config.getAll(), null, 2));
  
  console.log('=== ENV VARS ===');
  Object.keys(process.env).filter(k => k.startsWith('STUDY_')).forEach(k => 
    console.log(`${k}=${process.env[k]}`)
  );
})();