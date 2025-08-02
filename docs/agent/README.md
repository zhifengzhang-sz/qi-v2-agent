# Agent Module

## Interface Specification

```typescript
interface IAgent {
  initialize(): Promise<void>
  process(request: AgentRequest): Promise<AgentResponse>
  stream(request: AgentRequest): AsyncIterable<AgentStreamChunk>  
  getStatus(): AgentStatus
  shutdown(): Promise<void>
}
```

## Architectural Role

The agent serves as the main orchestrator in a component-based architecture:

- **Input Processing**: Receives structured requests with context metadata
- **Classification Coordination**: Delegates input analysis to classification subsystem
- **Handler Routing**: Routes classified inputs to appropriate execution handlers
- **State Management**: Maintains conversation state and system configuration
- **Response Coordination**: Aggregates and formats responses from multiple components

## Behavioral Contracts

### Processing Pipeline
1. **Request Validation**: Verify input structure and context completeness
2. **Classification**: Determine input type (command/prompt/workflow) via classifier
3. **Handler Dispatch**: Route to CommandHandler, PromptHandler, or WorkflowEngine
4. **State Integration**: Update conversation history and metrics
5. **Response Formatting**: Structure output with metadata and performance data

### Streaming Protocol
- **Classification Phase**: Initial input type determination
- **Processing Phase**: Progressive output from execution handlers  
- **Completion Phase**: Final metadata and performance metrics

## Configuration Parameters

```typescript
interface AgentConfig {
  domain: string                    // Specialization domain (e.g., 'coding-assistant')
  enableCommands?: boolean          // Enable built-in system commands  
  enablePrompts?: boolean           // Enable LLM-based prompt processing
  enableWorkflows?: boolean         // Enable multi-step workflow execution
  sessionPersistence?: boolean      // Maintain conversation history
  providers?: {
    modelProvider?: string          // Primary model provider selection
    toolProvider?: string           // Tool execution provider
  }
  timeouts?: {
    classification?: number         // Classification timeout (ms)
    commandExecution?: number       // Command timeout (ms) 
    promptProcessing?: number       // Prompt timeout (ms)
    workflowExecution?: number      // Workflow timeout (ms)
  }
}
```

## Performance Characteristics

- **Classification Latency**: 0-1ms (rule-based) to 200-400ms (LLM-based)
- **Command Execution**: Sub-millisecond for built-in commands
- **Prompt Processing**: Variable based on model provider and complexity
- **Memory Usage**: Linear with conversation history size
- **Throughput**: Concurrent request processing with configurable limits

## Error Handling

- **Classification Failures**: Fallback to default handler with confidence scoring
- **Handler Unavailability**: Graceful degradation with error response structure
- **Timeout Management**: Configurable timeouts per operation type
- **State Recovery**: Automatic session state restoration after failures

## Usage Patterns

### Basic Agent Instantiation
```typescript
const agent = createAgent(stateManager, {
  domain: 'coding-assistant',
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: true
});
await agent.initialize();
```

### Request Processing
```typescript
const response = await agent.process({
  input: "write a quicksort function",
  context: {
    sessionId: session.id,
    timestamp: new Date(),
    source: 'cli'
  }
});
```

### Streaming Interface
```typescript
for await (const chunk of agent.stream(request)) {
  switch (chunk.type) {
    case 'classification':
      console.log(`Type: ${chunk.data.type}`);
      break;
    case 'processing':
      process.stdout.write(chunk.data.content);
      break;
    case 'completion':
      console.log(`Done in ${chunk.data.executionTime}ms`);
      break;
  }
}
```

## Implementation: `lib/src/agent/`