/**
 * Context Manager - Main Module Exports
 */

// Export specific types explicitly (needed by index.ts)
export type {
  AgentSpecialization,
  AppContext,
  ContextAccessAudit,
  ContextMessage,
  ConversationContext,
  IsolatedContext,
  IsolatedContextConfig,
  SecurityRestrictions,
} from './abstractions/ContextTypes.js';
// Abstract interfaces
export type * from './abstractions/index.js';

// Implementations
export * from './impl/index.js';

// Utilities
export * from './utils/index.js';

import type { AppContext } from './abstractions/index.js';
import {
  type ToolbasedContextConfig,
  ToolbasedContextManager,
} from './impl/ToolbasedContextManager.js';
// Factory functions
import { ContextManager } from './impl/ContextManager.js';
import type { ToolRegistry } from '../tools/index.js';

/**
 * Create a context manager with initial application context
 */
export function createContextManager(initialAppContext: AppContext): ContextManager {
  return new ContextManager(initialAppContext);
}

/**
 * Create toolbox-based context manager (RECOMMENDED)
 *
 * Uses toolbox architecture:
 * - Tool registry for composable operations
 * - File reference processing
 * - Project structure awareness
 * - Session persistence and management
 * - Context-aware prompting
 */
export function createToolbasedContextManager(
  initialAppContext: AppContext,
  toolRegistry: ToolRegistry,
  config: Partial<ToolbasedContextConfig> = {}
): ToolbasedContextManager {
  return new ToolbasedContextManager(initialAppContext, toolRegistry, config);
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
      ['PWD', process.cwd()],
    ]),
    metadata: new Map([
      ['version', '0.2.7'],
      ['platform', process.platform],
    ]),
  };
}
