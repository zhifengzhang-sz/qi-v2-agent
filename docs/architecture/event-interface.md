# CLI ↔ Agent Event Interface

## CLI → Agent Events

### State Change Requests
```typescript
// Model changes
interface ModelChangeRequestedEvent {
  type: 'modelChangeRequested';
  modelName: string;
  timestamp: Date;
}

// Mode changes
interface ModeChangeRequestedEvent {
  type: 'modeChangeRequested';
  mode: 'interactive' | 'command' | 'streaming';
  timestamp: Date;
}

// Configuration changes
interface ConfigChangeRequestedEvent {
  type: 'configChangeRequested';
  config: Partial<AgentConfig>;
  timestamp: Date;
}
```

### Processing Requests
```typescript
// User prompts
interface PromptRequestedEvent {
  type: 'promptRequested';
  prompt: string;
  context?: Map<string, unknown>;
  timestamp: Date;
}

// Status requests
interface StatusRequestedEvent {
  type: 'statusRequested';
  timestamp: Date;
}

// Cancel operations
interface CancelRequestedEvent {
  type: 'cancelRequested';
  timestamp: Date;
}
```

## Agent → CLI Events

### State Change Confirmations
```typescript
// Model changed confirmation
interface ModelChangedEvent {
  type: 'modelChanged';
  oldModel: string;
  newModel: string;
  success: boolean;
  error?: string;
  timestamp: Date;
}

// Mode changed confirmation
interface ModeChangedEvent {
  type: 'modeChanged';
  oldMode: string;
  newMode: string;
  success: boolean;
  timestamp: Date;
}

// Configuration changed
interface ConfigChangedEvent {
  type: 'configChanged';
  changes: Record<string, { oldValue: unknown; newValue: unknown }>;
  success: boolean;
  timestamp: Date;
}
```

### Processing Responses
```typescript
// Status response
interface StatusResponseEvent {
  type: 'statusResponse';
  status: {
    model: string;
    mode: string;
    uptime: number;
    provider: string;
    availableCommands: number;
  };
  timestamp: Date;
}

// Progress updates
interface ProgressEvent {
  type: 'progress';
  phase: string;
  progress: number; // 0-1
  details?: string;
  timestamp: Date;
}

// Streaming message chunks
interface MessageChunkEvent {
  type: 'messageChunk';
  content: string;
  isComplete: boolean;
  timestamp: Date;
}

// Operation complete
interface CompleteEvent {
  type: 'complete';
  result: {
    content: string;
    executionTime: number;
    metadata: Map<string, unknown>;
  };
  timestamp: Date;
}

// Errors
interface ErrorEvent {
  type: 'error';
  error: {
    code: string;
    message: string;
    context?: Record<string, unknown>;
  };
  timestamp: Date;
}

// Operation cancelled
interface CancelledEvent {
  type: 'cancelled';
  reason: string;
  timestamp: Date;
}
```

## CLI-Only Operations (No Agent Events)

```typescript
// These are handled directly in CLI, no events needed
- /exit    → CLI terminates process
- /clear   → CLI clears screen  
- /help    → CLI shows usage help
```

## Event Flow Examples

### Model Change Flow
```
1. User: /model llama3.2:3b
2. CLI → Agent: ModelChangeRequestedEvent { modelName: 'llama3.2:3b' }
3. Agent: calls stateManager.setCurrentModel('llama3.2:3b')
4. Agent → CLI: ModelChangedEvent { oldModel: 'qwen3:8b', newModel: 'llama3.2:3b', success: true }
5. CLI: updates prompt display with new model
```

### Prompt Flow
```
1. User: "explain quantum computing"
2. CLI → Agent: PromptRequestedEvent { prompt: 'explain quantum computing' }
3. Agent → CLI: ProgressEvent { phase: 'processing', progress: 0.1 }
4. Agent → CLI: ProgressEvent { phase: 'llm_processing', progress: 0.5 }
5. Agent → CLI: MessageChunkEvent { content: 'Quantum computing...', isComplete: false }
6. Agent → CLI: MessageChunkEvent { content: 'uses quantum bits...', isComplete: false }
7. Agent → CLI: CompleteEvent { result: { content: '...', executionTime: 4200 } }
```

### Mode Change Flow
```
1. User: Shift+Tab
2. CLI → Agent: ModeChangeRequestedEvent { mode: 'command' }
3. Agent: calls stateManager.setCurrentMode('command')
4. Agent → CLI: ModeChangedEvent { oldMode: 'interactive', newMode: 'command', success: true }
5. CLI: updates mode indicator display
```

## Implementation Notes

- All events include timestamps for debugging/logging
- State changes go through Agent's StateManager for consistency
- CLI never directly manages Agent state
- Error handling via ErrorEvent for all failed operations
- Agent emits confirmation events even for successful state changes