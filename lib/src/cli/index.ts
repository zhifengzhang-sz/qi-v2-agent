/**
 * CLI System - Main export file
 * 
 * Event-driven CLI framework with hotkey support, progress display, and agent integration.
 */

// Legacy exports (maintained for backward compatibility)
export * from './abstractions/index.js';
export * from './frameworks/index.js';
export * from './impl/index.js';
export { type CLIFeedback, type CLIInput, createPureCLI, type ICLI } from './impl/index.js';

// NEW: Event-Driven CLI Framework
export { EventDrivenCLI, createEventDrivenCLI } from './impl/EventDrivenCLI.js';

// CLI Framework interfaces
export type {
  ICLIFramework,
  IAgentCLIBridge,
  CLIEvents,
  CLIConfig,
  CLIState,
  CLIMode,
  MessageType,
  IKeyboardManager,
  IProgressDisplay,
  IModeIndicator,
  IStreamingRenderer,
} from './abstractions/ICLIFramework.js';

// Keyboard management
export { HotkeyManager, createHotkeyManager, debugKeypress } from './keyboard/HotkeyManager.js';
export type { HotkeyEvents, HotkeyConfig } from './keyboard/HotkeyManager.js';

export {
  KeyCodes,
  EscapeSequences,
  Terminal,
  Colors,
  matchesEscapeSequence,
  isControlCharacter,
  isPrintable,
  controlToString,
  identifyKey,
} from './keyboard/KeyboardUtils.js';

// UI Components
export { ProgressDisplay, createProgressBar, formatPercentage, createSpinner } from './ui/ProgressDisplay.js';
export type { ProgressState, ProgressConfig } from './ui/ProgressDisplay.js';

export { ModeIndicator, createModeIndicator, getModeEmoji, getModeColor } from './ui/ModeIndicator.js';
export type { ModeConfig, ModeInfo } from './ui/ModeIndicator.js';

export { StreamingRenderer, createStreamingRenderer, wrapText } from './ui/StreamingRenderer.js';
export type { StreamChunk } from './ui/StreamingRenderer.js';

// Utility functions  
import { createEventDrivenCLI as internalCreateCLI } from './impl/EventDrivenCLI.js';
export function createCompleteCLI(config?: Partial<import('./abstractions/ICLIFramework.js').CLIConfig>) {
  return internalCreateCLI(config);
}

// Re-export types for convenience
export type { 
  CLIConfig as Config, 
  CLIState as State, 
  CLIMode as Mode 
} from './abstractions/ICLIFramework.js';

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

/**
 * Quick setup function for common use cases
 */
export function setupQuickCLI(options: {
  agent?: any;
  enableHotkeys?: boolean;
  enableStreaming?: boolean;
  debug?: boolean;
} = {}) {
  const cli = internalCreateCLI({
    enableHotkeys: options.enableHotkeys ?? true,
    enableStreaming: options.enableStreaming ?? true,
    debug: options.debug ?? false,
  });

  if (options.agent) {
    cli.connectAgent(options.agent);
    
    // Setup bidirectional communication
    cli.on('userInput', ({ input }: { input: any }) => {
      cli.sendToAgent(input);
    });
    
    cli.on('cancelRequested', () => {
      cli.cancelAgent();
    });
  }

  return cli;
}
