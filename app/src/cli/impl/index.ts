/**
 * CLI Implementation - Export all concrete implementations
 */

// Parser implementations
export { CLIParser, createParser } from './parser.js'
export { WorkflowCLIParser, createWorkflowParser, createEnhancedWorkflowParser } from './workflow-parser.js'

// State manager implementation
export { CLIStateManager, createStateManager, createDebugStateManager } from './state-manager.js'

// Command handler implementations
// export { CLICommandHandler, createCommandHandler, createCommandHandlerWithShell } from './command-handler.js' // DEPRECATED: Mixes CLI/agent concerns
export { SimpleCLICommandHandler } from './simple-command-handler.js'

// Pure CLI implementation (recommended)
export { PureCLI, createPureCLI, type ICLI, type CLIInput, type CLIFeedback } from './pure-cli.js'

// Workflow handler implementation - moved to qi-code
// export { CLIWorkflowHandler, createWorkflowHandler, createTestWorkflowHandler } from './workflow-handler.js'
// export type { IWorkflowHandler, WorkflowExecutionResult, WorkflowStreamUpdate } from './workflow-handler.js'

// Re-export types for convenience
export type * from '../abstractions/index.js'
export type * from '../abstractions/state-machine.js'