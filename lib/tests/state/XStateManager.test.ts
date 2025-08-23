/**
 * XState v5 StateManager Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/state/impl/StateManager.js';
import type { IStateManager, AppConfig, ModelInfo } from '../../src/state/abstractions/index.js';

describe('XState v5 StateManager', () => {
  let stateManager: IStateManager;

  beforeEach(() => {
    stateManager = new StateManager();
  });

  afterEach(() => {
    // Clean up the state manager if it has a stop method
    if ('stop' in stateManager && typeof stateManager.stop === 'function') {
      stateManager.stop();
    }
  });

  describe('Configuration Management', () => {
    it('should have default configuration', () => {
      const config = stateManager.getConfig();
      
      expect(config.version).toBe('0.7.1');
      expect(config.defaultModel).toBe('ollama');
      expect(config.availableModels).toContain('ollama');
      expect(config.enableDebugMode).toBe(false);
      expect(config.maxHistorySize).toBe(100);
    });

    it('should update configuration', () => {
      const updates = {
        enableDebugMode: true,
        maxHistorySize: 200,
      };

      stateManager.updateConfig(updates);
      const config = stateManager.getConfig();

      expect(config.enableDebugMode).toBe(true);
      expect(config.maxHistorySize).toBe(200);
      expect(config.defaultModel).toBe('ollama'); // Should remain unchanged
    });

    it('should reset configuration to defaults', () => {
      // First modify the config
      stateManager.updateConfig({ enableDebugMode: true });
      expect(stateManager.getConfig().enableDebugMode).toBe(true);

      // Then reset
      stateManager.resetConfig();
      const config = stateManager.getConfig();

      expect(config.enableDebugMode).toBe(false);
      expect(config.version).toBe('0.7.1');
    });
  });

  describe('Model Management', () => {
    it('should have default models', () => {
      const models = stateManager.getAvailableModels();
      
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.id === 'ollama')).toBe(true);
      expect(models.some(m => m.id === 'groq')).toBe(true);
      expect(models.some(m => m.id === 'openai')).toBe(true);
    });

    it('should get current model', () => {
      const currentModel = stateManager.getCurrentModel();
      expect(currentModel).toBe('ollama');
    });

    it('should set current model', () => {
      stateManager.setCurrentModel('groq');
      expect(stateManager.getCurrentModel()).toBe('groq');
    });

    it('should add and remove models', () => {
      const newModel: ModelInfo = {
        id: 'test-model',
        name: 'Test Model',
        provider: 'test',
        available: true,
        description: 'A test model',
      };

      // Add model
      stateManager.addModel(newModel);
      const modelInfo = stateManager.getModelInfo('test-model');
      expect(modelInfo).toEqual(newModel);

      // Remove model
      stateManager.removeModel('test-model');
      expect(stateManager.getModelInfo('test-model')).toBeNull();
    });

    it('should throw error when setting non-existent model', () => {
      expect(() => {
        stateManager.setCurrentModel('non-existent');
      }).toThrow("Model 'non-existent' not found");
    });
  });

  describe('Mode Management', () => {
    it('should have default mode', () => {
      expect(stateManager.getCurrentMode()).toBe('ready');
    });

    it('should set mode', () => {
      stateManager.setCurrentMode('planning');
      expect(stateManager.getCurrentMode()).toBe('planning');

      stateManager.setCurrentMode('executing');
      expect(stateManager.getCurrentMode()).toBe('executing');
    });
  });

  describe('Context Management', () => {
    it('should have default context', () => {
      const context = stateManager.getContext();
      
      expect(context.sessionId).toBeDefined();
      expect(context.currentDirectory).toBe(process.cwd());
      expect(context.environment).toBeInstanceOf(Map);
      expect(context.metadata).toBeInstanceOf(Map);
    });

    it('should update context', () => {
      const updates = {
        currentDirectory: '/new/directory',
        metadata: new Map([['key', 'value']]),
      };

      stateManager.updateContext(updates);
      const context = stateManager.getContext();

      expect(context.currentDirectory).toBe('/new/directory');
      expect(context.metadata.get('key')).toBe('value');
    });

    it('should reset context', () => {
      const originalContext = stateManager.getContext();
      
      // Modify context
      stateManager.updateContext({ currentDirectory: '/modified' });
      expect(stateManager.getContext().currentDirectory).toBe('/modified');

      // Reset context
      stateManager.resetContext();
      const resetContext = stateManager.getContext();

      expect(resetContext.currentDirectory).toBe(process.cwd());
      expect(resetContext.sessionId).not.toBe(originalContext.sessionId); // Should be new session ID
    });
  });

  describe('Session Management', () => {
    it('should have default session', () => {
      const session = stateManager.getCurrentSession();
      
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActiveAt).toBeInstanceOf(Date);
      expect(session.conversationHistory).toEqual([]);
      expect(session.metadata).toBeInstanceOf(Map);
    });

    it('should create new session', () => {
      const originalSession = stateManager.getCurrentSession();
      
      const newSession = stateManager.createSession('test-user');
      
      expect(newSession.id).not.toBe(originalSession.id);
      expect(newSession.userId).toBe('test-user');
      expect(newSession.conversationHistory).toEqual([]);
    });

    it('should add conversation entries', () => {
      const entry = {
        type: 'user_input' as const,
        content: 'Hello, world!',
        metadata: new Map([['test', true]]),
      };

      stateManager.addConversationEntry(entry);
      const session = stateManager.getCurrentSession();

      expect(session.conversationHistory).toHaveLength(1);
      const addedEntry = session.conversationHistory[0];
      expect(addedEntry.type).toBe('user_input');
      expect(addedEntry.content).toBe('Hello, world!');
      expect(addedEntry.id).toBeDefined();
      expect(addedEntry.timestamp).toBeInstanceOf(Date);
    });

    it('should clear conversation history', () => {
      // Add some entries
      stateManager.addConversationEntry({
        type: 'user_input',
        content: 'Test 1',
        metadata: new Map(),
      });
      stateManager.addConversationEntry({
        type: 'agent_response',
        content: 'Test 2',
        metadata: new Map(),
      });

      expect(stateManager.getCurrentSession().conversationHistory).toHaveLength(2);

      // Clear history
      stateManager.clearConversationHistory();
      expect(stateManager.getCurrentSession().conversationHistory).toHaveLength(0);
    });
  });

  describe('State Subscriptions', () => {
    it('should notify listeners of state changes', () => {
      let notificationCount = 0;
      let lastChange: any = null;

      const unsubscribe = stateManager.subscribe((change) => {
        notificationCount++;
        lastChange = change;
      });

      // Trigger a state change
      stateManager.updateConfig({ enableDebugMode: true });

      expect(notificationCount).toBeGreaterThan(0);
      expect(lastChange).toBeDefined();
      expect(lastChange.type).toBe('config');

      // Clean up
      unsubscribe();
    });

    it('should stop notifying after unsubscribe', () => {
      let notificationCount = 0;

      const unsubscribe = stateManager.subscribe(() => {
        notificationCount++;
      });

      // Trigger a change
      stateManager.setCurrentMode('planning');
      const countAfterFirst = notificationCount;

      // Unsubscribe and trigger another change
      unsubscribe();
      stateManager.setCurrentMode('editing');

      // Should not have received the second notification
      expect(notificationCount).toBe(countAfterFirst);
    });
  });

  describe('State Persistence', () => {
    it('should have save and load methods', () => {
      expect(typeof stateManager.save).toBe('function');
      expect(typeof stateManager.load).toBe('function');
    });

    it('should save state successfully', async () => {
      const result = await stateManager.save();
      expect(result).toBeDefined();
    });

    it('should load state successfully', async () => {
      const result = await stateManager.load();
      expect(result).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    it('should provide complete state snapshot', () => {
      const state = stateManager.getState();

      expect(state).toHaveProperty('config');
      expect(state).toHaveProperty('currentModel');
      expect(state).toHaveProperty('currentMode');
      expect(state).toHaveProperty('context');
      expect(state).toHaveProperty('session');
    });

    it('should reset all state', () => {
      // Modify various parts of state
      stateManager.updateConfig({ enableDebugMode: true });
      stateManager.setCurrentMode('planning');
      stateManager.addConversationEntry({
        type: 'user_input',
        content: 'Test',
        metadata: new Map(),
      });

      // Reset everything
      stateManager.reset();

      // Verify reset to defaults
      const config = stateManager.getConfig();
      expect(config.enableDebugMode).toBe(false);
      expect(stateManager.getCurrentMode()).toBe('ready');
      expect(stateManager.getCurrentSession().conversationHistory).toHaveLength(0);
    });
  });

  describe('Debug Methods', () => {
    it('should provide debug snapshot when implemented', () => {
      // Check if debug method exists (it's a custom method on our implementation)
      if ('getDebugSnapshot' in stateManager && typeof stateManager.getDebugSnapshot === 'function') {
        const snapshot = stateManager.getDebugSnapshot();
        expect(snapshot).toBeDefined();
        expect(snapshot).toHaveProperty('value');
        expect(snapshot).toHaveProperty('context');
        expect(snapshot).toHaveProperty('description');
      }
    });
  });
});