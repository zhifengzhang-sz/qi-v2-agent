# qi-v2 Agent Request Processing

## Overview

This document describes the complete request processing lifecycle in the qi-v2 Agent, from input reception to response delivery. The agent follows a structured pipeline that ensures proper classification, routing, and state management.

## Request Processing Pipeline

### Complete Processing Flow

```
1. Input Reception → 2. Validation → 3. State Commands → 4. Classification → 5. Handler Routing → 6. State Updates → 7. Response
        ↓               ↓              ↓                 ↓                  ↓                    ↓                ↓
   AgentRequest → Initialization → Built-in Cmds → Classifier → Command/Prompt/Workflow → StateManager → AgentResponse
                     Check           (Priority)      Service      Handler Selection        Updates
```

## Phase 1: Input Reception

### AgentRequest Structure

```typescript
interface AgentRequest {
  readonly input: string;           // Raw user input
  readonly context: AgentContext;   // Execution context
}

interface AgentContext {
  readonly sessionId: string;       // Current session ID
  readonly timestamp: Date;         // Request timestamp  
  readonly source: string;          // Source identifier (cli, api, web)
  readonly environmentContext?: ReadonlyMap<string, unknown>; // Additional context
}
```

### Request Creation Example

```typescript
// CLI creates request
const request: AgentRequest = {
  input: "write a quicksort function in TypeScript",
  context: {
    sessionId: stateManager.getCurrentSession().id,
    timestamp: new Date(),
    source: 'qi-code-cli',
    environmentContext: new Map([
      ['workingDirectory', process.cwd()],
      ['userId', 'local-user'],
      ['terminalWidth', process.stdout.columns]
    ])
  }
};

const response = await agent.process(request);
```

## Phase 2: Validation and Initialization

### Agent State Validation

```typescript
async process(request: AgentRequest): Promise<AgentResponse> {
  // 1. Check agent initialization
  if (!this.isInitialized) {
    throw new Error('Agent not initialized. Call initialize() first.');
  }

  // 2. Start metrics tracking
  const startTime = Date.now();
  this.requestCount++;
  this.lastActivity = new Date();

  // Continue processing...
}
```

### Request Validation

- **Agent Initialization**: Agent must be initialized before processing
- **Request Structure**: Validate required fields in AgentRequest
- **Context Validation**: Ensure required context fields are present
- **Metrics Setup**: Start timing and tracking for performance metrics

## Phase 3: State Command Processing (Highest Priority)

### State Command Detection

```typescript
private isStateCommand(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  const stateCommands = ['/model', '/status', '/config', '/mode', '/session'];
  return stateCommands.some(cmd => trimmed.startsWith(cmd));
}
```

### State Command Processing

State commands bypass normal classification and route directly to StateManager:

```typescript
if (this.isStateCommand(request.input)) {
  const response = await this.handleStateCommand(request.input);
  const executionTime = Date.now() - startTime;
  this.totalResponseTime += executionTime;
  return { ...response, executionTime };
}
```

### Available State Commands

#### `/model` Command
```typescript
// Show current model and available models
/model
// Output: 📋 Current Model: ollama (Ollama (qwen2.5:7b))
//         Available Models:
//         ✅ ollama - Ollama (qwen2.5:7b) - Local Ollama model
//         ❌ groq - Groq (llama-3.1-70b) - Fast inference via Groq
//         ❌ openai - OpenAI (gpt-4) - OpenAI GPT-4

// Change model  
/model groq
// Output: ✅ Model changed to: groq (Groq (llama-3.1-70b))
```

#### `/status` Command
```typescript
/status
// Output: 📊 Agent Status:
//           Model: ollama (Ollama (qwen2.5:7b))
//           Mode: ready
//           Session: 79fd7920...
//           Conversation History: 5 entries
//           Requests Processed: 12
//           Average Response Time: 245ms
//           Last Activity: 2024-01-15T10:30:45.123Z
```

#### `/config` Command
```typescript
/config
// Output: ⚙️ Configuration:
//           Version: 0.2.7
//           Default Model: ollama
//           Debug Mode: disabled
//           Max History: 100
//           Session Timeout: 30min
//           Available Models: ollama, groq, openai
```

