// Memory Provider Implementation
//
// Implements IMemoryProvider with both in-memory and persistent storage options
// Provides session management, conversation state, and processing event tracking

import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import type { 
  IMemoryProvider,
  SessionContext,
  ConversationState,
  ProcessingEvent,
  ModelMessage,
  CognitivePattern
} from '../../core/interfaces.js';

// ============================================================================
// Memory Provider Configuration
// ============================================================================

export interface MemoryProviderConfig {
  readonly type: 'memory' | 'file' | 'hybrid';
  readonly persistenceDir?: string;
  readonly maxSessions?: number;
  readonly maxEventsPerSession?: number;
  readonly sessionTTL?: number; // Time-to-live in milliseconds
  readonly enableCompression?: boolean;
  readonly autoCleanup?: boolean;
  readonly cleanupInterval?: number; // Cleanup interval in milliseconds
}

// ============================================================================
// In-Memory Storage Structures
// ============================================================================

interface InMemorySession extends SessionContext {
  lastAccessedAt: Date;
}

interface InMemoryConversationState extends ConversationState {
  lastUpdated: Date;
}

interface InMemoryProcessingEvent extends ProcessingEvent {
  timestamp: Date;
}

// ============================================================================
// Multi-Modal Memory Provider Implementation
// ============================================================================

