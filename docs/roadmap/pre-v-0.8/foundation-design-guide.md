# qi-v2-agent Framework Foundation Design Guide

**Document Version**: 2.0  
**Date**: 2025-01-17  
**Status**: Implementation-Ready Architecture  
**Target**: Build qi-v2-agent framework from scratch with production-grade patterns

## Executive Summary

This guide provides the complete architectural blueprint for building the qi-v2-agent framework from the ground up. The framework enables unlimited agent creation through robust design structures, leveraging battle-tested patterns and enterprise-grade implementation strategies.

## Core Design Philosophy

### **Framework-First Architecture**

The qi-v2-agent is **not** a single agent - it's an **agent creation framework** with extensible design structures that enable developers to build unlimited specialized agents based on specific workflow requirements.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Creation Framework                    │
├─────────────────────────────────────────────────────────────────┤
│  qi-prompt │ qi-code │ qi-data │ qi-deploy │ ... (unlimited)     │
│   Agent    │  Agent  │  Agent  │   Agent   │                    │
└─────────────────────────────────────────────────────────────────┘
```

### **Foundational Principles**

1. **Contract-Driven Development**: Every module interaction through typed interfaces
2. **QiCore Integration**: Functional Result<T> patterns throughout 
3. **h2A Message Coordination**: Sequential processing, zero race conditions
4. **Security-First Design**: Comprehensive boundaries from foundation
5. **Extension Over Configuration**: Framework patterns enable unlimited specialization

## Framework Architecture Overview

### **Layer Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                 Agent Interface Layer                           │ ← Agent implementations (qi-prompt, qi-code, etc.)
├─────────────────────────────────────────────────────────────────┤
│     CLI Framework     │     Workflow Engine                     │ ← User interaction & orchestration  
├─────────────────────────────────────────────────────────────────┤
│  Tool Execution  │  State Management  │  Context Management     │ ← Core capabilities
├─────────────────────────────────────────────────────────────────┤
│             Message-Driven Coordination                        │ ← h2A coordination foundation
├─────────────────────────────────────────────────────────────────┤
│  Security Framework  │  QiCore Foundation  │  Infrastructure    │ ← Platform foundation
└─────────────────────────────────────────────────────────────────┘
```

### **Package Strategy**

#### **Core Infrastructure Packages**
- `@qi/base`: Result<T> patterns, error handling, functional composition
- `@qi/core`: Logger, cache, configuration with QiCore integration  
- `@qi/agent/messaging`: h2A message queue implementation
- `@qi/agent/security`: Permission management, audit logging
- `@qi/agent/context`: Isolation boundaries, security contexts

#### **Framework Capability Packages**  
- `@qi/agent/tools`: 6-phase execution pipeline, tool registry
- `@qi/agent/state`: Configuration, session, persistence management
- `@qi/agent/cli`: Multi-framework CLI (readline/ink/hybrid)
- `@qi/agent/workflows`: Pattern engine, orchestration
- `@qi/agent/classifier`: Three-type input classification

#### **Agent Implementation Packages**
- `@qi/agent/core`: Base agent contracts and orchestration
- `@qi/prompt`: Simple conversational agent implementation
- `@qi/code`: Advanced workflow agent implementation

## Module Contracts and Interfaces

### **1. Message-Driven Coordination**

**Contract**: `IAsyncMessageQueue<T>`

```typescript
// Package: @qi/agent/messaging
interface IAsyncMessageQueue<T extends QiMessage> extends AsyncIterable<T> {
  enqueue(message: T): Result<void, QiError>;
  done(): Result<void, QiError>;
  getState(): Result<QueueState, QiError>;
  destroy(): Promise<Result<void, QiError>>;
}

interface QiMessage {
  readonly id: string;
  readonly type: MessageType;
  readonly content: MessageContent;
  readonly metadata: MessageMetadata;
  readonly timestamp: Date;
}

enum MessageType {
  USER_INPUT = 'user_input',
  AGENT_OUTPUT = 'agent_output', 
  TOOL_EXECUTION = 'tool_execution',
  WORKFLOW_EVENT = 'workflow_event',
  SYSTEM_CONTROL = 'system_control'
}
```

