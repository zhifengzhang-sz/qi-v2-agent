/**
 * CLI Abstractions - Framework-agnostic interfaces
 * 
 * This module exports all the core abstractions used throughout the CLI architecture.
 * These interfaces ensure that different terminal frameworks can be swapped seamlessly.
 */

// Core framework interfaces (existing)
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
} from './ICLIFramework.js';

// Terminal abstraction
export type {
  ITerminal,
  TerminalDimensions,
} from './ITerminal.js';

// Input management abstraction
export type {
  IInputManager,
  InputConfig,
  KeypressData,
} from './IInputManager.js';

// UI component abstractions
export type {
  IUIComponent,
  IProgressRenderer,
  IModeRenderer,
  IStreamRenderer,
  IMessageDisplay,
  ProgressConfig,
} from './IUIComponent.js';

// Service abstractions (QiCore-based services)
export type {
  IEventManager,
  ICommandRouter,
  IAgentConnector,
  IConfigManager,
  IStateManager,
  CommandParseResult,
  CommandHandler,
} from './ICLIServices.js';

// Dependency injection abstractions
export type {
  ICLIContainer,
  ICLIContainerBuilder,
  IFrameworkRegistry,
  ServiceFactory,
  ServiceLifecycle,
  ServiceRegistration,
  ContainerConfig,
  CLIFactory,
  ContainerFactory,
  FrameworkRegistration,
} from './ICLIContainer.js';