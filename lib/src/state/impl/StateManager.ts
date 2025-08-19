/**
 * XState v5-based State Manager Implementation
 *
 * Modern state management using XState v5 actors while maintaining
 * the existing IStateManager interface for compatibility.
 */

import { join } from 'node:path';
import { fromAsyncTryCatch, match, type QiError, type Result, validationError } from '@qi/base';
import { ConfigBuilder } from '@qi/core';
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
}
