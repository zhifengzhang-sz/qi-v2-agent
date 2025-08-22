/**
 * State Manager - Abstract Interfaces
 *
 * Manages application configuration, state, and context.
 * Provides passive data store - no automatic notifications.
 */

// QiCore imports - Essential for proper error handling patterns
import type { QiError, Result } from '@qi/base';

/**
 * Application configuration
 */
export interface AppConfig {
  readonly version: string;
  readonly defaultModel: string;
  readonly availableModels: readonly string[];
  readonly enableDebugMode: boolean;
  readonly maxHistorySize: number;
  readonly sessionTimeout: number;
  readonly preferences: ReadonlyMap<string, unknown>;
  readonly configPath?: string; // Path to LLM configuration directory
}

/**
 * LLM configuration for specific roles
 */
export interface LLMRoleConfig {
  readonly provider: string;
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/**
 * Application mode types
 */
export type AppMode = 'ready' | 'planning' | 'editing' | 'executing' | 'error';

/**
 * Model information
 */
export interface ModelInfo {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly available: boolean;
  readonly description?: string;
}

/**
 * Application context for processing
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
 * Session data
 */
export interface SessionData {
  readonly id: string;
  readonly userId?: string;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly conversationHistory: readonly ConversationEntry[];
  readonly context: AppContext;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Session summary for listing
 */
export interface SessionSummary {
  readonly id: string;
  readonly userId?: string;
  readonly createdAt: Date;
  readonly lastActiveAt: Date;
  readonly messageCount: number;
  readonly summary: string;
}

/**
 * Conversation history entry
 */
export interface ConversationEntry {
  readonly id: string;
  readonly timestamp: Date;
  readonly type: 'user_input' | 'agent_response' | 'system_message';
  readonly content: string;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * State change notification
 */
export interface StateChange {
  readonly type: 'config' | 'model' | 'mode' | 'context' | 'session';
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly timestamp: Date;
}

/**
 * State change listener
 */
export type StateChangeListener = (change: StateChange) => void;

/**
 * State manager interface - passive data store
 */
export interface IStateManager {
  // Configuration management
  getConfig(): AppConfig;
  updateConfig(updates: Partial<AppConfig>): void;
  resetConfig(): void;

  // LLM configuration management
  loadLLMConfig(configPath: string): Promise<void>;
  getClassifierConfig(): LLMRoleConfig | null;
  getPromptConfig(): LLMRoleConfig | null;
  updatePromptModel(model: string): void;
  updatePromptProvider(provider: string): void;
  updatePromptMaxTokens(maxTokens: number): void;
  getAvailablePromptModels(): readonly string[];
  getAvailablePromptProviders(): readonly string[];
  getLLMConfigForPromptModule(): any | null; // Returns LLMConfig structure that prompt module expects

  // Model management
  getCurrentModel(): string;
  setCurrentModel(modelId: string): void;
  getAvailableModels(): readonly ModelInfo[];
  getModelInfo(modelId: string): ModelInfo | null;
  addModel(model: ModelInfo): void;
  removeModel(modelId: string): void;

  // Mode management
  getCurrentMode(): AppMode;
  setCurrentMode(mode: AppMode): void;

  // Context management
  getContext(): AppContext;
  updateContext(updates: Partial<AppContext>): void;
  resetContext(): void;

  // Session management
  getCurrentSession(): SessionData;
  createSession(userId?: string): SessionData;
  loadSession(sessionId: string): SessionData | null;
  saveSession(): void;
  addConversationEntry(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void;
  clearConversationHistory(): void;

  // Enhanced session persistence - QiCore Result<T> patterns
  persistSession(sessionId: string, data: SessionData): Promise<Result<void, QiError>>;
  loadPersistedSession(sessionId: string): Promise<Result<SessionData | null, QiError>>;
  listSessions(userId?: string): Promise<Result<SessionSummary[], QiError>>;
  deleteSession(sessionId: string): Promise<Result<void, QiError>>;

  // Context memory management - QiCore Result<T> patterns for async operations
  setContextMemory(key: string, value: any): Result<void, QiError>; // Synchronous but can fail
  getContextMemory(key: string): any; // Synchronous access to local cache
  loadContextMemoryFromMCP(key: string): Promise<Result<any, QiError>>; // Async MCP loading
  clearOldContextMemory(maxAge: number): Result<void, QiError>;
  getContextMemoryKeys(): string[];

  // State persistence - QiCore Result<T> patterns
  save(): Promise<Result<void, QiError>>;
  load(): Promise<Result<void, QiError>>;

  // Optional: State change notifications (for components that need updates)
  subscribe(listener: StateChangeListener): () => void;

  // Utility methods
  getState(): {
    config: AppConfig;
    currentModel: string;
    currentMode: AppMode;
    context: AppContext;
    session: SessionData;
  };

  reset(): void;
}
