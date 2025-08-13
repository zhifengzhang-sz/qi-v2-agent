# Qi-Prompt v0.6.1 - Detailed Architecture Documentation

## Overview

Qi-Prompt v0.6.1 implements a **Pure Message-Driven Architecture** inspired by the h2A pattern, eliminating EventEmitter race conditions through sequential message processing. This document provides detailed logical structure and message flow patterns.

## Core Architecture Principles

### 1. Message-Driven Coordination
- **No EventEmitter**: All communication through message queue
- **Sequential Processing**: Single message processing loop prevents race conditions
- **Asynchronous Flow**: Non-blocking message handling with Promise-based iteration

### 2. Component Isolation
- **Clear Boundaries**: Each component has specific message responsibilities
- **Loose Coupling**: Components communicate only through message queue
- **Single Responsibility**: Each component handles one aspect of the system

### 3. Functional Patterns
- **QiCore Integration**: Uses Result<T> patterns for error handling
- **Immutable Messages**: Messages are read-only after creation
- **Pure Functions**: Message processors are side-effect free where possible

## System Architecture Overview

### Container Diagram

```mermaid
C4Container
    title Qi-Prompt v0.6.1 - Container Diagram
    
    Person(user, "Developer", "User interacting with AI assistant")
    
    Container_Boundary(qiprompt, "Qi-Prompt Application") {
        Container(app, "QiPromptApp", "TypeScript/Bun", "Main application coordinator")
        Container(cli, "CLI Framework", "React/Ink", "User interface and input handling")
        Container(messagequeue, "Message Queue", "TypeScript", "h2A-inspired async message coordination")
        Container(orchestrator, "Orchestrator", "TypeScript", "LLM request routing and processing")
        Container(workflows, "Workflows", "TypeScript", "Context and workflow management")
    }
    
    System_Ext(llm, "LLM Provider", "Ollama/OpenAI/etc.")
    SystemDb_Ext(context, "Context Storage", "Conversation history and project context")
    
    Rel(user, cli, "Enters prompts and commands")
    Rel(cli, messagequeue, "Enqueues user messages")
    Rel(messagequeue, app, "Sequential message processing")
    Rel(app, orchestrator, "Routes requests")
    Rel(orchestrator, workflows, "Context management")
    Rel(orchestrator, llm, "LLM API calls")
    Rel(orchestrator, context, "Stores/retrieves context")
    Rel(orchestrator, cli, "Returns responses")
```

### Component Diagram

```mermaid
C4Component
    title Qi-Prompt v0.6.1 - Component Diagram
    
    Container_Boundary(app, "Qi-Prompt Application") {
        Component(qipromptapp, "QiPromptApp", "Main coordinator", "Initializes and coordinates all components")
        Component(qipromptcli, "QiPromptCLI", "Message processor", "Core message processing loop")
        
        Container_Boundary(cli_framework, "CLI Framework") {
            Component(inkcli, "InkCLIFramework", "React/Ink UI", "User interface with React components")
            Component(mainlayout, "MainLayout", "React Component", "Main UI layout and input box")
            Component(outputdisplay, "OutputDisplay", "React Component", "Conversation display")
            Component(inputbox, "InputBox", "React Component", "User input handling")
        }
        
        Container_Boundary(messaging, "Message System") {
            Component(messagequeue, "QiAsyncMessageQueue", "Async Queue", "h2A pattern message coordination")
            Component(messagetypes, "Message Types", "TypeScript", "USER_INPUT, AGENT_OUTPUT, etc.")
        }
        
        Container_Boundary(processing, "Request Processing") {
            Component(orchestrator, "PromptAppOrchestrator", "Router", "Input classification and LLM routing")
            Component(prompthandler, "LangChainPromptHandler", "LLM Interface", "LLM API integration")
            Component(contextmanager, "ContextManager", "Context", "Conversation history management")
            Component(workflowhandler, "WorkflowHandler", "Workflows", "File reference and workflow processing")
        }
    }
    
    Rel(qipromptapp, qipromptcli, "initializes")
    Rel(qipromptapp, inkcli, "creates")
    Rel(qipromptcli, messagequeue, "iterates")
    Rel(inkcli, messagequeue, "enqueues")
    Rel(qipromptcli, orchestrator, "processes")
    Rel(orchestrator, prompthandler, "calls LLM")
    Rel(orchestrator, contextmanager, "manages context")
    Rel(orchestrator, workflowhandler, "handles workflows")
    Rel(inkcli, mainlayout, "renders")
    Rel(mainlayout, outputdisplay, "displays messages")
    Rel(mainlayout, inputbox, "handles input")
```

