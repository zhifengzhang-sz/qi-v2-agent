# Claude Code Layered Architecture

## Overview

Claude Code implements a strict five-layer architecture that provides clear separation of concerns, enables scalability, and maintains system reliability. Based on comprehensive source code analysis, this document details each layer's responsibilities, interactions, and technical implementation.

## Architectural Layers

### Layer 1: Application Layer

The application layer handles all user-facing interactions and presentation logic.

#### Components
- **CLI Interface**: Command-line argument processing and routing
- **Terminal Rendering**: React-based terminal UI components
- **Response Formatting**: Output formatting and display management
- **Error Display**: User-friendly error presentation

#### Key Technologies
```javascript
// CLI Framework (Commander.js)
const program = new Command();
program
  .name('claude-code')
  .description('AI-powered development assistant')
  .version('1.0.33');

// React Terminal Rendering
const TerminalApp = () => {
  return (
    <Box flexDirection="column">
      <ChatInterface messages={messages} />
      <InputPrompt onSubmit={handleInput} />
    </Box>
  );
};
```

#### Responsibilities
- Command parsing and validation
- User input processing
- Real-time response rendering
- Session state visualization
- Error message formatting

### Layer 2: Agent Control Layer

The agent control layer orchestrates AI reasoning and conversation management.

#### Core Components

**1. nO Main Loop (Agent Orchestrator)**
```javascript
// Source: improved-claude-code-5.mjs:46187
async function* agentMainLoop(messages, config, context) {
  yield { type: "stream_request_start" };
  
  // Context compression check
  const { messages: processedMessages, wasCompacted } = 
    await contextCompressor(messages, context);
  
  // Main conversation loop
  try {
    while (!abortController.signal.aborted) {
      // Generate LLM response
      for await (const response of conversationGenerator(
        processedMessages, systemPrompt, tools, context
      )) {
        if (response.type === "tool_calls") {
          // Execute tools and yield results
          for await (const toolResult of toolExecutor(
            response.toolCalls, context
          )) {
            yield toolResult;
          }
        } else {
          yield response;
        }
      }
      
      // Check continuation conditions
      if (!shouldContinue(response, context)) break;
    }
  } catch (error) {
    yield handleAgentError(error);
  }
}
```

**2. wu Stream Generator (LLM Interface)**
```javascript
// Source: improved-claude-code-5.mjs
async function* conversationGenerator(messages, prompt, tools, context) {
  const llmRequest = {
    model: context.model,
    messages: formatMessages(messages),
    tools: formatToolSchemas(tools),
    stream: true
  };
  
  const response = await anthropic.messages.create(llmRequest);
  
  for await (const chunk of response) {
    yield processResponseChunk(chunk);
  }
}
```

**3. SubAgent Management (I2A Function)**
```javascript
// SubAgent instantiation and lifecycle management
async function* createSubAgent(taskPrompt, parentContext, options = {}) {
  const agentId = generateAgentId();
  const isolatedContext = createIsolatedContext(parentContext);
  
  try {
    // Execute in isolated environment
    for await (const result of agentMainLoop(
      [{ role: "user", content: taskPrompt }],
      isolatedContext.config,
      isolatedContext
    )) {
      yield result;
    }
  } finally {
    // Cleanup isolated resources
    await cleanupAgentResources(agentId);
  }
}
```

#### Layer Responsibilities
- Conversation flow orchestration
- LLM interaction management
- SubAgent lifecycle control
- Context state management
- Real-time streaming coordination

### Layer 3: Tool Execution Layer

The tool execution layer manages the comprehensive tool ecosystem and execution pipeline.

#### Core Components

**1. MH1 Execution Engine**
```javascript
// Six-phase tool execution pipeline
async function* toolExecutionEngine(toolCall, context) {
  // Phase 1: Tool Discovery and Validation
  const tool = await discoverTool(toolCall.name);
  if (!tool) throw new Error(`Tool not found: ${toolCall.name}`);
  
  // Phase 2: Input Schema Validation
  const validationResult = tool.inputSchema.safeParse(toolCall.input);
  if (!validationResult.success) {
    throw new ValidationError(validationResult.error);
  }
  
  // Phase 3: Permission Check
  const permissionResult = await checkToolPermissions(tool, context);
  if (permissionResult.behavior === "deny") {
    throw new PermissionError("Tool execution denied");
  }
  
  // Phase 4: Abort Signal Check
  if (context.abortController.signal.aborted) {
    throw new AbortError("Execution cancelled");
  }
  
  // Phase 5: Tool Execution
  try {
    for await (const result of tool.execute(
      validationResult.data, 
      context
    )) {
      yield formatToolResult(result);
    }
  } catch (error) {
    yield createErrorResult(error, toolCall.id);
  }
  
  // Phase 6: Result Formatting and Cleanup
  await recordExecutionMetrics(tool.name, context);
}
```

