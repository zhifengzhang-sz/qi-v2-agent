/**
 * CLI System - Main export file
 *
 * Event-driven CLI framework with hotkey support, progress display, and agent integration.
 */

// CLI Framework interfaces
export type {
  CLIConfig,
  CLIEvents,
  CLIMode,
  CLIState,
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
export { createCLI, getAvailableFrameworks, recommendFramework } from './factories/createCLI.js';
export {
  createReadlineCLI,
  createReadlineCLIAsync,
  getDefaultReadlineConfig,
} from './factories/createReadlineCLI.js';
export * from './frameworks/index.js';
// NEW: Refactored CLI Framework with Dependency Injection
export { EventDrivenCLI } from './impl/EventDrivenCLI.js';
export * from './impl/index.js';
export { type CLIFeedback, type CLIInput, createPureCLI, type ICLI } from './impl/index.js';
export type { HotkeyConfig, HotkeyEvents } from './keyboard/HotkeyManager.js';
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

// Factory functions
import { createReadlineCLI } from './factories/createReadlineCLI.js';
export function createCompleteCLI(
  config?: Partial<import('./abstractions/ICLIFramework.js').CLIConfig>
) {
  const result = createReadlineCLI(config);
  if (result.tag === 'failure') {
    throw new Error(`Failed to create CLI: ${result.error.message}`);
  }
  return result.value;
}

// Re-export types for convenience
export type {
  CLIConfig as Config,
  CLIMode as Mode,
  CLIState as State,
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
 * Quick setup function for common use cases with framework selection
 * Now supports configuration loading from environment variables, CLI args, and config files
 */
export function setupQuickCLI(
  options: {
    framework?: 'readline' | 'ink' | 'blessed';
    agent?: any;
    enableHotkeys?: boolean;
    enableStreaming?: boolean;
    debug?: boolean;
    commandHandler?: any; // ICommandHandler - using any for now to avoid circular imports
    configPath?: string;
    args?: string[];
    autoDetect?: boolean; // Auto-detect best framework
  } = {}
) {
  // Always load configuration to get all settings
  const { loadCLIConfig, autoDetectFramework } = require('./config/CLIConfigLoader.js');

  const cliConfig = loadCLIConfig({
    configPath: options.configPath,
    args: options.args,
  });

  // Clean up debug logging for production
  // if (options.debug) {
  //   console.log('🔍 Loaded config:', cliConfig);
  //   console.log('🔍 Options framework:', options.framework);
  //   console.log('🔍 Args passed:', options.args);
  // }

  // Determine framework with proper precedence: explicit option > config > auto-detect > default
  let framework: string;
  if (options.framework) {
    framework = options.framework; // Explicit option wins
  } else if (cliConfig.framework) {
    framework = cliConfig.framework; // Config file/env var
  } else if (options.autoDetect) {
    framework = autoDetectFramework(); // Auto-detect
  } else {
    framework = 'readline'; // Default
  }

  // Merge config with explicit options taking precedence
  const config = {
    ...cliConfig, // Base config
    // Explicit options override everything
    ...(options.enableHotkeys !== undefined && { enableHotkeys: options.enableHotkeys }),
    ...(options.enableStreaming !== undefined && { enableStreaming: options.enableStreaming }),
    ...(options.debug !== undefined && { debug: options.debug }),
  };

  if (config.debug) {
    console.log(`🔧 Using ${framework} framework with config:`, config);
  }

  // Use framework-specific factories to handle commandHandler properly
  let result: any;

  switch (framework) {
    case 'ink': {
      const { createInkCLI } = require('./factories/createCLI.js');
      result = createInkCLI(config);
      break;
    }

    case 'blessed': {
      const { createBlessedCLI } = require('./factories/createCLI.js');
      result = createBlessedCLI(config);
      break;
    }
    default: {
      // Use existing readline factory which supports commandHandler
      result = createReadlineCLI(config, {
        commandHandler: options.commandHandler,
      });
      break;
    }
  }

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

    cli.on('command', ({ command, args }: { command: string; args: string[] }) => {
      // Handle commands by formatting them as input and sending to agent
      const commandInput = `/${command} ${args.join(' ')}`.trim();
      (cli as any).handleInput(commandInput);
    });

    cli.on('cancelRequested', () => {
      (cli as any).cancelAgent();
    });
  }

  return cli;
}