### Message Flow Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant I as InputBox
    participant F as InkCLIFramework
    participant Q as QiAsyncMessageQueue
    participant C as QiPromptCLI
    participant O as PromptAppOrchestrator
    participant L as LLM Provider
    participant D as OutputDisplay
    
    U->>I: Types "hello"
    I->>F: handleInput("hello")
    F->>D: Add user message to display
    F->>Q: enqueue(USER_INPUT)
    Note over Q: h2A async iterator
    Q->>C: yield message
    C->>O: process(request)
    O->>O: classify input as 'prompt'
    O->>L: LLM API call
    L-->>O: Response: "How can I help?"
    O-->>C: Return response
    C->>F: displayMessage(response)
    F->>D: Add assistant message to display
    Note over F: Reset processing state
```

### Class Relationship Diagram

```mermaid
classDiagram
    class QiPromptApp {
        -messageQueue: QiAsyncMessageQueue
        -orchestrator: PromptAppOrchestrator
        -cli: ICLIFramework
        +initialize()
        +run()
    }
    
    class QiPromptCLI {
        -messageQueue: QiAsyncMessageQueue
        -orchestrator: PromptAppOrchestrator
        -cli: ICLIFramework
        +startMessageProcessingLoop()
        -processMessage(message)
    }
    
    class QiAsyncMessageQueue {
        -queue: QueuedMessage[]
        -state: QueueState
        +enqueue(message)
        +[Symbol.asyncIterator]()
        +next()
    }
    
    class InkCLIFramework {
        -state: CLIState
        -messageQueue: QiAsyncMessageQueue
        +handleInput(input)
        +displayMessage(content)
        +displayProgress(phase, progress)
    }
    
    class PromptAppOrchestrator {
        -promptHandler: IPromptHandler
        -contextManager: IContextManager
        -workflowHandler: IWorkflowHandler
        +process(request)
        -handlePrompt(content)
        -handleCommand(content)
        -handleWorkflow(content)
    }
    
    QiPromptApp --> QiPromptCLI
    QiPromptApp --> QiAsyncMessageQueue
    QiPromptApp --> PromptAppOrchestrator
    QiPromptApp --> InkCLIFramework
    QiPromptCLI --> QiAsyncMessageQueue
    QiPromptCLI --> PromptAppOrchestrator
    InkCLIFramework --> QiAsyncMessageQueue
    PromptAppOrchestrator --> IPromptHandler
    PromptAppOrchestrator --> IContextManager
    PromptAppOrchestrator --> IWorkflowHandler
```

## Message Flow Architecture

### 1. Message Types and Responsibilities

```typescript
enum MessageType {
  USER_INPUT = 'user_input',           // Raw user input from CLI
  AGENT_OUTPUT = 'agent_output',       // LLM responses to display
  SYSTEM_CONTROL = 'system_control',   // Lifecycle management
  CLI_MESSAGE_RECEIVED = 'cli_message_received',  // UI state updates
}
```

**Message Ownership:**
- `USER_INPUT`: Created by InkCLIFramework, consumed by QiPromptCLI
- `AGENT_OUTPUT`: Created by QiPromptCLI, consumed by InkCLIFramework
- `SYSTEM_CONTROL`: Created by QiPromptCLI, consumed by system components
- `CLI_MESSAGE_RECEIVED`: Internal CLI framework communication

### 2. Critical Message Flow Patterns

#### Pattern 1: User Input Processing (Primary Flow)
```
┌─────────────┐    USER_INPUT     ┌─────────────┐
│InkCLI       │ ────────────────► │QiPromptCLI  │
│Framework    │                   │             │
└─────────────┘                   └─────────────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │PromptApp    │
                                  │Orchestrator │
                                  └─────────────┘
                                         │
                                         ▼ (LLM Response)
                                  ┌─────────────┐
                                  │QiPromptCLI  │
                                  │.displayMsg()│ ◄─── DIRECT DISPLAY
                                  └─────────────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │InkCLI       │
                                  │Framework    │
                                  └─────────────┘
