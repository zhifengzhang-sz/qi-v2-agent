/**
 * CLI Frameworks - Export all framework implementations
 */

// Ink framework (React-based) - DEPRECATED: Uses deprecated command handler
// export { InkCLIApplication, createInkCLI, MainLayout, StateIndicator, InputBox, OutputDisplay } from './ink/index.js'
// export { createOutputMessage as createInkOutputMessage, type OutputMessage as InkOutputMessage } from './ink/index.js'

// Neo-blessed framework (Widget-based) - DEPRECATED: Uses deprecated command handler  
// export { NeoBlessedCLIApplication, createNeoBlessedCLI, StateWidget, InputWidget, OutputWidget } from './neo-blessed/index.js'
// export { createOutputMessage as createNeoBlessedOutputMessage, type OutputMessage as NeoBlessedOutputMessage } from './neo-blessed/index.js'

// Framework factory function - DEPRECATED
// TODO: Replace with simple CLI implementations that don't mix CLI/agent concerns
import type { ICLIApplication, CLIConfig } from '../abstractions/index.js'
// import { createInkCLI } from './ink/index.js'
// import { createNeoBlessedCLI } from './neo-blessed/index.js'

/**
 * Create a CLI application using the specified framework
 * DEPRECATED: Use SimpleCLICommandHandler directly for proper CLI functionality
 */
export function createCLI(framework: 'simple' = 'simple'): never {
  throw new Error('Deprecated: Use SimpleCLICommandHandler directly. See demos/cli/simple-cli-demo.ts for example.');
}

/**
 * Create and start a CLI application with configuration
 * DEPRECATED: Use SimpleCLI demo pattern instead
 */
export async function startCLI(config: CLIConfig): Promise<never> {
  throw new Error('Deprecated: Use SimpleCLI demo pattern. CLI should not handle agent work.');
}