/**
 * State Persistence for XState v5 Agent State Manager
 *
 * Provides basic file-based persistence for agent state including sessions
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  create,
  failure,
  flatMap,
  fromAsyncTryCatch,
  map,
  match,
  type QiError,
  type Result,
  success,
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
// Persistence Error Factory Functions
// ============================================================================

/**
 * StatePersistence-specific error factories using QiCore patterns
 */
const persistenceError = {
  fileNotFound: (path: string): QiError =>
    create('FILE_NOT_FOUND', `State file not found: ${path}`, 'SYSTEM', { path }),

  permissionDenied: (path: string, operation: string): QiError =>
    create('PERMISSION_DENIED', `Permission denied for ${operation} on: ${path}`, 'SYSTEM', {
      path,
      operation,
    }),

  corruptedState: (path: string, details?: string): QiError =>
    create(
      'CORRUPTED_STATE',
      `Corrupted state data in: ${path}${details ? `: ${details}` : ''}`,
      'VALIDATION',
      { path, details }
    ),

  serializationError: (data: unknown, error: string): QiError =>
    create('SERIALIZATION_ERROR', `Failed to serialize state data: ${error}`, 'SYSTEM', {
      dataType: typeof data,
      error,
    }),

  deserializationError: (path: string, error: string): QiError =>
    create(
      'DESERIALIZATION_ERROR',
      `Failed to deserialize state from: ${path}: ${error}`,
      'SYSTEM',
      { path, error }
    ),

  diskSpaceError: (path: string): QiError =>
    create('DISK_SPACE_ERROR', `Insufficient disk space for: ${path}`, 'SYSTEM', { path }),

  directoryCreationError: (path: string, error: string): QiError =>
    create('DIRECTORY_CREATION_ERROR', `Failed to create directory: ${path}: ${error}`, 'SYSTEM', {
      path,
      error,
    }),

  invalidSessionId: (sessionId: string): QiError =>
    create('INVALID_SESSION_ID', `Invalid session ID: ${sessionId}`, 'VALIDATION', { sessionId }),

  sessionNotFound: (sessionId: string): QiError =>
    create('SESSION_NOT_FOUND', `Session not found: ${sessionId}`, 'SYSTEM', { sessionId }),
};

/**
 * Map Node.js file system errors to appropriate QiError categories
 */
