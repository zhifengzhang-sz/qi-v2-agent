/**
 * Ink Framework (STUB)
 * 
 * React-based rich UI framework implementation stubs.
 * These will be expanded when Ink framework support is fully implemented.
 * 
 * Dependencies: bun add ink @inkjs/ui ink-progress-bar ink-spinner
 */

// Stub implementations
export { InkTerminal, isInkAvailable } from './InkTerminal.js';

// TODO: Implement remaining components when Ink support is added
// export { InkInputManager } from './InkInputManager.js';
// export { InkProgressRenderer } from './InkProgressRenderer.js';
// export { InkModeRenderer } from './InkModeRenderer.js';
// export { InkStreamRenderer } from './InkStreamRenderer.js';

// Re-export interfaces for convenience
export type {
  ITerminal,
  TerminalDimensions,
} from '../../abstractions/ITerminal.js';

/**
 * Ink framework availability check
 */
export function checkInkSupport(): { available: boolean; reason: string; packages?: string[] } {
  try {
    require('ink');
    require('@inkjs/ui');
    
    return {
      available: true,
      reason: 'Ink packages are available',
    };
  } catch (error) {
    return {
      available: false,
      reason: 'Ink packages not found',
      packages: ['ink', '@inkjs/ui', 'ink-progress-bar', 'ink-spinner'],
    };
  }
}