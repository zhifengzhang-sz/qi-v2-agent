/**
 * Framework-agnostic CLI Factory
 * 
 * Provides a unified interface for creating CLI instances with different frameworks:
 * - readline (default, zero dependencies)
 * - ink (React-based rich UI)
 * - blessed (traditional TUI widgets)
 */

import {
  Ok,
  Err,
  match,
  create,
  type Result,
  type QiError,
} from '@qi/base';
import type { ICLIFramework, CLIConfig } from '../abstractions/ICLIFramework.js';

// Framework factories
import { 
  createReadlineCLI,
  createValidatedReadlineCLI,
  createReadlineCLIAsync,
  checkReadlineSupport,
} from './createReadlineCLI.js';

import {
  createBlessedCLI,
  createValidatedBlessedCLI,
  createBlessedCLIAsync,
  checkBlessedFrameworkSupport,
} from './createBlessedCLI.js';

// Import Ink framework
import { InkCLIFramework } from '../frameworks/ink/InkCLIFramework.js';

/**
 * Framework types supported by the CLI
 */
export type CLIFramework = 'readline' | 'ink' | 'blessed';

/**
 * Extended CLI configuration with framework selection
 */
export interface CLIConfigWithFramework extends CLIConfig {
  framework?: CLIFramework;
}

/**
 * Factory error types
 */
interface CLIFactoryError extends QiError {
  context: {
    framework?: CLIFramework;
    operation?: string;
    availableFrameworks?: CLIFramework[];
    supportCheck?: any;
  };
}

const cliFactoryError = (
  code: string,
  message: string,
  context: CLIFactoryError['context'] = {}
): CLIFactoryError => create(code, message, 'SYSTEM', context) as CLIFactoryError;

/**
 * Create a CLI instance with the specified framework
 * 
 * @param config - CLI configuration including framework selection
 * @returns Result containing the CLI instance or error
 */
export function createCLI(config: Partial<CLIConfigWithFramework> = {}): Result<ICLIFramework, QiError> {
  const framework = config.framework || 'readline';
  
  switch (framework) {
    case 'readline':
      return createReadlineCLI(config);
      
    case 'ink':
      return createInkCLI(config);
      
    case 'blessed':
      return createBlessedCLI(config);
      
    default:
      return Err(cliFactoryError(
        'UNSUPPORTED_FRAMEWORK',
        `Unsupported framework: ${framework}`,
        { 
          framework,
          operation: 'createCLI',
          availableFrameworks: ['readline', 'ink', 'blessed']
        }
      ));
  }
}

/**
 * Create a validated CLI instance
 * 
 * @param config - CLI configuration with validation
 * @returns Result containing the validated CLI instance or error
 */
export function createValidatedCLI(config: Partial<CLIConfigWithFramework> = {}): Result<ICLIFramework, QiError> {
  const framework = config.framework || 'readline';
  
  // Check framework support first
  const supportResult = checkFrameworkSupport(framework);
  
  return match(
    () => {
      switch (framework) {
        case 'readline':
          return createValidatedReadlineCLI(config);
          
        case 'ink':
          return createValidatedInkCLI(config);
          
        case 'blessed':
          return createValidatedBlessedCLI(config);
          
        default:
          return Err(cliFactoryError(
            'UNSUPPORTED_FRAMEWORK',
            `Unsupported framework: ${framework}`,
            { framework, operation: 'createValidatedCLI' }
          ));
      }
    },
    (error) => Err(error),
    supportResult
  );
}

/**
 * Create a CLI instance with async initialization
 * 
 * @param config - CLI configuration
 * @returns Promise resolving to Result with CLI instance or error
 */
export async function createCLIAsync(config: Partial<CLIConfigWithFramework> = {}): Promise<Result<ICLIFramework, QiError>> {
  const framework = config.framework || 'readline';
  
  switch (framework) {
    case 'readline':
      return await createReadlineCLIAsync(config);
      
    case 'ink':
      return await createInkCLIAsync(config);
      
    case 'blessed':
      return await createBlessedCLIAsync(config);
      
    default:
      return Err(cliFactoryError(
        'UNSUPPORTED_FRAMEWORK',
        `Unsupported framework: ${framework}`,
        { framework, operation: 'createCLIAsync' }
      ));
  }
}

/**
 * Get framework support information
 */
export function getFrameworkSupport(): Record<CLIFramework, any> {
  return {
    readline: checkReadlineSupport(),
    ink: checkInkSupport(),
    blessed: checkBlessedSupport(),
  };
}

/**
 * Check if a specific framework is supported in the current environment
 */
