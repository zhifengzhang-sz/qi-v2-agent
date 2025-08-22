/**
 * XState v5-based State Manager Implementation
 *
 * Modern state management using XState v5 actors while maintaining
 * the existing IStateManager interface for compatibility.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromAsyncTryCatch, match, type QiError, type Result, validationError } from '@qi/base';
import { ConfigBuilder } from '@qi/core';
import { Database } from 'sqlite3';
import { createActor } from 'xstate';
import { createQiLogger, logError, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type {
  AppConfig,
  AppContext,
  AppMode,
  ConversationEntry,
  IStateManager,
  LLMRoleConfig,
  ModelInfo,
  SessionData,
  SessionSummary,
  StateChange,
  StateChangeListener,
} from '../abstractions/index.js';
import {
  type AgentStateActor,
  type AgentStateContext,
  agentStateMachine,
  createInitialAgentContext,
  getAgentStateDescription,
} from '../machines/index.js';
import { initializePersistence, StatePersistence } from '../persistence/index.js';

/**
 * XState v5-based State Manager implementation
 */
export class StateManager implements IStateManager {
  private actor: AgentStateActor;
  private listeners: Set<StateChangeListener> = new Set();
  private logger: SimpleLogger;
  private database: Database | null = null;
  private contextMemory: Map<string, any> = new Map();

  constructor() {
    // Initialize QiCore logger
    this.logger = createQiLogger({
      level: 'info',
      name: 'StateManager',
      pretty: true,
    });

    // Initialize persistence system
    this.initializePersistence();

    // Create and start the XState actor
    this.actor = createActor(agentStateMachine, {
      input: createInitialAgentContext(),
    });

    // Subscribe to state changes and notify listeners
    this.actor.subscribe((snapshot) => {
      // Always notify on state transitions
      this.notifyStateChange(snapshot.context);
    });

    // Start the actor
    this.actor.start();

    // Initialize enhanced session database
    this.initializeSessionDatabase();
  }

  // ==========================================================================
  // Configuration management
  // ==========================================================================

  getConfig(): AppConfig {
    return { ...this.actor.getSnapshot().context.config };
  }

  updateConfig(updates: Partial<AppConfig>): void {
    const oldConfig = this.getConfig();
    this.actor.send({ type: 'UPDATE_CONFIG', updates });

    this.notifyChange({
      type: 'config',
      field: 'config',
      oldValue: oldConfig,
      newValue: this.getConfig(),
      timestamp: new Date(),
    });
  }

  resetConfig(): void {
    const oldConfig = this.getConfig();
    this.actor.send({ type: 'RESET_CONFIG' });

    this.notifyChange({
      type: 'config',
      field: 'config',
      oldValue: oldConfig,
      newValue: this.getConfig(),
      timestamp: new Date(),
    });
  }

  // ==========================================================================
  // LLM configuration management
  // ==========================================================================