**Design Patterns**:
- **h2A Pattern**: Single iterator, sequential processing
- **Non-blocking Enqueue**: Real-time message injection
- **Priority Support**: Critical messages processed first
- **QiCore Integration**: All operations return Result<T>

**Implementation Strategy**:
```typescript
// Use AsyncIterator with Promise-based coordination
class QiAsyncMessageQueue<T extends QiMessage> implements IAsyncMessageQueue<T> {
  private queue: T[] = [];
  private waitingReader?: (value: T | null) => void;
  
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    // Single iterator constraint - h2A pattern
    while (!this.state.isDone) {
      const message = await this.waitForMessage();
      if (message) yield message;
    }
  }
}
```

### **2. Agent Framework Core**

**Contract**: `IAgent`

```typescript
// Package: @qi/agent/core
interface IAgent {
  initialize(): Promise<void>;
  process(request: AgentRequest): Promise<AgentResponse>;
  stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk>;
  getStatus(): AgentStatus;
  shutdown(): Promise<void>;
}

interface AgentRequest {
  readonly input: string;
  readonly context: AgentContext;
}

interface AgentResponse {
  readonly content: string;
  readonly type: 'command' | 'prompt' | 'workflow';
  readonly confidence: number;
  readonly executionTime: number;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly success: boolean;
  readonly error?: string;
}
```

**Design Patterns**:
- **Orchestrator Pattern**: Agents coordinate but don't implement
- **Contract Injection**: StateManager, ContextManager via constructor
- **Streaming Support**: Real-time response capability
- **Type Classification**: Command/prompt/workflow routing

### **3. Tool Execution Framework**

**Contract**: `ITool` and `IToolExecutor`

```typescript
// Package: @qi/agent/tools
interface ITool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly inputSchema: z.ZodSchema<TInput>;
  readonly isReadOnly: boolean;
  readonly isConcurrencySafe: boolean;
  readonly maxRetries: number;
  readonly timeout: number;

  execute(input: TInput, context: ToolContext): Promise<Result<TOutput, QiError>>;
  validate(input: TInput): Result<void, QiError>;
  checkPermissions(input: TInput, context: ToolContext): Result<PermissionResult, QiError>;
  cleanup?(): Promise<Result<void, QiError>>;
}

interface IToolExecutor {
  execute<TOutput>(
    call: ToolCall, 
    options?: ExecutionOptions
  ): AsyncGenerator<Result<ExecutionProgress | ToolResult<TOutput>, QiError>>;
  
  executeBatch(
    calls: readonly ToolCall[],
    options?: ExecutionOptions  
  ): AsyncGenerator<Result<ExecutionProgress | BatchExecutionResult, QiError>>;
  
  cancel(callId: string): Promise<Result<void, QiError>>;
  getStats(): ExecutorStats;
}
```

**6-Phase Execution Pipeline**:
1. **Discovery**: Tool resolution and validation
2. **Validation**: Schema + business logic validation  
3. **Security**: Permission checks and boundary enforcement
4. **Execution**: Tool execution with timeout and retry
5. **Processing**: Result transformation and enhancement
6. **Cleanup**: Metrics collection, audit logging, resource cleanup

**Implementation Strategy**:
```typescript
// Use AsyncGenerator for progress streaming
async *execute<TOutput>(call: ToolCall): AsyncGenerator<Result<ExecutionProgress | ToolResult<TOutput>, QiError>> {
  yield* this.executePhase1Discovery(call);
  const tool = yield* this.executePhase2Validation(call);
  yield* this.executePhase3Security(call, tool);
  const result = yield* this.executePhase4Execution(call, tool);
  const processed = yield* this.executePhase5Processing(call, result);
  yield* this.executePhase6Cleanup(call, processed);
  yield success(processed);
}
```

### **4. CLI Framework**

**Contract**: `ICLIFramework`

