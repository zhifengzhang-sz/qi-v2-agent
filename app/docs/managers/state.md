# State Manager Design & Implementation Guide

## Overview

The State Manager is a centralized, passive data store that manages application configuration, session state, conversation history, and application context. It serves as the single source of truth for all stateful information in the qi-v2 agent system.

## Design Philosophy

### Core Principles

1. **Centralized State**: Single source of truth for all application state
2. **Passive Store**: No automatic notifications - components request state when needed
3. **Immutable Interfaces**: Read-only access with explicit update methods
4. **Technology Agnostic**: Pure TypeScript interfaces with no framework dependencies
5. **Contract-Based**: Components interact via well-defined contracts

### Architecture Position

```
Agent → StateManager (via contracts)
     ↓
Agent gets: Config, Context, Session, Model Info
Agent sets: Current Model, Mode, History Updates
```

The StateManager is **owned by the Agent** and accessed through contracts, not as a flow-through component.

## Core Components

### 1. Application Configuration (`AppConfig`)

Manages system-wide configuration settings:

```typescript
interface AppConfig {
  readonly version: string;                    // Application version
  readonly defaultModel: string;              // Default LLM model
  readonly availableModels: readonly string[]; // Available model IDs
  readonly enableDebugMode: boolean;          // Debug mode flag
  readonly maxHistorySize: number;            // Conversation history limit
  readonly sessionTimeout: number;            // Session timeout (ms)
  readonly preferences: ReadonlyMap<string, unknown>; // User preferences
}
```

**Use Cases:**
- System initialization
- Model availability checks
- User preference management
- Debug mode controls

### 2. Application Context (`AppContext`)

Manages execution environment context:

```typescript
interface AppContext {
  readonly sessionId: string;                  // Current session identifier
  readonly userId?: string;                    // User identifier (optional)
  readonly workspaceId?: string;              // Workspace identifier (optional)
  readonly currentDirectory: string;          // Working directory
  readonly environment: ReadonlyMap<string, string>; // Environment variables
  readonly metadata: ReadonlyMap<string, unknown>;   // Additional context
}
```

**Use Cases:**
- Command execution context
- File path resolution
- User session tracking
- Environment-specific behavior

### 3. Session Management (`SessionData`)

Manages conversation sessions and history:

```typescript
interface SessionData {
  readonly id: string;                        // Unique session ID
  readonly userId?: string;                   // Associated user
  readonly createdAt: Date;                   // Session creation time
  readonly lastActiveAt: Date;                // Last activity timestamp
  readonly conversationHistory: readonly ConversationEntry[]; // Conversation log
  readonly context: AppContext;              // Session context
  readonly metadata: ReadonlyMap<string, unknown>; // Session metadata
}

interface ConversationEntry {
  readonly id: string;                        // Entry ID
  readonly timestamp: Date;                   // Entry timestamp
  readonly type: 'user_input' | 'agent_response' | 'system_message';
  readonly content: string;                   // Entry content
  readonly metadata: ReadonlyMap<string, unknown>; // Entry metadata
}
```

**Use Cases:**
- Conversation continuity
- History analysis
- Session persistence
- Context preservation

### 4. Model Management (`ModelInfo`)

Manages available LLM models:

```typescript
interface ModelInfo {
  readonly id: string;                        // Model identifier
  readonly name: string;                      // Display name
  readonly provider: string;                  // Provider (ollama, groq, openai)
  readonly available: boolean;                // Availability status
  readonly description?: string;              // Model description
}
```

**Use Cases:**
- Model selection
- Availability checking
- Provider routing
- Model switching

## State Manager Interface

### Core Methods

