#!/usr/bin/env node

/**
 * LLM-Based Classification Test Runner
 * 
 * Tests only the LLM-based classification method with comprehensive analysis.
 * Requires Ollama server to be running with configured model.
 */

import { ComprehensiveTestRunner } from './comprehensive-test-runner.js';

async function main(): Promise<void> {
  console.log('🤖 LLM-BASED CLASSIFICATION TEST');
  console.log('================================\n');
  console.log('Testing only LLM-based method. Requires Ollama server running.\n');
  
  const runner = new ComprehensiveTestRunner();
  await runner.initialize();
  await runner.runComprehensiveTests('llm-based');
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main as testLLMBasedOnly };