**2. UH1 Concurrency Scheduler**
```javascript
// Smart concurrency control based on tool safety
async function* concurrentToolScheduler(toolCalls, context) {
  const maxConcurrency = 10; // gW5 constant
  
  // Group tools by concurrency safety
  const concurrentSafe = toolCalls.filter(t => 
    tools[t.name].isConcurrencySafe()
  );
  const sequential = toolCalls.filter(t => 
    !tools[t.name].isConcurrencySafe()
  );
  
  // Execute concurrent-safe tools in parallel
  const concurrentPromises = concurrentSafe
    .slice(0, maxConcurrency)
    .map(toolCall => toolExecutionEngine(toolCall, context));
  
  // Process results as they complete
  for await (const result of Promise.race(concurrentPromises)) {
    yield result;
  }
  
  // Execute sequential tools one by one
  for (const toolCall of sequential) {
    for await (const result of toolExecutionEngine(toolCall, context)) {
      yield result;
    }
  }
}
```

**3. Tool Registry (15 Core Tools)**
```javascript
const coreTools = {
  // File Operations
  Read: readTool,
  Write: writeTool,
  Edit: editTool,
  MultiEdit: multiEditTool,
  
  // Search & Discovery
  Glob: globTool,
  Grep: grepTool,
  LS: lsTool,
  
  // Task Management
  TodoRead: todoReadTool,
  TodoWrite: todoWriteTool,
  Task: taskTool,
  
  // System Execution
  Bash: bashTool,
  
  // Network Interaction
  WebFetch: webFetchTool,
  WebSearch: webSearchTool,
  
  // Specialized Tools
  NotebookRead: notebookReadTool
};
```

#### Layer Responsibilities
- Tool discovery and registration
- Execution pipeline orchestration
- Concurrency management
- Permission enforcement
- Result standardization

### Layer 4: Storage Management Layer

The storage layer handles all data persistence and state management.

#### Components

**1. Session State Management**
```javascript
// React-based state management
const [sessionState, setSessionState] = useState({
  messages: [],
  todos: [],
  contextUsage: 0,
  executionStats: {},
  modelConfiguration: {}
});

// State synchronization
const updateSessionState = useCallback((updates) => {
  setSessionState(prev => ({
    ...prev,
    ...updates,
    timestamp: Date.now()
  }));
}, []);
```

**2. Context Cache System**
```javascript
// Three-tier memory architecture
class ContextManager {
  constructor() {
    this.shortTerm = new Map(); // Active conversation
    this.mediumTerm = new LRUCache(100); // Compressed history
    this.longTerm = new FileStorage(); // CLAUDE.md persistence
  }
  
  async getContext(sessionId) {
    // Priority: short-term -> medium-term -> long-term
    return this.shortTerm.get(sessionId) ||
           this.mediumTerm.get(sessionId) ||
           await this.longTerm.load(sessionId);
  }
  
  async saveContext(sessionId, context) {
    this.shortTerm.set(sessionId, context);
    
    // Trigger compression if needed
    if (this.shouldCompress(context)) {
      const compressed = await this.compressContext(context);
      this.mediumTerm.set(sessionId, compressed);
    }
  }
}
```

**3. Todo Data Management**
```javascript
// YJ1 sorting algorithm for todo items
function sortTodoItems(todoA, todoB) {
  const statusPriority = {
    "in_progress": 0,
    "pending": 1,
    "completed": 2
  };
  
  const importancePriority = {
    "high": 0,
    "medium": 1,
    "low": 2
  };
  
  // Multi-level sorting
  const statusDiff = statusPriority[todoA.status] - statusPriority[todoB.status];
  if (statusDiff !== 0) return statusDiff;
  
  const importanceDiff = importancePriority[todoA.priority] - importancePriority[todoB.priority];
  if (importanceDiff !== 0) return importanceDiff;
  
  return new Date(todoA.createdAt) - new Date(todoB.createdAt);
}
```

