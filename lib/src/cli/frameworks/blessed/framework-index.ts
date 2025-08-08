/**
 * neo-blessed Framework (STUB)
 * 
 * Traditional TUI framework implementation stubs.
 * These will be expanded when neo-blessed framework support is fully implemented.
 * 
 * Dependencies: bun add neo-blessed @types/blessed
 */

// Stub implementations
export { BlessedTerminal, isBlessedAvailable } from './BlessedTerminal.js';

// TODO: Implement remaining components when neo-blessed support is added
// export { BlessedInputManager } from './BlessedInputManager.js';
// export { BlessedProgressRenderer } from './BlessedProgressRenderer.js';
// export { BlessedModeRenderer } from './BlessedModeRenderer.js';
// export { BlessedStreamRenderer } from './BlessedStreamRenderer.js';

// Re-export interfaces for convenience
export type {
  ITerminal,
  TerminalDimensions,
} from '../../abstractions/ITerminal.js';

/**
 * neo-blessed framework availability check
 */
export function checkBlessedSupport(): { available: boolean; reason: string; packages?: string[] } {
  try {
    require('neo-blessed');
    
    return {
      available: true,
      reason: 'neo-blessed package is available',
    };
  } catch (error) {
    return {
      available: false,
      reason: 'neo-blessed package not found',
      packages: ['neo-blessed', '@types/blessed'],
    };
  }
}