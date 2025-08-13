/**
 * XState v5 Agent State Machine Definition
 *
 * Manages application-level state: configuration, models, sessions, context
 * Separate from CLI state machine which handles UI interaction states
 */

import { type ActorRefFrom, assign, setup } from 'xstate';
import type {
  AppConfig,
  AppContext,
  AppMode,
  ConversationEntry,
  LLMRoleConfig,
  ModelInfo,
  SessionData,
} from '../abstractions/index.js';

// ============================================================================
// Agent State Machine Events
// ============================================================================

export type AgentStateEvent =
  // Configuration events
  | { type: 'UPDATE_CONFIG'; updates: Partial<AppConfig> }
  | { type: 'RESET_CONFIG' }
  | { type: 'LOAD_LLM_CONFIG'; configPath: string }
  | {
      type: 'SET_LLM_CONFIG';
      llmConfig: any;
      classifierConfig: LLMRoleConfig | null;
      promptConfig: LLMRoleConfig | null;
    }

  // Model events
  | { type: 'SET_CURRENT_MODEL'; modelId: string }
  | { type: 'ADD_MODEL'; model: ModelInfo }
  | { type: 'REMOVE_MODEL'; modelId: string }
  | { type: 'UPDATE_PROMPT_MODEL'; model: string }
  | { type: 'UPDATE_PROMPT_PROVIDER'; provider: string }
  | { type: 'UPDATE_PROMPT_MAX_TOKENS'; maxTokens: number }

  // Mode events
  | { type: 'SET_MODE'; mode: AppMode }

  // Context events
  | { type: 'UPDATE_CONTEXT'; updates: Partial<AppContext> }
  | { type: 'RESET_CONTEXT' }

  // Session events
  | { type: 'CREATE_SESSION'; userId?: string }
  | { type: 'LOAD_SESSION'; sessionId: string }
  | { type: 'SAVE_SESSION' }
  | { type: 'ADD_CONVERSATION_ENTRY'; entry: Omit<ConversationEntry, 'id' | 'timestamp'> }
  | { type: 'CLEAR_CONVERSATION_HISTORY' }

  // State management
  | { type: 'SAVE_STATE' }
  | { type: 'LOAD_STATE' }
  | { type: 'RESET_ALL' };

// ============================================================================
// Agent State Machine Context
// ============================================================================

export interface AgentStateContext {
  // Configuration state
  readonly config: AppConfig;
  readonly llmConfig: any | null;
  readonly classifierConfig: LLMRoleConfig | null;
  readonly promptConfig: LLMRoleConfig | null;

  // Model state
  readonly currentModel: string;
  readonly models: ReadonlyMap<string, ModelInfo>;

  // Application state
  readonly currentMode: AppMode;
  readonly context: AppContext;
  readonly session: SessionData;

  // Error state
  readonly error?: string;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_CONFIG: AppConfig = {
  version: '0.7.1',
  defaultModel: 'ollama',
  availableModels: ['ollama', 'groq', 'openai'],
  enableDebugMode: false,
  maxHistorySize: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  preferences: new Map(),
};

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

// ============================================================================
// Helper Functions
// ============================================================================

function createDefaultContext(): AppContext {
  return {
    sessionId: crypto.randomUUID(),
    currentDirectory: process.cwd(),
    environment: new Map(
      Object.entries(process.env).filter(([_, v]) => v !== undefined) as [string, string][]
    ),
    metadata: new Map(),
  };
}

function createDefaultSession(userId?: string): SessionData {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    userId,
    createdAt: now,
    lastActiveAt: now,
    conversationHistory: [],
    context: createDefaultContext(),
    metadata: new Map(),
  };
}

function createInitialModelsMap(): Map<string, ModelInfo> {
  const modelsMap = new Map<string, ModelInfo>();
  for (const model of DEFAULT_MODELS) {
    modelsMap.set(model.id, model);
  }
  return modelsMap;
}

// ============================================================================
// Agent State Machine Definition
// ============================================================================

