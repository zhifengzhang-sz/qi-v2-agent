/**
 * CLI Implementation - Export all concrete implementations
 */

// Parser implementations removed - CLI should delegate to lib layer InputClassifier

// Pure CLI implementation (recommended)
export { type CLIFeedback, type CLIInput, createPureCLI, type ICLI, PureCLI } from './pure-cli.js';

// Command handler implementations
// export { CLICommandHandler, createCommandHandler, createCommandHandlerWithShell } from './command-handler.js' // DEPRECATED: Mixes CLI/agent concerns
export { SimpleCLICommandHandler } from './simple-command-handler.js';
// State manager implementation
export { CLIStateManager, createDebugStateManager, createStateManager } from './state-manager.js';

// Workflow handler implementation - moved to qi-code
// export { CLIWorkflowHandler, createWorkflowHandler, createTestWorkflowHandler } from './workflow-handler.js'
// export type { IWorkflowHandler, WorkflowExecutionResult, WorkflowStreamUpdate } from './workflow-handler.js'

// Re-export types for convenience
export type * from '../abstractions/index.js';
export type * from '../abstractions/state-machine.js';
