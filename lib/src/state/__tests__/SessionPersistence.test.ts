/**
 * Test Enhanced Session Persistence functionality
 */

import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConversationEntry, type SessionData } from '../abstractions/IStateManager.js';
import { StateManager } from '../impl/StateManager.js';

describe('Enhanced Session Persistence', () => {
  let stateManager: StateManager;
  let testDbPath: string;

  beforeEach(() => {
    // Use unique database for each test
    testDbPath = `./test-sessions-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;

    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    stateManager = new StateManager();
  });

  afterEach(async () => {
    // Clean up test database
    if (stateManager) {
      stateManager.stop();
    }

    // Wait a bit for database to close properly
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }

    // Also clean up the default data directory database that might be created
    const defaultDbPath = './data/sessions.db';
    if (existsSync(defaultDbPath)) {
      unlinkSync(defaultDbPath);
    }
  });

  it('should persist and load session data', async () => {
    const sessionId = randomUUID();

    // Create test session data
    const testSessionData: SessionData = {
      id: sessionId,
      userId: 'test-user',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      conversationHistory: [
        {
          id: randomUUID(),
          timestamp: new Date(),
          type: 'user_input',
          content: 'Hello, how are you?',
          metadata: new Map(),
        },
        {
          id: randomUUID(),
          timestamp: new Date(),
          type: 'agent_response',
          content: 'I am doing well, thank you!',
          metadata: new Map(),
        },
      ],
      context: {
        sessionId,
        currentDirectory: process.cwd(),
        environment: new Map(),
        metadata: new Map(),
      },
      metadata: new Map(),
    };

    // Persist the session
    await stateManager.persistSession(sessionId, testSessionData);

    // Load the session back
    const loadedSession = await stateManager.loadPersistedSession(sessionId);

    expect(loadedSession).toBeTruthy();
    expect(loadedSession?.id).toBe(sessionId);
    expect(loadedSession?.userId).toBe('test-user');
    expect(loadedSession?.conversationHistory).toHaveLength(2);
    expect(loadedSession?.conversationHistory[0].content).toBe('Hello, how are you?');
    expect(loadedSession?.conversationHistory[1].content).toBe('I am doing well, thank you!');
  });

  it('should list sessions correctly', async () => {
    const sessionId1 = randomUUID();
    const sessionId2 = randomUUID();

    const testSession1: SessionData = {
      id: sessionId1,
      userId: 'user1',
      createdAt: new Date(Date.now() - 1000),
      lastActiveAt: new Date(Date.now() - 500),
      conversationHistory: [
        {
          id: randomUUID(),
          timestamp: new Date(),
          type: 'user_input',
          content: 'First session message',
          metadata: new Map(),
        },
      ],
      context: {
        sessionId: sessionId1,
        currentDirectory: process.cwd(),
        environment: new Map(),
        metadata: new Map(),
      },
      metadata: new Map(),
    };

    const testSession2: SessionData = {
      id: sessionId2,
      userId: 'user2',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      conversationHistory: [
        {
          id: randomUUID(),
          timestamp: new Date(),
          type: 'user_input',
          content: 'Second session message',
          metadata: new Map(),
        },
        {
          id: randomUUID(),
          timestamp: new Date(),
          type: 'agent_response',
          content: 'Second session response',
          metadata: new Map(),
        },
      ],
      context: {
        sessionId: sessionId2,
        currentDirectory: process.cwd(),
        environment: new Map(),
        metadata: new Map(),
      },
      metadata: new Map(),
    };

    // Persist both sessions
    await stateManager.persistSession(sessionId1, testSession1);
    await stateManager.persistSession(sessionId2, testSession2);

    // List all sessions
    const sessions = await stateManager.listSessions();

    expect(sessions).toHaveLength(2);
    expect(sessions[0].messageCount).toBe(2); // More recent session should be first
    expect(sessions[1].messageCount).toBe(1);

    // List sessions for specific user
    const user1Sessions = await stateManager.listSessions('user1');
    expect(user1Sessions).toHaveLength(1);
    expect(user1Sessions[0].id).toBe(sessionId1);
  });

  it('should handle context memory operations', () => {
    // Set context memory
    stateManager.setContextMemory('test_key', { value: 'test_data', timestamp: Date.now() });
    stateManager.setContextMemory('another_key', 'simple_string');

    // Get context memory
    const testData = stateManager.getContextMemory('test_key');
    const stringData = stateManager.getContextMemory('another_key');
    const nonExistent = stateManager.getContextMemory('non_existent');

    expect(testData).toEqual({ value: 'test_data', timestamp: expect.any(Number) });
    expect(stringData).toBe('simple_string');
    expect(nonExistent).toBeUndefined();

    // Get memory keys
    const keys = stateManager.getContextMemoryKeys();
    expect(keys).toContain('test_key');
    expect(keys).toContain('another_key');
    expect(keys).toHaveLength(2);
  });

  it('should delete sessions correctly', async () => {
    const sessionId = randomUUID();

    const testSession: SessionData = {
      id: sessionId,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      conversationHistory: [],
      context: {
        sessionId,
        currentDirectory: process.cwd(),
        environment: new Map(),
        metadata: new Map(),
      },
      metadata: new Map(),
    };

    // Persist session
    await stateManager.persistSession(sessionId, testSession);

    // Verify it exists
    let loadedSession = await stateManager.loadPersistedSession(sessionId);
    expect(loadedSession).toBeTruthy();

    // Delete session
    await stateManager.deleteSession(sessionId);

    // Verify it's gone
    loadedSession = await stateManager.loadPersistedSession(sessionId);
    expect(loadedSession).toBeNull();
  });

  it('should return null for non-existent session', async () => {
    const nonExistentId = randomUUID();
    const result = await stateManager.loadPersistedSession(nonExistentId);
    expect(result).toBeNull();
  });
});
