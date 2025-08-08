#!/usr/bin/env node

/**
 * Simple test script to verify Ink framework functionality
 */

import { spawn } from 'child_process';

const child = spawn('bun', ['run', 'app/src/prompt/qi-prompt.ts', '--framework=ink'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

// Let it run for a bit then exit
setTimeout(() => {
  child.kill('SIGINT');
}, 5000);

child.on('exit', (code) => {
  console.log(`\nTest completed with exit code: ${code}`);
});