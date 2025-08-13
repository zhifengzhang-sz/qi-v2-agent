/**
 * State Manager Implementation
 *
 * Passive data store for application configuration, state, and context.
 * Internal to state module - other modules cannot access this directly.
 */

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fromAsyncTryCatch, match, type QiError, type Result, validationError } from '@qi/base';
import { ConfigBuilder } from '@qi/core';
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

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AppConfig = {
  version: '0.2.7',
  defaultModel: 'ollama',
  availableModels: ['ollama', 'groq', 'openai'],
  enableDebugMode: false,
  maxHistorySize: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  preferences: new Map(),
};

/**
 * Default models
 */
const DEFAULT_MODELS: ModelInfo[] = [
  {
    id: 'ollama',
    name: 'Ollama (qwen2.5:7b)',
    provider: 'ollama',
    available: true,
    description: 'Local Ollama model',
  },
  {
    id: 'groq',
    name: 'Groq (llama-3.1-70b)',
    provider: 'groq',
    available: false,
    description: 'Fast inference via Groq',
  },
  {
    id: 'openai',
    name: 'OpenAI (gpt-4)',
    provider: 'openai',
    available: false,
    description: 'OpenAI GPT-4',
  },
];

/**
 * State Manager implementation
 */
export class StateManager implements IStateManager {
  private config: AppConfig;
  private currentModel: string;
  private currentMode: AppMode;
  private context: AppContext;
  private session: SessionData;
  private models: Map<string, ModelInfo>;
  private listeners: Set<StateChangeListener> = new Set();
  private logger: SimpleLogger;

  // LLM configuration
  private llmConfig: any = null;
  private classifierConfig: LLMRoleConfig | null = null;
  private promptConfig: LLMRoleConfig | null = null;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.currentModel = DEFAULT_CONFIG.defaultModel;
    this.currentMode = 'ready';

    // Initialize QiCore logger
    this.logger = createQiLogger({
      level: 'info',
      name: 'StateManager',
      pretty: true,
    });

    // Initialize models
    this.models = new Map();
    for (const model of DEFAULT_MODELS) {
      this.models.set(model.id, model);
    }

