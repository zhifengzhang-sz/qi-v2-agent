#!/usr/bin/env bun

import { createCLI } from './cli/commands.js';

async function main() {
  try {
    const program = createCLI();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (import.meta.main) {
  main();
}