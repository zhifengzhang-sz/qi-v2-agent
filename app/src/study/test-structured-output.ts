#!/usr/bin/env node

/**
 * Structured Output Classification Test Runner
 * 
 * Tests structured output classification method with schema validation.
 * This method uses our custom OllamaStructuredWrapper for reliable JSON parsing.
 */

import { ComprehensiveTestRunner } from './comprehensive-test-runner.js';

async function main(): Promise<void> {
  console.log('📋 STRUCTURED OUTPUT CLASSIFICATION TEST');
  console.log('=======================================\n');
  console.log('Testing structured output method with schema validation.\n');
  
  const runner = new ComprehensiveTestRunner();
  await runner.initialize();
  await runner.runComprehensiveTests('structured');
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main as testStructuredOutputOnly };