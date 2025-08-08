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

---

# CLI Framework Architecture Refactoring Plan

## Current CLI Design Problems

The current EventDrivenCLI implementation in `lib/src/cli/impl/EventDrivenCLI.ts` violates several SOLID design principles:

- **SRP Violation**: EventDrivenCLI handles too many responsibilities (terminal I/O, UI rendering, event management, agent communication)
- **DIP Violation**: Direct instantiation of concrete classes instead of depending on abstractions
- **Tight Coupling**: Hard-coded dependencies make testing and extension difficult  
- **God Class**: EventDrivenCLI is becoming monolithic with 700+ lines

## Proposed CLI Framework Architecture

### Phase 1: Terminal Abstraction Layer

Create clean interfaces for terminal operations:

```typescript
interface ITerminal {
  write(text: string): void;
  clear(): void;
  clearLine(): void;
  moveCursor(x: number, y: number): void;
  getDimensions(): { width: number; height: number };
  saveCursor(): void;
  restoreCursor(): void;
}

interface IInputManager {
  onInput(callback: (input: string) => void): void;
  onKeypress(callback: (key: string, data: any) => void): void;
  setPrompt(prompt: string): void;
  showPrompt(): void;
  close(): void;
}
```

**Implementations:**
- `ReadlineTerminal` & `ReadlineInputManager` - current readline-based implementation
- `InkTerminal` & `InkInputManager` - future Ink.js support
- `BlessedTerminal` & `BlessedInputManager` - future neo-blessed support

### Phase 2: UI Component Layer

Extract UI responsibilities into pluggable components:

```typescript
interface IUIComponent {
  render(): void;
  update(data: any): void;
  show(): void;
  hide(): void;
  destroy(): void;
}

interface IProgressRenderer extends IUIComponent {
  start(config: ProgressConfig): void;
  updateProgress(progress: number, phase: string): void;
  complete(message?: string): void;
}

interface IModeRenderer extends IUIComponent {
  setMode(mode: CLIMode): void;
  cycleMode(): CLIMode;
  getPromptPrefix(): string;
}

interface IStreamRenderer extends IUIComponent {
  startStreaming(): void;
  addChunk(content: string): void;
  complete(): void;
  cancel(): void;
}
```

### Phase 3: Services Layer

Extract business logic into dedicated services:

```typescript
interface IEventManager {
  on(event: string, callback: Function): void;
  emit(event: string, data: any): void;
  off(event: string, callback: Function): void;
  destroy(): void;
}

interface ICommandRouter {
  parseInput(input: string): { type: 'command' | 'prompt'; content: string };
  handleCommand(command: string): boolean;
  addCommandHandler(command: string, handler: Function): void;
}

interface IAgentConnector {
  connect(agent: any): void;
  disconnect(): void;
  sendToAgent(input: string): void;
  cancelAgent(): void;
}
```

### Phase 4: Dependency Injection Container

```typescript
interface ICLIContainer {
  register<T>(key: string, factory: () => T): void;
  resolve<T>(key: string): T;
  createCLI(config: CLIConfig): ICLIFramework;
}

class CLIContainer implements ICLIContainer {
  private dependencies = new Map<string, () => any>();
  
  register<T>(key: string, factory: () => T): void {
    this.dependencies.set(key, factory);
  }
  
  resolve<T>(key: string): T {
    const factory = this.dependencies.get(key);
    if (!factory) throw new Error(`Dependency '${key}' not registered`);
    return factory();
  }
  
  createCLI(config: CLIConfig): ICLIFramework {
    return new EventDrivenCLI(
      this.resolve<ITerminal>('terminal'),
      this.resolve<IInputManager>('inputManager'),
      this.resolve<IProgressRenderer>('progressRenderer'),
      this.resolve<IModeRenderer>('modeRenderer'),
      this.resolve<IStreamRenderer>('streamRenderer'),
      this.resolve<IEventManager>('eventManager'),
      this.resolve<ICommandRouter>('commandRouter'),
      this.resolve<IAgentConnector>('agentConnector'),
      config
    );
  }
}
```

### Phase 5: Refactored EventDrivenCLI

Slim down to pure orchestration:

```typescript
export class EventDrivenCLI implements ICLIFramework, IAgentCLIBridge {
  constructor(
    private terminal: ITerminal,
    private inputManager: IInputManager,
    private progressRenderer: IProgressRenderer,
    private modeRenderer: IModeRenderer,
    private streamRenderer: IStreamRenderer,
    private eventManager: IEventManager,
    private commandRouter: ICommandRouter,
    private agentConnector: IAgentConnector,
    private config: CLIConfig
  ) {
    this.setupEventHandlers();
  }
  
  // Pure orchestration - delegates to injected components
  async start(): Promise<void> {
    this.terminal.write('🚀 Event-Driven CLI Ready\n');
    this.modeRenderer.show();
    this.inputManager.showPrompt();
  }
  
  displayProgress(phase: string, progress: number): void {
    this.progressRenderer.updateProgress(progress, phase);
  }
  
  // No direct terminal operations or component instantiation
}
```

