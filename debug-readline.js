#!/usr/bin/env node

/**
 * Simple readline test to verify basic functionality
 */

const readline = require('node:readline');

console.log('Testing basic readline functionality...');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'test> '
});

console.log('Readline interface created');
console.log('Type "exit" to quit, or Ctrl+C');

rl.on('line', (input) => {
  console.log(`You typed: ${input}`);
  if (input.trim() === 'exit') {
    console.log('Exiting...');
    rl.close();
    process.exit(0);
  }
  rl.prompt();
});

rl.on('SIGINT', () => {
  console.log('\nCtrl+C detected, exiting...');
  process.exit(0);
});

rl.prompt();