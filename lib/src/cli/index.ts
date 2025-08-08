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

// NEW: Refactored CLI Framework with Dependency Injection
export { EventDrivenCLI } from './impl/EventDrivenCLI.js';
export { createReadlineCLI, createReadlineCLIAsync, getDefaultReadlineConfig } from './factories/createReadlineCLI.js';

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

// Factory functions
import { createReadlineCLI } from './factories/createReadlineCLI.js';
import { match } from '@qi/base';
export function createCompleteCLI(config?: Partial<import('./abstractions/ICLIFramework.js').CLIConfig>) {
  const result = createReadlineCLI(config);
  if (result.tag === 'failure') {
    throw new Error(`Failed to create CLI: ${result.error.message}`);
  }
  return result.value;
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
  const result = createReadlineCLI({
    enableHotkeys: options.enableHotkeys ?? true,
    enableStreaming: options.enableStreaming ?? true,
    debug: options.debug ?? false,
  });

  if (result.tag === 'failure') {
    throw new Error(`Failed to create CLI: ${result.error.message}`);
  }

  const cli = result.value;

  if (options.agent) {
    // Cast to include bridge methods since EventDrivenCLI implements both interfaces
    (cli as any).connectAgent(options.agent);
    
    // Setup bidirectional communication
    cli.on('userInput', ({ input }: { input: any }) => {
      (cli as any).sendToAgent(input);
    });
    
    cli.on('cancelRequested', () => {
      (cli as any).cancelAgent();
    });
  }

  return cli;
}
