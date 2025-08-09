/**
 * neo-blessed CLI Framework
 * 
 * Main entry point for the blessed-based CLI framework.
 * Exports all blessed components and factory functions.
 */

// Export the main CLI framework implementation (deprecated - use EventDrivenCLI with blessed components)
export { BlessedCLIFramework } from './BlessedCLIFramework.js';

// Export individual components
export {
  BlessedTerminal,
  isBlessedAvailable,
} from './BlessedTerminal.js';

export { BlessedInputManager } from './BlessedInputManager.js';
export { BlessedProgressRenderer } from './BlessedProgressRenderer.js';
export { BlessedModeRenderer } from './BlessedModeRenderer.js';
export { BlessedStreamRenderer } from './BlessedStreamRenderer.js';

// Export framework utilities
export {
  checkBlessedSupport,
} from './framework-index.js';

// Export types
export type {
  ITerminal,
  TerminalDimensions,
  IInputManager,
  InputCallback,
  KeypressCallback,
  IProgressRenderer,
  ProgressConfig,
  IModeRenderer,
  CLIMode,
  IStreamRenderer,
} from './framework-index.js';

import type { CLIConfig } from '../../abstractions/ICLIFramework.js';
import { BlessedCLIFramework } from './BlessedCLIFramework.js';

/**
 * Factory function to create a blessed CLI implementation (deprecated)
 * Use createBlessedCLI from factories/createBlessedCLI.ts instead
 */
export function createBlessedCLIImpl(config: Partial<CLIConfig> = {}): BlessedCLIFramework {
  console.warn('createBlessedCLIImpl is deprecated. Use createBlessedCLI from factories instead.');
  return new BlessedCLIFramework(config);
}