#### `/session` Command
```typescript
/session
// Output: 💾 Session Information:
//           ID: 79fd7920-8c45-4a2b-9f12-3e5d7a8b9c0d
//           Created: 2024-01-15T10:00:00.000Z
//           Last Active: 2024-01-15T10:30:45.123Z
//           Conversation History: 5 entries
//
//         Recent entries:
//           10:25:30 [user_input]: write a quicksort function...
//           10:25:32 [agent_response]: Here's a TypeScript quicksort implementation...
//           10:28:15 [user_input]: /status
```

#### `/mode` Command
```typescript
/mode                    // Show current mode
/mode planning          // Set mode to planning
/mode executing         // Set mode to executing
```

### State Command Flow

```
User: "/status" → Agent.isStateCommand() → Agent.handleStateCommand() → StateManager.getState() → Formatted Response
      ↓                    ✓                         ↓                          ↓                      ↓
  State Command → Skip Classification → Direct StateManager Access → System Status → User Display
```

## Phase 4: Input Classification

### Classification Requirements

```typescript
// Classification only happens for non-state commands
if (!this.classifier) {
  throw new Error('Classifier not available');
}

const classification = await this.classifier.classify(request.input);
```

### Classification Context

```typescript
// Classifier receives context for better classification
const classification = await this.classifier.classify(request.input, {
  userId: request.context.sessionId,
  sessionId: request.context.sessionId, 
  timestamp: request.context.timestamp,
  metadata: request.context.environmentContext || new Map()
});
```

### Classification Results

```typescript
interface ClassificationResult {
  type: 'command' | 'prompt' | 'workflow';
  confidence: number;           // 0.0 to 1.0
  method: string;              // Classification method used
  metadata: Map<string, any>;  // Additional classification data
}
```

### Example Classifications

```typescript
// Prompt examples
"hi" → { type: 'prompt', confidence: 0.95, method: 'rule-based' }
"write a quicksort function" → { type: 'prompt', confidence: 0.85, method: 'rule-based' }
"explain TypeScript generics" → { type: 'prompt', confidence: 0.90, method: 'rule-based' }

// Workflow examples  
"fix bug in src/file.ts and run tests" → { type: 'workflow', confidence: 0.88, method: 'rule-based' }
"analyze codebase and generate report" → { type: 'workflow', confidence: 0.92, method: 'rule-based' }
"refactor authentication system" → { type: 'workflow', confidence: 0.85, method: 'rule-based' }

// Command examples (non-state commands)
"help me with commands" → { type: 'command', confidence: 0.75, method: 'rule-based' }
"show available tools" → { type: 'command', confidence: 0.80, method: 'rule-based' }
```

## Phase 5: Handler Routing

### Routing Logic

```typescript
let response: AgentResponse;

switch (classification.type) {
  case 'command':
    response = await this.handleCommand(request, classification);
    break;
  case 'prompt':
    response = await this.handlePrompt(request, classification);
    break;
  case 'workflow':
    response = await this.handleWorkflow(request, classification);
    break;
  default:
    throw new Error(`Unknown classification type: ${classification.type}`);
}
```

### Command Handler Routing

```typescript
private async handleCommand(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  // 1. Feature flag check
  if (!this.config.enableCommands) {
    return this.createDisabledResponse('command', 'Command processing is disabled');
  }

  // 2. Handler availability check
  if (!this.commandHandler) {
    return this.createErrorResponse('command', 'Command handler not available');
  }

  // 3. Transform request format
  const commandRequest: CommandRequest = {
    commandName: this.extractCommandName(request.input),
    parameters: this.extractCommandParameters(request.input),
    rawInput: request.input,
    context: request.context.environmentContext
  };

  // 4. Execute through handler
  const result = await this.commandHandler.executeCommand(commandRequest);

  // 5. Transform response format
  return {
    content: result.content,
    type: 'command',
    confidence: classification.confidence,
    executionTime: 0, // Will be set by main process method
    metadata: new Map([
      ...result.metadata,
      ['commandName', result.commandName],
      ['commandStatus', result.status]
    ]),
    success: result.success,
    error: result.error
  };
}
```

