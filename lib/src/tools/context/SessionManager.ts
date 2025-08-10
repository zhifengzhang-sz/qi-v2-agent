/**
 * Session Manager Tool
 * 
 * Manages conversation sessions with persistence and context tracking.
 * Supports Claude Code-style session continuity.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ContextMessage } from '../../context/abstractions/index.js';

/**
 * Session information with enhanced context tracking
 */
export interface Session {
  readonly id: string;
  readonly title: string;
  readonly startTime: Date;
  readonly lastActivity: Date;
  readonly messages: readonly ContextMessage[];
  readonly projectPath?: string;
  readonly fileReferences: readonly string[];
  readonly contextWindow: {
    readonly maxTokens: number;
    readonly currentTokens: number;
    readonly truncated: boolean;
  };
  readonly configuration: ReadonlyMap<string, unknown>;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Session storage format for persistence
 */
interface StoredSession {
  id: string;
  title: string;
  startTime: string;
  lastActivity: string;
  messages: ContextMessage[];
  projectPath?: string;
  fileReferences: string[];
  contextWindow: {
    maxTokens: number;
    currentTokens: number;
    truncated: boolean;
  };
  configuration: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Session manager configuration
 */
export interface SessionManagerConfig {
  readonly storagePath: string;
  readonly maxSessions: number;
  readonly maxContextWindow: number;
  readonly enablePersistence: boolean;
  readonly autoSave: boolean;
  readonly compressionEnabled: boolean;
}

/**
 * Default configuration for session manager
 */
const DEFAULT_CONFIG: SessionManagerConfig = {
  storagePath: '.claude-sessions',
  maxSessions: 100,
  maxContextWindow: 8000,
  enablePersistence: true,
  autoSave: true,
  compressionEnabled: false,
};

import type { Tool } from '../index.js';

/**
 * Session Manager Tool
 * 
 * Provides session management with persistence and context tracking.
 */
export class SessionManager implements Tool<string, Session> {
  readonly name = 'SessionManager';
  readonly description = 'Manages conversation sessions with persistence and context tracking';
  readonly version = '1.0.0';
  private config: SessionManagerConfig;
  private sessions = new Map<string, Session>();
  private activeSessionId?: string;

  constructor(config: Partial<SessionManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.enablePersistence) {
      this.ensureStorageDirectory();
    }
  }

  /**
   * Tool interface implementation
   */
  async execute(input: string): Promise<Session> {
    return this.createSession(input);
  }

  /**
   * Initialize session manager and load existing sessions
   */
  async initialize(): Promise<void> {
    if (this.config.enablePersistence) {
      await this.loadSessions();
    }
  }

  /**
   * Create a new conversation session
   */
  async createSession(title: string, projectPath?: string): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      title: title || `Session ${new Date().toLocaleString()}`,
      startTime: new Date(),
      lastActivity: new Date(),
      messages: [],
      projectPath,
      fileReferences: [],
      contextWindow: {
        maxTokens: this.config.maxContextWindow,
        currentTokens: 0,
        truncated: false,
      },
      configuration: new Map(),
      metadata: new Map([
        ['createdAt', new Date().toISOString()],
        ['version', '1.0'],
      ]),
    };

    this.sessions.set(session.id, session);
    this.activeSessionId = session.id;

    if (this.config.autoSave) {
      await this.saveSession(session.id);
    }

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get the currently active session
   */
  getActiveSession(): Session | null {
    return this.activeSessionId ? this.getSession(this.activeSessionId) : null;
  }

