/**
 * CLI ↔ Agent Event Interface
 * 
 * Defines the complete event-driven communication interface between
 * CLI and Agent for consistent, bidirectional interaction.
 */

// Base event interface
interface BaseEvent {
  timestamp: Date;
}

// ===========================================
// CLI → Agent Events
// ===========================================

/**
 * State change requests from CLI to Agent
 */
export interface ModelChangeRequestedEvent extends BaseEvent {
  type: 'modelChangeRequested';
  modelName: string;
}

export interface ModeChangeRequestedEvent extends BaseEvent {
  type: 'modeChangeRequested';
  mode: 'interactive' | 'command' | 'streaming';
}

export interface ConfigChangeRequestedEvent extends BaseEvent {
  type: 'configChangeRequested';
  config: Record<string, unknown>;
}

/**
 * Processing requests from CLI to Agent
 */
export interface PromptRequestedEvent extends BaseEvent {
  type: 'promptRequested';
  prompt: string;
  context?: Map<string, unknown>;
}

export interface StatusRequestedEvent extends BaseEvent {
  type: 'statusRequested';
}

export interface CancelRequestedEvent extends BaseEvent {
  type: 'cancelRequested';
}

/**
 * Union type for all CLI → Agent events
 */
export type CLIToAgentEvent = 
  | ModelChangeRequestedEvent
  | ModeChangeRequestedEvent
  | ConfigChangeRequestedEvent
  | PromptRequestedEvent
  | StatusRequestedEvent
  | CancelRequestedEvent;

// ===========================================
// Agent → CLI Events  
// ===========================================

/**
 * State change confirmations from Agent to CLI
 */
export interface ModelChangedEvent extends BaseEvent {
  type: 'modelChanged';
  oldModel: string;
  newModel: string;
  success: boolean;
  error?: string;
}

export interface ModeChangedEvent extends BaseEvent {
  type: 'modeChanged';
  oldMode: string;
  newMode: string;
  success: boolean;
}

export interface ConfigChangedEvent extends BaseEvent {
  type: 'configChanged';
  changes: Record<string, { oldValue: unknown; newValue: unknown }>;
  success: boolean;
}

/**
 * Processing responses from Agent to CLI
 */
export interface StatusResponseEvent extends BaseEvent {
  type: 'statusResponse';
  status: {
    model: string;
    mode: string;
    uptime: number;
    provider: string;
    availableCommands: number;
  };
}

export interface ProgressEvent extends BaseEvent {
  type: 'progress';
  phase: string;
  progress: number; // 0-1
  details?: string;
}

export interface MessageChunkEvent extends BaseEvent {
  type: 'messageChunk';
  content: string;
  isComplete: boolean;
}

export interface CompleteEvent extends BaseEvent {
  type: 'complete';
  result: {
    content: string;
    executionTime: number;
    metadata: Map<string, unknown>;
  };
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  error: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
}

export interface CancelledEvent extends BaseEvent {
  type: 'cancelled';
  reason: string;
}

/**
 * Union type for all Agent → CLI events
 */
export type AgentToCLIEvent =
  | ModelChangedEvent
  | ModeChangedEvent
  | ConfigChangedEvent
  | StatusResponseEvent
  | ProgressEvent
  | MessageChunkEvent
  | CompleteEvent
  | ErrorEvent
  | CancelledEvent;

// ===========================================
// Event Handler Types
// ===========================================

/**
 * CLI event handler - handles events from Agent
 */
export type CLIEventHandler = (event: AgentToCLIEvent) => void;

/**
 * Agent event handler - handles events from CLI
 */
export type AgentEventHandler = (event: CLIToAgentEvent) => void;

/**
 * Event emitter interface for CLI
 */
export interface ICLIEventEmitter {
  emit(event: CLIToAgentEvent): void;
  on(handler: CLIEventHandler): void;
  off(handler: CLIEventHandler): void;
}

/**
 * Event emitter interface for Agent
 */
export interface IAgentEventEmitter {
  emit(event: AgentToCLIEvent): void;
  on(handler: AgentEventHandler): void;
  off(handler: AgentEventHandler): void;
}

// ===========================================
// Helper Functions
// ===========================================

/**
 * Create a CLI → Agent event with timestamp
 */
export function createCLIEvent<T extends CLIToAgentEvent>(
  event: Omit<T, 'timestamp'>
): T {
  return {
    ...event,
    timestamp: new Date(),
  } as T;
}

/**
 * Create an Agent → CLI event with timestamp
 */
export function createAgentEvent<T extends AgentToCLIEvent>(
  event: Omit<T, 'timestamp'>
): T {
  return {
    ...event,
    timestamp: new Date(),
  } as T;
}