### Factory Functions for Different Configurations

```typescript
// Default readline-based CLI
export function createReadlineCLI(config: CLIConfig): ICLIFramework {
  const container = new CLIContainer();
  
  container.register('terminal', () => new ReadlineTerminal());
  container.register('inputManager', () => new ReadlineInputManager());
  container.register('progressRenderer', () => new ProgressRenderer(container.resolve('terminal')));
  container.register('modeRenderer', () => new ModeRenderer(container.resolve('terminal')));
  container.register('streamRenderer', () => new StreamRenderer(container.resolve('terminal')));
  container.register('eventManager', () => new EventManager());
  container.register('commandRouter', () => new CommandRouter());
  container.register('agentConnector', () => new AgentConnector());
  
  return container.createCLI(config);
}

// Future: Ink.js-based CLI  
export function createInkCLI(config: CLIConfig): ICLIFramework {
  const container = new CLIContainer();
  
  container.register('terminal', () => new InkTerminal());
  container.register('inputManager', () => new InkInputManager());
  // ... Ink-specific implementations
  
  return container.createCLI(config);
}

// Backward compatibility
export function createEventDrivenCLI(config?: Partial<CLIConfig>): ICLIFramework {
  return createReadlineCLI({ ...DefaultCLIConfig, ...config });
}
```

## Benefits of New Architecture

### **Testability**
Each component can be unit tested in isolation with mock dependencies:

```typescript
describe('EventDrivenCLI', () => {
  it('should display progress when agent reports progress', () => {
    const mockProgressRenderer = jest.fn();
    const cli = new EventDrivenCLI(/* inject mocks */);
    
    cli.displayProgress('processing', 0.5);
    
    expect(mockProgressRenderer.updateProgress).toHaveBeenCalledWith(0.5, 'processing');
  });
});
```

### **Extensibility**
Easy to add new UI frameworks without changing core logic:

```typescript
// Add blessed support without touching EventDrivenCLI
export function createBlessedCLI(config: CLIConfig): ICLIFramework {
  const container = new CLIContainer();
  container.register('terminal', () => new BlessedTerminal());
  // ... blessed implementations
  return container.createCLI(config);
}
```

### **Maintainability**
Clear separation of concerns - each class has a single responsibility:

- `EventDrivenCLI` - orchestration only
- `ReadlineTerminal` - terminal operations only  
- `ProgressRenderer` - progress display only
- `ModeRenderer` - mode indication only

### **SOLID Compliance**
- **S**RP: Each class has one reason to change
- **O**CP: Open for extension via new implementations, closed for modification
- **L**SP: All implementations honor their interface contracts  
- **I**SP: Interfaces are focused and cohesive
- **D**IP: Depend on abstractions, not concretions

## Implementation Strategy

### Backward Compatibility
- Keep existing `setupQuickCLI()` function unchanged
- Existing CLI users don't need to modify their code
- Internal refactoring only - external API preserved

### Migration Approach  
1. **Phase 1**: Create new interfaces alongside existing code
2. **Phase 2**: Implement concrete classes for each interface
3. **Phase 3**: Create dependency injection container and factories
4. **Phase 4**: Refactor EventDrivenCLI to use injected dependencies
5. **Phase 5**: Update factory functions to use new architecture
6. **Phase 6**: Testing and validation - ensure all functionality works

### File Structure
```
lib/src/cli/
├── abstractions/
│   ├── ITerminal.ts
│   ├── IUIComponent.ts
│   └── ICLIServices.ts
├── terminal/
│   ├── ReadlineTerminal.ts
│   ├── InkTerminal.ts (future)
│   └── BlessedTerminal.ts (future)
├── renderers/
│   ├── ProgressRenderer.ts
│   ├── ModeRenderer.ts
│   └── StreamRenderer.ts
├── services/
│   ├── EventManager.ts
│   ├── CommandRouter.ts
│   └── AgentConnector.ts
├── container/
│   └── CLIContainer.ts
├── factories/
│   ├── createReadlineCLI.ts
│   ├── createInkCLI.ts
│   └── createBlessedCLI.ts
└── impl/
    └── EventDrivenCLI.ts (refactored)
```

This architecture refactoring will transform the CLI from a monolithic implementation into a modular, testable, and extensible framework that can support multiple terminal backends while maintaining clean separation of concerns.