const mapFileSystemError = (
  error: NodeJS.ErrnoException,
  filePath: string,
  operation: string
): QiError => {
  switch (error.code) {
    case 'ENOENT':
      return persistenceError.fileNotFound(filePath);
    case 'EACCES':
    case 'EPERM':
      return persistenceError.permissionDenied(filePath, operation);
    case 'ENOSPC':
      return persistenceError.diskSpaceError(filePath);
    case 'EISDIR':
      return create(
        'INVALID_FILE_TYPE',
        `Expected file but found directory: ${filePath}`,
        'VALIDATION',
        { filePath }
      );
    default:
      return create(
        error.code || 'FILE_SYSTEM_ERROR',
        `File system error during ${operation}: ${error.message}`,
        'SYSTEM',
        {
          filePath,
          operation,
          code: error.code,
        }
      );
  }
};

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
      (error) => {
        if (error && typeof error === 'object' && 'code' in error) {
          return mapFileSystemError(
            error as NodeJS.ErrnoException,
            PERSISTENCE_DIR,
            'directory creation'
          );
        }
        return persistenceError.directoryCreationError(PERSISTENCE_DIR, String(error));
      }
    );
  }

  /**
   * Save agent state to disk
   */
  static async saveState(context: AgentStateContext): Promise<Result<void, QiError>> {
    // Validate context data first
    const validateContext = (ctx: AgentStateContext): Result<AgentStateContext, QiError> => {
      if (!ctx || typeof ctx !== 'object') {
        return failure(persistenceError.corruptedState('memory', 'Invalid context object'));
      }
      return success(ctx);
    };

    // Create serializable state
    const createPersistedState = (ctx: AgentStateContext): Result<PersistedState, QiError> => {
      try {
        const persistedState: PersistedState = {
          timestamp: new Date().toISOString(),
          version: '0.7.1',
          context: {
            config: ctx.config,
            currentModel: ctx.currentModel,
            currentMode: ctx.currentMode,
            context: ctx.context,
            // Note: we don't persist models map or LLM configs as they should be reloaded
          },
        };
        return success(persistedState);
      } catch (error) {
        return failure(persistenceError.serializationError(ctx, String(error)));
      }
    };

    // Serialize to JSON
    const serializeState = (state: PersistedState): Result<string, QiError> => {
      try {
        const stateJson = JSON.stringify(state, null, 2);
        return success(stateJson);
      } catch (error) {
        return failure(persistenceError.serializationError(state, String(error)));
      }
    };

    // Write to file
    const writeStateFile = async (stateJson: string): Promise<Result<void, QiError>> => {
      return fromAsyncTryCatch(
        async () => {
          await writeFile(STATE_FILE, stateJson, 'utf-8');
        },
        (error) => {
          if (error && typeof error === 'object' && 'code' in error) {
            return mapFileSystemError(error as NodeJS.ErrnoException, STATE_FILE, 'write');
          }
          return create('WRITE_ERROR', `Failed to write state file: ${error}`, 'SYSTEM', {
            path: STATE_FILE,
          });
        }
      );
    };

    // Functional composition: validate → create persisted state → serialize → write
    const validationResult = validateContext(context);
    return match(
      (validCtx) => {
        const stateResult = createPersistedState(validCtx);
        return match(
          (persistedState) => {
            const serializedResult = serializeState(persistedState);
            return match(
              (stateJson) => writeStateFile(stateJson),
              (error) => Promise.resolve(failure(error)),
              serializedResult
            );
          },
          (error) => Promise.resolve(failure(error)),
          stateResult
        );
      },
      (error) => Promise.resolve(failure(error)),
      validationResult
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
          try {
            const persistedState = JSON.parse(stateJson) as PersistedState;
            return persistedState;
          } catch (parseError) {
            throw persistenceError.deserializationError(STATE_FILE, String(parseError));
          }
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            return null; // File doesn't exist, return null
          }
          throw error;
        }
      },
      (error) => {
        // Handle QiError objects directly
        if (error && typeof error === 'object' && 'code' in error && 'category' in error) {
          return error as QiError;
        }
        // Handle Node.js file system errors
        if (error && typeof error === 'object' && 'code' in error) {
          return mapFileSystemError(error as NodeJS.ErrnoException, STATE_FILE, 'read');
        }
        return create('LOAD_ERROR', `Failed to load agent state: ${error}`, 'SYSTEM', {
          path: STATE_FILE,
        });
      }
    );
  }

  /**
   * Save session to disk
   */
  static async saveSession(session: SessionData): Promise<Result<void, QiError>> {
    // Validate session data
    const validateSession = (sess: SessionData): Result<SessionData, QiError> => {
      if (!sess || !sess.id || typeof sess.id !== 'string') {
        return failure(persistenceError.invalidSessionId(sess?.id || 'undefined'));
      }
      return success(sess);
    };

    return fromAsyncTryCatch(
      async () => {
        return match(
          async (validSession) => {
            const persistedSession: PersistedSession = {
              timestamp: new Date().toISOString(),
              sessionData: validSession,
            };

            const sessionFile = join(SESSIONS_DIR, `${validSession.id}.json`);
            try {
              const sessionJson = JSON.stringify(persistedSession, null, 2);
              await writeFile(sessionFile, sessionJson, 'utf-8');
            } catch (writeError) {
              if (writeError && typeof writeError === 'object' && 'code' in writeError) {
                throw mapFileSystemError(writeError as NodeJS.ErrnoException, sessionFile, 'write');
              }
              throw persistenceError.serializationError(persistedSession, String(writeError));
            }
          },
          (error) => {
            throw error;
          },
          validateSession(session)
        );
      },
      (error) => {
        // Handle QiError objects directly
        if (error && typeof error === 'object' && 'code' in error && 'category' in error) {
          return error as QiError;
        }
        return create(
          'SAVE_SESSION_ERROR',
          `Failed to save session ${session.id}: ${error}`,
          'SYSTEM',
          { sessionId: session.id }
        );
      }
    );
  }

  /**
   * Load session from disk
   */
  static async loadSession(sessionId: string): Promise<Result<SessionData | null, QiError>> {
    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      return Promise.resolve(failure(persistenceError.invalidSessionId(sessionId)));
    }

    return fromAsyncTryCatch(
      async () => {
        try {
          const sessionFile = join(SESSIONS_DIR, `${sessionId}.json`);
          const sessionJson = await readFile(sessionFile, 'utf-8');
          try {
            const persistedSession = JSON.parse(sessionJson) as PersistedSession;
            return persistedSession.sessionData;
          } catch (parseError) {
            throw persistenceError.deserializationError(sessionFile, String(parseError));
          }
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            return null; // Session file doesn't exist
          }
          throw error;
        }
      },
      (error) => {
        // Handle QiError objects directly
        if (error && typeof error === 'object' && 'code' in error && 'category' in error) {
          return error as QiError;
        }
        // Handle Node.js file system errors
        if (error && typeof error === 'object' && 'code' in error) {
          const sessionFile = join(SESSIONS_DIR, `${sessionId}.json`);
          return mapFileSystemError(error as NodeJS.ErrnoException, sessionFile, 'read');
        }
        return create(
          'LOAD_SESSION_ERROR',
          `Failed to load session ${sessionId}: ${error}`,
          'SYSTEM',
          { sessionId }
        );
      }
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
      (error) => {
        // Handle Node.js file system errors
        if (error && typeof error === 'object' && 'code' in error) {
          return mapFileSystemError(error as NodeJS.ErrnoException, SESSIONS_DIR, 'list');
        }
        return create('LIST_SESSIONS_ERROR', `Failed to list sessions: ${error}`, 'SYSTEM', {
          directory: SESSIONS_DIR,
        });
      }
    );
  }

  /**
   * Delete a session from disk
   */
  static async deleteSession(sessionId: string): Promise<Result<void, QiError>> {
    // Validate session ID
    if (!sessionId || typeof sessionId !== 'string') {
      return Promise.resolve(failure(persistenceError.invalidSessionId(sessionId)));
    }

    return fromAsyncTryCatch(
      async () => {
        const { unlink } = await import('node:fs/promises');
        const sessionFile = join(SESSIONS_DIR, `${sessionId}.json`);
        await unlink(sessionFile);
      },
      (error) => {
        // Handle Node.js file system errors
        if (error && typeof error === 'object' && 'code' in error) {
          const sessionFile = join(SESSIONS_DIR, `${sessionId}.json`);
          return mapFileSystemError(error as NodeJS.ErrnoException, sessionFile, 'delete');
        }
        return create(
          'DELETE_SESSION_ERROR',
          `Failed to delete session ${sessionId}: ${error}`,
          'SYSTEM',
          { sessionId }
        );
      }
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

        // Use proper QiCore pattern - no throwing inside match
        return match(
          async (sessionIds) => {
            let deletedCount = 0;
            const cutoffTime = Date.now() - maxAgeMs;

            for (const sessionId of sessionIds) {
              const sessionResult = await StatePersistence.loadSession(sessionId);

              // Use proper match pattern - no side effects in match
              const shouldDelete = match(
                (sessionData) => {
                  if (sessionData) {
                    const lastActive = new Date(sessionData.lastActiveAt).getTime();
                    return lastActive < cutoffTime;
                  }
                  return false;
                },
                () => {
                  // Ignore session load errors during cleanup - don't delete
                  return false;
                },
                sessionResult
              );

              if (shouldDelete) {
                const deleteResult = await StatePersistence.deleteSession(sessionId);
                // Only increment count if deletion was successful
                match(
                  () => {
                    deletedCount++;
                  },
                  () => {
                    // Ignore deletion errors during cleanup
                  },
                  deleteResult
                );
              }
            }

            return deletedCount;
          },
          (error) => {
            throw error; // Let fromAsyncTryCatch handle this
          },
          sessionIdsResult
        );
      },
      (error) => {
        // Handle QiError objects directly
        if (error && typeof error === 'object' && 'code' in error && 'category' in error) {
          return error as QiError;
        }
        return create('CLEANUP_ERROR', `Failed to cleanup old sessions: ${error}`, 'SYSTEM');
      }
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