```typescript
interface IStateManager {
  // Configuration Management
  getConfig(): AppConfig;
  updateConfig(updates: Partial<AppConfig>): void;
  resetConfig(): void;
  
  // Model Management
  getCurrentModel(): string;
  setCurrentModel(modelId: string): void;
  getAvailableModels(): readonly ModelInfo[];
  getModelInfo(modelId: string): ModelInfo | null;
  addModel(model: ModelInfo): void;
  removeModel(modelId: string): void;
  
  // Mode Management
  getCurrentMode(): AppMode;
  setCurrentMode(mode: AppMode): void;
  
  // Context Management
  getContext(): AppContext;
  updateContext(updates: Partial<AppContext>): void;
  resetContext(): void;
  
  // Session Management
  getCurrentSession(): SessionData;
  createSession(userId?: string): SessionData;
  loadSession(sessionId: string): SessionData | null;
  saveSession(): void;
  addConversationEntry(entry: Omit<ConversationEntry, 'id' | 'timestamp'>): void;
  clearConversationHistory(): void;
  
  // State Persistence
  save(): Promise<void>;
  load(): Promise<void>;
  
  // Notifications (Optional)
  subscribe(listener: StateChangeListener): () => void;
  
  // Utilities
  getState(): CompleteState;
  reset(): void;
}
```

### Application Modes

```typescript
type AppMode = 'ready' | 'planning' | 'editing' | 'executing' | 'error';
```

- **ready**: System ready for input
- **planning**: Agent planning workflow
- **editing**: Actively editing files
- **executing**: Running commands/tools
- **error**: Error state requiring attention

## Implementation Architecture

### Directory Structure

```
src/state/
├── index.ts                    # Public API exports
├── abstractions/
│   ├── index.ts               # Interface exports
│   └── IStateManager.ts       # Core interfaces
└── impl/
    └── StateManager.ts        # Concrete implementation
```

### Implementation Details

#### 1. Memory-Based Storage

```typescript
export class StateManager implements IStateManager {
  private config: AppConfig;
  private currentModel: string;
  private currentMode: AppMode;
  private context: AppContext;
  private session: SessionData;
  private models: Map<string, ModelInfo>;
  private listeners: Set<StateChangeListener>;
}
```

#### 2. Default Configuration

```typescript
const DEFAULT_CONFIG: AppConfig = {
  version: '0.2.7',
  defaultModel: 'ollama',
  availableModels: ['ollama', 'groq', 'openai'],
  enableDebugMode: false,
  maxHistorySize: 100,
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  preferences: new Map()
};
```

#### 3. State Change Notifications

```typescript
interface StateChange {
  readonly type: 'config' | 'model' | 'mode' | 'context' | 'session';
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly timestamp: Date;
}
```

Components can subscribe to state changes for reactive updates.

## Usage Patterns

### 1. Agent Integration

```typescript
class QiCodeAgent implements IAgent {
  private stateManager: IStateManager;
  
  constructor(stateManager: IStateManager, config: AgentConfig) {
    this.stateManager = stateManager;
  }
  
  async process(request: AgentRequest): Promise<AgentResponse> {
    // Get current context
    const context = this.stateManager.getContext();
    const model = this.stateManager.getCurrentModel();
    
    // Process request...
    
    // Update conversation history
    this.stateManager.addConversationEntry({
      type: 'user_input',
      content: request.input,
      metadata: new Map([['model', model]])
    });
  }
}
```

### 2. State Commands

The StateManager supports built-in state commands:

```typescript
// Model management
/model                  // Show current and available models
/model ollama          // Switch to ollama model

// Status information
/status                // Show complete agent status
/config               // Show configuration

// Mode management
/mode                 // Show current mode
/mode planning        // Set mode to planning

// Session management
/session             // Show session information
```

### 3. Factory Pattern

```typescript
// Create state manager with defaults
export function createStateManager(): StateManager {
  return new StateManager();
}

// Usage
const stateManager = createStateManager();
const agent = createAgent(stateManager, agentConfig);
```

## State Persistence

### Current Implementation

- **Memory-based**: State exists only during application lifetime
- **Session Management**: Basic session creation and management
- **History Tracking**: Conversation history with size limits

### Future Enhancements

```typescript
// File-based persistence
async save(): Promise<void> {
  const state = this.getState();
  await fs.writeFile('state.json', JSON.stringify(state, null, 2));
}

async load(): Promise<void> {
  const data = await fs.readFile('state.json', 'utf-8');
  const state = JSON.parse(data);
  // Restore state...
}
```

