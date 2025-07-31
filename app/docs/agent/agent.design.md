# qi-v2 Agent Design

## Design Philosophy

The qi-v2 Agent follows an **agent-centric architecture** where the agent serves as the central orchestrator that owns and coordinates all other components. This design provides superior modularity, testability, and maintainability compared to traditional flow-through architectures.

## Core Design Principles

### 1. **Agent Ownership**
The agent **owns** its dependencies rather than being a component in a pipeline:

```typescript
class QiCodeAgent implements IAgent {
  private stateManager: IStateManager;      // OWNED by agent
  private contextManager: IContextManager;  // OWNED by agent (future)
  private classifier?: IClassifier;         // OWNED by agent
  
  constructor(stateManager: IStateManager, config: AgentConfig, dependencies: {...}) {
    this.stateManager = stateManager;  // Direct ownership
    // Agent controls lifecycle and interactions
  }
}
```

**Not**: `CLI → StateManager → Classifier → Agent`  
**But**: `Agent owns StateManager and uses it via contracts`

### 2. **Contract-Based Interactions**
Components interact through well-defined interfaces, not direct dependencies:

```typescript
// Agent accesses state via contracts
const currentModel = this.stateManager.getCurrentModel();
this.stateManager.addConversationEntry(entry);

// Not direct property access or complex coupling
```

### 3. **Three-Type Classification System**
Practical input classification that maps to real-world usage patterns:

```typescript
type ClassificationType = 'command' | 'prompt' | 'workflow';

// Commands: System operations (/help, /config, /model)
// Prompts: Simple requests ("hi", "write quicksort in haskell")  
// Workflows: Complex tasks ("fix bug in src/file.ts and run tests")
```

### 4. **Optional Handler Injection**
Flexible handler system with graceful degradation:

```typescript
interface AgentDependencies {
  classifier?: IClassifier;        // Input classification
  commandHandler?: ICommandHandler; // Built-in commands  
  promptHandler?: IPromptHandler;   // LLM integration
  workflowEngine?: IWorkflowEngine; // Complex tasks
  workflowExtractor?: IWorkflowExtractor; // Task parsing
}
```

## Interface Design

### Agent Interface (`IAgent`)

```typescript
interface IAgent {
  /**
   * Initialize the agent and its dependencies
   */
  initialize(): Promise<void>;
  
  /**
   * Process a single request with full context
   */
  process(request: AgentRequest): Promise<AgentResponse>;
  
  /**
   * Stream responses for real-time interaction
   */
  stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk>;
  
  /**
   * Get current agent status and metrics
   */
  getStatus(): AgentStatus;
  
  /**
   * Shutdown agent and cleanup resources
   */
  shutdown(): Promise<void>;
}
```

### Request/Response Design

#### Agent Request
```typescript
interface AgentRequest {
  readonly input: string;           // User input text
  readonly context: AgentContext;   // Execution context
}

interface AgentContext {
  readonly sessionId: string;       // Session identifier
  readonly timestamp: Date;         // Request timestamp
  readonly source: string;          // Request source (cli, api, web)
  readonly environmentContext?: ReadonlyMap<string, unknown>; // Additional context
}
```

#### Agent Response
```typescript
interface AgentResponse {
  readonly content: string;         // Response content
  readonly type: 'command' | 'prompt' | 'workflow'; // Response type
  readonly confidence: number;      // Classification confidence
  readonly executionTime: number;   // Processing time (ms)
  readonly metadata: ReadonlyMap<string, unknown>; // Response metadata
  readonly success: boolean;        // Success flag
  readonly error?: string;          // Error message if failed
}
```

### Configuration Design

```typescript
interface AgentConfig {
  readonly domain: string;                    // Agent domain/purpose
  readonly enableCommands?: boolean;          // Enable command processing
  readonly enablePrompts?: boolean;           // Enable prompt processing
  readonly enableWorkflows?: boolean;         // Enable workflow processing
  readonly sessionPersistence?: boolean;     // Persist sessions
  readonly configPath?: string;               // Config file path
  readonly providers?: {                      // Provider configurations
    readonly modelProvider?: string;
    readonly toolProvider?: string;
    readonly memoryProvider?: string;
  };
  readonly timeouts?: {                       // Timeout configurations
    readonly commandTimeout?: number;
    readonly promptTimeout?: number;
    readonly workflowTimeout?: number;
  };
  readonly retries?: {                        // Retry configurations
    readonly maxRetries?: number;
    readonly retryDelay?: number;
  };
}
```

## Request Processing Design

### Processing Pipeline

```typescript
async process(request: AgentRequest): Promise<AgentResponse> {
  // 1. Initialization check
  if (!this.isInitialized) {
    throw new Error('Agent not initialized');
  }

  // 2. Built-in state command check (highest priority)
  if (this.isStateCommand(request.input)) {
    return await this.handleStateCommand(request.input);
  }

  // 3. Input classification
  const classification = await this.classifier.classify(request.input);

  // 4. Route to appropriate handler
  switch (classification.type) {
    case 'command': return await this.handleCommand(request, classification);
    case 'prompt': return await this.handlePrompt(request, classification);
    case 'workflow': return await this.handleWorkflow(request, classification);
  }

  // 5. Update conversation history
  this.stateManager.addConversationEntry({
    type: 'agent_response',
    content: response.content,
    metadata: new Map([...response.metadata])
  });
}
```

### State Command Processing

Built-in commands that directly interact with StateManager:

