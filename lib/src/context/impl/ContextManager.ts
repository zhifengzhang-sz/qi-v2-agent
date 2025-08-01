/**
 * Context Manager Implementation
 *
 * Manages execution contexts, environment isolation, and contextual information flow
 */

import { randomUUID } from 'node:crypto';
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
import { SecurityBoundaryManager } from './SecurityBoundaryManager.js';

/**
 * Main context manager implementation
 */
export class ContextManager implements IContextManager {
  private applicationContext: AppContext;
  private conversationContexts = new Map<string, ConversationContext>();
  private isolatedContexts = new Map<string, IsolatedContext>();
  private securityBoundaries: SecurityBoundaryManager;
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
  }

  async initialize(): Promise<void> {
    // Start cleanup interval for expired contexts
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredContexts(),
      60000 // Every minute
    );
  }

  async shutdown(): Promise<void> {
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
  ): ConversationContext {
    const contextId = this.generateContextId();
    const now = new Date();

    // Validate parent context if specified
    if (parentId && !this.conversationContexts.has(parentId)) {
      throw new Error(`Parent context ${parentId} not found`);
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

    return context;
  }

  getConversationContext(id: string): ConversationContext | null {
    const context = this.conversationContexts.get(id);
    if (!context) {
      return null;
    }

    // Return a deep copy to maintain immutability
    return {
      ...context,
      messages: [...context.messages],
      restrictions: { ...context.restrictions },
      allowedOperations: [...context.allowedOperations],
      metadata: new Map(context.metadata),
    };
  }

  addMessageToContext(contextId: string, message: ContextMessage): void {
    const context = this.conversationContexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    // Create updated context with new message
    const updatedContext: ConversationContext = {
      ...context,
      messages: [...context.messages, message],
    };

    this.conversationContexts.set(contextId, updatedContext);
  }

  updateConversationContext(contextId: string, updates: Partial<ConversationContext>): void {
    const context = this.conversationContexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
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
  }

  // Isolated Context Management

  createIsolatedContext(config: IsolatedContextConfig): IsolatedContext {
    const contextId = this.generateContextId();
    const now = new Date();

    // Validate parent context exists
    if (!this.conversationContexts.has(config.parentContextId)) {
      throw new Error(`Parent context ${config.parentContextId} not found`);
    }

    const isolatedContext: IsolatedContext = {
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

    this.isolatedContexts.set(contextId, isolatedContext);
    this.securityBoundaries.registerContext(contextId, isolatedContext);
    this.stats.totalContextsCreated++;

    return isolatedContext;
  }

  getIsolatedContext(id: string): IsolatedContext | null {
    const context = this.isolatedContexts.get(id);
    if (!context) {
      return null;
    }

    // Return a deep copy
    return {
      ...context,
      allowedOperations: [...context.allowedOperations],
      allowedPaths: [...context.allowedPaths],
      boundaries: [...context.boundaries],
    };
  }

  async validateContextAccess(contextId: string, operation: string): Promise<boolean> {
    const context = this.isolatedContexts.get(contextId);
    if (!context) {
      this.auditContextAccess(contextId, operation, false, 'Context not found');
      return false;
    }

    // Check expiration
    if (new Date() > context.expiresAt) {
      this.terminateContext(contextId);
      this.auditContextAccess(contextId, operation, false, 'Context expired');
      return false;
    }

    // Use security boundary manager for validation
    const allowed = await this.securityBoundaries.validateAccess(contextId, operation);
    this.auditContextAccess(contextId, operation, allowed);

    return allowed;
  }

  terminateContext(contextId: string): void {
    // Remove from active contexts
    this.conversationContexts.delete(contextId);
    this.isolatedContexts.delete(contextId);

    // Clean up security boundaries
    this.securityBoundaries.unregisterContext(contextId);

    // Remove child contexts
    const childContexts = this.getChildContexts(contextId);
    for (const childContext of childContexts) {
      this.terminateContext(childContext.id);
    }
  }

  // Context Lifecycle Management

  async cleanupExpiredContexts(): Promise<number> {
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

  async enforceSecurityBoundaries(contextId: string, operation: string): Promise<boolean> {
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
