#!/usr/bin/env node

/**
 * State Manager Demo
 * 
 * Demonstrates the state manager functionality:
 * - Configuration management
 * - Model management
 * - Mode management
 * - Context management
 * - Session management
 */

import { createStateManager, type IStateManager } from '../../state/index.js';

async function demonstrateStateManager(): Promise<void> {
  console.log('🔧 State Manager Demo');
  console.log('=====================\n');

  const stateManager: IStateManager = createStateManager();

  // Test configuration
  console.log('📋 Configuration Management:');
  console.log('Initial config:', stateManager.getConfig());
  
  stateManager.updateConfig({ 
    enableDebugMode: true,
    maxHistorySize: 50 
  });
  console.log('Updated config:', stateManager.getConfig());
  console.log('');

  // Test model management
  console.log('🧠 Model Management:');
  console.log('Current model:', stateManager.getCurrentModel());
  console.log('Available models:', stateManager.getAvailableModels().map(m => `${m.id} (${m.name})`));
  
  stateManager.setCurrentModel('groq');
  console.log('Changed to model:', stateManager.getCurrentModel());
  console.log('');

  // Test mode management
  console.log('⚡ Mode Management:');
  console.log('Current mode:', stateManager.getCurrentMode());
  
  stateManager.setCurrentMode('planning');
  console.log('Changed to mode:', stateManager.getCurrentMode());
  
  stateManager.setCurrentMode('executing');
  console.log('Changed to mode:', stateManager.getCurrentMode());
  console.log('');

  // Test context management
  console.log('📍 Context Management:');
  const context = stateManager.getContext();
  console.log('Session ID:', context.sessionId);
  console.log('Current directory:', context.currentDirectory);
  
  stateManager.updateContext({
    workspaceId: 'demo-workspace',
    metadata: new Map([['demo', true]])
  });
  console.log('Updated context workspace:', stateManager.getContext().workspaceId);
  console.log('');

  // Test session management
  console.log('💾 Session Management:');
  const session = stateManager.getCurrentSession();
  console.log('Session ID:', session.id);
  console.log('Created at:', session.createdAt.toISOString());
  console.log('History length:', session.conversationHistory.length);
  
  // Add conversation entries
  stateManager.addConversationEntry({
    type: 'user_input',
    content: 'Hello, how are you?',
    metadata: new Map([['demo', true]])
  });
  
  stateManager.addConversationEntry({
    type: 'agent_response',
    content: 'I am doing well, thank you!',
    metadata: new Map([['model', 'groq']])
  });
  
  const updatedSession = stateManager.getCurrentSession();
  console.log('Updated history length:', updatedSession.conversationHistory.length);
  console.log('Last entry:', updatedSession.conversationHistory[updatedSession.conversationHistory.length - 1]);
  console.log('');

  // Test state change notifications
  console.log('🔔 State Change Notifications:');
  const unsubscribe = stateManager.subscribe((change) => {
    console.log(`  Change: ${change.type}.${change.field} = ${change.newValue}`);
  });
  
  stateManager.setCurrentModel('ollama');
  stateManager.setCurrentMode('ready');
  
  unsubscribe();
  console.log('');

  // Test complete state
  console.log('🌍 Complete State:');
  const state = stateManager.getState();
  console.log('Model:', state.currentModel);
  console.log('Mode:', state.currentMode);
  console.log('Session entries:', state.session.conversationHistory.length);
  console.log('Config version:', state.config.version);
  console.log('');

  console.log('✅ State Manager demo completed successfully!');
}

if (import.meta.main) {
  demonstrateStateManager().catch(console.error);
}