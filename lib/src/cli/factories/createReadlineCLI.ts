/**
 * Readline CLI Factory
 * 
 * Creates a complete CLI instance using the readline framework (zero dependencies)
 * with all necessary services and components properly wired up.
 */

import {
  Ok,
  Err,
  match,
  flatMap,
  create,
  type Result,
  type QiError,
} from '@qi/base';
import type { ICLIFramework, CLIConfig } from '../abstractions/ICLIFramework.js';
import { CLIContainer } from '../container/CLIContainer.js';

// Import interface types for dependency resolution
import type { ITerminal } from '../abstractions/ITerminal.js';
import type { IInputManager } from '../abstractions/IInputManager.js';
import type { IProgressRenderer, IModeRenderer, IStreamRenderer } from '../abstractions/IUIComponent.js';
import type { IEventManager, ICommandRouter, IAgentConnector } from '../abstractions/ICLIServices.js';

// Readline framework implementations
import {
  ReadlineTerminal,
  ReadlineInputManager,
  ReadlineProgressRenderer,
  ReadlineModeRenderer,
  ReadlineStreamRenderer,
} from '../frameworks/readline/index.js';

// Shared QiCore services
import {
  QiCoreEventManager,
  QiCoreCommandRouter,
  QiCoreAgentConnector,
} from '../services/index.js';
import type { ICommandHandler } from '../../command/abstractions/index.js';

// Will be implemented when we refactor EventDrivenCLI
import { EventDrivenCLI } from '../impl/EventDrivenCLI.js';

/**
 * Factory error types
 */
interface FactoryError extends QiError {
  context: {
    operation?: string;
    framework?: string;
    serviceKey?: string;
    config?: any;
  };
}

const factoryError = (
  code: string,
  message: string,
  context: FactoryError['context'] = {}
): FactoryError => create(code, message, 'SYSTEM', context) as FactoryError;

/**
 * Default CLI configuration for readline framework
 */
