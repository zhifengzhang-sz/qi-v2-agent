# Qi-Prompt App Architecture & Design

## Fundamental Design Pattern

**Abstractions provide the framework and execution structure**
**Concretes provide the content and specific behavior**

### Framework vs Content Separation

**Framework (Abstractions)**:
- CLI framework provides event handling, input/output, UI components
- Agent framework provides processing pipeline, state management, lifecycle
- App framework provides initialization, wiring, configuration

**Content (Concretes)**:
- Specific event types (ModelChangeRequested, PromptRequested)
- Business logic (model switching, prompt processing)
- UI behavior (progress display, streaming responses)

## Architecture Layers

### Layer 1: Abstract Frameworks
```
lib/src/cli/abstractions/     - Generic CLI framework
lib/src/agent/abstractions/   - Generic Agent framework  
lib/src/state/abstractions/   - Generic StateManager framework
```

**Responsibilities:**
- Define execution flow and lifecycle
- Provide extension points for concrete implementations
- Handle cross-cutting concerns (error handling, logging, events)

### Layer 2: Concrete Implementations
```
lib/src/cli/impl/            - Specific CLI implementations (EventDrivenCLI)
lib/src/agent/impl/          - Specific Agent implementations (PromptAppOrchestrator)
lib/src/state/impl/          - Specific StateManager implementations
```

**Responsibilities:**
- Implement abstract interfaces with specific behavior
- Provide concrete business logic
- Handle framework-specific details

### Layer 3: App-Specific Content
```
app/src/prompt/              - Qi-Prompt specific content
├── events/                  - App-specific event definitions
├── commands/                - App-specific command implementations  
├── qi-prompt.ts            - App assembly and wiring
```

**Responsibilities:**
- Define app-specific events and data structures
- Provide app-specific business logic
- Wire framework components with app content

## Event Architecture Design

### Problem with Previous Approach
❌ **Events defined in CLI abstractions**
- Creates circular dependencies
- Makes frameworks app-specific
- Violates separation of concerns

### Correct Approach
✅ **Events defined at App level**

**1. Abstract Framework Level:**
```typescript
// lib/src/cli/abstractions/ICLIFramework.ts
interface ICLIFramework<TEvent> {
  emit(event: TEvent): void;
  on(handler: (event: TEvent) => void): void;
}

// lib/src/agent/abstractions/IAgent.ts  
interface IAgent<TEvent> {
  on(handler: (event: TEvent) => void): void;
  emit(event: TEvent): void;
}
```

**2. App Content Level:**
```typescript
// app/src/prompt/events/PromptAppEvents.ts
export interface ModelChangeRequestedEvent {
  type: 'modelChangeRequested';
  modelName: string;
  timestamp: Date;
}

export interface PromptRequestedEvent {
  type: 'promptRequested';
  prompt: string;
  context?: Map<string, unknown>;
  timestamp: Date;
}

// Union type for this specific app
export type PromptAppCLIEvent = ModelChangeRequestedEvent | PromptRequestedEvent | ...;
export type PromptAppAgentEvent = ModelChangedEvent | StatusResponseEvent | ...;
```

**3. App Assembly Level:**
```typescript
// app/src/prompt/qi-prompt.ts
class QiPromptApp {
  private cli: ICLIFramework<PromptAppCLIEvent>;
  private agent: IAgent<PromptAppAgentEvent>;
  
  constructor() {
    // Create framework instances with app-specific event types
    this.cli = createCLI<PromptAppCLIEvent>();
    this.agent = createAgent<PromptAppAgentEvent>();
    
    // Wire events - App handles the bridging
    this.setupEventBridge();
  }
}
```

## Command Architecture Design

### Problem with Current Approach
❌ **Dual CommandHandlers**
- App has its own CommandHandler with stub implementations
- Agent has real CommandHandler with actual logic
- Creates confusion and duplication

### Correct Approach
✅ **Single Source of Truth**

**1. Agent owns CommandHandler:**
```typescript
// lib/src/agent/impl/PromptAppOrchestrator.ts
class PromptAppOrchestrator implements IAgent {
  private commandHandler: ICommandHandler; // Owns the real commands
  
  constructor() {
    this.commandHandler = createCommandHandler();
    this.registerCommands(); // Register real implementations
  }
}
```