```typescript
// Package: @qi/agent/cli
interface ICLIFramework {
  initialize(): Promise<void>;
  start(): Promise<void>;
  shutdown(): Promise<void>;
  
  getState(): CLIState;
  setMode(mode: CLIMode): void;
  
  handleInput(input: string): void;
  displayMessage(content: string, type?: MessageType): void;
  displayProgress(phase: string, progress: number, details?: string): void;
  
  startStreaming(): void;
  addStreamingChunk(content: string): void;
  completeStreaming(message?: string): void;
  cancelStreaming(): void;
  
  subscribeToStateChanges(stateManager: any): void;
  updateConfig(config: Partial<CLIConfig>): void;
}

type CLIMode = 'interactive' | 'command' | 'streaming';

interface CLIConfig {
  enableHotkeys: boolean;
  enableStreaming: boolean;
  prompt: string;
  colors: boolean;
  stateManager?: any;
  messageQueue?: any;
  debug: boolean;
}
```

**Framework Strategy**:
- **Multi-Framework Support**: readline (universal), ink (rich), hybrid (adaptive)
- **Message Queue Integration**: All input flows through h2A queue
- **State-Driven UI**: Real-time updates from StateManager
- **Hotkey Management**: Mode switching, cancellation support

### **5. State Management**

**Contract**: `IStateManager`

```typescript
// Package: @qi/agent/state  
interface IStateManager {
  // Configuration
  getConfig(): AppConfig;
  updateConfig(updates: Partial<AppConfig>): Promise<void>;
  
  // Session Management
  getCurrentSession(): SessionData;
  createSession(userId?: string): Promise<SessionData>;
  addConversationEntry(entry: ConversationEntry): Promise<void>;
  
  // Model Management
  getCurrentModel(): string;
  setCurrentModel(modelId: string): Promise<void>;
  getAvailableModels(): ModelInfo[];
  
  // Persistence
  saveState(): Promise<void>;
  loadState(): Promise<void>;
  
  // Event System
  subscribe(listener: StateChangeListener): () => void;
}

interface AppConfig {
  defaultModel: string;
  maxContextLength: number;
  debugMode: boolean;
  logLevel: string;
  toolPermissions: Record<string, ToolPermissions>;
}
```

**Implementation Strategy**:
- **Centralized Source of Truth**: Single config/session state
- **Event-Driven Updates**: Observers for UI synchronization
- **Persistent Sessions**: File-based session storage
- **Configuration Hierarchy**: Defaults → File → Environment → Runtime

### **6. Context Management** 

**Contract**: `IContextManager`

```typescript
// Package: @qi/agent/context
interface IContextManager {
  getApplicationContext(): AppContext;
  createIsolatedContext(config: IsolatedContextConfig): IsolatedContext;
  createConversationContext(sessionId: string): ConversationContext;
  validateContextAccess(contextId: string, operation: string): boolean;
  terminateContext(contextId: string): void;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

interface SecurityRestrictions {
  readOnlyMode: boolean;
  allowedPaths: string[];
  blockedCommands: string[];
  blockedTools: string[];
  requireApproval: boolean;
  maxExecutionTime: number;
  networkAccess: boolean;
  systemAccess: boolean;
}
```

**Security Model**:
- **Context Isolation**: Sub-agents run in restricted contexts
- **Path Validation**: File system access controls
- **Tool Restrictions**: Limited tool access per context
- **Resource Limits**: Memory, CPU, execution time controls

## Implementation Strategy

### **Development Phases**

#### **Phase 1: Foundation Infrastructure (3-4 weeks)**

**Week 1-2: Core Infrastructure**
- Set up QiCore foundation (@qi/base, @qi/core)
- Implement h2A message queue with typed interfaces
- Create security framework with permission system
- Establish project structure and tooling

**Week 3-4: Agent Framework Core**
- Implement Agent abstraction and orchestration patterns
- Create StateManager with configuration hierarchy
- Build ContextManager with security boundaries  
- Establish module contracts and dependency injection

#### **Phase 2: Tool and CLI Systems (3-4 weeks)**

**Week 5-6: Tool Execution Framework**
- Implement 6-phase tool execution pipeline
- Create tool registry with discovery capabilities
- Build core tools (file, search, system operations)
- Add security validation and audit logging

**Week 7-8: CLI Framework**
- Implement multi-framework CLI system
- Create message queue integration
- Build streaming and progress display
- Add hotkey management and mode switching

#### **Phase 3: Integration and Production (2-3 weeks)**

**Week 9-10: System Integration**
- Connect all framework components
- Implement agent creation patterns
- Create example agents (qi-prompt, qi-code foundations)
- Add comprehensive testing

