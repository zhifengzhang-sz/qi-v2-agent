/**
 * Context Manager - Abstract Interface
 *
 * Manages execution contexts, environment isolation, and contextual information flow
 */

import type {
  AppContext,
  ContextAccessAudit,
  ContextMessage,
  ConversationContext,
  IsolatedContext,
  IsolatedContextConfig,
} from './ContextTypes.js';

/**
 * Context manager interface for managing execution contexts and security isolation
 */
export interface IContextManager {
  // Application Context Management
  getApplicationContext(): AppContext;
  updateApplicationContext(updates: Partial<AppContext>): void;

  // Conversation Context Management
  createConversationContext(
    type: 'main' | 'sub-agent' | 'tool',
    parentId?: string
  ): ConversationContext;
  getConversationContext(id: string): ConversationContext | null;
  addMessageToContext(contextId: string, message: ContextMessage): void;
  updateConversationContext(contextId: string, updates: Partial<ConversationContext>): void;

  // Isolated Context Management for Sub-Agents
  createIsolatedContext(config: IsolatedContextConfig): IsolatedContext;
  getIsolatedContext(id: string): IsolatedContext | null;
  validateContextAccess(contextId: string, operation: string): Promise<boolean>;
  terminateContext(contextId: string): void;

  // Context Lifecycle Management
  cleanupExpiredContexts(): Promise<number>;
  getActiveContexts(): readonly ConversationContext[];
  getActiveIsolatedContexts(): readonly IsolatedContext[];

  // Security and Boundary Enforcement
  enforceSecurityBoundaries(contextId: string, operation: string): Promise<boolean>;
  auditContextAccess(contextId: string, operation: string, result: boolean, reason?: string): void;
  getAccessAuditLog(contextId?: string): readonly ContextAccessAudit[];

  // Context Hierarchy and Relations
  getChildContexts(parentId: string): readonly ConversationContext[];
  getContextHierarchy(contextId: string): readonly string[];

  // Utility Methods
  generateContextId(): string;
  isContextActive(contextId: string): boolean;
  getContextStatistics(): ContextManagerStatistics;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Context manager statistics
 */
export interface ContextManagerStatistics {
  readonly totalContextsCreated: number;
  readonly activeConversationContexts: number;
  readonly activeIsolatedContexts: number;
  readonly expiredContextsCleanedUp: number;
  readonly securityViolations: number;
  readonly memoryUsage: number;
  readonly uptime: number;
}

/**
 * Security boundary manager interface
 */
export interface ISecurityBoundaryManager {
  registerContext(contextId: string, context: IsolatedContext): void;
  unregisterContext(contextId: string): void;
  validateAccess(contextId: string, operation: string): Promise<boolean>;
  enforcePathRestrictions(contextId: string, path: string): boolean;
  enforceToolRestrictions(contextId: string, tool: string): boolean;
  enforceCommandRestrictions(contextId: string, command: string): boolean;
  getViolationCount(contextId: string): number;
}
