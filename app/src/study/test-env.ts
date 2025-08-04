import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

// Load YAML
const config = parse(readFileSync('./classification-config.yaml', 'utf8'));

// Manual env merge - STUDY_ prefix
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith('STUDY_')) {
    const configKey = key.slice(6).toLowerCase(); // Remove STUDY_
    config[configKey] = value;
  }
}

// Print everything
console.log('=== CONFIG DATA ===');
console.log(JSON.stringify(config, null, 2));
console.log('=== ENV VARS ===');
Object.keys(process.env).filter(k => k.startsWith('STUDY_')).forEach(k => 
  console.log(`${k}=${process.env[k]}`)
);