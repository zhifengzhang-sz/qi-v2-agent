# Prompt App Refactoring Plan

## Current Architecture Overview

The Prompt App provides a simplified agent interface without complex 3-way classification:

```
┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│   qi-prompt-cli │────│ PromptAppOrchestrator │────│  Agent Handlers │
│   (readline)    │    │   (lib/src/agent)   │    │ (command/prompt)│
└─────────────────┘    └─────────────────────┘    └─────────────────┘
```

### Key Features
- **Simple 2-category parsing**: `/command` vs `prompt` (no workflows)
- **Same IAgent interface**: Compatible with QiCodeAgent contracts
- **Context-aware prompting**: Maintains conversation history
- **Built-in commands**: `/model`, `/status` for configuration

## Problems with Current Architecture

### 1. **Request/Response Bottleneck**
Current synchronous pattern blocks CLI during long operations:
```typescript
const response = await orchestrator.process(request); // Blocks entire CLI
```

### 2. **No Progress Feedback**
User has no visibility during:
- LLM processing (5-30 seconds)
- File operations
- Command execution

### 3. **No Cancellation Support**
Cannot interrupt long-running operations.

### 4. **State Synchronization Issues**
CLI and agent state can become inconsistent.

## Proposed Callback-Based Architecture

### **Bidirectional Event System**

Replace synchronous request/response with event-driven callbacks:

```typescript
// Agent → CLI Events
interface AgentCallbacks {
  onStateChange(newState: AgentState): void;
  onProgress(progress: ProgressUpdate): void;
  onMessage(message: StreamingMessage): void;
  onError(error: AgentError): void;
  onComplete(result: AgentResult): void;
}

// CLI → Agent Events
interface CLICallbacks {
  onUserInput(input: string): void;
  onCommand(command: ParsedCommand): void;
  onCancel(): void;
  onConfigChange(config: AgentConfig): void;
}
```

### **Refactored Architecture**

```
┌─────────────────┐                    ┌─────────────────────┐
│   qi-prompt-cli │◄──────events──────►│ PromptAppOrchestrator │
│                 │                    │                     │
│ • onProgress    │                    │ • onUserInput       │
│ • onMessage     │                    │ • onCommand         │
│ • onStateChange │                    │ • onCancel          │
│ • onError       │                    │ • onConfigChange    │
└─────────────────┘                    └─────────────────────┘
         │                                        │
         │              ┌─────────────────────┐   │
         └─────events───►│   EventManager     │◄──┘
                        │ (EventEmitter)     │
                        └─────────────────────┘
```

## Implementation Strategy

### **Phase 1: EventEmitter Foundation**
Start with Node.js EventEmitter pattern for immediate productivity:

```typescript
import { EventEmitter } from 'node:events';

class PromptAppOrchestrator extends EventEmitter implements IAgent {
  // Emit progress during operations
  async process(request: AgentRequest): Promise<AgentResponse> {
    this.emit('progress', { phase: 'parsing', progress: 0.1 });
    const parsed = parseInput(request.input);
    
    this.emit('progress', { phase: 'processing', progress: 0.3 });
    // ... processing logic
    
    this.emit('message', { content: 'Generating response...', type: 'status' });
    const result = await this.executeRequest(parsed);
    
    this.emit('complete', result);
    return result;
  }
}
```

### **Phase 2: Enhanced CLI with Live Updates**

```typescript
class QiPromptCLI {
  constructor() {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers() {
    // Agent → CLI events
    this.orchestrator.on('progress', (progress) => {
      this.showProgressBar(progress.phase, progress.progress);
    });
    
    this.orchestrator.on('message', (message) => {
      if (message.type === 'streaming') {
        process.stdout.write(message.content);
      }
    });
    
    this.orchestrator.on('stateChange', (state) => {
      this.updateStatusLine(state);
    });
    
    // CLI → Agent events  
    this.rl.on('SIGINT', () => {
      this.orchestrator.emit('cancel');
    });
  }
}
```

### **Phase 3: Migration from Synchronous to Event-Driven**

**Current (Synchronous):**
```typescript
private async processInput(input: string) {
  try {
    const response = await this.orchestrator.process({ input, context: this.context });
    console.log(response.content);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}
```

**New (Event-Driven):**
```typescript
private async processInput(input: string) {
  // Trigger processing (non-blocking)
  this.orchestrator.emit('userInput', input);
  
  // CLI continues to be responsive
  // Results come via onMessage/onComplete events
}
```

## Future Considerations: XState v5 Migration

When complexity grows (workflow support, multiple agent modes), migrate to XState v5:

```typescript
import { setup, assign } from 'xstate';

const promptAppMachine = setup({
  types: {
    context: {} as {
      currentRequest: AgentRequest | null;
      processingPhase: string;
      progress: number;
    },
    events: {} as 
      | { type: 'USER_INPUT'; input: string }
      | { type: 'CANCEL' }
      | { type: 'COMPLETE'; result: AgentResponse }
  },
}).createMachine({
  context: {
    currentRequest: null,
    processingPhase: 'idle',
    progress: 0,
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        USER_INPUT: {
          target: 'processing',
          actions: assign({
            currentRequest: ({ event }) => ({ input: event.input, context: {} }),
            processingPhase: 'parsing'
          })
        }
      }
    },
    processing: {
      // State machine handles complex async flows
    }
  }
});
```

## Benefits of Callback Architecture

### **1. Responsive User Experience**
- Live progress indicators during LLM calls
- Streaming responses appear character-by-character
- CLI remains interactive during processing

### **2. Cancellation Support**
- Ctrl+C properly cancels operations
- Cleanup and state recovery
- User control over long operations

### **3. Better Error Handling**
- Granular error reporting
- Recovery suggestions
- State consistency maintenance

### **4. Testing & Development**
- Mock events for testing
- Easy debugging via event logs
- Cleaner separation of concerns

## Migration Timeline

1. **Week 1**: EventEmitter foundation, basic progress events
2. **Week 2**: Full CLI integration, streaming messages  
3. **Week 3**: Cancellation support, error recovery
4. **Week 4**: Testing, documentation, polish

## Example: Live Progress Demo

```bash
> Explain quantum computing in simple terms

[████████░░] 80% Processing request...
╭─ Streaming Response ─╮
│ Quantum computing     │
│ uses quantum bits...  │
│                       │
│ [Ctrl+C to cancel]    │
╰───────────────────────╯

✅ Complete (4.2s) | Model: qwen3:8b | Tokens: 156
```

This callback architecture transforms the prompt app from a simple CLI tool into a responsive, professional development environment.