/**
 * neo-blessed Framework
 * 
 * Complete traditional TUI framework implementation using neo-blessed.
 * Provides widget-based terminal interface with efficient rendering.
 * 
 * Dependencies: neo-blessed @types/blessed
 */

// Core implementations
export { BlessedTerminal, isBlessedAvailable } from './BlessedTerminal.js';
export { BlessedInputManager } from './BlessedInputManager.js';
export { BlessedProgressRenderer } from './BlessedProgressRenderer.js';
export { BlessedModeRenderer } from './BlessedModeRenderer.js';
export { BlessedStreamRenderer } from './BlessedStreamRenderer.js';

// Re-export interfaces for convenience
export type {
  ITerminal,
  TerminalDimensions,
} from '../../abstractions/ITerminal.js';

export type {
  IInputManager,
  InputCallback,
  KeypressCallback,
} from '../../abstractions/IInputManager.js';

export type {
  IProgressRenderer,
  ProgressConfig,
} from '../../abstractions/IProgressRenderer.js';

export type {
  IModeRenderer,
  CLIMode,
} from '../../abstractions/IModeRenderer.js';

export type {
  IStreamRenderer,
} from '../../abstractions/IStreamRenderer.js';

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