```

**Key Rule**: LLM responses are displayed **directly** without re-enqueueing to prevent loops.

#### Pattern 2: System Control Flow
```
┌─────────────┐  SYSTEM_CONTROL  ┌─────────────┐
│QiPromptCLI  │ ────────────────► │QiAsyncMsgQ  │
│             │                   │             │
└─────────────┘                   └─────────────┘
                                         │
                                         ▼
                                  ┌─────────────┐
                                  │Component    │
                                  │Shutdown     │
                                  └─────────────┘
```

### 3. Message Queue Implementation Details

#### h2A-Inspired Async Iterator Pattern
```typescript
class QiAsyncMessageQueue<T extends QiMessage> {
  // Core iterator - implements h2A non-blocking pattern
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (!this.state.isDone) {
      const message = await this.waitForMessage();
      if (message) yield message;
    }
  }

  // Non-blocking message waiting
  private async waitForMessage(): Promise<T | null> {
    // If message available, return immediately
    if (this.queue.length > 0) {
      return this.dequeue();
    }
    
    // Otherwise, wait for new message
    return new Promise((resolve) => {
      this.readResolve = resolve;
    });
  }
}
```

**Critical Design Decision**: Queue can only be iterated **once** to prevent duplicate processing.

## Component Detailed Specifications

### 1. QiPromptCLI (Core Message Processor)

**Responsibilities:**
- Single message processing loop using `for await`
- Route USER_INPUT to PromptAppOrchestrator
- Display responses directly (no re-enqueueing)
- Handle system lifecycle messages

**Message Processing Logic:**
```typescript
private async processMessage(message: QiMessage): Promise<void> {
  switch (message.type) {
    case MessageType.USER_INPUT:
      // Process through orchestrator
      const result = await this.orchestrator.process(request);
      
      // CRITICAL: Display directly, do NOT enqueue AGENT_OUTPUT
      this.cli.displayMessage(result.content);
      break;
      
    case MessageType.AGENT_OUTPUT:
      // Legacy support - should be rare in normal flow
      this.cli.displayMessage(message.content);
      break;
  }
}
```

**Anti-Pattern Prevented:**
```typescript
// ❌ WRONG - Creates infinite loop
const agentOutputMessage = { type: MessageType.AGENT_OUTPUT, ... };
this.messageQueue.enqueue(agentOutputMessage);

