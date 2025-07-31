/**
 * CLI Abstractions - Export CLI-specific interfaces and types
 */

// CLI-specific interfaces (built on top of lib abstractions)
export * from './cli-interfaces.js'

// State machine
export * from './state-machine.js'

// Re-export commonly used types for convenience
export type {
  AppState,
  AppSubState,
  CLIConfig,
  CLIStatus,
  AppStateContext,
  StateEvent,
  ICLIApplication,
  IStateManager,
  IFrameworkRenderer
} from './cli-interfaces.js'

export type {
  CLIStateEvent,
  CLIStateContext,
  CLIStateActor
} from './state-machine.js'