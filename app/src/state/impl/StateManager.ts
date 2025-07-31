/**
 * State Manager Implementation
 * 
 * Passive data store for application configuration, state, and context.
 * Internal to state module - other modules cannot access this directly.
 */

import { randomUUID } from 'node:crypto';
import type {
  IStateManager,
  AppConfig,
  AppMode,
  ModelInfo,
  AppContext,
  SessionData,
  ConversationEntry,
  StateChange,
  StateChangeListener
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
  preferences: new Map()
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
    description: 'Local Ollama model'
  },
  {
    id: 'groq',
    name: 'Groq (llama-3.1-70b)',
    provider: 'groq',
    available: false,
    description: 'Fast inference via Groq'
  },
  {
    id: 'openai',
    name: 'OpenAI (gpt-4)',
    provider: 'openai',
    available: false,
    description: 'OpenAI GPT-4'
  }
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

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.currentModel = DEFAULT_CONFIG.defaultModel;
    this.currentMode = 'ready';
    
    // Initialize models
    this.models = new Map();
    for (const model of DEFAULT_MODELS) {
      this.models.set(model.id, model);
    }
    
    // Initialize context
    this.context = {
      sessionId: randomUUID(),
      currentDirectory: process.cwd(),
      environment: new Map(Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]),
      metadata: new Map()
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
      timestamp: new Date()
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
      timestamp: new Date()
    });
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
      timestamp: new Date()
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
      timestamp: new Date()
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
        timestamp: new Date()
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
      timestamp: new Date()
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
      timestamp: new Date()
    });
  }

  resetContext(): void {
    const oldContext = { ...this.context };
    this.context = {
      sessionId: randomUUID(),
      currentDirectory: process.cwd(),
      environment: new Map(Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]),
      metadata: new Map()
    };
    
    this.notifyChange({
      type: 'context',
      field: 'context',
      oldValue: oldContext,
      newValue: this.context,
      timestamp: new Date()
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
      metadata: new Map()
    };
    
    this.session = newSession;
    
    this.notifyChange({
      type: 'session',
      field: 'session',
      oldValue: null,
      newValue: newSession,
      timestamp: new Date()
    });
    
    return { ...newSession };
  }

  loadSession(sessionId: string): SessionData | null {
    // TODO: Implement session persistence
    // For now, just return null (session not found)
    return null;
  }

  saveSession(): void {
    // Update the session with new lastActiveAt timestamp
    this.session = {
      ...this.session,
      lastActiveAt: new Date()
    };
    
    // TODO: Implement session persistence
  }

  addConversationEntry(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void {
    const newEntry: ConversationEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      ...entry
    };
    
    const updatedHistory = [...this.session.conversationHistory, newEntry];
    
    // Limit history size
    if (updatedHistory.length > this.config.maxHistorySize) {
      updatedHistory.splice(0, updatedHistory.length - this.config.maxHistorySize);
    }
    
    this.session = {
      ...this.session,
      conversationHistory: updatedHistory,
      lastActiveAt: new Date()
    };
    
    this.notifyChange({
      type: 'session',
      field: 'conversationHistory',
      oldValue: null,
      newValue: newEntry,
      timestamp: new Date()
    });
  }

  clearConversationHistory(): void {
    const oldHistory = this.session.conversationHistory;
    this.session = {
      ...this.session,
      conversationHistory: [],
      lastActiveAt: new Date()
    };
    
    this.notifyChange({
      type: 'session',
      field: 'conversationHistory',
      oldValue: oldHistory,
      newValue: [],
      timestamp: new Date()
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
        console.error('State change listener error:', error);
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
      session: this.getCurrentSession()
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
      timestamp: new Date()
    });
  }
}