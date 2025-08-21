/**
 * Context Manager - Abstract Interface
 *
 * Manages execution contexts, environment isolation, and contextual information flow
 */

import type { Result } from '@qi/base';
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
  ): Result<ConversationContext>;
  // QiCore API - proper error handling with Result<T>
  getConversationContext(id: string): Result<ConversationContext>;
  // Legacy API - backward compatibility with nullable return
  getConversationContextLegacy(id: string): ConversationContext | null;
  addMessageToContext(contextId: string, message: ContextMessage): Result<void>;
  updateConversationContext(contextId: string, updates: Partial<ConversationContext>): Result<void>;

  // Isolated Context Management for Sub-Agents
  createIsolatedContext(config: IsolatedContextConfig): Result<IsolatedContext>;
  // QiCore API - proper error handling with Result<T>
  getIsolatedContext(id: string): Result<IsolatedContext>;
  // Legacy API - backward compatibility with nullable return
  getIsolatedContextLegacy(id: string): IsolatedContext | null;
  validateContextAccess(contextId: string, operation: string): Promise<Result<boolean>>;
  terminateContext(contextId: string): void;

  // Context Lifecycle Management
  cleanupExpiredContexts(): Promise<Result<number>>;
  getActiveContexts(): readonly ConversationContext[];
  getActiveIsolatedContexts(): readonly IsolatedContext[];

  // Security and Boundary Enforcement
  enforceSecurityBoundaries(contextId: string, operation: string): Promise<Result<boolean>>;
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
  initialize(): Promise<Result<void>>;
  shutdown(): Promise<Result<void>>;
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
  registerContext(contextId: string, context: IsolatedContext): Result<void>;
  unregisterContext(contextId: string): Result<void>;
  validateAccess(contextId: string, operation: string): Promise<Result<boolean>>;
  enforcePathRestrictions(contextId: string, path: string): Result<boolean>;
  enforceToolRestrictions(contextId: string, tool: string): Result<boolean>;
  enforceCommandRestrictions(contextId: string, command: string): Result<boolean>;
  getViolationCount(contextId: string): Result<number>;
  getAccessLog(contextId?: string): Result<readonly ContextAccessAudit[]>;
}
