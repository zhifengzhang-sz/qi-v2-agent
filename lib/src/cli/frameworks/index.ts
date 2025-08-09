/**
 * CLI Frameworks - Two framework implementations
 * 
 * This module provides access to the two supported CLI frameworks:
 * - readline (custom, zero dependencies)
 * - ink (React-based rich UI)
 */

// Readline framework (complete implementation)
export * from './readline/index.js';

// Ink framework (complete implementation - requires: bun add ink @inkjs/ui)
export * from './ink/framework-index.js';

// Framework support checking
export { checkReadlineSupport } from './readline/index.js';
export { checkInkSupport } from './ink/framework-index.js'; 

// Import functions for internal use
import { checkReadlineSupport } from './readline/index.js';
import { checkInkSupport } from './ink/framework-index.js';

// Type definitions
export type CLIFrameworkType = 'readline' | 'ink';

/**
 * Get all available frameworks in the current environment
 */
export function getAvailableFrameworks(): CLIFrameworkType[] {
  const frameworks: CLIFrameworkType[] = ['readline']; // Always available
  
  if (checkInkSupport().available) {
    frameworks.push('ink');
  }
  
  return frameworks;
}

/**
 * Get framework support information
 */
export function getAllFrameworkSupport(): Record<CLIFrameworkType, any> {
  return {
    readline: checkReadlineSupport(),
    ink: checkInkSupport(),
  };
}