const DEFAULT_READLINE_CONFIG: CLIConfig = {
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
 * Create a CLI instance using the readline framework
 * 
 * This factory assembles all the necessary components:
 * - Readline-based terminal and input management
 * - QiCore services for robust error handling
 * - Proper dependency injection and lifecycle management
 */
export function createReadlineCLI(
  config: Partial<CLIConfig> = {},
  options: {
    commandHandler?: ICommandHandler;
  } = {}
): Result<ICLIFramework, QiError> {
  const fullConfig: CLIConfig = { ...DEFAULT_READLINE_CONFIG, ...config };
  
  // Create container
  const containerResult = createContainer();
  
  return flatMap(
    (container: CLIContainer) => {
      // Register all services
      const registrationResult = registerServices(container, fullConfig, options);
      
      return match(
        () => {
          // Create CLI instance with commandHandler option
          return createCLIInstance(container, fullConfig, options.commandHandler);
        },
        (error) => Err(error),
        registrationResult
      );
    },
    containerResult
  );
}

/**
 * Create and configure the dependency injection container
 */
function createContainer(): Result<CLIContainer, QiError> {
  try {
    const container = new CLIContainer({
      enableDebug: false,
      enableValidation: true,
      maxResolutionDepth: 10,
    });
    
    return Ok(container);
  } catch (error) {
    return Err(factoryError(
      'CONTAINER_CREATION_FAILED',
      `Failed to create container: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { operation: 'createContainer', framework: 'readline' }
    ));
  }
}

/**
 * Register all necessary services in the container
 */
function registerServices(
  container: CLIContainer, 
  config: CLIConfig, 
  options: { commandHandler?: ICommandHandler } = {}
): Result<void, QiError> {
  // Register terminal implementation
  const terminalResult = container.register(
    'terminal',
    () => new ReadlineTerminal(),
    { singleton: true }
  );
  
  if (terminalResult.tag === 'failure') {
    return terminalResult;
  }
  
  // Register input manager
  const inputResult = container.register(
    'inputManager', 
    () => {
      return new ReadlineInputManager();
    },
    { singleton: true, destroyer: (instance) => instance.close() }
  );
  
  if (inputResult.tag === 'failure') {
    return inputResult;
  }
  
  // Register progress renderer
  const progressResult = container.register(
    'progressRenderer',
    () => new ReadlineProgressRenderer({
      animated: config.animations,
      showElapsed: true,
      showPercentage: true,
    }),
    { singleton: true, destroyer: (instance) => instance.destroy() }
  );
  
  if (progressResult.tag === 'failure') {
    return progressResult;
  }
  
  // Register mode renderer
  const modeResult = container.register(
    'modeRenderer',
    () => new ReadlineModeRenderer({
      showIcon: config.colors,
      showLabel: false,
      position: 'inline',
    }),
    { singleton: true, destroyer: (instance) => instance.destroy() }
  );
  
  if (modeResult.tag === 'failure') {
    return modeResult;
  }
  
  // Register stream renderer
  const streamResult = container.register(
    'streamRenderer',
    () => new ReadlineStreamRenderer({
      throttleMs: config.streamingThrottle,
      showCursor: config.animations,
      bufferSize: config.maxBufferSize,
    }),
    { singleton: true, destroyer: (instance) => instance.destroy() }
  );
  
  if (streamResult.tag === 'failure') {
    return streamResult;
  }
  
  // Register shared QiCore services
  const eventManagerResult = container.register(
    'eventManager',
    () => new QiCoreEventManager({ trackHistory: config.debug }),
    { singleton: true, destroyer: (instance) => instance.destroy() }
  );
  
  if (eventManagerResult.tag === 'failure') {
    return eventManagerResult;
  }
  
  // Use QiCoreCommandRouter - if commandHandler provided, it will be used directly by CLI
  const commandRouterResult = container.register(
    'commandRouter',
    () => new QiCoreCommandRouter(),
    { singleton: true }
  );
  
  if (commandRouterResult.tag === 'failure') {
    return commandRouterResult;
  }
  
  const agentConnectorResult = container.register(
    'agentConnector',
    () => new QiCoreAgentConnector(),
    { singleton: true, destroyer: (instance) => instance.dispose() }
  );
  
  if (agentConnectorResult.tag === 'failure') {
    return agentConnectorResult;
  }
  
  return Ok(void 0);
}

/**
 * Create the CLI instance with resolved dependencies
 */
function createCLIInstance(container: CLIContainer, config: CLIConfig, commandHandler?: ICommandHandler): Result<ICLIFramework, QiError> {
  try {
    // Resolve all dependencies with explicit types
    const terminal = container.resolve<ITerminal>('terminal');
    const inputManager = container.resolve<IInputManager>('inputManager');
    const progressRenderer = container.resolve<IProgressRenderer>('progressRenderer');
    const modeRenderer = container.resolve<IModeRenderer>('modeRenderer');
    const streamRenderer = container.resolve<IStreamRenderer>('streamRenderer');
    const eventManager = container.resolve<IEventManager>('eventManager');
    const commandRouter = container.resolve<ICommandRouter>('commandRouter');
    const agentConnector = container.resolve<IAgentConnector>('agentConnector');
    
    // Check all resolutions succeeded
    const dependencies = [
      terminal, inputManager, progressRenderer, modeRenderer, 
      streamRenderer, eventManager, commandRouter, agentConnector
    ];
    
    for (const dep of dependencies) {
      if (dep.tag === 'failure') {
        return dep as Result<ICLIFramework, QiError>;
      }
    }
    
    // Create CLI instance with resolved dependencies
    // Type assertion is safe here since we already checked all deps succeeded
    const cli = new EventDrivenCLI(
      (terminal as any).value,
      (inputManager as any).value,
      (progressRenderer as any).value,
      (modeRenderer as any).value,
      (streamRenderer as any).value,
      (eventManager as any).value,
      (commandRouter as any).value,
      (agentConnector as any).value,
      config,
      commandHandler // Pass the commandHandler directly
    );
    
    return Ok(cli);
  } catch (error) {
    return Err(factoryError(
      'CLI_CREATION_FAILED',
      `Failed to create CLI instance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { operation: 'createCLI', framework: 'readline' }
    ));
  }
}

/**
 * Validate CLI configuration for readline framework
 */
function validateReadlineConfig(config: CLIConfig): Result<void, QiError> {
  if (config.historySize < 0 || config.historySize > 10000) {
    return Err(factoryError(
      'INVALID_HISTORY_SIZE',
      'History size must be between 0 and 10000',
      { operation: 'validateConfig', config: { historySize: config.historySize } }
    ));
  }
  
  if (config.streamingThrottle < 0 || config.streamingThrottle > 1000) {
    return Err(factoryError(
      'INVALID_STREAMING_THROTTLE',
      'Streaming throttle must be between 0 and 1000ms',
      { operation: 'validateConfig', config: { streamingThrottle: config.streamingThrottle } }
    ));
  }
  
  if (config.maxBufferSize < 100 || config.maxBufferSize > 100000) {
    return Err(factoryError(
      'INVALID_BUFFER_SIZE',
      'Max buffer size must be between 100 and 100000',
      { operation: 'validateConfig', config: { maxBufferSize: config.maxBufferSize } }
    ));
  }
  
  return Ok(void 0);
}

/**
 * Create readline CLI with validation
 */
export function createValidatedReadlineCLI(config: Partial<CLIConfig> = {}): Result<ICLIFramework, QiError> {
  const fullConfig: CLIConfig = { ...DEFAULT_READLINE_CONFIG, ...config };
  
  const validationResult = validateReadlineConfig(fullConfig);
  
  return match(
    () => createReadlineCLI(config),
    (error) => Err(error),
    validationResult
  );
}

/**
 * Create readline CLI with async initialization
 */
export async function createReadlineCLIAsync(config: Partial<CLIConfig> = {}): Promise<Result<ICLIFramework, QiError>> {
  const cliResult = createReadlineCLI(config);
  
  return await match(
    async (cli): Promise<Result<ICLIFramework, QiError>> => {
      try {
        await cli.initialize();
        return Ok(cli);
      } catch (error) {
        return Err(factoryError(
          'CLI_INITIALIZATION_FAILED',
          `Failed to initialize CLI: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { operation: 'initialize', framework: 'readline' }
        ));
      }
    },
    async (error: QiError): Promise<Result<ICLIFramework, QiError>> => Err(error),
    cliResult
  );
}

/**
 * Get default readline CLI configuration
 */
export function getDefaultReadlineConfig(): CLIConfig {
  return { ...DEFAULT_READLINE_CONFIG };
}

/**
 * Check if current environment supports readline features
 */
export function checkReadlineSupport(): {
  terminal: boolean;
  colors: boolean;
  unicode: boolean;
  hotkeys: boolean;
} {
  return {
    terminal: process.stdout.isTTY || false,
    colors: !!(process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') || 
            (process.stdout.isTTY && !process.env.NO_COLOR && !process.env.NODE_DISABLE_COLORS),
    unicode: process.platform !== 'win32',
    hotkeys: process.stdin.isTTY || false,
  };
}