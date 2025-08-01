/**
 * CLI System - Main export file
 */

// Core abstractions
export * from './abstractions/index.js';
// Framework implementations
export * from './frameworks/index.js';
// Implementation classes
export * from './impl/index.js';

// Main CLI factory function (deprecated)
// export { createCLI, startCLI } from './frameworks/index.js' // DEPRECATED

// Pure CLI interface (recommended)
export { type CLIFeedback, type CLIInput, createPureCLI, type ICLI } from './impl/index.js';