**2. App defines command content:**
```typescript
// app/src/prompt/commands/ModelCommand.ts
export function createModelCommand(stateManager: IStateManager): CommandDefinition {
  return {
    name: 'model',
    description: 'Show or change the current LLM model',
    handler: async (request) => {
      const modelName = request.parameters.get('model_name') as string;
      
      if (!modelName) {
        const currentModel = stateManager.getCurrentModel();
        return { success: true, content: `Current model: ${currentModel}` };
      }
      
      stateManager.setCurrentModel(modelName);
      return { success: true, content: `Switched to model: ${modelName}` };
    }
  };
}
```

**3. Agent registers app-provided commands:**
```typescript
// lib/src/agent/impl/PromptAppOrchestrator.ts
private registerCommands(): void {
  // App provides command definitions, Agent registers them
  const modelCommand = createModelCommand(this.stateManager);
  const statusCommand = createStatusCommand(this.stateManager);
  
  this.commandHandler.registerCommand(modelCommand.name, modelCommand.handler);
  this.commandHandler.registerCommand(statusCommand.name, statusCommand.handler);
}
```

**4. CLI uses Agent's CommandHandler:**
```typescript
// No separate CommandHandler in CLI or App
// CLI sends events → Agent handles via its CommandHandler → Agent sends events back
```

## State Management Flow

### Correct Event-Driven State Flow
```
1. User Action (CLI)
   ↓
2. Event Emission (CLI → Agent)  
   ↓
3. State Change (Agent → StateManager)
   ↓
4. Confirmation Event (Agent → CLI)
   ↓
5. UI Update (CLI)
```

**Example - Model Change:**
```typescript
// 1. User types /model llama3.2:3b
cli.handleInput('/model llama3.2:3b');

// 2. CLI parses and emits event
cli.emit({ type: 'modelChangeRequested', modelName: 'llama3.2:3b' });

// 3. Agent receives event and delegates to CommandHandler
agent.on('modelChangeRequested', (event) => {
  const result = this.commandHandler.executeCommand({
    commandName: 'model',
    parameters: new Map([['model_name', event.modelName]])
  });
});

// 4. CommandHandler calls StateManager
stateManager.setCurrentModel('llama3.2:3b');

// 5. Agent emits confirmation
agent.emit({ type: 'modelChanged', oldModel: 'qwen3:8b', newModel: 'llama3.2:3b' });

// 6. CLI updates display
cli.on('modelChanged', (event) => {
  this.updatePromptDisplay(event.newModel);
});
```

## CLI-Local vs Agent Operations

### CLI-Local Operations
```typescript
// Handled directly in CLI, no Agent involvement
- /exit     → CLI terminates process
- /clear    → CLI clears screen
- /help     → CLI shows usage (CLI-specific help)
- Shift+Tab → CLI cycles modes locally, then emits event to sync Agent state
```

### Agent Operations  
```typescript
// Sent as events to Agent
- /model    → Agent changes model via StateManager
- /status   → Agent reports current state
- prompts   → Agent processes via LLM
- /config   → Agent updates configuration
```

## Implementation Strategy

### Phase 1: Define App Events
- Create `app/src/prompt/events/PromptAppEvents.ts`
- Define all CLI ↔ Agent event types for this specific app

### Phase 2: Parameterize Frameworks
- Update CLI framework to be generic: `ICLIFramework<TEvent>`
- Update Agent framework to be generic: `IAgent<TEvent>`

### Phase 3: Remove Dual CommandHandlers
- Remove App's CommandHandler entirely
- Move command definitions to `app/src/prompt/commands/`
- Agent registers app-provided commands

### Phase 4: Event-Driven Communication
- CLI emits events instead of calling commands
- Agent listens for events and handles via CommandHandler
- Agent emits confirmation events back to CLI

### Phase 5: App Assembly
- App creates parameterized CLI and Agent
- App handles event bridging/translation
- App becomes pure wiring layer

## Benefits of This Architecture

### Separation of Concerns
- **Frameworks are reusable** across different apps
- **Business logic is centralized** in app layer
- **No circular dependencies** between layers

### Type Safety
- **Generic frameworks** maintain type safety with concrete event types
- **App-specific events** are strongly typed
- **Compile-time verification** of event handling

### Testability
- **Frameworks can be unit tested** with mock events
- **App logic can be tested** independently of frameworks
- **Event flow can be traced** and verified

### Maintainability
- **Clear ownership** of responsibilities at each layer
- **Easy to extend** with new apps using same frameworks
- **Consistent patterns** across the entire system