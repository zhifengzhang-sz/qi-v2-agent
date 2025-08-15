/**
 * CLI System - Main export file
 *
 * Event-driven CLI framework with hotkey support, progress display, and agent integration.
 */

// CLI Framework interfaces
// Re-export types for convenience
export type {
  CLIConfig,
  CLIConfig as Config,
  CLIEvents,
  CLIMode,
  CLIMode as Mode,
  CLIState,
  CLIState as State,
  IAgentCLIBridge,
  ICLIFramework,
  IKeyboardManager,
  IModeIndicator,
  IProgressDisplay,
  IStreamingRenderer,
  MessageType,
} from './abstractions/ICLIFramework.js';
// Legacy exports (maintained for backward compatibility)
export * from './abstractions/index.js';
export {
  autoDetectFramework,
  type CLIConfigWithFramework,
  type CLIFramework,
  displayConfigHelp,
  loadCLIConfig,
} from './config/index.js';
// Framework-agnostic factories and configuration
// ONLY ONE CLI CREATION FUNCTION - NO FALLBACKS
export {
  createCLIAsync,
  getAvailableFrameworks,
  recommendFramework,
} from './factories/createCLI.js';
export {
  createReadlineCLI,
  createReadlineCLIAsync,
  getDefaultReadlineConfig,
} from './factories/createReadlineCLI.js';
export * from './frameworks/index.js';
export * from './impl/index.js';
// NEW: Refactored CLI Framework with Dependency Injection
export { MessageDrivenCLI } from './impl/MessageDrivenCLI.js';
export type { HotkeyConfig } from './keyboard/HotkeyManager.js';
// Keyboard management
export { createHotkeyManager, debugKeypress, HotkeyManager } from './keyboard/HotkeyManager.js';
export {
  Colors,
  controlToString,
  EscapeSequences,
  identifyKey,
  isControlCharacter,
  isPrintable,
  KeyCodes,
  matchesEscapeSequence,
  Terminal,
} from './keyboard/KeyboardUtils.js';
export type { ModeConfig, ModeInfo } from './ui/ModeIndicator.js';
export {
  createModeIndicator,
  getModeColor,
  getModeEmoji,
  ModeIndicator,
} from './ui/ModeIndicator.js';
export type { ProgressConfig, ProgressState } from './ui/ProgressDisplay.js';
// UI Components
export {
  createProgressBar,
  createSpinner,
  formatPercentage,
  ProgressDisplay,
} from './ui/ProgressDisplay.js';
export type { StreamChunk } from './ui/StreamingRenderer.js';
export { createStreamingRenderer, StreamingRenderer, wrapText } from './ui/StreamingRenderer.js';

// Default configuration
export const DefaultCLIConfig: import('./abstractions/ICLIFramework.js').CLIConfig = {
  enableHotkeys: true,
  enableModeIndicator: true,
  enableProgressDisplay: true,
  enableStreaming: true,
  prompt: '> ',
  colors: true,
  animations: true,
  historySize: 100,
  autoComplete: false,
  streamingThrottle: 0,
  maxBufferSize: 10000,
  debug: false,
};