const agentStateMachineSetup = setup({
  types: {} as {
    context: AgentStateContext;
    events: AgentStateEvent;
  },
  actions: {
    // Configuration actions
    updateConfig: assign(({ context, event }) => {
      if (event.type === 'UPDATE_CONFIG') {
        return {
          config: { ...context.config, ...event.updates },
        };
      }
      return {};
    }),

    resetConfig: assign({
      config: DEFAULT_CONFIG,
    }),

    setLLMConfig: assign(({ event }) => {
      if (event.type === 'SET_LLM_CONFIG') {
        return {
          llmConfig: event.llmConfig,
          classifierConfig: event.classifierConfig,
          promptConfig: event.promptConfig,
        };
      }
      return {};
    }),

    // Model actions
    setCurrentModel: assign(({ event }) => {
      if (event.type === 'SET_CURRENT_MODEL') {
        return {
          currentModel: event.modelId,
        };
      }
      return {};
    }),

    addModel: assign(({ context, event }) => {
      if (event.type === 'ADD_MODEL') {
        const newModels = new Map(context.models);
        newModels.set(event.model.id, event.model);
        return {
          models: newModels,
        };
      }
      return {};
    }),

    removeModel: assign(({ context, event }) => {
      if (event.type === 'REMOVE_MODEL') {
        const newModels = new Map(context.models);
        newModels.delete(event.modelId);
        return {
          models: newModels,
          // If this was the current model, switch to default
          currentModel:
            context.currentModel === event.modelId
              ? context.config.defaultModel
              : context.currentModel,
        };
      }
      return {};
    }),

    updatePromptModel: assign(({ context, event }) => {
      if (event.type === 'UPDATE_PROMPT_MODEL' && context.promptConfig) {
        return {
          promptConfig: {
            ...context.promptConfig,
            model: event.model,
          },
          currentModel: event.model,
        };
      }
      return {};
    }),

    updatePromptProvider: assign(({ context, event }) => {
      if (event.type === 'UPDATE_PROMPT_PROVIDER' && context.promptConfig) {
        return {
          promptConfig: {
            ...context.promptConfig,
            provider: event.provider,
          },
        };
      }
      return {};
    }),

    updatePromptMaxTokens: assign(({ context, event }) => {
      if (event.type === 'UPDATE_PROMPT_MAX_TOKENS' && context.promptConfig) {
        return {
          promptConfig: {
            ...context.promptConfig,
            maxTokens: event.maxTokens,
          },
        };
      }
      return {};
    }),

    // Mode actions
    setMode: assign(({ event }) => {
      if (event.type === 'SET_MODE') {
        return {
          currentMode: event.mode,
        };
      }
      return {};
    }),

    // Context actions
    updateContext: assign(({ context, event }) => {
      if (event.type === 'UPDATE_CONTEXT') {
        return {
          context: { ...context.context, ...event.updates },
        };
      }
      return {};
    }),

    resetContext: assign({
      context: createDefaultContext(),
    }),

    // Session actions
    createSession: assign(({ event }) => {
      if (event.type === 'CREATE_SESSION') {
        return {
          session: createDefaultSession(event.userId),
        };
      }
      return {};
    }),

    saveSession: assign(({ context }) => ({
      session: {
        ...context.session,
        lastActiveAt: new Date(),
      },
    })),

    addConversationEntry: assign(({ context, event }) => {
      if (event.type === 'ADD_CONVERSATION_ENTRY') {
        const newEntry: ConversationEntry = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          ...event.entry,
        };

        const updatedHistory = [...context.session.conversationHistory, newEntry];

        // Limit history size
        if (updatedHistory.length > context.config.maxHistorySize) {
          updatedHistory.splice(0, updatedHistory.length - context.config.maxHistorySize);
        }

        return {
          session: {
            ...context.session,
            conversationHistory: updatedHistory,
            lastActiveAt: new Date(),
          },
        };
      }
      return {};
    }),

    clearConversationHistory: assign(({ context }) => ({
      session: {
        ...context.session,
        conversationHistory: [],
        lastActiveAt: new Date(),
      },
    })),

    // Reset all state
    resetAll: assign({
      config: DEFAULT_CONFIG,
      llmConfig: null,
      classifierConfig: null,
      promptConfig: null,
      currentModel: DEFAULT_CONFIG.defaultModel,
      models: createInitialModelsMap(),
      currentMode: 'ready' as AppMode,
      context: createDefaultContext(),
      session: createDefaultSession(),
      error: undefined,
    }),

    // Error handling
    setError: assign(({ event }) => ({
      error:
        event.type === 'LOAD_LLM_CONFIG'
          ? `Failed to load LLM config: ${event.configPath}`
          : 'Unknown error',
    })),

    clearError: assign({
      error: undefined,
    }),
  },
});

