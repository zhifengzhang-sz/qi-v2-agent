/**
 * CLI System - Main export file
 */

// Core abstractions
export * from './abstractions/index.js'

// Implementation classes
export * from './impl/index.js'

// Framework implementations
export * from './frameworks/index.js'

// Main CLI factory function (deprecated)
// export { createCLI, startCLI } from './frameworks/index.js' // DEPRECATED

// Pure CLI interface (recommended)
export { createPureCLI, type ICLI, type CLIInput, type CLIFeedback } from './impl/index.js'