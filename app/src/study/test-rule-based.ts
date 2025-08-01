#!/usr/bin/env node

/**
 * Rule-Based Classification Test Runner
 * 
 * Tests only the rule-based classification method with comprehensive analysis.
 * Fast execution for quick validation and development iterations.
 */

import { ComprehensiveTestRunner } from './comprehensive-test-runner.js';

async function main(): Promise<void> {
  console.log('🎯 RULE-BASED CLASSIFICATION TEST');
  console.log('=================================\n');
  console.log('Testing only rule-based method for fast iteration and validation.\n');
  
  const runner = new ComprehensiveTestRunner();
  await runner.initialize();
  await runner.runComprehensiveTests('rule-based');
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main as testRuleBasedOnly };