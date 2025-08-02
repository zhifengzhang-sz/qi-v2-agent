#!/usr/bin/env node

/**
 * LLM-Based Classification Test (Quiet Mode)
 * 
 * Tests LLM-based classification with suppressed ollama logging
 */

import { spawn } from 'node:child_process';

// Suppress ollama logging by filtering stdout
const child = spawn('bun', ['run', 'src/study/comprehensive-test-runner.ts', 'llm-based'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DEBUG: '',
    VERBOSE: '',
    SILENT: 'true'
  }
});

// Filter stdout to remove ollama logs
child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  const filteredLines = lines.filter((line: string) => !line.includes('[ollama]'));
  if (filteredLines.length > 0 && filteredLines.join('').trim()) {
    process.stdout.write(filteredLines.join('\n'));
  }
});

// Pass through stderr
child.stderr.on('data', (data) => {
  process.stderr.write(data);
});

child.on('close', (code) => {
  process.exit(code || 0);
});