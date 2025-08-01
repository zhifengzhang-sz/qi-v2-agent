/**
 * CLI Abstractions - Export CLI-specific interfaces and types
 */

// Re-export commonly used types for convenience
export type {
  AppState,
  AppStateContext,
  AppSubState,
  CLIConfig,
  CLIStatus,
  ICLIApplication,
  IFrameworkRenderer,
  IStateManager,
  StateEvent,
} from './cli-interfaces.js';
// CLI-specific interfaces (built on top of lib abstractions)
export * from './cli-interfaces.js';
export type {
  CLIStateActor,
  CLIStateContext,
  CLIStateEvent,
} from './state-machine.js';
// State machine
export * from './state-machine.js';
