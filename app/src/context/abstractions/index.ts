/**
 * Context Manager - Abstract Interfaces
 * 
 * Public interface exports for context management
 */

// Core interfaces
export type { IContextManager, ISecurityBoundaryManager, ContextManagerStatistics } from './IContextManager.js';

// Type definitions
export type {
  AppContext,
  ConversationContext,
  ContextMessage,
  IsolatedContext,
  SecurityRestrictions,
  AgentSpecialization,
  IsolatedContextConfig,
  ContextAccessAudit
} from './ContextTypes.js';