    // Initialize context
    this.context = {
      sessionId: randomUUID(),
      currentDirectory: process.cwd(),
      environment: new Map(
        Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]
      ),
      metadata: new Map(),
    };

    // Initialize session
    this.session = this.createSession();
  }

  // Configuration management
  getConfig(): AppConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AppConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };

    this.notifyChange({
      type: 'config',
      field: 'config',
      oldValue: oldConfig,
      newValue: this.config,
      timestamp: new Date(),
    });
  }

  resetConfig(): void {
    const oldConfig = { ...this.config };
    this.config = { ...DEFAULT_CONFIG };

    this.notifyChange({
      type: 'config',
      field: 'config',
      oldValue: oldConfig,
      newValue: this.config,
      timestamp: new Date(),
    });
  }

  // LLM configuration management (qicore internal, simple interface for agent)
  async loadLLMConfig(configPath: string): Promise<void> {
    const result = await fromAsyncTryCatch(
      async () => {
        const configFilePath = join(configPath, 'llm-providers.yaml');
        const schemaFilePath = join(configPath, 'llm-providers.schema.json');

        const builderResult = await ConfigBuilder.fromYamlFile(configFilePath);
        const config = match(
          (builder: unknown) =>
            match(
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
                .validateWithSchemaFile(schemaFilePath)
                .build()
            ),
          (error: QiError) => {
            throw new Error(`Config loading failed: ${error.message}`);
          },
          builderResult
        );

        // Extract LLM config using proper pattern
        const llmSection = match(
          (section: any) => section,
          (error: QiError) => {
            throw new Error(`LLM config not found: ${error.message}`);
          },
          (config as { get: (key: string) => Result<any, QiError> }).get('llm')
        );

        this.llmConfig = { llm: llmSection };

        // Extract classifier configuration from validated config
        if (this.llmConfig.llm?.classifier) {
          this.classifierConfig = {
            provider: this.llmConfig.llm.classifier.provider,
            model: this.llmConfig.llm.classifier.model,
            temperature: this.llmConfig.llm.classifier.temperature,
            maxTokens: this.llmConfig.llm.classifier.maxTokens,
          };
        }

        // Extract prompt configuration from validated config
        if (this.llmConfig.llm?.prompt) {
          this.promptConfig = {
            provider:
              this.llmConfig.llm.prompt.defaultProvider || this.llmConfig.llm.defaultProvider,
            model: this.llmConfig.llm.prompt.currentModel,
            temperature:
              this.llmConfig.llm.providers?.[
                this.llmConfig.llm.prompt.defaultProvider || this.llmConfig.llm.defaultProvider
              ]?.models?.[0]?.defaultParameters?.temperature,
            maxTokens:
              this.llmConfig.llm.providers?.[
                this.llmConfig.llm.prompt.defaultProvider || this.llmConfig.llm.defaultProvider
              ]?.models?.[0]?.defaultParameters?.max_tokens,
          };

          // CRITICAL FIX: Synchronize currentModel with promptConfig.model during initialization
          if (this.promptConfig.model) {
            this.currentModel = this.promptConfig.model;
          }
        }

        // Update app config with the config path
        this.updateConfig({ configPath });

        this.notifyChange({
          type: 'config',
          field: 'llmConfig',
          oldValue: null,
          newValue: this.llmConfig,
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
    return this.classifierConfig ? { ...this.classifierConfig } : null;
  }

  getPromptConfig(): LLMRoleConfig | null {
    return this.promptConfig ? { ...this.promptConfig } : null;
  }

  updatePromptModel(model: string): void {
    if (!this.promptConfig) {
      throw new Error('Prompt configuration not loaded');
    }

    const availableModels = this.getAvailablePromptModels();
    if (!availableModels.includes(model)) {
      throw new Error(`Model '${model}' not available for prompts`);
    }

    const oldConfig = { ...this.promptConfig };
    this.promptConfig = { ...this.promptConfig, model };

    // Also update the current model to keep it in sync
    const _oldCurrentModel = this.currentModel;
    this.currentModel = model;

    // Update the underlying config
    if (this.llmConfig?.llm?.prompt) {
      this.llmConfig.llm.prompt.currentModel = model;
    }

    this.notifyChange({
      type: 'config',
      field: 'promptModel',
      oldValue: oldConfig,
      newValue: this.promptConfig,
      timestamp: new Date(),
    });
  }

  updatePromptMaxTokens(maxTokens: number): void {
    if (!this.promptConfig) {
      throw new Error('Prompt configuration not loaded');
    }

    if (maxTokens < 1 || maxTokens > 32768) {
      throw new Error('Max tokens must be between 1 and 32768');
    }

    const oldConfig = { ...this.promptConfig };
    this.promptConfig = { ...this.promptConfig, maxTokens };

    // Update the underlying config if possible
    if (this.llmConfig?.llm?.providers?.[this.promptConfig.provider]?.models) {
      // Find the current model in the provider's models and update its maxTokens
      const models = this.llmConfig.llm.providers[this.promptConfig.provider].models;
      const currentModel = models.find((m: any) => m.name === this.promptConfig?.model);
      if (currentModel?.defaultParameters) {
        currentModel.defaultParameters.max_tokens = maxTokens;
      }
    }

    this.notifyChange({
      type: 'config',
      field: 'promptMaxTokens',
      oldValue: oldConfig,
      newValue: this.promptConfig,
      timestamp: new Date(),
    });
  }

  getAvailablePromptModels(): readonly string[] {
    if (!this.llmConfig?.llm?.providers || !this.promptConfig?.provider) {
      return [];
    }

    // Get models for the current provider
    const currentProvider = this.promptConfig.provider;
    const providerConfig = this.llmConfig.llm.providers[currentProvider];

    if (!providerConfig?.models) {
      return [];
    }

    // Return model names for the current provider
    return providerConfig.models.map((model: any) => model.name);
  }

  updatePromptProvider(provider: string): void {
    if (!this.promptConfig) {
      throw new Error('Prompt configuration not loaded');
    }
    const availableProviders = this.getAvailablePromptProviders();
    if (!availableProviders.includes(provider)) {
      throw new Error(`Provider '${provider}' not available for prompts`);
    }
    const oldConfig = { ...this.promptConfig };

    // Get available models for the new provider (before updating this.promptConfig)
    const providerConfig = this.llmConfig?.llm?.providers?.[provider];
    const availableModels = providerConfig?.models?.map((model: any) => model.name) || [];
    const newModel = availableModels.length > 0 ? availableModels[0] : this.promptConfig.model;

    this.promptConfig = {
      ...this.promptConfig,
      provider,
      model: newModel,
    };

    this.currentModel = newModel;

    // Update the underlying config
    if (this.llmConfig?.llm?.prompt) {
      this.llmConfig.llm.prompt.currentModel = newModel;
    }

    // Emit state change
    this.notifyChange({
      type: 'config',
      field: 'promptProvider',
      oldValue: oldConfig,
      newValue: this.promptConfig,
      timestamp: new Date(),
    });
  }

  getAvailablePromptProviders(): readonly string[] {
    if (!this.llmConfig?.llm?.providers) {
      return [];
    }
    // Return list of enabled providers
    return Object.keys(this.llmConfig.llm.providers).filter(
      (providerId) => this.llmConfig?.llm?.providers?.[providerId]?.enabled === true
    );
  }

  /**
   * Extract LLMConfig structure that the prompt module expects
   * This removes our classifier/prompt sections and returns the traditional structure
   */
  getLLMConfigForPromptModule(): any | null {
    if (!this.llmConfig?.llm) {
      return null;
    }

    // Return the LLMConfig structure the prompt module expects
    // Remove our custom classifier/prompt sections
    const { classifier, prompt, ...llmCore } = this.llmConfig.llm;

    return {
      llm: llmCore,
    };
  }

  // Model management
  getCurrentModel(): string {
    return this.currentModel;
  }

  setCurrentModel(modelId: string): void {
    if (!this.models.has(modelId)) {
      throw new Error(`Model '${modelId}' not found`);
    }

    const oldModel = this.currentModel;
    this.currentModel = modelId;

    this.notifyChange({
      type: 'model',
      field: 'currentModel',
      oldValue: oldModel,
      newValue: modelId,
      timestamp: new Date(),
    });
  }

  getAvailableModels(): readonly ModelInfo[] {
    return Array.from(this.models.values());
  }

  getModelInfo(modelId: string): ModelInfo | null {
    return this.models.get(modelId) || null;
  }

  addModel(model: ModelInfo): void {
    this.models.set(model.id, model);

    this.notifyChange({
      type: 'model',
      field: 'models',
      oldValue: null,
      newValue: model,
      timestamp: new Date(),
    });
  }

  removeModel(modelId: string): void {
    const model = this.models.get(modelId);
    if (model) {
      this.models.delete(modelId);

      // If this was the current model, switch to default
      if (this.currentModel === modelId) {
        this.setCurrentModel(this.config.defaultModel);
      }

      this.notifyChange({
        type: 'model',
        field: 'models',
        oldValue: model,
        newValue: null,
        timestamp: new Date(),
      });
    }
  }

  // Mode management
  getCurrentMode(): AppMode {
    return this.currentMode;
  }

  setCurrentMode(mode: AppMode): void {
    const oldMode = this.currentMode;
    this.currentMode = mode;

    this.notifyChange({
      type: 'mode',
      field: 'currentMode',
      oldValue: oldMode,
      newValue: mode,
      timestamp: new Date(),
    });
  }

  // Context management
  getContext(): AppContext {
    return { ...this.context };
  }

  updateContext(updates: Partial<AppContext>): void {
    const oldContext = { ...this.context };
    this.context = { ...this.context, ...updates };

    this.notifyChange({
      type: 'context',
      field: 'context',
      oldValue: oldContext,
      newValue: this.context,
      timestamp: new Date(),
    });
  }

  resetContext(): void {
    const oldContext = { ...this.context };
    this.context = {
      sessionId: randomUUID(),
      currentDirectory: process.cwd(),
      environment: new Map(
        Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]
      ),
      metadata: new Map(),
    };

    this.notifyChange({
      type: 'context',
      field: 'context',
      oldValue: oldContext,
      newValue: this.context,
      timestamp: new Date(),
    });
  }

  // Session management
  getCurrentSession(): SessionData {
    return { ...this.session };
  }

  createSession(userId?: string): SessionData {
    const now = new Date();
    const newSession: SessionData = {
      id: randomUUID(),
      userId,
      createdAt: now,
      lastActiveAt: now,
      conversationHistory: [],
      context: this.getContext(),
      metadata: new Map(),
    };

    this.session = newSession;

    this.notifyChange({
      type: 'session',
      field: 'session',
      oldValue: null,
      newValue: newSession,
      timestamp: new Date(),
    });

    return { ...newSession };
  }

  loadSession(_sessionId: string): SessionData | null {
    // TODO: Implement session persistence
    // For now, just return null (session not found)
    return null;
  }

  saveSession(): void {
    // Update the session with new lastActiveAt timestamp
    this.session = {
      ...this.session,
      lastActiveAt: new Date(),
    };

    // TODO: Implement session persistence
  }

  addConversationEntry(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void {
    const newEntry: ConversationEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      ...entry,
    };

    const updatedHistory = [...this.session.conversationHistory, newEntry];

    // Limit history size
    if (updatedHistory.length > this.config.maxHistorySize) {
      updatedHistory.splice(0, updatedHistory.length - this.config.maxHistorySize);
    }

    this.session = {
      ...this.session,
      conversationHistory: updatedHistory,
      lastActiveAt: new Date(),
    };

    this.notifyChange({
      type: 'session',
      field: 'conversationHistory',
      oldValue: null,
      newValue: newEntry,
      timestamp: new Date(),
    });
  }

  clearConversationHistory(): void {
    const oldHistory = this.session.conversationHistory;
    this.session = {
      ...this.session,
      conversationHistory: [],
      lastActiveAt: new Date(),
    };

    this.notifyChange({
      type: 'session',
      field: 'conversationHistory',
      oldValue: oldHistory,
      newValue: [],
      timestamp: new Date(),
    });
  }

  // State persistence
  async save(): Promise<void> {
    // TODO: Implement state persistence to file system
    // For now, this is a no-op
  }

  async load(): Promise<void> {
    // TODO: Implement state loading from file system
    // For now, this is a no-op
  }

  // State change notifications
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

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

  // Utility methods
  getState() {
    return {
      config: this.getConfig(),
      currentModel: this.getCurrentModel(),
      currentMode: this.getCurrentMode(),
      context: this.getContext(),
      session: this.getCurrentSession(),
    };
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.currentModel = DEFAULT_CONFIG.defaultModel;
    this.currentMode = 'ready';
    this.resetContext();
    this.session = this.createSession();

    // Clear all models and re-add defaults
    this.models.clear();
    for (const model of DEFAULT_MODELS) {
      this.models.set(model.id, model);
    }

    this.notifyChange({
      type: 'config',
      field: 'reset',
      oldValue: null,
      newValue: null,
      timestamp: new Date(),
    });
  }
}
