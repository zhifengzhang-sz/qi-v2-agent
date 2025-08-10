#!/usr/bin/env bun

/**
 * Run Enhanced Qi Prompt CLI
 * 
 * Simple script to run the enhanced qi-prompt with Claude Code features
 */

import { spawn } from 'bun';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);

// Get the current script directory and navigate to app directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appDir = join(__dirname, '..');
const scriptPath = join(appDir, 'src/prompt/qi-prompt-enhanced.ts');

console.log('🚀 Starting Enhanced Qi Prompt CLI...');
console.log('📍 App directory:', appDir);
console.log('📍 Script path:', scriptPath);

if (args.length > 0) {
  console.log('🔧 Arguments:', args.join(' '));
}

// Run the enhanced qi-prompt from the app directory
const result = spawn({
  cmd: ['bun', 'run', scriptPath, ...args],
  cwd: appDir,
  stdio: ['inherit', 'inherit', 'inherit'],
});

result.exited.then((exitCode: number | null) => {
  if (exitCode !== 0) {
    console.error(`❌ Enhanced CLI exited with code ${exitCode}`);
    process.exit(exitCode || 1);
  }
}).catch((error: unknown) => {
  console.error('❌ Error running enhanced CLI:', error);
  process.exit(1);
});