// ✅ CORRECT - Direct display
this.cli.displayMessage(result.content);
```

### 2. QiAsyncMessageQueue (h2A Message Hub)

**Design Principles:**
- **Single Producer, Single Consumer**: One iterator, multiple enqueuers
- **Priority Queuing**: High-priority messages processed first
- **TTL Support**: Messages expire to prevent memory leaks
- **Statistics**: Performance monitoring built-in

**Key Safeguards:**
```typescript
[Symbol.asyncIterator](): AsyncIterator<T> {
  if (this.state.started) {
    throw new Error('Queue can only be iterated once');
  }
  this.state.started = true;
  return this;
}
```

**Message Lifecycle:**
1. **Enqueue**: Message added to priority queue
2. **Dequeue**: Retrieved by iterator when available
3. **Processing**: Marked as in-progress
4. **Completion**: Marked as completed or error
5. **Cleanup**: TTL-based automatic cleanup

### 3. PromptAppOrchestrator (Routing Logic)

**Input Classification:**
```typescript
export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();
  
  if (trimmed.startsWith('/')) {
    return { type: 'command', content: trimmed.slice(1) };
  }
  
  if (trimmed.includes('@') && (trimmed.includes('.') || trimmed.includes('/'))) {
    return { type: 'workflow', content: trimmed };
  }
  
  return { type: 'prompt', content: trimmed };
}
```

**Processing Pipeline:**
1. **Parse Input**: Classify as command, workflow, or prompt
2. **Route to Handler**: CommandHandler, WorkflowHandler, or PromptHandler
3. **Context Management**: Maintain conversation history
4. **Response Generation**: Return formatted response

### 4. InkCLIFramework (UI Management)

**Message Integration:**
```typescript
private handleUserInput(input: string): void {
  if (this.messageQueue) {
    this.messageQueue.enqueue({
      type: MessageType.USER_INPUT,
      id: generateUniqueId(),         // Crypto-based unique ID
      input: input,
      timestamp: new Date(),
      priority: MessagePriority.NORMAL
    });
  }
}
```

**Display Pipeline:**
1. **Input Capture**: React-based input handling
2. **Message Creation**: Generate USER_INPUT message
3. **Queue Enqueue**: Send to message queue
4. **Display Updates**: Receive responses and update UI

## Security and Performance Considerations

### 1. Message ID Generation
**Problem**: `Math.random().toString(36)` can cause collisions
**Solution**: `crypto.randomBytes(8).toString('hex')` for unique IDs

### 2. Memory Management
- **TTL Cleanup**: Automatic message expiration
- **Queue Limits**: Configurable maximum queue size
- **Reference Cleanup**: Proper cleanup of Promise resolvers

### 3. Error Handling
- **QiCore Patterns**: Result<T> for all operations
- **Graceful Degradation**: Continue processing on non-fatal errors
- **Circuit Breakers**: Stop processing on critical errors

## Testing Strategy

### 1. Unit Testing
- **Message Processing**: Test individual message type handling
- **Queue Operations**: Test enqueue, dequeue, iteration
- **Component Isolation**: Mock dependencies for pure unit tests

### 2. Integration Testing
- **End-to-End Flow**: Test complete user input → LLM response cycle
- **Error Scenarios**: Test failure modes and recovery
- **Performance**: Test under load and stress conditions

### 3. Architecture Testing
- **Loop Detection**: Verify no circular message patterns
- **Resource Cleanup**: Verify proper shutdown and cleanup
- **State Consistency**: Verify system state remains consistent

## Migration and Evolution

### From v0.5.x to v0.6.1
- **Removed EventEmitter**: All event-based communication replaced with messages
- **Single Processing Loop**: Eliminated race conditions from parallel processing
- **Improved Error Handling**: QiCore Result<T> patterns throughout

### Future Evolution (v0.7.x+)
- **Multiple Processing Loops**: Support for parallel processing of different message types
- **Message Routing**: Advanced routing based on message metadata
- **Distributed Processing**: Support for multi-process message handling

## Troubleshooting Guide

### Common Issues

**1. Infinite Loops**
- **Symptom**: Continuous message processing, high CPU
- **Cause**: Circular message enqueueing
- **Solution**: Verify message flow doesn't create cycles

**2. Message Loss**
- **Symptom**: User input not processed
- **Cause**: Queue iteration not started or multiple iterators
- **Solution**: Verify single iterator and proper initialization

**3. Memory Leaks**
- **Symptom**: Increasing memory usage over time
- **Cause**: Messages not cleaned up, Promise resolvers not cleared
- **Solution**: Enable TTL cleanup and proper shutdown

**4. Race Conditions**
- **Symptom**: Inconsistent behavior, out-of-order responses
- **Cause**: Multiple processing loops or EventEmitter usage
- **Solution**: Ensure single message processing loop

## Conclusion

The v0.6.1 architecture successfully eliminates race conditions through pure message-driven coordination while maintaining responsive user experience. The key insight is that **message flow topology** is as important as individual component design - circular dependencies in message flow create subtle but critical bugs that are hard to detect and debug.

Future development should maintain these architectural principles while extending functionality through additional message types and processing patterns.