#### Layer Responsibilities
- Session data persistence
- Context caching and retrieval
- Todo state management
- Configuration storage
- Performance metrics tracking

### Layer 5: Infrastructure Layer

The infrastructure layer provides system resources and foundational services.

#### Components

**1. Network Communication**
```javascript
// Anthropic API client with retry logic
class AnthropicClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.retryAttempts = options.retryAttempts || 3;
    this.timeout = options.timeout || 120000;
  }
  
  async makeRequest(endpoint, payload) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
      } catch (error) {
        if (attempt === this.retryAttempts) throw error;
        await this.exponentialBackoff(attempt);
      }
    }
  }
}
```

**2. File System Interface**
```javascript
// Secure file operations with sandboxing
class SecureFileSystem {
  constructor(allowedPaths = []) {
    this.allowedPaths = allowedPaths;
  }
  
  async readFile(path) {
    this.validatePath(path);
    try {
      return await fs.readFile(path, 'utf8');
    } catch (error) {
      throw new FileSystemError(`Failed to read file: ${error.message}`);
    }
  }
  
  async writeFile(path, content) {
    this.validatePath(path);
    this.validateContent(content);
    
    try {
      await fs.writeFile(path, content, 'utf8');
    } catch (error) {
      throw new FileSystemError(`Failed to write file: ${error.message}`);
    }
  }
  
  validatePath(path) {
    const resolved = path.resolve(path);
    const isAllowed = this.allowedPaths.some(allowedPath => 
      resolved.startsWith(allowedPath)
    );
    
    if (!isAllowed) {
      throw new SecurityError(`Path not allowed: ${path}`);
    }
  }
}
```

**3. Process Management**
```javascript
// Bash execution with sandboxing
class BashExecutor {
  constructor(options = {}) {
    this.timeout = options.timeout || 120000;
    this.sandbox = options.sandbox || false;
    this.allowedCommands = options.allowedCommands || [];
  }
  
  async execute(command, options = {}) {
    if (this.sandbox) {
      this.validateCommand(command);
    }
    
    const childProcess = spawn('bash', ['-c', command], {
      timeout: this.timeout,
      killSignal: 'SIGTERM',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.sanitizeEnvironment(process.env)
    });
    
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      childProcess.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });
      
      childProcess.on('error', (error) => {
        reject(new ProcessError(`Command execution failed: ${error.message}`));
      });
    });
  }
}
```

**4. Security Framework**
```javascript
// Six-layer security implementation
class SecurityFramework {
  // Layer 1: Input Validation
  validateInput(input, schema) {
    const result = schema.safeParse(input);
    if (!result.success) {
      throw new ValidationError(result.error);
    }
    return result.data;
  }
  
  // Layer 2: Permission Control
  async checkPermissions(resource, action, context) {
    const policy = await this.getPolicy(resource, context);
    
    switch (policy.behavior) {
      case 'allow':
        return { granted: true };
      case 'deny':
        return { granted: false, reason: policy.reason };
      case 'ask':
        return await this.requestUserPermission(resource, action);
    }
  }
  
  // Layer 3: Sandbox Isolation
  createSandbox(limits = {}) {
    return {
      memoryLimit: limits.memory || '512MB',
      timeLimit: limits.time || 30000,
      networkAccess: limits.network || false,
      fileSystemAccess: limits.filesystem || 'readonly'
    };
  }
  
  // Layer 4: Execution Monitoring
  monitorExecution(process, limits) {
    const monitor = new ProcessMonitor(process);
    
    monitor.on('memory_exceeded', () => {
      process.kill('SIGTERM');
    });
    
    monitor.on('time_exceeded', () => {
      process.kill('SIGKILL');
    });
    
    return monitor;
  }
  
  // Layer 5: Error Recovery
  async handleSecurityViolation(violation, context) {
    await this.logSecurityEvent(violation);
    await this.notifyAdministrators(violation);
    
    if (violation.severity === 'critical') {
      await this.emergencyShutdown(context);
    }
  }
  
  // Layer 6: Audit Logging
  async logSecurityEvent(event) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      type: event.type,
      severity: event.severity,
      user: event.context.userId,
      resource: event.resource,
      action: event.action,
      result: event.result
    };
    
    await this.persistAuditLog(auditLog);
  }
}
```

