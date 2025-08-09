#!/usr/bin/env node

// Simple test script to interact with TUI
const { spawn } = require('child_process');

const child = spawn('bun', ['app/src/prompt/qi-prompt.ts', '--blessed-tui'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Let the TUI start up
setTimeout(() => {
  console.log('Sending "hi" to TUI...');
  child.stdin.write('hi\n');
  
  // Wait a bit then exit
  setTimeout(() => {
    child.stdin.write('q');
    child.kill();
  }, 2000);
}, 2000);

child.stdout.on('data', (data) => {
  const output = data.toString();
  if (output.includes('🎯') || output.includes('🔍') || output.includes('🧹')) {
    console.log('DEBUG:', output);
  }
});

child.stderr.on('data', (data) => {
  const output = data.toString();
  if (output.includes('🎯') || output.includes('🔍') || output.includes('🧹')) {
    console.log('DEBUG:', output);
  }
});