**Week 11-12: Production Readiness**
- Binary compilation support
- Performance optimization
- Documentation and examples
- Deployment preparation

### **Package Dependencies**

#### **Core Dependencies**
```json
{
  "dependencies": {
    "zod": "^3.22.0",           // Schema validation
    "typescript": "^5.0.0",     // Type system
    "@types/node": "^20.0.0",   // Node.js types
    "vitest": "^1.0.0",         // Testing framework
    "tsup": "^8.0.0"            // Build tooling
  }
}
```

#### **CLI Framework Dependencies**
```json
{
  "dependencies": {
    "readline": "^1.3.0",       // Basic CLI (built-in)
    "ink": "^4.4.0",            // Rich CLI framework
    "react": "^18.2.0",         // Ink dependency
    "blessed": "^0.1.81",       // Terminal UI (optional)
    "ansi-escapes": "^6.0.0",   // Terminal control
    "chalk": "^5.3.0"           // Colors and styling
  }
}
```

#### **Tool System Dependencies**
```json
{
  "dependencies": {
    "fast-glob": "^3.3.0",      // File pattern matching
    "chokidar": "^3.5.0",       // File watching
    "execa": "^8.0.0",          // Process execution
    "fs-extra": "^11.2.0",      // Enhanced file operations
    "mime-types": "^2.1.0"      // File type detection
  }
}
```

### **Architecture Patterns**

#### **Dependency Injection Pattern**
```typescript
// Framework components inject dependencies, not create them
class QiCodeAgent implements IAgent {
  constructor(
    private stateManager: IStateManager,
    private contextManager: IContextManager,
    private config: AgentConfig
  ) {}
}

// Factory pattern for component creation
export function createAgent(
  stateManager: IStateManager,
  contextManager: IContextManager, 
  config: AgentConfig
): IAgent {
  return new QiCodeAgent(stateManager, contextManager, config);
}
```

#### **Contract-First Development**
```typescript
// Define interfaces first, implement second
interface IWorkflowEngine {
  execute(workflow: WorkflowSpec): AsyncGenerator<WorkflowEvent>;
  getPatterns(): readonly WorkflowPattern[];
  canHandle(request: WorkflowRequest): boolean;
}

// Multiple implementations possible
class LangGraphWorkflowEngine implements IWorkflowEngine { }
class QiWorkflowEngine implements IWorkflowEngine { }
```

#### **QiCore Integration Pattern**
```typescript
// All operations return Result<T> for composability
async function executeToolChain(tools: string[], input: any): Promise<Result<any, QiError>> {
  return fromAsyncTryCatch(
    async () => {
      const results = [];
      for (const toolName of tools) {
        const result = await toolExecutor.execute(toolName, input);
        match(
          success => results.push(success),
          error => throw error,
          result
        );
      }
      return results;
    },
    error => systemError(`Tool chain execution failed: ${error.message}`)
  );
}
```

## Testing Strategy

### **Contract Testing**
```typescript
// Test interface contracts, not implementations
describe('IToolExecutor Contract', () => {
  test('execute returns AsyncGenerator with progress', async () => {
    const call: ToolCall = createTestCall();
    const executor = createTestExecutor();
    
    const results = [];
    for await (const result of executor.execute(call)) {
      expect(result.tag).toBeOneOf(['success', 'failure']);
      results.push(result);
    }
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[results.length - 1].value).toHaveProperty('success');
  });
});
```

### **Integration Testing**
```typescript
// Test component integration through contracts
describe('Agent-CLI Integration', () => {
  test('message flow from CLI to agent', async () => {
    const messageQueue = new QiAsyncMessageQueue();
    const cli = createCLI({ messageQueue });
    const agent = createAgent(stateManager, contextManager, config);
    
    // Simulate user input
    cli.handleInput('test command');
    
    // Verify message in queue
    for await (const message of messageQueue) {
      expect(message.type).toBe(MessageType.USER_INPUT);
      expect(message.content.input).toBe('test command');
      break;
    }
  });
});
```

## Security Implementation