```typescript
private isStateCommand(input: string): boolean {
  const stateCommands = ['/model', '/status', '/config', '/mode', '/session'];
  return stateCommands.some(cmd => input.trim().toLowerCase().startsWith(cmd));
}

private async handleStateCommand(input: string): Promise<AgentResponse> {
  const [command, ...args] = input.trim().split(/\s+/);
  
  switch (command.toLowerCase()) {
    case '/model': return this.handleModelCommand(args);
    case '/status': return this.handleStatusCommand();
    case '/config': return this.handleConfigCommand(args);
    case '/session': return this.handleSessionCommand(args);
    // ...
  }
}
```

### Handler Routing Design

```typescript
private async handlePrompt(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  // Check if handler is available
  if (!this.promptHandler) {
    return this.createErrorResponse('prompt', 'Prompt handler not available');
  }

  // Check if feature is enabled
  if (!this.config.enablePrompts) {
    return this.createDisabledResponse('prompt', 'Prompt processing is disabled');
  }

  // Process with handler
  const result = await this.promptHandler.process({
    input: request.input,
    context: request.context,
    classification
  });

  return this.mapToAgentResponse(result, 'prompt', classification);
}
```

## Error Handling Design

### Graceful Degradation

```typescript
// Handler unavailable - graceful error response
if (!this.workflowEngine) {
  return {
    content: 'Workflow processing not available - this requires workflow engine integration',
    type: 'workflow',
    confidence: 0,
    executionTime: 0,
    metadata: new Map([['error', 'component-unavailable']]),
    success: false,
    error: 'Workflow engine not available'
  };
}
```

### Error Response Standardization

```typescript
private createErrorResponse(
  type: 'command' | 'prompt' | 'workflow',
  message: string
): AgentResponse {
  return {
    content: message,
    type,
    confidence: 0,
    executionTime: 0,
    metadata: new Map([['errorType', 'processing-error']]),
    success: false,
    error: message
  };
}
```

## Streaming Design

```typescript
async *stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk> {
  // Classification phase
  yield {
    type: 'classification',
    content: 'Classifying input...',
    isComplete: false
  };

  const classification = await this.classifier.classify(request.input);
  
  yield {
    type: 'classification',
    content: `Classified as: ${classification.type}`,
    isComplete: true,
    metadata: new Map([['classification', classification]])
  };

  // Processing phase
  yield {
    type: 'processing',
    content: `Processing ${classification.type}...`,
    isComplete: false
  };

  // Execute and stream results
  const response = await this.process(request);
  
  yield {
    type: 'result',
    content: response.content,
    isComplete: true,
    metadata: response.metadata
  };
}
```

## Factory Design

### Agent Factory Pattern

```typescript
export function createAgent(
  stateManager: IStateManager, 
  config: AgentFactoryConfig
): QiCodeAgent {
  
  // Extract core config
  const agentConfig: AgentConfig = {
    domain: config.domain,
    enableCommands: config.enableCommands ?? true,
    enablePrompts: config.enablePrompts ?? true,
    enableWorkflows: config.enableWorkflows ?? true,
    sessionPersistence: config.sessionPersistence ?? false
  };

  // Extract dependencies
  const dependencies = {
    classifier: config.classifier,
    commandHandler: config.commandHandler,
    promptHandler: config.promptHandler,
    workflowEngine: config.workflowEngine,
    workflowExtractor: config.workflowExtractor
  };

  // Create agent with injected dependencies
  return new QiCodeAgent(stateManager, agentConfig, dependencies);
}
```

### Dependency Injection Benefits

1. **Testability**: Easy to inject mocks for testing
2. **Flexibility**: Different handlers for different use cases
3. **Extensibility**: Add new handlers without modifying core agent
4. **Configuration**: Runtime configuration of capabilities

## Status and Metrics Design

### Agent Status Interface

```typescript
interface AgentStatus {
  readonly isInitialized: boolean;       // Initialization state
  readonly domain: string;               // Agent domain
  readonly uptime: number;               // Uptime in milliseconds
  readonly requestsProcessed: number;    // Total requests processed
  readonly averageResponseTime: number;  // Average response time (ms)
  readonly lastActivity?: Date;          // Last activity timestamp
}
```

### Metrics Tracking

```typescript
class QiCodeAgent implements IAgent {
  private requestCount = 0;
  private totalResponseTime = 0;
  private startTime?: Date;
  private lastActivity?: Date;

  async process(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    this.requestCount++;
    this.lastActivity = new Date();

    try {
      // Process request...
      const response = await this.processRequest(request);
      
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;
      
      return { ...response, executionTime };
    } catch (error) {
      // Track errors in metrics
      this.totalResponseTime += Date.now() - startTime;
      throw error;
    }
  }

  getStatus(): AgentStatus {
    return {
      isInitialized: this.isInitialized,
      domain: this.config.domain,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      requestsProcessed: this.requestCount,
      averageResponseTime: this.requestCount > 0 ? 
        this.totalResponseTime / this.requestCount : 0,
      lastActivity: this.lastActivity
    };
  }
}
```

## Benefits of This Design

### 1. **Clear Ownership Model**
- Agent owns its dependencies
- Clear responsibility boundaries
- Easier testing and debugging

### 2. **Flexible Architecture**
- Optional handler injection
- Graceful degradation when components unavailable
- Easy to extend with new capabilities

### 3. **Practical Classification**
- Three types map to real-world usage patterns
- Not over-engineered like "everything is a workflow"
- Clear routing logic

### 4. **Contract-Based Integration**
- Components interact via interfaces
- Loose coupling enables testing
- Clear API boundaries

### 5. **Built-in State Management**
- Direct StateManager access
- Automatic conversation tracking
- Centralized configuration

---

This design provides a solid foundation for our AI coding assistant with clear separation of concerns, flexible extensibility, and practical real-world usage patterns.