### Prompt Handler Routing

```typescript
private async handlePrompt(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  // 1. Feature flag check
  if (!this.config.enablePrompts) {
    return this.createDisabledResponse('prompt', 'Prompt processing is disabled');
  }

  // 2. Handler availability check  
  if (!this.promptHandler) {
    return this.createErrorResponse('prompt', 'Prompt handler not available');
  }

  // 3. Transform and execute (TODO: Implementation needed)
  // This is where we would integrate with PromptHandler
  // const result = await this.promptHandler.process(promptRequest);
  // return this.mapToAgentResponse(result, 'prompt', classification);
  
  throw new Error('Prompt processing not implemented - design incomplete');
}
```

### Workflow Handler Routing

```typescript
private async handleWorkflow(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  // 1. Feature flag check
  if (!this.config.enableWorkflows) {
    return this.createDisabledResponse('workflow', 'Workflow processing is disabled');
  }

  // 2. Handler availability check
  if (!this.workflowExtractor || !this.workflowEngine) {
    return this.createErrorResponse('workflow', 'Workflow components not available');
  }

  // 3. Two-phase workflow processing (TODO: Implementation needed)
  // Phase 1: Extract workflow specification
  // const workflowSpec = await this.workflowExtractor.extract(request.input);
  // Phase 2: Execute workflow with tools
  // const result = await this.workflowEngine.execute(workflowSpec);
  // return this.mapToAgentResponse(result, 'workflow', classification);
  
  throw new Error('Workflow processing not implemented - design incomplete');
}
```

## Phase 6: Response Processing and Metadata

### Response Enhancement

```typescript
// Add execution time and metadata
const executionTime = Date.now() - startTime;
this.totalResponseTime += executionTime;

return {
  ...response,
  executionTime,
  metadata: new Map([
    ...response.metadata,
    ['classification', {
      type: classification.type,
      confidence: classification.confidence,
      method: classification.method
    }],
    ['agentProcessingTime', executionTime],
    ['requestCount', this.requestCount],
    ['sessionId', request.context.sessionId],
    ['source', request.context.source]
  ])
};
```

### Error Handling

```typescript
} catch (error) {
  // Track failed requests in metrics
  const executionTime = Date.now() - startTime;
  this.totalResponseTime += executionTime;

  return {
    content: `Agent processing failed: ${error.message}`,
    type: 'command', // Default type for errors
    confidence: 0,
    executionTime,
    metadata: new Map([
      ['error', error.message],
      ['errorType', 'agent-processing-error'],
      ['failedAt', 'request-processing'],
      ['requestCount', this.requestCount]
    ]),
    success: false,
    error: error.message
  };
}
```

## Phase 7: State Updates

### Conversation History Updates

The agent automatically updates conversation history through StateManager:

```typescript
// Add user input to conversation history
this.stateManager.addConversationEntry({
  type: 'user_input',
  content: request.input,
  metadata: new Map([
    ['source', request.context.source],
    ['classification', classification.type],
    ['confidence', classification.confidence]
  ])
});

// Add agent response to conversation history
this.stateManager.addConversationEntry({
  type: 'agent_response',
  content: response.content,
  metadata: new Map([
    ['success', response.success],
    ['executionTime', response.executionTime],
    ['responseType', response.type]
  ])
});
```

### State Manager Updates

```typescript
// Update last activity
this.lastActivity = new Date();

// Update session activity
this.stateManager.getCurrentSession(); // Updates lastActiveAt internally

// Update metrics
this.requestCount++;
this.totalResponseTime += executionTime;
```

## Streaming Processing Pipeline

### Streaming Flow

```typescript
async *stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk> {
  if (!this.isInitialized) {
    throw new Error('Agent not initialized');
  }

  try {
    // Phase 1: Classification streaming
    yield {
      type: 'classification',
      content: 'Classifying input...',
      isComplete: false
    };

    const classification = await this.classifier.classify(request.input);

    yield {
      type: 'classification',
      content: `Classified as: ${classification.type} (${(classification.confidence * 100).toFixed(1)}% confidence)`,
      isComplete: true,
      metadata: new Map([['classification', classification]])
    };

    // Phase 2: Processing streaming
    yield {
      type: 'processing',
      content: `Processing ${classification.type}...`,
      isComplete: false
    };

    // Phase 3: Execute and stream result
    const response = await this.process(request);

    yield {
      type: 'result',
      content: response.content,
      isComplete: true,
      metadata: response.metadata
    };

  } catch (error) {
    yield {
      type: 'error',
      content: `Stream processing failed: ${error.message}`,
      isComplete: true,
      error: error.message
    };
  }
}
```

