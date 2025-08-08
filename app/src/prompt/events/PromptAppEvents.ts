/**
 * Qi-Prompt App Event Definitions
 * 
 * Defines all event types for communication between CLI and Agent
 * specific to the Qi-Prompt application. These are the "content" that
 * gets plugged into the generic framework "structure".
 */

// Base event interface with timestamp
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

/**
 * Processing requests from CLI to Agent
 */
export interface PromptRequestedEvent extends BaseEvent {
  type: 'promptRequested';
  prompt: string;
  context?: {
    sessionId?: string;
    previousContext?: string;
  };
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
export type PromptAppCLIEvent = 
  | ModelChangeRequestedEvent
  | ModeChangeRequestedEvent
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
  oldMode: 'interactive' | 'command' | 'streaming';
  newMode: 'interactive' | 'command' | 'streaming';
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
    memoryUsage?: number;
  };
}

export interface ProgressEvent extends BaseEvent {
  type: 'progress';
  phase: 'parsing' | 'routing' | 'command_processing' | 'llm_processing' | 'completing';
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
    metadata: {
      type: 'command' | 'prompt';
      confidence?: number;
      tokensUsed?: number;
      model?: string;
    };
  };
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  error: {
    code: string;
    message: string;
    context?: {
      operation?: string;
      input?: string;
      phase?: string;
    };
  };
}

export interface CancelledEvent extends BaseEvent {
  type: 'cancelled';
  reason: 'user_requested' | 'timeout' | 'system_error';
}

/**
 * Union type for all Agent → CLI events
 */
export type PromptAppAgentEvent =
  | ModelChangedEvent
  | ModeChangedEvent
  | StatusResponseEvent
  | ProgressEvent
  | MessageChunkEvent
  | CompleteEvent
  | ErrorEvent
  | CancelledEvent;

// ===========================================
// Event Creation Helpers
// ===========================================

/**
 * Create a CLI → Agent event with automatic timestamp
 */
export function createCLIEvent<T extends PromptAppCLIEvent>(
  event: Omit<T, 'timestamp'>
): T {
  return {
    ...event,
    timestamp: new Date(),
  } as T;
}

/**
 * Create an Agent → CLI event with automatic timestamp
 */
export function createAgentEvent<T extends PromptAppAgentEvent>(
  event: Omit<T, 'timestamp'>
): T {
  return {
    ...event,
    timestamp: new Date(),
  } as T;
}

// ===========================================
// Event Flow Documentation
// ===========================================

/**
 * Expected Event Flows:
 * 
 * MODEL CHANGE:
 * 1. User: /model llama3.2:3b
 * 2. CLI → Agent: ModelChangeRequestedEvent
 * 3. Agent → CLI: ModelChangedEvent (success/failure)
 * 
 * MODE CHANGE:
 * 1. User: Shift+Tab  
 * 2. CLI → Agent: ModeChangeRequestedEvent
 * 3. Agent → CLI: ModeChangedEvent (confirmation)
 * 
 * PROMPT PROCESSING:
 * 1. User: "explain quantum computing"
 * 2. CLI → Agent: PromptRequestedEvent
 * 3. Agent → CLI: ProgressEvent (parsing, llm_processing, etc.)
 * 4. Agent → CLI: MessageChunkEvent(s) (streaming response)
 * 5. Agent → CLI: CompleteEvent (final result + metadata)
 * 
 * STATUS REQUEST:
 * 1. User: /status
 * 2. CLI → Agent: StatusRequestedEvent  
 * 3. Agent → CLI: StatusResponseEvent
 * 
 * CANCELLATION:
 * 1. User: Ctrl+C or Esc
 * 2. CLI → Agent: CancelRequestedEvent
 * 3. Agent → CLI: CancelledEvent (confirmation)
 */