## Security Considerations

### 1. Immutable Interfaces

All external interfaces are readonly to prevent accidental mutations:

```typescript
// Safe - returns copy
getConfig(): AppConfig

// Safe - controlled updates
updateConfig(updates: Partial<AppConfig>): void
```

### 2. Environment Variable Filtering

```typescript
// Only include defined environment variables
environment: new Map(
  Object.entries(process.env)
    .filter(([_, v]) => v !== undefined) as [string, string][]
)
```

### 3. Metadata Isolation

Each component gets its own metadata space to prevent conflicts.

## Testing Strategy

### 1. Unit Tests

```typescript
describe('StateManager', () => {
  test('should create with default configuration', () => {
    const manager = new StateManager();
    expect(manager.getCurrentModel()).toBe('ollama');
  });
  
  test('should manage conversation history', () => {
    const manager = new StateManager();
    manager.addConversationEntry({
      type: 'user_input',
      content: 'test message',
      metadata: new Map()
    });
    
    const session = manager.getCurrentSession();
    expect(session.conversationHistory).toHaveLength(1);
  });
});
```

### 2. Integration Tests

```typescript
test('agent state integration', async () => {
  const stateManager = createStateManager();
  const agent = createAgent(stateManager, config);
  
  await agent.initialize();
  
  // Verify agent can access state
  expect(agent.getStatus().isInitialized).toBe(true);
});
```

## Performance Considerations

### 1. Memory Management

- History size limits prevent unbounded growth
- Session timeouts for cleanup
- Lazy loading for large data structures

### 2. State Access Patterns

- Immutable returns prevent accidental mutations
- Copy-on-read for complex objects
- Efficient Map/Set operations for lookups

### 3. Notification System

- Optional listener system for reactive updates
- Debounced notifications for high-frequency changes
- Cleanup mechanisms for listener removal

## Error Handling

### 1. Configuration Validation

```typescript
setCurrentModel(modelId: string): void {
  if (!this.models.has(modelId)) {
    throw new Error(`Model '${modelId}' not found`);
  }
  // Set model...
}
```

### 2. State Consistency

- Atomic updates for related state changes
- Rollback mechanisms for failed operations
- Validation for state transitions

### 3. Recovery Patterns

```typescript
reset(): void {
  // Reset to known good state
  this.config = { ...DEFAULT_CONFIG };
  this.currentModel = DEFAULT_CONFIG.defaultModel;
  this.currentMode = 'ready';
  // ...
}
```

## Migration Path

### From Previous Architecture

1. **Centralize scattered state** → Single StateManager
2. **Replace direct state access** → Contract-based access
3. **Consolidate configuration** → AppConfig interface
4. **Unify session management** → SessionData structure

### Breaking Changes

- State access patterns changed from direct to contract-based
- Configuration structure normalized
- Session management centralized

## Future Enhancements

### 1. Advanced Persistence

- Database backends (SQLite, PostgreSQL)
- Cloud storage integration
- Backup and restore capabilities

### 2. State Validation

- Schema validation for state consistency
- Type-safe state migrations
- State integrity checks

### 3. Performance Optimization

- State caching layers
- Incremental updates
- Memory usage optimization

---

## Quick Reference

### Key Interfaces

- `IStateManager` - Main state management contract
- `AppConfig` - Application configuration
- `AppContext` - Execution context
- `SessionData` - Session and conversation data
- `ModelInfo` - LLM model information

### Key Implementation

- `StateManager` - Concrete implementation
- `createStateManager()` - Factory function

### Integration Pattern

```typescript
// Agent owns StateManager
const stateManager = createStateManager();
const agent = createAgent(stateManager, config);

// Agent accesses state via contracts
const model = this.stateManager.getCurrentModel();
this.stateManager.addConversationEntry(entry);
```

This design provides a robust, centralized state management system that supports the qi-v2 agent's architecture while maintaining flexibility for future enhancements.