  /**
   * Set the active session
   */
  setActiveSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      this.activeSessionId = sessionId;
      return true;
    }
    return false;
  }

  /**
   * Add a message to a session
   */
  async addMessage(sessionId: string, message: ContextMessage): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const updatedSession: Session = {
      ...session,
      messages: [...session.messages, message],
      lastActivity: new Date(),
      contextWindow: {
        ...session.contextWindow,
        currentTokens: this.estimateTokens([...session.messages, message]),
      },
    };

    // Handle context window overflow
    if (updatedSession.contextWindow.currentTokens > updatedSession.contextWindow.maxTokens) {
      const truncatedSession = this.truncateSession(updatedSession);
      this.sessions.set(sessionId, truncatedSession);
    } else {
      this.sessions.set(sessionId, updatedSession);
    }

    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }

    return true;
  }

  /**
   * Add file reference to a session
   */
  async addFileReference(sessionId: string, filePath: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Avoid duplicates
    if (session.fileReferences.includes(filePath)) {
      return true;
    }

    const updatedSession: Session = {
      ...session,
      fileReferences: [...session.fileReferences, filePath],
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);

    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }

    return true;
  }

  /**
   * Update session configuration
   */
  async updateSessionConfig(sessionId: string, config: Map<string, unknown>): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const updatedSession: Session = {
      ...session,
      configuration: new Map([...session.configuration, ...config]),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, updatedSession);

    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }

    return true;
  }

  /**
   * List all sessions
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.sessions.has(sessionId)) {
      return false;
    }

    this.sessions.delete(sessionId);

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = undefined;
    }

    if (this.config.enablePersistence) {
      await this.deleteStoredSession(sessionId);
    }

    return true;
  }

  /**
   * Save sessions to persistent storage
   */
  async saveSessions(): Promise<void> {
    if (!this.config.enablePersistence) return;

    const promises = Array.from(this.sessions.keys()).map(id => this.saveSession(id));
    await Promise.all(promises);
  }

  /**
   * Save a specific session
   */
  private async saveSession(sessionId: string): Promise<void> {
    if (!this.config.enablePersistence) return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    const storedSession = this.sessionToStorageFormat(session);
    const filePath = join(this.config.storagePath, `${sessionId}.json`);

    try {
      writeFileSync(filePath, JSON.stringify(storedSession, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`Failed to save session ${sessionId}:`, error);
    }
  }

  /**
   * Load sessions from persistent storage
   */
  private async loadSessions(): Promise<void> {
    if (!existsSync(this.config.storagePath)) return;

    try {
      const files = require('fs').readdirSync(this.config.storagePath);
      const sessionFiles = files.filter((file: string) => file.endsWith('.json'));

      for (const file of sessionFiles) {
        try {
          const filePath = join(this.config.storagePath, file);
          const content = readFileSync(filePath, 'utf-8');
          const storedSession: StoredSession = JSON.parse(content);
          const session = this.sessionFromStorageFormat(storedSession);
          
          this.sessions.set(session.id, session);
        } catch (fileError) {
          console.warn(`Failed to load session from ${file}:`, fileError);
        }
      }

      // Clean up old sessions if we exceed max limit
      await this.cleanupOldSessions();
    } catch (error) {
      console.warn('Failed to load sessions:', error);
    }
  }

  /**
   * Convert session to storage format
   */
  private sessionToStorageFormat(session: Session): StoredSession {
    return {
      id: session.id,
      title: session.title,
      startTime: session.startTime.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      messages: [...session.messages],
      projectPath: session.projectPath,
      fileReferences: [...session.fileReferences],
      contextWindow: { ...session.contextWindow },
      configuration: Object.fromEntries(session.configuration),
      metadata: Object.fromEntries(session.metadata),
    };
  }

  /**
   * Convert storage format to session
   */
  private sessionFromStorageFormat(stored: StoredSession): Session {
    return {
      id: stored.id,
      title: stored.title,
      startTime: new Date(stored.startTime),
      lastActivity: new Date(stored.lastActivity),
      messages: stored.messages,
      projectPath: stored.projectPath,
      fileReferences: stored.fileReferences,
      contextWindow: stored.contextWindow,
      configuration: new Map(Object.entries(stored.configuration)),
      metadata: new Map(Object.entries(stored.metadata)),
    };
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDirectory(): void {
    if (!existsSync(this.config.storagePath)) {
      mkdirSync(this.config.storagePath, { recursive: true });
    }
  }

  /**
   * Delete stored session file
   */
  private async deleteStoredSession(sessionId: string): Promise<void> {
    const filePath = join(this.config.storagePath, `${sessionId}.json`);
    
    try {
      if (existsSync(filePath)) {
        require('fs').unlinkSync(filePath);
      }
    } catch (error) {
      console.warn(`Failed to delete stored session ${sessionId}:`, error);
    }
  }

  /**
   * Clean up old sessions if we exceed the limit
   */
  private async cleanupOldSessions(): Promise<void> {
    const sessions = this.listSessions();
    
    if (sessions.length > this.config.maxSessions) {
      const sessionsToDelete = sessions.slice(this.config.maxSessions);
      
      for (const session of sessionsToDelete) {
        await this.deleteSession(session.id);
      }
    }
  }

  /**
   * Truncate session messages to fit context window
   */
  private truncateSession(session: Session): Session {
    const messages = [...session.messages];
    let currentTokens = this.estimateTokens(messages);
    
    // Remove oldest messages until we fit in the context window
    while (currentTokens > session.contextWindow.maxTokens && messages.length > 1) {
      messages.shift(); // Remove oldest message
      currentTokens = this.estimateTokens(messages);
    }

    return {
      ...session,
      messages,
      contextWindow: {
        ...session.contextWindow,
        currentTokens,
        truncated: messages.length < session.messages.length,
      },
    };
  }

  /**
   * Estimate token count for messages (rough approximation)
   */
  private estimateTokens(messages: readonly ContextMessage[]): number {
    const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }
}