/**
 * CLI Factories - Framework creation functions
 * 
 * This module exports factory functions for creating CLI instances
 * with different terminal frameworks and configurations.
 */

// Framework-agnostic factory
export {
  createCLI,
  createValidatedCLI,
  createCLIAsync,
  getFrameworkSupport,
  checkFrameworkSupport,
  recommendFramework,
  createEventDrivenCLI,
  getAvailableFrameworks,
  type CLIFramework,
  type CLIConfigWithFramework,
} from './createCLI.js';

// Readline framework factory
export {
  createReadlineCLI,
  createValidatedReadlineCLI,
  createReadlineCLIAsync,
  getDefaultReadlineConfig,
  checkReadlineSupport,
} from './createReadlineCLI.js';

// Blessed framework factory
export {
  createBlessedCLI,
  createValidatedBlessedCLI,
  createBlessedCLIAsync,
  checkBlessedFrameworkSupport,
} from './createBlessedCLI.js';

// Re-export core interfaces
export type {
  ICLIFramework,
  CLIConfig,
  CLIState,
  CLIMode,
  MessageType,
} from '../abstractions/ICLIFramework.js';