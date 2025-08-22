/**
 * XState v5-based State Manager Implementation
 *
 * Modern state management using XState v5 actors while maintaining
 * the existing IStateManager interface for compatibility.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  create,
  failure,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
  validationError,
} from '@qi/base';
import { ConfigBuilder } from '@qi/core';
// REMOVED: import { Database } from 'sqlite3'; - Using MCP memory server instead
import { createActor } from 'xstate';
// NEW: Add MCP imports for unified storage architecture
import type { MCPServiceManager } from '../../mcp/MCPServiceManager.js';
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
  // REMOVED: private database: Database | null = null; - Using MCP memory server instead
  private contextMemory: Map<string, any> = new Map();
  private serviceManager: MCPServiceManager; // NEW: MCP dependency for unified storage

  constructor(serviceManager: MCPServiceManager) {
    // Initialize QiCore logger first
    this.logger = createQiLogger({
      level: 'info',
      name: 'StateManager',
      pretty: true,
    });

    // Store MCP service manager for unified storage architecture
    this.serviceManager = serviceManager;

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

    // REMOVED: Initialize enhanced session database - Now using MCP memory server
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
        // Handle both directory path and full file path
        let configFilePath: string;
        let actualSchemaFilePath: string;

        if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
          // Full file path provided
          configFilePath = configPath;
          // Derive schema path from config path
          const basePath = configPath.replace(/\.ya?ml$/, '');
          actualSchemaFilePath = `${basePath}.schema.json`;
        } else {
          // Directory path provided (original design)
          configFilePath = join(configPath, 'llm-providers.yaml');
          actualSchemaFilePath = join(configPath, 'llm-providers.schema.json');
        }

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

  async save(): Promise<Result<void, QiError>> {
    this.actor.send({ type: 'SAVE_STATE' });

    // Save current state to persistence using proper QiCore patterns
    const currentContext = this.actor.getSnapshot().context;
    const result = await StatePersistence.saveState(currentContext);

    // Log but return the Result for proper functional composition
    match(
      () => {
        this.logger.info('Agent state saved to persistence');
      },
      (error) => {
        this.logger.error('Failed to save agent state', {
          error: error.message,
          errorCode: error.code,
          category: error.category,
        });
      },
      result
    );

    return result;
  }

  async load(): Promise<Result<void, QiError>> {
    this.actor.send({ type: 'LOAD_STATE' });

    // Load state from persistence using proper QiCore patterns
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
        return success(undefined);
      },
      (error): Result<void, QiError> => {
        this.logger.error('Failed to load agent state', {
          error: error.message,
          errorCode: error.code,
          category: error.category,
        });
        return failure(error);
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

  async persistSession(sessionId: string, data: SessionData): Promise<Result<void, QiError>> {
    // Persist to MCP memory server using proper QiCore patterns
    const result = await this.saveSessionToMCP(sessionId, data);

    // Use match() to log but return the Result for caller to handle
    match(
      () => {
        this.logger.info(`Session ${sessionId} persisted to MCP memory server`);
      },
      (error) => {
        this.logger.error(`Failed to persist session ${sessionId}`, {
          error: error.message,
          sessionId,
          errorCode: error.code,
          category: error.category,
        });
      },
      result
    );

    return result; // Return Result<void, QiError> for proper functional composition
  }

  /**
   * Save session data to MCP memory server using proper QiCore patterns
   */
  private async saveSessionToMCP(
    sessionId: string,
    data: SessionData
  ): Promise<Result<void, QiError>> {
    // Check MCP availability first
    if (!this.serviceManager.isConnected('memory')) {
      return failure(create('MCP_UNAVAILABLE', 'Memory service not connected', 'SYSTEM'));
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      return failure(create('MCP_CLIENT_UNAVAILABLE', 'Memory client not available', 'SYSTEM'));
    }

    // Use fromAsyncTryCatch for proper Promise→Result conversion
    return fromAsyncTryCatch(
      async () => {
        const summary = this.generateSessionSummary(data);

        // Store session as entity in MCP memory server
        await client.callTool({
          name: 'create_entities',
          arguments: {
            entities: [
              {
                name: `session_${sessionId}`,
                entityType: 'session',
                observations: [
                  JSON.stringify({
                    ...data,
                    summary,
                    sessionId,
                    persistedAt: new Date().toISOString(),
                  }),
                ],
              },
            ],
          },
        });

        return undefined; // Success value
      },
      (error) =>
        create(
          'SESSION_SAVE_FAILED',
          `Failed to save session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { sessionId, errorDetails: error }
        )
    );
  }

  async loadPersistedSession(sessionId: string): Promise<Result<SessionData | null, QiError>> {
    // Load from MCP memory server using proper QiCore patterns
    return fromAsyncTryCatch(
      async (): Promise<SessionData | null> => {
        const sessionData = await this.loadSessionFromMCP(sessionId);

        if (sessionData) {
          this.logger.info(`Session ${sessionId} loaded from MCP memory server`);
        } else {
          this.logger.info(`Session ${sessionId} not found in MCP memory server`);
        }

        return sessionData;
      },
      (error) =>
        create(
          'LOAD_SESSION_FAILED',
          `Failed to load session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { sessionId, errorDetails: error }
        )
    );
  }

  /**
   * Load session data from MCP memory server using proper QiCore patterns
   */
  private async loadSessionFromMCP(sessionId: string): Promise<SessionData | null> {
    // Check MCP availability first
    if (!this.serviceManager.isConnected('memory')) {
      this.logger.warn('Memory service not connected - session loading unavailable');
      return null; // Graceful degradation
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      this.logger.warn('Memory client not available - session loading unavailable');
      return null;
    }

    // Use fromAsyncTryCatch for proper Promise→Result conversion
    const loadResult = await fromAsyncTryCatch(
      async (): Promise<SessionData | null> => {
        const result = await client.callTool({
          name: 'search_nodes',
          arguments: { query: `session_${sessionId}` },
        });

        if (Array.isArray(result.content) && result.content[0]?.text) {
          const searchData = JSON.parse(result.content[0].text);
          if (searchData.entities?.[0]?.observations?.[0]) {
            const sessionData = JSON.parse(searchData.entities[0].observations[0]);
            // Remove the extra metadata we added during persistence
            delete sessionData.summary;
            delete sessionData.sessionId;
            delete sessionData.persistedAt;
            return sessionData as SessionData;
          }
        }
        return null;
      },
      (error) =>
        create(
          'SESSION_LOAD_FAILED',
          `Failed to load session: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { sessionId, errorDetails: error }
        )
    );

    // Use match() for proper functional handling
    return match(
      (sessionData) => sessionData,
      (error) => {
        this.logger.warn('Failed to load session from MCP memory server', {
          sessionId,
          error: error.message,
          errorCode: error.code,
          category: error.category,
        });
        return null; // Graceful degradation
      },
      loadResult
    );
  }

  async listSessions(userId?: string): Promise<Result<SessionSummary[], QiError>> {
    // List sessions from MCP memory server using proper QiCore patterns
    if (!this.serviceManager.isConnected('memory')) {
      this.logger.warn('Memory service not connected - session listing unavailable');
      return success([]); // Graceful degradation - return empty list as success
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      this.logger.warn('Memory client not available - session listing unavailable');
      return success([]); // Graceful degradation - return empty list as success
    }

    // Use fromAsyncTryCatch for proper Promise→Result conversion
    return fromAsyncTryCatch(
      async (): Promise<SessionSummary[]> => {
        // Search for all session entities
        const result = await client.callTool({
          name: 'search_nodes',
          arguments: { query: 'session_' },
        });

        const summaries: SessionSummary[] = [];

        if (Array.isArray(result.content) && result.content[0]?.text) {
          const searchData = JSON.parse(result.content[0].text);
          if (searchData.entities) {
            for (const entity of searchData.entities) {
              if (entity.entityType === 'session' && entity.observations?.[0]) {
                try {
                  const sessionData = JSON.parse(entity.observations[0]);

                  // Filter by userId if specified
                  if (userId && sessionData.userId !== userId) {
                    continue;
                  }

                  summaries.push({
                    id: sessionData.sessionId || entity.name.replace('session_', ''),
                    userId: sessionData.userId,
                    createdAt: new Date(sessionData.createdAt),
                    lastActiveAt: new Date(sessionData.lastActiveAt),
                    messageCount: sessionData.conversationHistory?.length || 0,
                    summary:
                      sessionData.summary ||
                      `Session started ${new Date(sessionData.createdAt).toLocaleDateString()}`,
                  });
                } catch (parseError) {
                  this.logger.warn('Failed to parse session data:', parseError);
                }
              }
            }
          }
        }

        // Sort by last activity (most recent first)
        summaries.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());

        return summaries;
      },
      (error) =>
        create(
          'LIST_SESSIONS_FAILED',
          `Failed to list sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { userId, errorDetails: error }
        )
    );
  }

  async deleteSession(sessionId: string): Promise<Result<void, QiError>> {
    // Delete session from MCP memory server using proper QiCore patterns
    if (!this.serviceManager.isConnected('memory')) {
      return failure(
        create(
          'MCP_UNAVAILABLE',
          'Memory service not connected - session deletion unavailable',
          'SYSTEM'
        )
      );
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      return failure(
        create(
          'MCP_CLIENT_UNAVAILABLE',
          'Memory client not available - session deletion unavailable',
          'SYSTEM'
        )
      );
    }

    // Use fromAsyncTryCatch for proper Promise→Result conversion
    return fromAsyncTryCatch(
      async () => {
        // Note: MCP memory server doesn't have a direct delete operation
        // We would need to implement this when MCP memory server supports deletion
        // For now, we'll log a warning and return success
        this.logger.warn(
          `Session deletion not yet implemented for MCP memory server: ${sessionId}`
        );
        // TODO: Implement when MCP memory server supports entity deletion
        return undefined; // Success value
      },
      (error) =>
        create(
          'SESSION_DELETE_FAILED',
          `Session deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { sessionId, errorDetails: error }
        )
    );
  }

  // ==========================================================================
  // Context memory management
  // ==========================================================================

  setContextMemory(key: string, value: any): Result<void, QiError> {
    try {
      this.contextMemory.set(key, value);

      // Also persist to MCP memory server asynchronously (don't block)
      this.saveContextMemoryToMCP(key, value).catch((error) => {
        this.logger.error(`Failed to persist context memory key ${key}:`, error.message);
      });

      return success(undefined);
    } catch (error) {
      return failure(
        create(
          'CONTEXT_MEMORY_SET_FAILED',
          `Failed to set context memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { key, errorDetails: error }
        )
      );
    }
  }

  /**
   * Save context memory to MCP memory server using proper QiCore patterns
   */
  private async saveContextMemoryToMCP(key: string, value: any): Promise<void> {
    if (!this.serviceManager.isConnected('memory')) {
      return; // Graceful degradation - only store in local memory
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      return;
    }

    // Use fromAsyncTryCatch for proper Promise→Result conversion
    const saveResult = await fromAsyncTryCatch(
      async () => {
        await client.callTool({
          name: 'create_entities',
          arguments: {
            entities: [
              {
                name: `context_memory_${key}`,
                entityType: 'context_memory',
                observations: [
                  JSON.stringify({
                    key,
                    value,
                    accessedAt: new Date().toISOString(),
                  }),
                ],
              },
            ],
          },
        });
        return undefined; // Success value
      },
      (error) =>
        create(
          'CONTEXT_MEMORY_SAVE_FAILED',
          `Failed to persist context memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { key, errorDetails: error }
        )
    );

    // Use match() for proper functional handling
    match(
      () => {
        // Success - no action needed
      },
      (error) => {
        this.logger.warn('Failed to persist context memory to MCP', {
          key,
          error: error.message,
          errorCode: error.code,
          category: error.category,
        });
      },
      saveResult
    );
  }

  getContextMemory(key: string): any {
    // Return from local memory only (synchronous access)
    // NOTE: For MCP loading, use loadContextMemoryFromMCP() separately
    return this.contextMemory.get(key);
  }

  /**
   * Load context memory from MCP memory server using proper QiCore patterns
   * This should be called during initialization to populate local memory
   */
  async loadContextMemoryFromMCP(key: string): Promise<any> {
    if (!this.serviceManager.isConnected('memory')) {
      return undefined; // Graceful degradation
    }

    const client = this.serviceManager.getClient('memory');
    if (!client) {
      return undefined;
    }

    // Use fromAsyncTryCatch for proper Promise→Result conversion
    const loadResult = await fromAsyncTryCatch(
      async (): Promise<any> => {
        const result = await client.callTool({
          name: 'search_nodes',
          arguments: { query: `context_memory_${key}` },
        });

        if (Array.isArray(result.content) && result.content[0]?.text) {
          const searchData = JSON.parse(result.content[0].text);
          if (searchData.entities?.[0]?.observations?.[0]) {
            const memoryData = JSON.parse(searchData.entities[0].observations[0]);
            const value = memoryData.value;

            // Store in local memory for fast access
            this.contextMemory.set(key, value);

            return value;
          }
        }
        return undefined;
      },
      (error) =>
        create(
          'CONTEXT_MEMORY_LOAD_FAILED',
          `Failed to load context memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { key, errorDetails: error }
        )
    );

    // Use match() for proper functional handling
    return match(
      (value) => value,
      (error) => {
        this.logger.warn('Failed to load context memory from MCP', {
          key,
          error: error.message,
          errorCode: error.code,
          category: error.category,
        });
        return undefined; // Graceful degradation
      },
      loadResult
    );
  }

  clearOldContextMemory(maxAge: number): Result<void, QiError> {
    try {
      // Clear from local memory map
      const cutoffTime = Date.now() - maxAge;

      // For now, just clear all local memory (simple approach)
      // TODO: Implement timestamp tracking and selective clearing
      this.contextMemory.clear();

      // NOTE: MCP memory server doesn't have a built-in way to delete old context
      // This would need to be implemented when MCP supports bulk operations
      this.logger.info(`Cleared local context memory (maxAge: ${maxAge}ms)`);

      return success(undefined);
    } catch (error) {
      return failure(
        create(
          'CLEAR_CONTEXT_MEMORY_FAILED',
          `Failed to clear context memory: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'SYSTEM',
          { maxAge, errorDetails: error }
        )
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

    // REMOVED: Database connection closing - Now using MCP memory server
    this.logger.info('StateManager stopped');
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

  // REMOVED: SQLite database initialization methods
  // - initializeSessionDatabase(): Now using MCP memory server
  // - initializeDatabaseSchema(): Database schema not needed for MCP

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