#### Layer Responsibilities
- Network communication management
- File system operations
- Process execution and monitoring
- Security policy enforcement
- Resource allocation and limits

## Inter-Layer Communication

### Message Flow Patterns

**1. Request-Response Flow**
```
User Input → Application Layer → Agent Layer → Tool Layer → Infrastructure Layer
                ↓              ↓           ↓            ↓
            UI Update ← Agent Response ← Tool Result ← System Response
```

**2. Event-Driven Communication**
```javascript
// Event bus for cross-layer communication
class EventBus extends EventEmitter {
  publish(event, data) {
    this.emit(event, {
      timestamp: Date.now(),
      layer: this.currentLayer,
      data
    });
  }
  
  subscribe(event, handler) {
    this.on(event, handler);
  }
}

// Layer communication example
eventBus.publish('tool.execution.start', { toolName: 'Read', params });
eventBus.publish('agent.context.compressed', { ratio: 0.78, saved: 4200 });
eventBus.publish('ui.update.required', { component: 'chat', data: newMessage });
```

### Data Flow Optimization

**1. Context Passing**
```javascript
// Immutable context object passed through layers
const createContext = (baseContext, layerData) => ({
  ...baseContext,
  [Symbol.for('layer.data')]: layerData,
  timestamp: Date.now(),
  requestId: generateId()
});
```

**2. Result Aggregation**
```javascript
// Results bubble up through layers with metadata
const aggregateResults = (results) => ({
  data: results.map(r => r.data),
  metadata: {
    processingTime: results.reduce((acc, r) => acc + r.duration, 0),
    layersInvolved: [...new Set(results.map(r => r.layer))],
    performance: calculatePerformanceMetrics(results)
  }
});
```

## Performance Considerations

### Layer-Specific Optimizations

**Application Layer**
- Virtual DOM optimization for large conversation histories
- Debounced input processing
- Lazy loading of UI components

**Agent Layer**
- Context compression at 92% threshold
- Model response streaming
- Concurrent SubAgent execution

**Tool Layer**
- Intelligent concurrency grouping
- Result caching for idempotent operations
- Resource pooling for expensive tools

**Storage Layer**
- LRU caching for frequently accessed data
- Batch operations for bulk updates
- Compression for historical data

**Infrastructure Layer**
- Connection pooling for network requests
- Process reuse for similar operations
- Resource monitoring and allocation

## Error Handling Strategy

### Layer Isolation
Each layer handles its own errors and provides fallback mechanisms:

```javascript
class LayerErrorHandler {
  async handleError(error, layer, context) {
    // Log error with layer context
    await this.logError(error, layer);
    
    // Apply layer-specific recovery
    switch (layer) {
      case 'application':
        return this.recoverUI(error, context);
      case 'agent':
        return this.recoverAgent(error, context);
      case 'tool':
        return this.recoverTool(error, context);
      case 'storage':
        return this.recoverStorage(error, context);
      case 'infrastructure':
        return this.recoverInfrastructure(error, context);
    }
  }
}
```

## Scalability Design

### Horizontal Scaling
- SubAgent distribution across processes
- Tool execution load balancing
- Storage sharding strategies

### Vertical Scaling
- Memory optimization through compression
- CPU optimization through concurrent execution
- I/O optimization through async patterns

## Conclusion

Claude Code's layered architecture provides a robust foundation for AI-powered development tools. The clear separation of concerns, comprehensive error handling, and performance optimizations enable the system to handle complex development workflows while maintaining reliability and user experience.

The architecture's modularity also facilitates maintenance, testing, and future enhancements, making it a solid foundation for enterprise-grade AI development tools.

## References

- [System Overview](./system-overview.md)
- [Agent Loop Implementation](./agent-loop.md)
- [Multi-Agent System](./multi-agent-system.md)
- [Security Framework Design](../design/security-framework.md)
- [Performance Optimization](../design/performance-optimization.md)