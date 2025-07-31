/**
 * Context Manager - Main Module Exports
 */

// Abstract interfaces
export type * from './abstractions/index.js';

// Implementations
export * from './impl/index.js';

// Factory functions
import { ContextManager } from './impl/ContextManager.js';
import type { AppContext } from './abstractions/index.js';

/**
 * Create a context manager with initial application context
 */
export function createContextManager(initialAppContext: AppContext): ContextManager {
  return new ContextManager(initialAppContext);
}

/**
 * Create default application context for development
 */
export function createDefaultAppContext(): AppContext {
  return {
    sessionId: `session_${Date.now()}`,
    currentDirectory: process.cwd(),
    environment: new Map([
      ['NODE_ENV', process.env.NODE_ENV || 'development'],
      ['PWD', process.cwd()]
    ]),
    metadata: new Map([
      ['version', '0.2.7'],
      ['platform', process.platform]
    ])
  };
}