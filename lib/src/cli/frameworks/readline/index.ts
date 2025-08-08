/**
 * Readline Framework - Zero dependency CLI implementation
 * 
 * This module exports all readline framework components that implement
 * the CLI abstractions using only Node.js built-ins and ANSI escape sequences.
 */

// Core readline framework implementations
export { ReadlineTerminal } from './ReadlineTerminal.js';
export { ReadlineInputManager } from './ReadlineInputManager.js';
export { ReadlineProgressRenderer } from './ReadlineProgressRenderer.js';
export { ReadlineModeRenderer } from './ReadlineModeRenderer.js';
export { ReadlineStreamRenderer } from './ReadlineStreamRenderer.js';

// Re-export interfaces for convenience
export type {
  ITerminal,
  TerminalDimensions,
} from '../../abstractions/ITerminal.js';

export type {
  IInputManager,
  InputConfig,
  KeypressData,
} from '../../abstractions/IInputManager.js';

export type {
  IProgressRenderer,
  IModeRenderer,
  IStreamRenderer,
  ProgressConfig,
} from '../../abstractions/IUIComponent.js';

/**
 * Readline framework availability check
 * Always available as it uses only Node.js built-ins
 */
export function checkReadlineSupport(): { available: boolean; reason: string } {
  return {
    available: true,
    reason: 'Readline framework uses only Node.js built-ins (always available)',
  };
}