## Request Processing Examples

### Example 1: State Command

```typescript
// Input: "/status"
const request = {
  input: "/status",
  context: {
    sessionId: "session-123",
    timestamp: new Date(),
    source: "cli"
  }
};

// Processing:
// 1. Validation ✓
// 2. isStateCommand("/status") → true
// 3. handleStateCommand("/status") → handleStatusCommand()
// 4. stateManager.getState() → system status
// 5. Format response with metrics
// 6. Skip classification and handlers
// 7. Return response

// Output:
{
  content: "📊 Agent Status:\n  Model: ollama\n  Requests: 15\n...",
  type: "command",
  success: true,
  executionTime: 5
}
```

### Example 2: Simple Prompt

```typescript
// Input: "write a quicksort function"
const request = {
  input: "write a quicksort function",
  context: { sessionId: "session-123", timestamp: new Date(), source: "cli" }
};

// Processing:
// 1. Validation ✓
// 2. isStateCommand() → false  
// 3. classifier.classify() → { type: 'prompt', confidence: 0.85 }
// 4. handlePrompt() → (TODO: PromptHandler integration)
// 5. Add metadata and timing
// 6. Update conversation history
// 7. Return response

// Current output (handler not implemented):
{
  content: "Prompt handler not available",
  type: "prompt", 
  success: false,
  error: "Prompt handler not available"
}
```

### Example 3: Complex Workflow

```typescript
// Input: "analyze src/ directory and generate a code quality report"
const request = {
  input: "analyze src/ directory and generate a code quality report",
  context: { sessionId: "session-123", timestamp: new Date(), source: "cli" }
};

// Processing:
// 1. Validation ✓
// 2. isStateCommand() → false
// 3. classifier.classify() → { type: 'workflow', confidence: 0.92 }
// 4. handleWorkflow() → (TODO: WorkflowEngine integration)
// 5. Add metadata and timing
// 6. Update conversation history  
// 7. Return response

// Current output (handler not implemented):
{
  content: "Workflow components not available",
  type: "workflow",
  success: false, 
  error: "Workflow components not available"
}
```

## Performance Metrics

### Request Timing

```typescript
// Processing phases and typical timing:
Phase 1: Input Reception        < 1ms
Phase 2: Validation            < 1ms  
Phase 3: State Commands        5-20ms (if applicable)
Phase 4: Classification        10-50ms
Phase 5: Handler Routing       Variable (handler dependent)
Phase 6: Response Processing   < 5ms
Phase 7: State Updates         5-15ms

Total: 20-100ms (excluding handler execution time)
```

### Current Performance

Based on our test results:
- **Agent Status Command**: ~5-10ms execution time
- **Classification**: ~10-20ms for rule-based classification
- **State Updates**: ~5ms for conversation history
- **Average Response Time**: Currently tracking in agent metrics

## Error Scenarios

### Common Error Paths

1. **Agent Not Initialized**
   ```typescript
   // Error: "Agent not initialized. Call initialize() first."
   // Resolution: Call agent.initialize() before processing
   ```

2. **Classifier Unavailable**
   ```typescript
   // Error: "Classifier not available" 
   // Resolution: Inject classifier in agent factory
   ```

3. **Handler Not Available**
   ```typescript
   // Error: "Prompt handler not available"
   // Resolution: Inject appropriate handler or expect graceful degradation
   ```

4. **Feature Disabled**
   ```typescript
   // Error: "Workflow processing is disabled"
   // Resolution: Enable feature in agent configuration
   ```

---

This processing pipeline provides a robust, extensible foundation for handling all types of user requests while maintaining clear separation of concerns and providing comprehensive error handling and metrics tracking.