export function checkFrameworkSupport(framework: CLIFramework): Result<void, QiError> {
  switch (framework) {
    case 'readline': {
      const support = checkReadlineSupport();
      if (!support.terminal) {
        return Err(cliFactoryError(
          'READLINE_NOT_SUPPORTED',
          'Readline framework requires TTY support',
          { framework, supportCheck: support }
        ));
      }
      return Ok(void 0);
    }
    
    case 'ink': {
      const support = checkInkSupport();
      if (!support.available) {
        return Err(cliFactoryError(
          'INK_NOT_SUPPORTED',
          'Ink framework is not available. Run: bun add ink ink-text-input',
          { framework, supportCheck: support }
        ));
      }
      return Ok(void 0);
    }
    
    case 'blessed': {
      const support = checkBlessedSupport();
      if (!support.available) {
        return Err(cliFactoryError(
          'BLESSED_NOT_SUPPORTED',
          'neo-blessed framework is not available. Run: bun add neo-blessed',
          { framework, supportCheck: support }
        ));
      }
      return Ok(void 0);
    }
    
    default:
      return Err(cliFactoryError(
        'UNKNOWN_FRAMEWORK',
        `Unknown framework: ${framework}`,
        { framework }
      ));
  }
}

/**
 * Recommend the best framework for the current environment
 */
export function recommendFramework(): {
  framework: CLIFramework;
  reason: string;
  alternatives: CLIFramework[];
} {
  const support = getFrameworkSupport();
  
  // Check if Ink is available and terminal supports rich UI
  if (support.ink.available && support.readline.terminal && support.readline.colors) {
    return {
      framework: 'ink',
      reason: 'Rich React-based UI with excellent terminal support',
      alternatives: ['blessed', 'readline'],
    };
  }
  
  // Check if neo-blessed is available for TUI applications
  if (support.blessed.available && support.readline.terminal) {
    return {
      framework: 'blessed',
      reason: 'Traditional TUI with widget support',
      alternatives: ['readline', 'ink'],
    };
  }
  
  // Default to readline (always available)
  return {
    framework: 'readline',
    reason: 'Zero dependencies, always available',
    alternatives: ['ink', 'blessed'],
  };
}

// Framework-specific factories

function createInkCLI(config: Partial<CLIConfig> = {}): Result<ICLIFramework, QiError> {
  try {
    // Check if Ink is available
    const support = checkInkSupport();
    if (!support.available) {
      return Err(cliFactoryError(
        'INK_NOT_AVAILABLE',
        `Ink framework not available: ${support.reason}. Install with: bun add ${support.packages?.join(' ')}`,
        { framework: 'ink', operation: 'createInkCLI', supportCheck: support }
      ));
    }
    
    // Create actual Ink CLI implementation
    const cli = new InkCLIFramework(config);
    
    return Ok(cli);
  } catch (error: any) {
    return Err(cliFactoryError(
      'INK_CREATION_FAILED',
      `Failed to create Ink CLI: ${error.message}`,
      { framework: 'ink', operation: 'createInkCLI' }
    ));
  }
}

// Now imported from createBlessedCLI.ts

function createValidatedInkCLI(config: Partial<CLIConfig> = {}): Result<ICLIFramework, QiError> {
  // Run validation first
  const validationResult = checkFrameworkSupport('ink');
  
  return match(
    () => createInkCLI(config),
    (error) => Err(error),
    validationResult
  );
}

// Now imported from createBlessedCLI.ts

async function createInkCLIAsync(config: Partial<CLIConfig> = {}): Promise<Result<ICLIFramework, QiError>> {
  return createInkCLI(config);
}

// Now imported from createBlessedCLI.ts

// Support checking functions

function checkInkSupport(): { available: boolean; reason: string; packages?: string[] } {
  try {
    // Try to require ink packages
    require('ink');
    require('ink-text-input');
    
    return {
      available: true,
      reason: 'Ink packages are available',
    };
  } catch (error) {
    return {
      available: false,
      reason: 'Ink packages not found',
      packages: ['ink', 'ink-text-input'],
    };
  }
}

// Use the imported function
const checkBlessedSupport = checkBlessedFrameworkSupport;

/**
 * Backward compatibility function
 */
export function createEventDrivenCLI(config?: Partial<CLIConfig>): Result<ICLIFramework, QiError> {
  return createReadlineCLI(config);
}

/**
 * Get all available frameworks
 */
export function getAvailableFrameworks(): CLIFramework[] {
  const frameworks: CLIFramework[] = [];
  
  // Readline is always available
  frameworks.push('readline');
  
  // Check optional frameworks
  if (checkInkSupport().available) {
    frameworks.push('ink');
  }
  
  if (checkBlessedSupport().available) {
    frameworks.push('blessed');
  }
  
  return frameworks;
}

// Export the framework-specific factories for direct use
export { createInkCLI, createBlessedCLI };