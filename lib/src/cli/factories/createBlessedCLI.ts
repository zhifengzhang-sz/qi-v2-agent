/**
 * Blessed CLI Factory
 * 
 * Creates a complete CLI instance using the neo-blessed framework 
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

// Blessed framework implementations
import {
  BlessedTerminal,
  BlessedInputManager,
  BlessedProgressRenderer,
  BlessedModeRenderer,
  BlessedStreamRenderer,
  checkBlessedSupport,
} from '../frameworks/blessed/index.js';

// Shared QiCore services
import {
  QiCoreEventManager,
  QiCoreCommandRouter,
  QiCoreAgentConnector,
} from '../services/index.js';
import type { ICommandHandler } from '../../command/abstractions/index.js';

// EventDrivenCLI for orchestration
import { EventDrivenCLI } from '../impl/EventDrivenCLI.js';

/**
 * Factory error types
 */
interface FactoryError extends QiError {
  context: {
    framework?: string;
    operation?: string;
    available?: boolean;
    reason?: string;
    packages?: string[];
  };
}

const factoryError = (
  code: string,
  message: string,
  context: FactoryError['context'] = {}
): FactoryError => create(code, message, 'SYSTEM', context) as FactoryError;

/**
 * Create a blessed CLI instance using EventDrivenCLI with blessed components
 * 
 * @param config - CLI configuration
 * @returns Result containing the CLI instance or error
 */
export function createBlessedCLI(config: Partial<CLIConfig> = {}): Result<ICLIFramework, QiError> {
  // Check if blessed is available first
  const support = checkBlessedSupport();
  if (!support.available) {
    return Err(factoryError(
      'BLESSED_NOT_AVAILABLE',
      `neo-blessed framework not available: ${support.reason}. Install with: bun add ${support.packages?.join(' ')}`,
      { 
        framework: 'blessed',
        operation: 'createBlessedCLI',
        available: support.available,
        reason: support.reason,
        packages: support.packages
      }
    ));
  }

  try {
    // Fix for blessed input duplication: Clean up any persistent stdin listeners
    // from previous CLI frameworks (readline, ink) before initializing blessed
    // This prevents interference that causes "hi" to become "hhii"
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('keypress');

    // Create shared blessed screen for all components
    const blessed = require('neo-blessed');
    const screen = blessed.screen({
      smartCSR: true,
      title: 'Qi CLI',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true
      },
      debug: config.debug || false,
      dockBorders: false,
      ignoreLocked: ['C-c']
    });

    // Create blessed-specific components that share the screen
    const terminal = new BlessedTerminal(screen);
    const inputManager = new BlessedInputManager(screen);
    const progressRenderer = new BlessedProgressRenderer(screen);
    const modeRenderer = new BlessedModeRenderer(screen);
    const streamRenderer = new BlessedStreamRenderer(screen);

    // Create shared QiCore services (same across all frameworks)
    const eventManager = new QiCoreEventManager();
    const commandRouter = new QiCoreCommandRouter();
    const agentConnector = new QiCoreAgentConnector();

    // Create EventDrivenCLI with blessed components injected
    const cli = new EventDrivenCLI(
      terminal,
      inputManager,
      progressRenderer,
      modeRenderer,
      streamRenderer,
      eventManager,
      commandRouter,
      agentConnector,
      {
        framework: 'blessed',
        ...config
      }
    );

    return Ok(cli);
  } catch (error: any) {
    return Err(factoryError(
      'BLESSED_CREATION_FAILED',
      `Failed to create blessed CLI: ${error.message}`,
      { framework: 'blessed', operation: 'createBlessedCLI' }
    ));
  }
}

/**
 * Create a validated blessed CLI instance
 * 
 * @param config - CLI configuration with validation
 * @returns Result containing the validated CLI instance or error
 */
export function createValidatedBlessedCLI(config: Partial<CLIConfig> = {}): Result<ICLIFramework, QiError> {
  // First validate blessed is available
  const support = checkBlessedSupport();
  if (!support.available) {
    return Err(factoryError(
      'BLESSED_VALIDATION_FAILED',
      `neo-blessed validation failed: ${support.reason}`,
      { 
        framework: 'blessed',
        operation: 'createValidatedBlessedCLI',
        available: support.available,
        reason: support.reason,
        packages: support.packages
      }
    ));
  }

  // Then create the CLI
  return createBlessedCLI(config);
}

/**
 * Create a blessed CLI instance with async initialization
 * 
 * @param config - CLI configuration
 * @returns Promise resolving to Result with CLI instance or error
 */
export async function createBlessedCLIAsync(config: Partial<CLIConfig> = {}): Promise<Result<ICLIFramework, QiError>> {
  const cliResult = createBlessedCLI(config);
  
  return match(
    async (cli) => {
      await cli.initialize();
      return Ok(cli);
    },
    (error) => Promise.resolve(Err(error)),
    cliResult
  );
}

/**
 * Check blessed framework support
 */
export function checkBlessedFrameworkSupport(): { available: boolean; reason: string; packages?: string[] } {
  return checkBlessedSupport();
}