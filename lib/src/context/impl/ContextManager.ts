/**
 * Context Manager Implementation
 *
 * Manages execution contexts, environment isolation, and contextual information flow
 */

import { randomUUID } from 'node:crypto';
import {
  create,
  failure,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type {
  AgentSpecialization,
  AppContext,
  ContextAccessAudit,
  ContextManagerStatistics,
  ContextMessage,
  ConversationContext,
  IContextManager,
  IsolatedContext,
  IsolatedContextConfig,
  SecurityRestrictions,
} from '../abstractions/index.js';
import { ContextOptimizer } from './ContextOptimizer.js';
import { SecurityBoundaryManager } from './SecurityBoundaryManager.js';

/**
 * Context-specific error factory functions with granular categorization
 */
const contextError = {
  // Context validation errors
  invalidConfiguration: (field: string, value: unknown): QiError =>
    create('INVALID_CONFIGURATION', `Invalid context configuration for ${field}`, 'VALIDATION', {
      field,
      value,
    }),

  parentContextNotFound: (parentId: string): QiError =>
    create('PARENT_CONTEXT_NOT_FOUND', `Parent context not found: ${parentId}`, 'VALIDATION', {
      parentId,
    }),

  contextNotFound: (contextId: string): QiError =>
    create('CONTEXT_NOT_FOUND', `Context not found: ${contextId}`, 'VALIDATION', { contextId }),

  contextExpired: (contextId: string, expiresAt: Date): QiError =>
    create('CONTEXT_EXPIRED', `Context expired: ${contextId}`, 'VALIDATION', {
      contextId,
      expiresAt: expiresAt.toISOString(),
    }),

  // Security boundary errors
  securityRegistrationFailed: (contextId: string, reason: string): QiError =>
    create(
      'SECURITY_REGISTRATION_FAILED',
      `Failed to register security context: ${contextId}`,
      'AUTHORIZATION',
      { contextId, reason }
    ),

  securityUnregistrationFailed: (contextId: string, reason: string): QiError =>
    create(
      'SECURITY_UNREGISTRATION_FAILED',
      `Failed to unregister security context: ${contextId}`,
      'AUTHORIZATION',
      { contextId, reason }
    ),

  accessValidationFailed: (contextId: string, operation: string, reason: string): QiError =>
    create(
      'ACCESS_VALIDATION_FAILED',
      `Access validation failed for context ${contextId}, operation: ${operation}`,
      'AUTHORIZATION',
      { contextId, operation, reason }
    ),

  // System-level errors
  initializationFailed: (reason: string): QiError =>
    create('CONTEXT_MANAGER_INIT_FAILED', `Context manager initialization failed`, 'SYSTEM', {
      reason,
    }),

  shutdownFailed: (reason: string): QiError =>
    create('CONTEXT_MANAGER_SHUTDOWN_FAILED', `Context manager shutdown failed`, 'SYSTEM', {
      reason,
    }),

  cleanupFailed: (reason: string): QiError =>
    create('CONTEXT_CLEANUP_FAILED', `Context cleanup operation failed`, 'SYSTEM', { reason }),

  // State corruption errors
  stateCorruption: (contextId: string, details: string): QiError =>
    create(
      'CONTEXT_STATE_CORRUPTION',
      `Context state corruption detected: ${contextId}`,
      'SYSTEM',
      {
        contextId,
        details,
      }
    ),
};

/**
 * Main context manager implementation
 */
export class ContextManager implements IContextManager {
  private applicationContext: AppContext;
  private conversationContexts = new Map<string, ConversationContext>();
  private isolatedContexts = new Map<string, IsolatedContext>();
  private securityBoundaries: SecurityBoundaryManager;
  private contextOptimizer: ContextOptimizer;
  private cleanupInterval?: NodeJS.Timeout;
  private accessAuditLog: ContextAccessAudit[] = [];

  // Statistics tracking
  private stats = {
    totalContextsCreated: 0,
    expiredContextsCleanedUp: 0,
    securityViolations: 0,
    startTime: Date.now(),
  };

  constructor(initialAppContext: AppContext) {
    this.applicationContext = { ...initialAppContext };
    this.securityBoundaries = new SecurityBoundaryManager();
    this.contextOptimizer = new ContextOptimizer();
  }

  async initialize(): Promise<Result<void>> {
    return fromAsyncTryCatch(
      async () => {
        // Start cleanup interval for expired contexts
        this.cleanupInterval = setInterval(
          () => this.cleanupExpiredContexts(),
          60000 // Every minute
        );
      },
      (error: unknown) => contextError.initializationFailed(String(error))
    );
  }

  async shutdown(): Promise<Result<void>> {
    return fromAsyncTryCatch(
      async () => {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
          this.cleanupInterval = undefined;
        }

        // Terminate all active contexts
        for (const contextId of this.isolatedContexts.keys()) {
          this.terminateContext(contextId);
        }

        this.conversationContexts.clear();
        this.isolatedContexts.clear();
      },
      (error: unknown) => contextError.shutdownFailed(String(error))
    );
  }

  // Application Context Management

  getApplicationContext(): AppContext {
    return {
      ...this.applicationContext,
      environment: new Map(this.applicationContext.environment),
      metadata: new Map(this.applicationContext.metadata),
    };
  }

  updateApplicationContext(updates: Partial<AppContext>): void {
    this.applicationContext = {
      ...this.applicationContext,
      ...updates,
      // Preserve readonly maps with proper merging
      environment: updates.environment || this.applicationContext.environment,
      metadata: updates.metadata || this.applicationContext.metadata,
    };
  }

  // Conversation Context Management

  createConversationContext(
    type: 'main' | 'sub-agent' | 'tool',
    parentId?: string
  ): Result<ConversationContext> {
    const contextId = this.generateContextId();
    const now = new Date();

    // Validate parent context if specified
    if (parentId && !this.conversationContexts.has(parentId)) {
      return failure(contextError.parentContextNotFound(parentId));
    }

    const context: ConversationContext = {
      id: contextId,
      parentId,
      type,
      createdAt: now,
      expiresAt:
        type === 'sub-agent'
          ? new Date(now.getTime() + 300000)
          : // 5 minutes for sub-agents
            undefined, // Main contexts don't expire
      messages: [],
      restrictions: this.getDefaultRestrictions(type),
      allowedOperations: this.getAllowedOperations(type),
      metadata: new Map(),
    };

    this.conversationContexts.set(contextId, context);
    this.stats.totalContextsCreated++;

    return success(context);
  }

  /**
   * External API - returns nullable for backward compatibility
   */
  getConversationContextLegacy(id: string): ConversationContext | null {
    const result = this.getConversationContext(id);
    return match(
      (context) => context,
      () => null, // Transform error to null for legacy compatibility
      result
    );
  }

  /**
   * QiCore API - returns Result<T> for proper error handling
   */
  getConversationContext(id: string): Result<ConversationContext> {
    const context = this.conversationContexts.get(id);
    if (!context) {
      return failure(contextError.contextNotFound(id));
    }

    // Check if context has expired
    if (context.expiresAt && new Date() > context.expiresAt) {
      // Clean up expired context
      this.conversationContexts.delete(id);
      return failure(contextError.contextExpired(id, context.expiresAt));
    }

    // Return a deep copy to maintain immutability
    const immutableContext: ConversationContext = {
      ...context,
      messages: [...context.messages],
      restrictions: { ...context.restrictions },
      allowedOperations: [...context.allowedOperations],
      metadata: new Map(context.metadata),
    };

    return success(immutableContext);
  }

  addMessageToContext(contextId: string, message: ContextMessage): Result<void> {
    const context = this.conversationContexts.get(contextId);
    if (!context) {
      return failure(contextError.contextNotFound(contextId));
    }

    // Create updated context with new message
    const updatedContext: ConversationContext = {
      ...context,
      messages: [...context.messages, message],
    };

    this.conversationContexts.set(contextId, updatedContext);
    return success(undefined);
  }

  updateConversationContext(
    contextId: string,
    updates: Partial<ConversationContext>
  ): Result<void> {
    const context = this.conversationContexts.get(contextId);
    if (!context) {
      return failure(contextError.contextNotFound(contextId));
    }

    const updatedContext: ConversationContext = {
      ...context,
      ...updates,
      // Preserve arrays and maps
      messages: updates.messages || context.messages,
      allowedOperations: updates.allowedOperations || context.allowedOperations,
      metadata: updates.metadata || context.metadata,
    };

    this.conversationContexts.set(contextId, updatedContext);
    return success(undefined);
  }

  // Isolated Context Management

  createIsolatedContext(config: IsolatedContextConfig): Result<IsolatedContext> {
    // Validate parent context exists
    const validateParentContext = (): Result<void> => {
      if (!this.conversationContexts.has(config.parentContextId)) {
        return failure(contextError.parentContextNotFound(config.parentContextId));
      }
      return success(undefined);
    };

    // Create isolated context with configuration
    const createContextData = (): IsolatedContext => {
      const contextId = this.generateContextId();
      const now = new Date();

      return {
        id: contextId,
        parentContextId: config.parentContextId,
        task: config.task,
        allowedOperations: this.filterOperationsBySpecialization(
          config.specialization,
          config.restrictions
        ),
        allowedPaths: [...config.restrictions.allowedPaths],
        timeLimit: config.timeLimit || 300000, // 5 minutes default
        memoryLimit: config.memoryLimit || 100 * 1024 * 1024, // 100MB default
        boundaries: this.createSecurityBoundaries(config.restrictions),
        createdAt: now,
        expiresAt: new Date(now.getTime() + (config.timeLimit || 300000)),
      };
    };

    // Register context and handle security boundaries
    const registerAndStore = (isolatedContext: IsolatedContext): Result<IsolatedContext> => {
      this.isolatedContexts.set(isolatedContext.id, isolatedContext);

      const registrationResult = this.securityBoundaries.registerContext(
        isolatedContext.id,
        isolatedContext
      );

      return match(
        (): Result<IsolatedContext> => {
          this.stats.totalContextsCreated++;
          return success(isolatedContext);
        },
        (error): Result<IsolatedContext> =>
          failure(contextError.securityRegistrationFailed(isolatedContext.id, String(error))),
        registrationResult
      );
    };

    // Functional composition chain
    const validationResult = validateParentContext();
    return match(
      () => registerAndStore(createContextData()),
      (error) => failure(error),
      validationResult
    );
  }

  /**
   * External API - returns nullable for backward compatibility
   */
  getIsolatedContextLegacy(id: string): IsolatedContext | null {
    const result = this.getIsolatedContext(id);
    return match(
      (context) => context,
      () => null, // Transform error to null for legacy compatibility
      result
    );
  }

  /**
   * QiCore API - returns Result<T> for proper error handling
   */
  getIsolatedContext(id: string): Result<IsolatedContext> {
    const context = this.isolatedContexts.get(id);
    if (!context) {
      return failure(contextError.contextNotFound(id));
    }

    // Check if context has expired
    if (new Date() > context.expiresAt) {
      // Clean up expired context
      this.isolatedContexts.delete(id);
      return failure(contextError.contextExpired(id, context.expiresAt));
    }

    // Return a deep copy
    const immutableContext: IsolatedContext = {
      ...context,
      allowedOperations: [...context.allowedOperations],
      allowedPaths: [...context.allowedPaths],
      boundaries: [...context.boundaries],
    };

    return success(immutableContext);
  }

  async validateContextAccess(contextId: string, operation: string): Promise<Result<boolean>> {
    // Get and validate context exists
    const getContext = (): Result<IsolatedContext> => {
      const context = this.isolatedContexts.get(contextId);
      if (!context) {
        this.auditContextAccess(contextId, operation, false, 'Context not found');
        return failure(contextError.contextNotFound(contextId));
      }
      return success(context);
    };

    // Check if context has expired
    const checkExpiration = (context: IsolatedContext): Result<IsolatedContext> => {
      if (new Date() > context.expiresAt) {
        this.terminateContext(contextId);
        this.auditContextAccess(contextId, operation, false, 'Context expired');
        return failure(contextError.contextExpired(contextId, context.expiresAt));
      }
      return success(context);
    };

    // Validate access through security boundaries
    const validateAccess = async (context: IsolatedContext): Promise<Result<boolean>> => {
      const validationResult = await this.securityBoundaries.validateAccess(contextId, operation);

      return match(
        (allowed) => {
          this.auditContextAccess(contextId, operation, allowed);
          return success(allowed);
        },
        (error) => {
          this.auditContextAccess(contextId, operation, false, error.message);
          return success(false); // Convert validation error to denied access
        },
        validationResult
      );
    };

    return fromAsyncTryCatch(
      async () => {
        const contextResult = getContext();
        return match(
          async (context) => {
            const expirationResult = checkExpiration(context);
            return match(
              async (validContext) => {
                const accessResult = await validateAccess(validContext);
                return match(
                  (allowed) => allowed,
                  () => false,
                  accessResult
                );
              },
              () => Promise.resolve(false), // Expired context = access denied
              expirationResult
            );
          },
          () => Promise.resolve(false), // Context not found = access denied
          contextResult
        );
      },
      (error: unknown) => contextError.accessValidationFailed(contextId, operation, String(error))
    );
  }

  terminateContext(contextId: string): void {
    // Remove from active contexts
    this.conversationContexts.delete(contextId);
    this.isolatedContexts.delete(contextId);

    // Clean up security boundaries - handle Result<T>
    const unregisterResult = this.securityBoundaries.unregisterContext(contextId);
    match(
      () => {
        // Successfully unregistered
      },
      (error) => {
        // Log the error but don't fail the entire termination
        // Log error but don't fail the entire termination
        console.warn(`Failed to unregister security context ${contextId}:`, error.message);
      },
      unregisterResult
    );

    // Remove child contexts
    const childContexts = this.getChildContexts(contextId);
    for (const childContext of childContexts) {
      this.terminateContext(childContext.id);
    }
  }

  // Context Lifecycle Management

  async cleanupExpiredContexts(): Promise<Result<number>> {
    return fromAsyncTryCatch(
      async () => {
        const now = new Date();
        let cleaned = 0;

        // Clean up expired conversation contexts
        for (const [contextId, context] of this.conversationContexts.entries()) {
          if (context.expiresAt && now > context.expiresAt) {
            this.terminateContext(contextId);
            cleaned++;
          }
        }

        // Clean up expired isolated contexts
        for (const [contextId, context] of this.isolatedContexts.entries()) {
          if (now > context.expiresAt) {
            this.terminateContext(contextId);
            cleaned++;
          }
        }

        this.stats.expiredContextsCleanedUp += cleaned;
        return cleaned;
      },
      (error: unknown) => contextError.cleanupFailed(String(error))
    );
  }

  getActiveContexts(): readonly ConversationContext[] {
    return Array.from(this.conversationContexts.values()).map((context) => ({
      ...context,
      messages: [...context.messages],
      allowedOperations: [...context.allowedOperations],
      metadata: new Map(context.metadata),
    }));
  }

  getActiveIsolatedContexts(): readonly IsolatedContext[] {
    return Array.from(this.isolatedContexts.values()).map((context) => ({
      ...context,
      allowedOperations: [...context.allowedOperations],
      allowedPaths: [...context.allowedPaths],
      boundaries: [...context.boundaries],
    }));
  }

  // Security and Boundary Enforcement

  async enforceSecurityBoundaries(contextId: string, operation: string): Promise<Result<boolean>> {
    return this.validateContextAccess(contextId, operation);
  }

  auditContextAccess(contextId: string, operation: string, result: boolean, reason?: string): void {
    const auditEntry: ContextAccessAudit = {
      contextId,
      operation,
      allowed: result,
      timestamp: new Date(),
      reason,
    };

    this.accessAuditLog.push(auditEntry);

    if (!result) {
      this.stats.securityViolations++;
    }

    // Keep only last 1000 audit entries
    if (this.accessAuditLog.length > 1000) {
      this.accessAuditLog = this.accessAuditLog.slice(-1000);
    }
  }

  getAccessAuditLog(contextId?: string): readonly ContextAccessAudit[] {
    if (contextId) {
      return this.accessAuditLog.filter((entry) => entry.contextId === contextId);
    }
    return [...this.accessAuditLog];
  }

  // Context Hierarchy and Relations

  getChildContexts(parentId: string): readonly ConversationContext[] {
    return Array.from(this.conversationContexts.values())
      .filter((context) => context.parentId === parentId)
      .map((context) => ({
        ...context,
        messages: [...context.messages],
        allowedOperations: [...context.allowedOperations],
        metadata: new Map(context.metadata),
      }));
  }

  getContextHierarchy(contextId: string): readonly string[] {
    const hierarchy: string[] = [];
    let currentContext = this.conversationContexts.get(contextId);

    while (currentContext) {
      hierarchy.unshift(currentContext.id);
      if (currentContext.parentId) {
        currentContext = this.conversationContexts.get(currentContext.parentId);
      } else {
        break;
      }
    }

    return hierarchy;
  }

  // Context Optimization (Enhancement 3)

  async optimizeContext(context: string, maxTokens: number): Promise<Result<string>> {
    return this.contextOptimizer.optimizeContext(context, maxTokens);
  }

  calculateTokenCount(text: string): number {
    return this.contextOptimizer.calculateTokenCount(text);
  }

  scoreRelevance(text: string, query: string): number {
    return this.contextOptimizer.scoreRelevance(text, query);
  }

  async pruneOldContext(context: string, maxAge: number): Promise<Result<string>> {
    return this.contextOptimizer.pruneOldContext(context, maxAge);
  }

  // Utility Methods

  generateContextId(): string {
    return `ctx_${randomUUID()}`;
  }

  isContextActive(contextId: string): boolean {
    const conversationContext = this.conversationContexts.get(contextId);
    if (conversationContext) {
      return !conversationContext.expiresAt || new Date() <= conversationContext.expiresAt;
    }

    const isolatedContext = this.isolatedContexts.get(contextId);
    if (isolatedContext) {
      return new Date() <= isolatedContext.expiresAt;
    }

    return false;
  }

  getContextStatistics(): ContextManagerStatistics {
    return {
      totalContextsCreated: this.stats.totalContextsCreated,
      activeConversationContexts: this.conversationContexts.size,
      activeIsolatedContexts: this.isolatedContexts.size,
      expiredContextsCleanedUp: this.stats.expiredContextsCleanedUp,
      securityViolations: this.stats.securityViolations,
      memoryUsage: process.memoryUsage().heapUsed,
      uptime: Date.now() - this.stats.startTime,
    };
  }

  // Private helper methods

  private getDefaultRestrictions(type: 'main' | 'sub-agent' | 'tool'): SecurityRestrictions {
    const baseRestrictions: SecurityRestrictions = {
      readOnlyMode: false,
      allowedPaths: [process.cwd()],
      blockedCommands: [],
      blockedTools: [],
      requireApproval: false,
      maxExecutionTime: 300000, // 5 minutes
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      networkAccess: false,
      systemAccess: false,
    };

    switch (type) {
      case 'main':
        return {
          ...baseRestrictions,
          networkAccess: true,
          systemAccess: true,
        };
      case 'sub-agent':
        return {
          ...baseRestrictions,
          readOnlyMode: true,
          requireApproval: true,
          maxExecutionTime: 180000, // 3 minutes
          maxMemoryUsage: 50 * 1024 * 1024, // 50MB
        };
      case 'tool':
        return {
          ...baseRestrictions,
          readOnlyMode: true,
          maxExecutionTime: 60000, // 1 minute
          maxMemoryUsage: 25 * 1024 * 1024, // 25MB
        };
      default:
        return baseRestrictions;
    }
  }

  private getAllowedOperations(type: 'main' | 'sub-agent' | 'tool'): string[] {
    const baseOperations = ['read', 'analyze', 'generate'];

    switch (type) {
      case 'main':
        return [...baseOperations, 'write', 'execute', 'network', 'system'];
      case 'sub-agent':
        return [...baseOperations, 'write'];
      case 'tool':
        return [...baseOperations];
      default:
        return baseOperations;
    }
  }

  private filterOperationsBySpecialization(
    specialization: AgentSpecialization,
    restrictions: SecurityRestrictions
  ): string[] {
    const baseOperations = ['read', 'analyze'];

    const specializationOperations: Record<AgentSpecialization, string[]> = {
      general: [...baseOperations, 'write', 'generate'],
      'file-operations': [...baseOperations, 'fs:read', 'fs:write', 'fs:list'],
      'code-analysis': [...baseOperations, 'analyze:code', 'generate:docs'],
      documentation: [...baseOperations, 'write:docs', 'generate:docs'],
      testing: [...baseOperations, 'execute:tests', 'generate:tests'],
      research: [...baseOperations, 'network:search', 'analyze:data'],
      'system-admin': [...baseOperations, 'system:info', 'system:monitor'],
    };

    let operations = specializationOperations[specialization] || baseOperations;

    // Filter based on restrictions
    if (restrictions.readOnlyMode) {
      operations = operations.filter((op) => !op.includes('write') && !op.includes('execute'));
    }

    if (!restrictions.networkAccess) {
      operations = operations.filter((op) => !op.includes('network'));
    }

    if (!restrictions.systemAccess) {
      operations = operations.filter((op) => !op.includes('system'));
    }

    return operations;
  }

  private createSecurityBoundaries(restrictions: SecurityRestrictions): string[] {
    const boundaries: string[] = [];

    if (restrictions.readOnlyMode) {
      boundaries.push('mode:readonly');
    }

    if (restrictions.networkAccess) {
      boundaries.push('network:allowed');
    }

    if (restrictions.systemAccess) {
      boundaries.push('system:allowed');
    }

    for (const tool of restrictions.blockedTools) {
      boundaries.push(`tool:blocked:${tool}`);
    }

    for (const command of restrictions.blockedCommands) {
      boundaries.push(`command:blocked:${command}`);
    }

    return boundaries;
  }
}