  async loadLLMConfig(configPath: string): Promise<void> {
    const result = await fromAsyncTryCatch(
      async () => {
        // Construct file paths from directory path (original design)
        const configFilePath = join(configPath, 'llm-providers.yaml');
        const actualSchemaFilePath = join(configPath, 'llm-providers.schema.json');

        const builderResult = await ConfigBuilder.fromYamlFile(configFilePath);
        const config = match(
          (builder: unknown) => {
            return match(
              (validatedConfig: unknown) => validatedConfig,
              (error: QiError) => {
                throw new Error(`Config validation failed: ${error.message}`);
              },
              (
                builder as {
                  validateWithSchemaFile: (path: string) => {
                    build: () => Result<unknown, QiError>;
                  };
                }
              )
                .validateWithSchemaFile(actualSchemaFilePath)
                .build()
            );
          },
          (error: QiError) => {
            throw new Error(`Config loading failed: ${error.message}`);
          },
          builderResult
        );

        // Extract LLM config using proper pattern
        const configData = config as any;

        // The config is wrapped in a state.data structure after validation
        const actualConfig = configData.state?.data || configData;

        if (!actualConfig.llm) {
          throw new Error(
            `LLM config section not found in configuration file: ${configFilePath}. Available keys: ${Object.keys(actualConfig).join(', ')}`
          );
        }
        const llmSection = actualConfig.llm;

        // Update the state machine with loaded config
        const { classifierConfig, promptConfig } = this.extractLLMConfigs({ llm: llmSection });
        this.actor.send({
          type: 'SET_LLM_CONFIG',
          llmConfig: { llm: llmSection },
          classifierConfig,
          promptConfig,
        });

        // Update app config with the config file path
        this.updateConfig({ configPath: configFilePath });

        this.notifyChange({
          type: 'config',
          field: 'llmConfig',
          oldValue: null,
          newValue: { llm: llmSection },
          timestamp: new Date(),
        });

        return void 0;
      },
      (error: unknown) =>
        validationError(
          `LLM config loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
    );

    // Convert Result<T> to simple Promise<void> for agent layer
    return match(
      () => Promise.resolve(),
      (error: QiError) => Promise.reject(new Error(error.message)),
      result
    );
  }

  getClassifierConfig(): LLMRoleConfig | null {
    const context = this.actor.getSnapshot().context;
    return context.classifierConfig ? { ...context.classifierConfig } : null;
  }

  getPromptConfig(): LLMRoleConfig | null {
    const context = this.actor.getSnapshot().context;
    return context.promptConfig ? { ...context.promptConfig } : null;
  }

  updatePromptModel(model: string): void {
    const availableModels = this.getAvailablePromptModels();
    if (!availableModels.includes(model)) {
      throw new Error(`Model '${model}' not available for prompts`);
    }

    const oldConfig = this.getPromptConfig();
    this.actor.send({ type: 'UPDATE_PROMPT_MODEL', model });

    this.notifyChange({
      type: 'config',
      field: 'promptModel',
      oldValue: oldConfig,
      newValue: this.getPromptConfig(),
      timestamp: new Date(),
    });
  }

  updatePromptMaxTokens(maxTokens: number): void {
    if (maxTokens < 1 || maxTokens > 32768) {
      throw new Error('Max tokens must be between 1 and 32768');
    }

    const oldConfig = this.getPromptConfig();
    this.actor.send({ type: 'UPDATE_PROMPT_MAX_TOKENS', maxTokens });

    this.notifyChange({
      type: 'config',
      field: 'promptMaxTokens',
      oldValue: oldConfig,
      newValue: this.getPromptConfig(),
      timestamp: new Date(),
    });
  }

  updatePromptProvider(provider: string): void {
    const availableProviders = this.getAvailablePromptProviders();
    if (!availableProviders.includes(provider)) {
      throw new Error(`Provider '${provider}' not available for prompts`);
    }

    const oldConfig = this.getPromptConfig();
    this.actor.send({ type: 'UPDATE_PROMPT_PROVIDER', provider });

    this.notifyChange({
      type: 'config',
      field: 'promptProvider',
      oldValue: oldConfig,
      newValue: this.getPromptConfig(),
      timestamp: new Date(),
    });
  }

  getAvailablePromptModels(): readonly string[] {
    const context = this.actor.getSnapshot().context;
    if (!context.llmConfig?.llm?.providers || !context.promptConfig?.provider) {
      return [];
    }

    // Get models for the current provider
    const currentProvider = context.promptConfig.provider;
    const providerConfig = context.llmConfig.llm.providers[currentProvider];

    if (!providerConfig?.models) {
      return [];
    }

    // Return model names for the current provider
    return providerConfig.models.map((model: any) => model.name);
  }

  getAvailablePromptProviders(): readonly string[] {
    const context = this.actor.getSnapshot().context;
    if (!context.llmConfig?.llm?.providers) {
      return [];
    }
    // Return list of enabled providers
    return Object.keys(context.llmConfig.llm.providers).filter(
      (providerId) => context.llmConfig?.llm?.providers?.[providerId]?.enabled === true
    );
  }

  getLLMConfigForPromptModule(): any | null {
    const context = this.actor.getSnapshot().context;
    if (!context.llmConfig?.llm) {
      return null;
    }

    // Return the LLMConfig structure the prompt module expects
    // Remove our custom classifier/prompt sections
    const { classifier, prompt, ...llmCore } = context.llmConfig.llm;

    return {
      llm: llmCore,
    };
  }

  // ==========================================================================
  // Model management
  // ==========================================================================

  getCurrentModel(): string {
    return this.actor.getSnapshot().context.currentModel;
  }

  setCurrentModel(modelId: string): void {
    const context = this.actor.getSnapshot().context;
    if (!context.models.has(modelId)) {
      throw new Error(`Model '${modelId}' not found`);
    }

    const oldModel = this.getCurrentModel();
    this.actor.send({ type: 'SET_CURRENT_MODEL', modelId });

    this.notifyChange({
      type: 'model',
      field: 'currentModel',
      oldValue: oldModel,
      newValue: modelId,
      timestamp: new Date(),
    });
  }

  getAvailableModels(): readonly ModelInfo[] {
    const context = this.actor.getSnapshot().context;
    return Array.from(context.models.values());
  }

  getModelInfo(modelId: string): ModelInfo | null {
    const context = this.actor.getSnapshot().context;
    return context.models.get(modelId) || null;
  }

  addModel(model: ModelInfo): void {
    this.actor.send({ type: 'ADD_MODEL', model });

    this.notifyChange({
      type: 'model',
      field: 'models',
      oldValue: null,
      newValue: model,
      timestamp: new Date(),
    });
  }

  removeModel(modelId: string): void {
    const context = this.actor.getSnapshot().context;
    const model = context.models.get(modelId);
    if (model) {
      this.actor.send({ type: 'REMOVE_MODEL', modelId });

      this.notifyChange({
        type: 'model',
        field: 'models',
        oldValue: model,
        newValue: null,
        timestamp: new Date(),
      });
    }
  }

  // ==========================================================================
  // Mode management
  // ==========================================================================

  getCurrentMode(): AppMode {
    return this.actor.getSnapshot().context.currentMode;
  }

  setCurrentMode(mode: AppMode): void {
    const oldMode = this.getCurrentMode();
    this.actor.send({ type: 'SET_MODE', mode });

    this.notifyChange({
      type: 'mode',
      field: 'currentMode',
      oldValue: oldMode,
      newValue: mode,
      timestamp: new Date(),
    });
  }

  // ==========================================================================
  // Context management
  // ==========================================================================

  getContext(): AppContext {
    return { ...this.actor.getSnapshot().context.context };
  }

  updateContext(updates: Partial<AppContext>): void {
    const oldContext = this.getContext();
    this.actor.send({ type: 'UPDATE_CONTEXT', updates });

    this.notifyChange({
      type: 'context',
      field: 'context',
      oldValue: oldContext,
      newValue: this.getContext(),
      timestamp: new Date(),
    });
  }

  resetContext(): void {
    const oldContext = this.getContext();
    this.actor.send({ type: 'RESET_CONTEXT' });

    this.notifyChange({
      type: 'context',
      field: 'context',
      oldValue: oldContext,
      newValue: this.getContext(),
      timestamp: new Date(),
    });
  }

  // ==========================================================================
  // Session management
  // ==========================================================================

  getCurrentSession(): SessionData {
    return { ...this.actor.getSnapshot().context.session };
  }

  createSession(userId?: string): SessionData {
    this.actor.send({ type: 'CREATE_SESSION', userId });
    const newSession = this.getCurrentSession();

    this.notifyChange({
      type: 'session',
      field: 'session',
      oldValue: null,
      newValue: newSession,
      timestamp: new Date(),
    });

    return { ...newSession };
  }

  loadSession(sessionId: string): SessionData | null {
    // Use synchronous approach for interface compatibility
    // The actual loading will be done asynchronously in background
    StatePersistence.loadSession(sessionId)
      .then((result) => {
        match(
          (sessionData) => {
            if (sessionData) {
              // TODO: Implement proper session restoration in state machine
              this.logger.info(`Session ${sessionId} loaded from persistence`);
            }
          },
          (error) => {
            this.logger.error(`Failed to load session ${sessionId}:`, error.message);
          },
          result
        );
      })
      .catch((error) => {
        this.logger.error(`Failed to load session ${sessionId}:`, error);
      });

    return null; // Return null for now, async loading happens in background
  }

  saveSession(): void {
    this.actor.send({ type: 'SAVE_SESSION' });

    // Save current session to persistence
    const currentSession = this.getCurrentSession();
    StatePersistence.saveSession(currentSession).then((result) => {
      match(
        () => {
          this.logger.info(`Session ${currentSession.id} saved to persistence`);
        },
        (error) => {
          this.logger.error(`Failed to save session ${currentSession.id}:`, error.message);
        },
        result
      );
    });
  }

  addConversationEntry(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void {
    this.actor.send({ type: 'ADD_CONVERSATION_ENTRY', entry });

    this.notifyChange({
      type: 'session',
      field: 'conversationHistory',
      oldValue: null,
      newValue: entry,
      timestamp: new Date(),
    });
  }

  clearConversationHistory(): void {
    const context = this.actor.getSnapshot().context;
    const oldHistory = context.session.conversationHistory;
    this.actor.send({ type: 'CLEAR_CONVERSATION_HISTORY' });

    this.notifyChange({
      type: 'session',
      field: 'conversationHistory',
      oldValue: oldHistory,
      newValue: [],
      timestamp: new Date(),
    });
  }

  // ==========================================================================
  // State persistence
  // ==========================================================================

  async save(): Promise<void> {
    this.actor.send({ type: 'SAVE_STATE' });

    // Save current state to persistence
    const currentContext = this.actor.getSnapshot().context;
    const result = await StatePersistence.saveState(currentContext);

    return match(
      () => {
        this.logger.info('Agent state saved to persistence');
        return Promise.resolve();
      },
      (error) => {
        this.logger.error('Failed to save agent state:', error.message);
        return Promise.reject(new Error(error.message));
      },
      result
    );
  }

  async load(): Promise<void> {
    this.actor.send({ type: 'LOAD_STATE' });

    // Load state from persistence
    const result = await StatePersistence.loadState();

    return match(
      (persistedState) => {
        if (persistedState) {
          // TODO: Implement proper state restoration in state machine
          // For now, we just log that state was found
          this.logger.info(`Agent state loaded from persistence (${persistedState.timestamp})`);
        } else {
          // No saved state found, continue with default state
          this.logger.info('No saved agent state found, using defaults');
        }
        return Promise.resolve();
      },
      (error) => {
        this.logger.error('Failed to load agent state:', error.message);
        return Promise.reject(new Error(error.message));
      },
      result
    );
  }

  // ==========================================================================
  // State change notifications
  // ==========================================================================

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ==========================================================================
  // Utility methods
  // ==========================================================================

  getState() {
    const context = this.actor.getSnapshot().context;
    return {
      config: this.getConfig(),
      currentModel: context.currentModel,
      currentMode: context.currentMode,
      context: this.getContext(),
      session: this.getCurrentSession(),
    };
  }

  reset(): void {
    this.actor.send({ type: 'RESET_ALL' });

    this.notifyChange({
      type: 'config',
      field: 'reset',
      oldValue: null,
      newValue: null,
      timestamp: new Date(),
    });
  }

  // ==========================================================================
  // Enhanced session persistence
  // ==========================================================================

  async persistSession(sessionId: string, data: SessionData): Promise<void> {
    if (!this.database) {
      throw new Error('Session database not initialized');
    }

    return new Promise((resolve, reject) => {
      const stmt = this.database!.prepare(`
        INSERT OR REPLACE INTO sessions 
        (id, user_id, start_time, last_activity, message_count, session_data, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const summary = this.generateSessionSummary(data);

      stmt.run(
        sessionId,
        data.userId || null,
        data.createdAt.toISOString(),
        data.lastActiveAt.toISOString(),
        data.conversationHistory.length,
        JSON.stringify(data),
        summary,
        (err: Error | null) => {
          if (err) {
            this.logger.error(`Failed to persist session ${sessionId}:`, err.message);
            reject(err);
          } else {
            this.logger.info(`Session ${sessionId} persisted successfully`);
            resolve();
          }
        }
      );

      stmt.finalize();
    });
  }

  async loadPersistedSession(sessionId: string): Promise<SessionData | null> {
    if (!this.database) {
      throw new Error('Session database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.database!.get(
        'SELECT session_data FROM sessions WHERE id = ?',
        [sessionId],
        (err: Error | null, row: any) => {
          if (err) {
            this.logger.error(`Failed to load session ${sessionId}:`, err.message);
            reject(err);
          } else if (row) {
            try {
              const sessionData: SessionData = JSON.parse(row.session_data);
              this.logger.info(`Session ${sessionId} loaded successfully`);
              resolve(sessionData);
            } catch (parseError) {
              this.logger.error(`Failed to parse session data for ${sessionId}:`, parseError);
              reject(parseError);
            }
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  async listSessions(userId?: string): Promise<SessionSummary[]> {
    if (!this.database) {
      throw new Error('Session database not initialized');
    }

    return new Promise((resolve, reject) => {
      const query = userId
        ? 'SELECT id, user_id, start_time, last_activity, message_count, summary FROM sessions WHERE user_id = ? ORDER BY last_activity DESC'
        : 'SELECT id, user_id, start_time, last_activity, message_count, summary FROM sessions ORDER BY last_activity DESC';

      const params = userId ? [userId] : [];

      this.database!.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) {
          this.logger.error('Failed to list sessions:', err.message);
          reject(err);
        } else {
          const summaries: SessionSummary[] = rows.map((row) => ({
            id: row.id,
            userId: row.user_id,
            createdAt: new Date(row.start_time),
            lastActiveAt: new Date(row.last_activity),
            messageCount: row.message_count,
            summary:
              row.summary || `Session started ${new Date(row.start_time).toLocaleDateString()}`,
          }));
          resolve(summaries);
        }
      });
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.database) {
      throw new Error('Session database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.database!.run('DELETE FROM sessions WHERE id = ?', [sessionId], (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // ==========================================================================
  // Context memory management
  // ==========================================================================

  setContextMemory(key: string, value: any): void {
    this.contextMemory.set(key, value);

    // Also persist to database
    if (this.database) {
      const stmt = this.database.prepare(`
        INSERT OR REPLACE INTO context_memory (key, value, accessed_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(key, JSON.stringify(value), (err: Error | null) => {
        if (err) {
          this.logger.error(`Failed to persist context memory key ${key}:`, err.message);
        }
      });

      stmt.finalize();
    }
  }

  getContextMemory(key: string): any {
    const memoryValue = this.contextMemory.get(key);
    if (memoryValue !== undefined) {
      return memoryValue;
    }

    // Try to load from database if not in memory
    if (this.database) {
      this.database.get(
        'SELECT value FROM context_memory WHERE key = ?',
        [key],
        (err: Error | null, row: any) => {
          if (!err && row) {
            try {
              const value = JSON.parse(row.value);
              this.contextMemory.set(key, value);

              // Update access time
              this.database!.run(
                'UPDATE context_memory SET accessed_at = CURRENT_TIMESTAMP WHERE key = ?',
                [key]
              );
            } catch (parseError) {
              this.logger.error(`Failed to parse context memory value for ${key}:`, parseError);
            }
          }
        }
      );
    }

    return undefined;
  }

  clearOldContextMemory(maxAge: number): void {
    // Clear from memory map
    const cutoffTime = Date.now() - maxAge;
    for (const [key, value] of this.contextMemory.entries()) {
      // Simple heuristic: remove if not accessed recently
      // In practice, you'd track access times
      this.contextMemory.delete(key);
    }

    // Clear from database
    if (this.database) {
      const cutoffDate = new Date(cutoffTime).toISOString();
      this.database.run(
        'DELETE FROM context_memory WHERE accessed_at < ?',
        [cutoffDate],
        (err: Error | null) => {
          if (err) {
            console.error('Failed to clear old context memory:', err.message);
          }
        }
      );
    }
  }

  getContextMemoryKeys(): string[] {
    return Array.from(this.contextMemory.keys());
  }

  // ==========================================================================
  // Private helper methods
  // ==========================================================================

  private notifyChange(change: StateChange): void {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        logError(this.logger, error, {
          component: 'StateManager',
          method: 'notifyChange',
          changeType: change.type,
          changeField: change.field,
          errorContext: 'state_change_listener_failed',
        });
      }
    }
  }

  private notifyStateChange(context: AgentStateContext): void {
    // Log state changes for debugging
    this.logger.info(`State changed: ${getAgentStateDescription(context)}`);
  }

  private extractLLMConfigs(llmConfig: any): {
    classifierConfig: LLMRoleConfig | null;
    promptConfig: LLMRoleConfig | null;
  } {
    // Extract classifier configuration from validated config
    let classifierConfig: LLMRoleConfig | null = null;
    if (llmConfig.llm?.classifier) {
      classifierConfig = {
        provider: llmConfig.llm.classifier.provider,
        model: llmConfig.llm.classifier.model,
        temperature: llmConfig.llm.classifier.temperature,
        maxTokens: llmConfig.llm.classifier.maxTokens,
      };
    }

    // Extract prompt configuration from validated config
    let promptConfig: LLMRoleConfig | null = null;
    if (llmConfig.llm?.prompt) {
      promptConfig = {
        provider: llmConfig.llm.prompt.defaultProvider || llmConfig.llm.defaultProvider,
        model: llmConfig.llm.prompt.currentModel,
        temperature:
          llmConfig.llm.providers?.[
            llmConfig.llm.prompt.defaultProvider || llmConfig.llm.defaultProvider
          ]?.models?.[0]?.defaultParameters?.temperature,
        maxTokens:
          llmConfig.llm.providers?.[
            llmConfig.llm.prompt.defaultProvider || llmConfig.llm.defaultProvider
          ]?.models?.[0]?.defaultParameters?.max_tokens,
      };

      // Synchronize currentModel with promptConfig.model during initialization
      if (promptConfig.model) {
        this.actor.send({ type: 'SET_CURRENT_MODEL', modelId: promptConfig.model });
      }
    }

    return { classifierConfig, promptConfig };
  }

  // ==========================================================================
  // Debug methods
  // ==========================================================================

  /**
   * Get current state machine snapshot for debugging
   */
  getDebugSnapshot() {
    const snapshot = this.actor.getSnapshot();
    return {
      value: snapshot.value,
      context: snapshot.context,
      can: (eventType: keyof typeof snapshot.can) => snapshot.can({ type: eventType as any }),
      description: getAgentStateDescription(snapshot.context),
    };
  }

  /**
   * Stop the state manager (cleanup)
   */
  stop(): void {
    this.actor.stop();
    this.listeners.clear();

    // Close database connection
    if (this.database) {
      this.database.close((err) => {
        if (err) {
          this.logger.error('Error closing session database:', err.message);
        } else {
          this.logger.info('Session database closed');
        }
      });
    }
  }

  // ==========================================================================
  // Private initialization methods
  // ==========================================================================

  private async initializePersistence(): Promise<void> {
    try {
      const result = await initializePersistence();
      match(
        () => {
          this.logger.info('Persistence system initialized');
        },
        (error) => {
          this.logger.error('Failed to initialize persistence:', error.message);
        },
        result
      );
    } catch (error) {
      this.logger.error('Failed to initialize persistence:', error);
    }
  }

  private initializeSessionDatabase(): void {
    try {
      // Create data directory if it doesn't exist
      const dataDir = './data';
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }
      const dbPath = join(dataDir, 'sessions.db');

      // Create database connection
      this.database = new Database(dbPath, (err) => {
        if (err) {
          this.logger.error('Failed to open session database:', err.message);
          return;
        }

        this.logger.info(`Session database connected: ${dbPath}`);

        // Initialize database schema
        this.initializeDatabaseSchema();
      });
    } catch (error) {
      this.logger.error('Failed to initialize session database:', error);
    }
  }

  private initializeDatabaseSchema(): void {
    if (!this.database) return;

    try {
      // Execute schema statements in sequence to ensure proper order
      const tableStatements = [
        `CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          start_time DATETIME NOT NULL,
          last_activity DATETIME NOT NULL,
          message_count INTEGER DEFAULT 0,
          session_data TEXT NOT NULL,
          summary TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS context_memory (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS conversation_entries (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          timestamp DATETIME NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('user_input', 'agent_response', 'system_message')),
          content TEXT NOT NULL,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      ];

      const indexStatements = [
        `CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity)`,
        `CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time)`,
        `CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_context_memory_accessed ON context_memory(accessed_at)`,
        `CREATE INDEX IF NOT EXISTS idx_conversation_session_id ON conversation_entries(session_id)`,
        `CREATE INDEX IF NOT EXISTS idx_conversation_timestamp ON conversation_entries(timestamp)`,
      ];

      // Execute table creation statements first
      this.database.serialize(() => {
        for (const statement of tableStatements) {
          this.database!.run(statement, (err) => {
            if (err) {
              this.logger.error('Failed to execute table statement:', err.message);
            }
          });
        }

        // Then execute index creation statements
        for (const statement of indexStatements) {
          this.database!.run(statement, (err) => {
            if (err) {
              this.logger.error('Failed to execute index statement:', err.message);
            }
          });
        }
      });

      this.logger.info('Session database schema initialized');
    } catch (error) {
      this.logger.error('Failed to initialize database schema:', error);
    }
  }

  private generateSessionSummary(data: SessionData): string {
    const messageCount = data.conversationHistory.length;
    if (messageCount === 0) {
      return `Session started ${data.createdAt.toLocaleDateString()}`;
    }

    const lastMessage = data.conversationHistory[messageCount - 1];
    const duration = data.lastActiveAt.getTime() - data.createdAt.getTime();
    const durationMinutes = Math.round(duration / 60000);

    return `${messageCount} messages over ${durationMinutes}m - "${lastMessage.content.substring(0, 50)}${lastMessage.content.length > 50 ? '...' : ''}"`;
  }
}
