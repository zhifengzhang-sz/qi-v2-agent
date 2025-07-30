// Memory Provider Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { CognitivePattern, ProcessingEvent } from './cognitive-patterns.js';
import type { ModelMessage } from './models.js';

/**
 * Session context
 */
export interface SessionContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly domain: string;
  readonly createdAt: Date;
  readonly lastAccessedAt: Date;
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Conversation state
 */
export interface ConversationState {
  readonly sessionId: string;
  readonly messages: readonly ModelMessage[];
  readonly currentPattern?: CognitivePattern;
  readonly context: ReadonlyMap<string, unknown>;
  readonly lastUpdated: Date;
}

/**
 * Abstract memory provider interface
 */
export interface IMemoryProvider {
  initialize(): Promise<void>;
  createSession(domain: string, metadata?: ReadonlyMap<string, unknown>): Promise<SessionContext>;
  getSession(sessionId: string): Promise<SessionContext | undefined>;
  updateSession(sessionId: string, metadata: ReadonlyMap<string, unknown>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  
  saveConversationState(state: ConversationState): Promise<void>;
  getConversationState(sessionId: string): Promise<ConversationState | undefined>;
  
  addProcessingEvent(event: ProcessingEvent): Promise<void>;
  getProcessingHistory(sessionId: string, limit?: number): Promise<readonly ProcessingEvent[]>;
  
  cleanup(): Promise<void>;
}