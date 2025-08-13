/**
 * State Persistence for XState v5 Agent State Manager
 *
 * Provides basic file-based persistence for agent state including sessions
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
  validationError,
} from '@qi/base';
import type { SessionData } from '../abstractions/index.js';
import type { AgentStateContext } from '../machines/index.js';

// ============================================================================
// Persistence Configuration
// ============================================================================

const PERSISTENCE_DIR = join(homedir(), '.qi-agent');
const STATE_FILE = join(PERSISTENCE_DIR, 'agent-state.json');
const SESSIONS_DIR = join(PERSISTENCE_DIR, 'sessions');

// ============================================================================
// Persistence Interface
// ============================================================================

export interface PersistedState {
  readonly timestamp: string;
  readonly version: string;
  readonly context: Partial<AgentStateContext>;
}

export interface PersistedSession {
  readonly timestamp: string;
  readonly sessionData: SessionData;
}

// ============================================================================
// State Persistence Implementation
// ============================================================================

export class StatePersistence {
  /**
   * Initialize persistence directories
   */
  static async initialize(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        await mkdir(PERSISTENCE_DIR, { recursive: true });
        await mkdir(SESSIONS_DIR, { recursive: true });
      },
      (error) => validationError(`Failed to initialize persistence directories: ${error}`)
    );
  }

  /**
   * Save agent state to disk
   */
  static async saveState(context: AgentStateContext): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Only persist serializable parts of the context
        const persistedState: PersistedState = {
          timestamp: new Date().toISOString(),
          version: '0.7.1',
          context: {
            config: context.config,
            currentModel: context.currentModel,
            currentMode: context.currentMode,
            context: context.context,
            // Note: we don't persist models map or LLM configs as they should be reloaded
          },
        };

        const stateJson = JSON.stringify(persistedState, null, 2);
        await writeFile(STATE_FILE, stateJson, 'utf-8');
      },
      (error) => validationError(`Failed to save agent state: ${error}`)
    );
  }

  /**
   * Load agent state from disk
   */
  static async loadState(): Promise<Result<PersistedState | null, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        try {
          const stateJson = await readFile(STATE_FILE, 'utf-8');
          const persistedState = JSON.parse(stateJson) as PersistedState;
          return persistedState;
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            return null; // File doesn't exist, return null
          }
          throw error;
        }
      },
      (error) => validationError(`Failed to load agent state: ${error}`)
    );
  }

  /**
   * Save session to disk
   */
  static async saveSession(session: SessionData): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const persistedSession: PersistedSession = {
          timestamp: new Date().toISOString(),
          sessionData: session,
        };

        const sessionFile = join(SESSIONS_DIR, `${session.id}.json`);
        const sessionJson = JSON.stringify(persistedSession, null, 2);
        await writeFile(sessionFile, sessionJson, 'utf-8');
      },
      (error) => validationError(`Failed to save session ${session.id}: ${error}`)
    );
  }

  /**
   * Load session from disk
   */
  static async loadSession(sessionId: string): Promise<Result<SessionData | null, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        try {
          const sessionFile = join(SESSIONS_DIR, `${sessionId}.json`);
          const sessionJson = await readFile(sessionFile, 'utf-8');
          const persistedSession = JSON.parse(sessionJson) as PersistedSession;
          return persistedSession.sessionData;
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            return null; // Session file doesn't exist
          }
          throw error;
        }
      },
      (error) => validationError(`Failed to load session ${sessionId}: ${error}`)
    );
  }

  /**
   * List all persisted session IDs
   */
  static async listSessions(): Promise<Result<string[], QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const { readdir } = await import('node:fs/promises');
        try {
          const files = await readdir(SESSIONS_DIR);
          return files
            .filter((file) => file.endsWith('.json'))
            .map((file) => file.replace('.json', ''));
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            return []; // Directory doesn't exist, return empty list
          }
          throw error;
        }
      },
      (error) => validationError(`Failed to list sessions: ${error}`)
    );
  }

  /**
   * Delete a session from disk
   */
  static async deleteSession(sessionId: string): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const { unlink } = await import('node:fs/promises');
        const sessionFile = join(SESSIONS_DIR, `${sessionId}.json`);
        await unlink(sessionFile);
      },
      (error) => validationError(`Failed to delete session ${sessionId}: ${error}`)
    );
  }

  /**
   * Clean up old sessions (older than 30 days by default)
   */
  static async cleanupOldSessions(
    maxAgeMs: number = 30 * 24 * 60 * 60 * 1000
  ): Promise<Result<number, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const sessionIdsResult = await StatePersistence.listSessions();
        const sessionIds = match(
          (ids) => ids,
          (error) => {
            throw new Error(error.message);
          },
          sessionIdsResult
        );

        let deletedCount = 0;
        const cutoffTime = Date.now() - maxAgeMs;

        for (const sessionId of sessionIds) {
          const sessionResult = await StatePersistence.loadSession(sessionId);
          match(
            (sessionData) => {
              if (sessionData) {
                const lastActive = new Date(sessionData.lastActiveAt).getTime();
                if (lastActive < cutoffTime) {
                  StatePersistence.deleteSession(sessionId);
                  deletedCount++;
                }
              }
            },
            () => {
              // Ignore session load errors during cleanup
            },
            sessionResult
          );
        }

        return deletedCount;
      },
      (error) => validationError(`Failed to cleanup old sessions: ${error}`)
    );
  }
}

// ============================================================================
// Initialization Helper
// ============================================================================

/**
 * Initialize persistence system
 */
export async function initializePersistence(): Promise<Result<void, QiError>> {
  return StatePersistence.initialize();
}
