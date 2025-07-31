/**
 * Context Manager - Type Definitions
 * 
 * Core types for context management, security isolation, and environment control
 */

/**
 * Application context for global execution environment
 */
export interface AppContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly workspaceId?: string;
  readonly currentDirectory: string;
  readonly environment: ReadonlyMap<string, string>;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Conversation context for interaction tracking
 */
export interface ConversationContext {
  readonly id: string;
  readonly parentId?: string;
  readonly type: 'main' | 'sub-agent' | 'tool';
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly messages: readonly ContextMessage[];
  readonly restrictions: SecurityRestrictions;
  readonly allowedOperations: readonly string[];
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Context message for conversation tracking
 */
export interface ContextMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: Date;
  readonly metadata?: ReadonlyMap<string, unknown>;
}

/**
 * Isolated context for secure sub-agent execution
 */
export interface IsolatedContext {
  readonly id: string;
  readonly parentContextId: string;
  readonly task: string;
  readonly allowedOperations: readonly string[];
  readonly allowedPaths: readonly string[];
  readonly timeLimit: number;
  readonly memoryLimit: number;
  readonly boundaries: readonly string[];
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/**
 * Security restrictions for context isolation
 */
export interface SecurityRestrictions {
  readonly readOnlyMode: boolean;
  readonly allowedPaths: readonly string[];
  readonly blockedCommands: readonly string[];
  readonly blockedTools: readonly string[];
  readonly requireApproval: boolean;
  readonly maxExecutionTime: number;
  readonly maxMemoryUsage: number;
  readonly networkAccess: boolean;
  readonly systemAccess: boolean;
}

/**
 * Agent specialization types for context configuration
 */
export type AgentSpecialization = 
  | 'general'
  | 'file-operations'
  | 'code-analysis'
  | 'documentation'
  | 'testing'
  | 'research'
  | 'system-admin';

/**
 * Configuration for creating isolated contexts
 */
export interface IsolatedContextConfig {
  readonly parentContextId: string;
  readonly task: string;
  readonly specialization: AgentSpecialization;
  readonly restrictions: SecurityRestrictions;
  readonly timeLimit?: number;
  readonly memoryLimit?: number;
}

/**
 * Context access audit entry
 */
export interface ContextAccessAudit {
  readonly contextId: string;
  readonly operation: string;
  readonly allowed: boolean;
  readonly timestamp: Date;
  readonly reason?: string;
}