export class MultiModalMemoryProvider implements IMemoryProvider {
  private config: MemoryProviderConfig;
  private sessions = new Map<string, InMemorySession>();
  private conversationStates = new Map<string, InMemoryConversationState>();
  private processingEvents = new Map<string, InMemoryProcessingEvent[]>();
  private cleanupTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<MemoryProviderConfig> = {}) {
    this.config = {
      type: config.type || 'memory',
      persistenceDir: config.persistenceDir || './memory-storage',
      maxSessions: config.maxSessions || 1000,
      maxEventsPerSession: config.maxEventsPerSession || 1000,
      sessionTTL: config.sessionTTL || 24 * 60 * 60 * 1000, // 24 hours
      enableCompression: config.enableCompression || false,
      autoCleanup: config.autoCleanup || true,
      cleanupInterval: config.cleanupInterval || 60 * 60 * 1000 // 1 hour
    };

    if (this.config.autoCleanup) {
      this.startCleanupTimer();
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log(`🧠 Initializing ${this.config.type} memory provider...`);

    if (this.config.type === 'file' || this.config.type === 'hybrid') {
      await this.initializeFileStorage();
      await this.loadExistingData();
    }

    this.isInitialized = true;
    console.log(`✅ Memory provider initialized (${this.config.type} mode)`);
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async createSession(
    domain: string, 
    metadata?: ReadonlyMap<string, unknown>
  ): Promise<SessionContext> {
    await this.ensureInitialized();

    const sessionId = randomUUID();
    const now = new Date();
    
    const session: InMemorySession = {
      sessionId,
      domain,
      createdAt: now,
      lastAccessedAt: now,
      metadata: metadata || new Map()
    };

    // Add to in-memory storage
    this.sessions.set(sessionId, session);

    // Persist if needed
    if (this.config.type === 'file' || this.config.type === 'hybrid') {
      await this.persistSession(session);
    }

    // Enforce session limits
    await this.enforceSessionLimits();

    console.log(`📝 Created session ${sessionId} for domain: ${domain}`);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionContext | undefined> {
    await this.ensureInitialized();

    // Try in-memory first
    let session = this.sessions.get(sessionId);
    
    // If not in memory, try loading from disk
    if (!session && (this.config.type === 'file' || this.config.type === 'hybrid')) {
      session = await this.loadSession(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
      }
    }

    if (session) {
      // Update last accessed time
      session.lastAccessedAt = new Date();
      if (this.config.type === 'file' || this.config.type === 'hybrid') {
        await this.persistSession(session);
      }
    }

    return session || undefined;
  }

  async updateSession(
    sessionId: string, 
    metadata: ReadonlyMap<string, unknown>
  ): Promise<void> {
    await this.ensureInitialized();

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedSession: InMemorySession = {
      ...session as InMemorySession,
      metadata: new Map([...session.metadata, ...metadata]),
      lastAccessedAt: new Date()
    };

    this.sessions.set(sessionId, updatedSession);

    if (this.config.type === 'file' || this.config.type === 'hybrid') {
      await this.persistSession(updatedSession);
    }

    console.log(`📝 Updated session ${sessionId} metadata`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();

    // Remove from in-memory storage
    this.sessions.delete(sessionId);
    this.conversationStates.delete(sessionId);
    this.processingEvents.delete(sessionId);

    // Remove from persistent storage
    if (this.config.type === 'file' || this.config.type === 'hybrid') {
      await this.deletePersistedSession(sessionId);
    }

    console.log(`🗑️  Deleted session ${sessionId}`);
  }

  // ============================================================================
  // Conversation State Management
  // ============================================================================

  async saveConversationState(state: ConversationState): Promise<void> {
    await this.ensureInitialized();

    const internalState: InMemoryConversationState = {
      ...state,
      lastUpdated: new Date()
    };

    this.conversationStates.set(state.sessionId, internalState);

    if (this.config.type === 'file' || this.config.type === 'hybrid') {
      await this.persistConversationState(internalState);
    }

    console.log(`💾 Saved conversation state for session ${state.sessionId}`);
  }

  async getConversationState(sessionId: string): Promise<ConversationState | undefined> {
    await this.ensureInitialized();

    // Try in-memory first
    let state = this.conversationStates.get(sessionId);

    // If not in memory, try loading from disk
    if (!state && (this.config.type === 'file' || this.config.type === 'hybrid')) {
      state = await this.loadConversationState(sessionId);
      if (state) {
        this.conversationStates.set(sessionId, state);
      }
    }

    return state || undefined;
  }

  // ============================================================================
  // Processing Event Management
  // ============================================================================

  async addProcessingEvent(event: ProcessingEvent): Promise<void> {
    await this.ensureInitialized();

    const internalEvent: InMemoryProcessingEvent = {
      ...event,
      timestamp: new Date()
    };

    // Add to in-memory storage
    let events = this.processingEvents.get(event.sessionId) || [];
    events.push(internalEvent);

    // Enforce event limits per session
    if (events.length > (this.config.maxEventsPerSession || 1000)) {
      events = events.slice(-this.config.maxEventsPerSession!);
    }

    this.processingEvents.set(event.sessionId, events);

    // Persist if needed
    if (this.config.type === 'file' || this.config.type === 'hybrid') {
      await this.persistProcessingEvents(event.sessionId, events);
    }

    console.log(`📊 Added processing event (${event.type}) for session ${event.sessionId}`);
  }

  async getProcessingHistory(
    sessionId: string, 
    limit?: number
  ): Promise<readonly ProcessingEvent[]> {
    await this.ensureInitialized();

    // Try in-memory first
    let events = this.processingEvents.get(sessionId);

    // If not in memory, try loading from disk
    if (!events && (this.config.type === 'file' || this.config.type === 'hybrid')) {
      events = await this.loadProcessingEvents(sessionId);
      if (events) {
        this.processingEvents.set(sessionId, events);
      }
    }

    if (!events) return [];

    // Apply limit if specified
    const limitedEvents = limit ? events.slice(-limit) : events;
    
    return limitedEvents.map(event => ({
      eventId: event.eventId,
      sessionId: event.sessionId,
      timestamp: event.timestamp,
      type: event.type,
      data: event.data
    }));
  }

  // ============================================================================
  // Cleanup and Maintenance
  // ============================================================================

  async cleanup(): Promise<void> {
    console.log('🧹 Starting memory provider cleanup...');

    const now = new Date();
    const expiredSessions: string[] = [];

    // Find expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      const isExpired = (now.getTime() - session.lastAccessedAt.getTime()) > (this.config.sessionTTL || 0);
      if (isExpired) {
        expiredSessions.push(sessionId);
      }
    }

    // Clean up expired sessions
    for (const sessionId of expiredSessions) {
      await this.deleteSession(sessionId);
    }

    // Clean up orphaned data
    await this.cleanupOrphanedData();

    console.log(`✅ Cleanup completed. Removed ${expiredSessions.length} expired sessions`);
  }

  // ============================================================================
  // File System Operations (for persistent storage)
  // ============================================================================

  private async initializeFileStorage(): Promise<void> {
    if (!this.config.persistenceDir) return;

    const baseDir = this.config.persistenceDir;
    const dirs = [
      join(baseDir, 'sessions'),
      join(baseDir, 'conversations'),
      join(baseDir, 'events')
    ];

    for (const dir of dirs) {
      try {
        await mkdir(dir, { recursive: true });
      } catch (error: any) {
        if (error.code !== 'EEXIST') {
          console.error(`Failed to create directory ${dir}:`, error);
          throw error;
        }
      }
    }
  }

  private async loadExistingData(): Promise<void> {
    if (!this.config.persistenceDir) return;

    try {
      // Load sessions
      const sessionsDir = join(this.config.persistenceDir, 'sessions');
      const sessionFiles = await this.listJsonFiles(sessionsDir);
      
      for (const file of sessionFiles) {
        try {
          const session = await this.loadSession(file.replace('.json', ''));
          if (session) {
            this.sessions.set(session.sessionId, session);
          }
        } catch (error) {
          console.warn(`Failed to load session ${file}:`, error);
        }
      }

      console.log(`📂 Loaded ${this.sessions.size} sessions from storage`);

    } catch (error) {
      console.warn('Failed to load existing data:', error);
    }
  }

  private async persistSession(session: InMemorySession): Promise<void> {
    if (!this.config.persistenceDir) return;

    const filePath = join(this.config.persistenceDir, 'sessions', `${session.sessionId}.json`);
    const data = {
      ...session,
      metadata: Object.fromEntries(session.metadata)
    };

    await this.writeJsonFile(filePath, data);
  }

  private async loadSession(sessionId: string): Promise<InMemorySession | undefined> {
    if (!this.config.persistenceDir) return undefined;

    try {
      const filePath = join(this.config.persistenceDir, 'sessions', `${sessionId}.json`);
      const data = await this.readJsonFile(filePath);
      
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        lastAccessedAt: new Date(data.lastAccessedAt),
        metadata: new Map(Object.entries(data.metadata || {}))
      };
    } catch (error) {
      return undefined;
    }
  }

  private async deletePersistedSession(sessionId: string): Promise<void> {
    if (!this.config.persistenceDir) return;

    const files = [
      join(this.config.persistenceDir, 'sessions', `${sessionId}.json`),
      join(this.config.persistenceDir, 'conversations', `${sessionId}.json`),
      join(this.config.persistenceDir, 'events', `${sessionId}.json`)
    ];

    for (const file of files) {
      try {
        await unlink(file);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to delete ${file}:`, error);
        }
      }
    }
  }

  private async persistConversationState(state: InMemoryConversationState): Promise<void> {
    if (!this.config.persistenceDir) return;

    const filePath = join(this.config.persistenceDir, 'conversations', `${state.sessionId}.json`);
    const data = {
      ...state,
      context: Object.fromEntries(state.context),
      lastUpdated: state.lastUpdated.toISOString()
    };

    await this.writeJsonFile(filePath, data);
  }

  private async loadConversationState(sessionId: string): Promise<InMemoryConversationState | undefined> {
    if (!this.config.persistenceDir) return undefined;

    try {
      const filePath = join(this.config.persistenceDir, 'conversations', `${sessionId}.json`);
      const data = await this.readJsonFile(filePath);
      
      return {
        ...data,
        context: new Map(Object.entries(data.context || {})),
        lastUpdated: new Date(data.lastUpdated)
      };
    } catch (error) {
      return undefined;
    }
  }

  private async persistProcessingEvents(sessionId: string, events: InMemoryProcessingEvent[]): Promise<void> {
    if (!this.config.persistenceDir) return;

    const filePath = join(this.config.persistenceDir, 'events', `${sessionId}.json`);
    const data = events.map(event => ({
      ...event,
      data: Object.fromEntries(event.data),
      timestamp: event.timestamp.toISOString()
    }));

    await this.writeJsonFile(filePath, data);
  }

  private async loadProcessingEvents(sessionId: string): Promise<InMemoryProcessingEvent[] | undefined> {
    if (!this.config.persistenceDir) return undefined;

    try {
      const filePath = join(this.config.persistenceDir, 'events', `${sessionId}.json`);
      const data = await this.readJsonFile(filePath);
      
      return data.map((event: any) => ({
        ...event,
        data: new Map(Object.entries(event.data || {})),
        timestamp: new Date(event.timestamp)
      }));
    } catch (error) {
      return undefined;
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async enforceSessionLimits(): Promise<void> {
    const maxSessions = this.config.maxSessions || 1000;
    
    if (this.sessions.size > maxSessions) {
      // Remove oldest sessions (by last accessed time)
      const sortedSessions = Array.from(this.sessions.entries())
        .sort(([, a], [, b]) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime());
      
      const sessionsToRemove = sortedSessions.slice(0, this.sessions.size - maxSessions);
      
      for (const [sessionId] of sessionsToRemove) {
        await this.deleteSession(sessionId);
      }
    }
  }

  private async cleanupOrphanedData(): Promise<void> {
    // Remove conversation states and events for non-existent sessions
    const sessionIds = new Set(this.sessions.keys());
    
    // Clean up orphaned conversation states
    for (const sessionId of this.conversationStates.keys()) {
      if (!sessionIds.has(sessionId)) {
        this.conversationStates.delete(sessionId);
      }
    }
    
    // Clean up orphaned processing events
    for (const sessionId of this.processingEvents.keys()) {
      if (!sessionIds.has(sessionId)) {
        this.processingEvents.delete(sessionId);
      }
    }
  }

  private startCleanupTimer(): void {
    const interval = this.config.cleanupInterval || 60 * 60 * 1000; // 1 hour default
    
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error('Cleanup timer error:', error);
      }
    }, interval);
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private async listJsonFiles(directory: string): Promise<string[]> {
    try {
      const files = await readdir(directory);
      return files.filter(file => file.endsWith('.json'));
    } catch (error) {
      return [];
    }
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    await mkdir(dirname(filePath), { recursive: true });
    const jsonData = JSON.stringify(data, null, 2);
    await writeFile(filePath, jsonData, 'utf-8');
  }

  private async readJsonFile(filePath: string): Promise<any> {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  // ============================================================================
  // Statistics and Monitoring
  // ============================================================================

  getStatistics(): {
    activeSessions: number;
    totalConversationStates: number;
    totalProcessingEvents: number;
    memoryUsage: {
      sessions: number;
      conversations: number;
      events: number;
    };
  } {
    const totalEvents = Array.from(this.processingEvents.values())
      .reduce((sum, events) => sum + events.length, 0);

    return {
      activeSessions: this.sessions.size,
      totalConversationStates: this.conversationStates.size,
      totalProcessingEvents: totalEvents,
      memoryUsage: {
        sessions: this.sessions.size,
        conversations: this.conversationStates.size,
        events: this.processingEvents.size
      }
    };
  }

  // ============================================================================
  // Shutdown
  // ============================================================================

  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down memory provider...');
    
    this.stopCleanupTimer();
    
    // Final cleanup
    if (this.config.autoCleanup) {
      await this.cleanup();
    }
    
    // Clear in-memory data
    this.sessions.clear();
    this.conversationStates.clear();
    this.processingEvents.clear();
    
    this.isInitialized = false;
    console.log('✅ Memory provider shutdown complete');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates an in-memory only memory provider (for development/testing)
 */
export function createInMemoryProvider(options: Partial<MemoryProviderConfig> = {}): IMemoryProvider {
  return new MultiModalMemoryProvider({
    ...options,
    type: 'memory'
  });
}

/**
 * Creates a file-based memory provider (for production persistence)
 */
export function createFileBasedProvider(
  persistenceDir: string,
  options: Partial<MemoryProviderConfig> = {}
): IMemoryProvider {
  return new MultiModalMemoryProvider({
    ...options,
    type: 'file',
    persistenceDir
  });
}

/**
 * Creates a hybrid memory provider (in-memory with file backup)
 */
export function createHybridProvider(
  persistenceDir: string,
  options: Partial<MemoryProviderConfig> = {}
): IMemoryProvider {
  return new MultiModalMemoryProvider({
    ...options,
    type: 'hybrid',
    persistenceDir
  });
}

export default MultiModalMemoryProvider;