### **Permission System**
```typescript
interface ToolPermissions {
  readonly readFiles: boolean;
  readonly writeFiles: boolean; 
  readonly executeCommands: boolean;
  readonly networkAccess: boolean;
  readonly systemAccess: boolean;
  readonly allowedPaths?: readonly string[];
  readonly deniedPaths?: readonly string[];
}

class PermissionManager {
  validatePermissions(
    toolName: string,
    input: any,
    context: ToolContext
  ): Result<PermissionResult, QiError> {
    // Path validation
    if (input.filePath && !this.isPathAllowed(input.filePath, context.permissions)) {
      return failure(validationError('Path access denied'));
    }
    
    // Tool restrictions
    if (context.permissions.blockedTools?.includes(toolName)) {
      return failure(validationError('Tool execution denied'));
    }
    
    return success({ allowed: true });
  }
}
```

### **Audit Logging**
```typescript
class AuditLogger {
  async logToolExecution(event: ToolAuditEvent): Promise<void> {
    this.logger.info('Tool execution audit', {
      component: 'AuditLogger',
      toolName: event.toolName,
      executionPhase: event.executionPhase,
      userId: event.userId,
      inputSanitized: this.sanitizeInput(event.input),
      securityChecks: event.securityChecks,
      timestamp: event.timestamp.toISOString()
    });
  }
}
```

## Performance Targets

### **Framework Performance**
- **Message Processing**: <10ms per message in queue
- **Tool Execution Overhead**: <100ms pipeline overhead
- **Memory Usage**: <50MB for basic agent
- **Startup Time**: <2 seconds for simple agents
- **Binary Size**: <20MB compiled executable

### **Scalability Targets**
- **Concurrent Tools**: 10+ simultaneous tool executions
- **Message Throughput**: 1000+ messages/second
- **Session Persistence**: 10,000+ conversation entries
- **Tool Registry**: 100+ registered tools

## Extension Patterns

### **Custom Agent Creation**
```typescript
// Framework enables unlimited agent types
class DataAnalysisAgent implements IAgent {
  constructor(
    private stateManager: IStateManager,
    private contextManager: IContextManager,
    private dataToolRegistry: IToolRegistry
  ) {}
  
  async process(request: AgentRequest): Promise<AgentResponse> {
    // Specialized logic for data analysis workflows
    return this.orchestrator.process(request);
  }
}
```

### **Custom Tool Development**
```typescript
// Tools follow standard interface for automatic integration
class CustomAnalyticsTool implements ITool<AnalyticsInput, AnalyticsOutput> {
  readonly name = 'analytics';
  readonly inputSchema = AnalyticsInputSchema;
  readonly isReadOnly = true;
  readonly isConcurrencySafe = true;
  
  async execute(
    input: AnalyticsInput, 
    context: ToolContext
  ): Promise<Result<AnalyticsOutput, QiError>> {
    // Custom analytics implementation
    return fromAsyncTryCatch(
      async () => this.performAnalysis(input),
      error => systemError(`Analytics failed: ${error.message}`)
    );
  }
}
```

## Documentation Requirements

### **API Documentation**
- Complete interface documentation with TypeScript types
- Usage examples for each framework component
- Integration patterns and best practices
- Performance optimization guidelines

### **Implementation Guides**
- Step-by-step component implementation
- Testing strategies and examples
- Security implementation patterns
- Extension and customization guides

### **Example Implementations**
- qi-prompt: Simple conversational agent
- qi-code: Advanced workflow agent  
- Custom agent creation tutorial
- Tool development walkthrough

---

## Summary

This foundation design guide provides the complete blueprint for building the qi-v2-agent framework from scratch. The architecture emphasizes:

1. **Framework-First Design**: Enable unlimited agent creation through robust patterns
2. **Contract-Driven Development**: Clear interfaces and dependency injection
3. **QiCore Integration**: Functional Result<T> patterns throughout
4. **Security-First Architecture**: Comprehensive boundaries from foundation
5. **Production Readiness**: Enterprise-grade logging, monitoring, and deployment

The framework foundation enables developers to create specialized agents (qi-prompt, qi-code, etc.) based on specific workflow requirements, using battle-tested patterns and enterprise-grade implementation strategies.

**Next Step**: Follow the [Implementation Guide](./implementation-guide.md) for detailed step-by-step construction instructions.