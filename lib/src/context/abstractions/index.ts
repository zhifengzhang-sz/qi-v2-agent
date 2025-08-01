/**
 * Context Manager - Abstract Interfaces
 *
 * Public interface exports for context management
 */

// Type definitions
export type {
  AgentSpecialization,
  AppContext,
  ContextAccessAudit,
  ContextMessage,
  ConversationContext,
  IsolatedContext,
  IsolatedContextConfig,
  SecurityRestrictions,
} from './ContextTypes.js';
// Core interfaces
export type {
  ContextManagerStatistics,
  IContextManager,
  ISecurityBoundaryManager,
} from './IContextManager.js';