export const agentStateMachine = agentStateMachineSetup.createMachine({
  id: 'agent',

  initial: 'ready',

  context: {
    config: DEFAULT_CONFIG,
    llmConfig: null,
    classifierConfig: null,
    promptConfig: null,
    currentModel: DEFAULT_CONFIG.defaultModel,
    models: createInitialModelsMap(),
    currentMode: 'ready',
    context: createDefaultContext(),
    session: createDefaultSession(),
  },

  states: {
    // Ready state - normal operation
    ready: {
      on: {
        // Configuration events
        UPDATE_CONFIG: {
          actions: ['updateConfig'],
        },
        RESET_CONFIG: {
          actions: ['resetConfig'],
        },
        LOAD_LLM_CONFIG: {
          target: 'loadingLLMConfig',
        },
        SET_LLM_CONFIG: {
          actions: ['setLLMConfig'],
        },

        // Model events
        SET_CURRENT_MODEL: {
          actions: ['setCurrentModel'],
        },
        ADD_MODEL: {
          actions: ['addModel'],
        },
        REMOVE_MODEL: {
          actions: ['removeModel'],
        },
        UPDATE_PROMPT_MODEL: {
          actions: ['updatePromptModel'],
        },
        UPDATE_PROMPT_PROVIDER: {
          actions: ['updatePromptProvider'],
        },
        UPDATE_PROMPT_MAX_TOKENS: {
          actions: ['updatePromptMaxTokens'],
        },

        // Mode events
        SET_MODE: {
          actions: ['setMode'],
        },

        // Context events
        UPDATE_CONTEXT: {
          actions: ['updateContext'],
        },
        RESET_CONTEXT: {
          actions: ['resetContext'],
        },

        // Session events
        CREATE_SESSION: {
          actions: ['createSession'],
        },
        SAVE_SESSION: {
          actions: ['saveSession'],
        },
        ADD_CONVERSATION_ENTRY: {
          actions: ['addConversationEntry'],
        },
        CLEAR_CONVERSATION_HISTORY: {
          actions: ['clearConversationHistory'],
        },

        // State management
        SAVE_STATE: {
          target: 'savingState',
        },
        LOAD_STATE: {
          target: 'loadingState',
        },
        RESET_ALL: {
          actions: ['resetAll'],
        },
      },
    },

    // Loading LLM config state
    loadingLLMConfig: {
      // This will be implemented when we integrate with actual config loading
      after: {
        100: {
          target: 'ready',
          actions: ['setLLMConfig'],
        },
      },
    },

    // Saving state
    savingState: {
      // This will be implemented when we add persistence
      after: {
        100: {
          target: 'ready',
        },
      },
    },

    // Loading state
    loadingState: {
      // This will be implemented when we add persistence
      after: {
        100: {
          target: 'ready',
        },
      },
    },

    // Error state
    error: {
      entry: ['setError'],
      on: {
        RESET_ALL: {
          target: 'ready',
          actions: ['resetAll', 'clearError'],
        },
      },
    },
  },
});

// ============================================================================
// State Machine Actor Type
// ============================================================================

export type AgentStateActor = ActorRefFrom<typeof agentStateMachine>;

// ============================================================================
// Helper Functions for State Access
// ============================================================================

/**
 * Create initial agent state context
 */
export function createInitialAgentContext(): AgentStateContext {
  return {
    config: DEFAULT_CONFIG,
    llmConfig: null,
    classifierConfig: null,
    promptConfig: null,
    currentModel: DEFAULT_CONFIG.defaultModel,
    models: createInitialModelsMap(),
    currentMode: 'ready',
    context: createDefaultContext(),
    session: createDefaultSession(),
  };
}

/**
 * Get state description for debugging
 */
export function getAgentStateDescription(context: AgentStateContext): string {
  return `Agent State: ${context.currentMode} | Model: ${context.currentModel} | Session: ${context.session.id}`;
}
