# qi-v2 Agent Implementation

## Implementation Overview

The `QiCodeAgent` class is our concrete implementation of the `IAgent` interface. It serves as the central orchestrator that owns and coordinates all system components through dependency injection and contract-based interactions.

## Core Implementation

### Class Structure

```typescript
export class QiCodeAgent implements IAgent {
  // Owned Dependencies
  private stateManager: IStateManager;           // Required - owned by agent
  private classifier?: IClassifier;              // Optional - input classification
  private commandHandler?: ICommandHandler;      // Optional - command processing
  private promptHandler?: IPromptHandler;        // Optional - LLM integration
  private workflowEngine?: IWorkflowEngine;      // Optional - workflow execution
  private workflowExtractor?: IWorkflowExtractor; // Optional - workflow parsing
  
  // Configuration and State
  private config: AgentConfig;                   // Agent configuration
  private isInitialized = false;                 // Initialization flag
  private startTime?: Date;                      // Agent start time
  private requestCount = 0;                      // Request counter
  private totalResponseTime = 0;                 // Total response time
  private lastActivity?: Date;                   // Last activity timestamp
}
```

### Constructor and Dependency Injection

```typescript
constructor(
  stateManager: IStateManager,     // Required dependency
  config: AgentConfig,             // Agent configuration
  dependencies: {                  // Optional dependencies
    classifier?: IClassifier;
    commandHandler?: ICommandHandler;
    promptHandler?: IPromptHandler;
    workflowEngine?: IWorkflowEngine;
    workflowExtractor?: IWorkflowExtractor;
  } = {}
) {
  // Store required dependencies
  this.stateManager = stateManager;
  this.config = config;
  
  // Store optional dependencies
  this.classifier = dependencies.classifier;
  this.commandHandler = dependencies.commandHandler;
  this.promptHandler = dependencies.promptHandler;
  this.workflowEngine = dependencies.workflowEngine;
  this.workflowExtractor = dependencies.workflowExtractor;
}
```

**Key Design Decisions**:
1. **StateManager is required** - Agent cannot function without state management
2. **Other dependencies are optional** - Agent can gracefully degrade functionality
3. **Dependencies are injected** - Enables testing and flexibility
4. **Agent owns dependencies** - Clear ownership model

## Initialization Implementation

```typescript
async initialize(): Promise<void> {
  if (this.isInitialized) {
    return; // Idempotent initialization
  }

  this.startTime = new Date();
  
  // Initialize components that need initialization
  // Each component handles its own initialization
  // No complex initialization orchestration needed
  
  this.isInitialized = true;
}
```

**Implementation Notes**:
- **Idempotent**: Safe to call multiple times
- **Minimal**: Components initialize themselves
- **Fast**: No complex startup sequence
- **Trackable**: Records start time for uptime metrics

## Request Processing Implementation

### Main Processing Method

```typescript
async process(request: AgentRequest): Promise<AgentResponse> {
  // 1. Validation
  if (!this.isInitialized) {
    throw new Error('Agent not initialized. Call initialize() first.');
  }

  // 2. Metrics tracking
  const startTime = Date.now();
  this.requestCount++;
  this.lastActivity = new Date();

  try {
    // 3. State command check (highest priority)
    if (this.isStateCommand(request.input)) {
      const response = await this.handleStateCommand(request.input);
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime;
      return { ...response, executionTime };
    }

    // 4. Classification (requires classifier)
    if (!this.classifier) {
      throw new Error('Classifier not available');
    }
    const classification = await this.classifier.classify(request.input);

    // 5. Route to handler
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

    // 6. Add metadata and return
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
        ['agentProcessingTime', executionTime]
      ])
    };

  } catch (error) {
    // 7. Error handling with metrics
    const executionTime = Date.now() - startTime;
    this.totalResponseTime += executionTime;

    return {
      content: `Agent processing failed: ${error.message}`,
      type: 'command', // Default type for errors
      confidence: 0,
      executionTime,
      metadata: new Map([
        ['error', error.message],
        ['errorType', 'agent-processing-error']
      ]),
      success: false,
      error: error.message
    };
  }
}
```

### State Command Processing

Our agent has built-in state management commands that directly interact with the StateManager:

```typescript
private isStateCommand(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  const stateCommands = ['/model', '/status', '/config', '/mode', '/session'];
  return stateCommands.some(cmd => trimmed.startsWith(cmd));
}

private async handleStateCommand(input: string): Promise<AgentResponse> {
  const trimmed = input.trim().toLowerCase();
  const parts = input.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  try {
    switch (command) {
      case '/model': return this.handleModelCommand(args);
      case '/status': return this.handleStatusCommand();
      case '/config': return this.handleConfigCommand(args);
      case '/mode': return this.handleModeCommand(args);
      case '/session': return this.handleSessionCommand(args);
      default:
        return this.createErrorResponse('command', `Unknown state command: ${command}`);
    }
  } catch (error) {
    return this.createErrorResponse('command', `State command error: ${error.message}`);
  }
}
```

#### Model Command Implementation

```typescript
private handleModelCommand(args: string[]): AgentResponse {
  if (args.length === 0) {
    // Show current model and available models
    const currentModel = this.stateManager.getCurrentModel();
    const currentModelInfo = this.stateManager.getModelInfo(currentModel);
    const availableModels = this.stateManager.getAvailableModels();
    
    let content = `📋 Current Model: ${currentModel}`;
    if (currentModelInfo) {
      content += ` (${currentModelInfo.name})`;
    }
    
    content += '\n\nAvailable Models:';
    for (const model of availableModels) {
      const status = model.available ? '✅' : '❌';
      content += `\n  ${status} ${model.id} - ${model.name}`;
      if (model.description) {
        content += ` - ${model.description}`;
      }
    }
    
    return {
      content,
      type: 'command',
      confidence: 1.0,
      executionTime: 0,
      metadata: new Map([
        ['currentModel', currentModel],
        ['availableModels', availableModels.length.toString()]
      ]),
      success: true
    };
  } else {
    // Set model
    const modelId = args[0];
    try {
      this.stateManager.setCurrentModel(modelId);
      const modelInfo = this.stateManager.getModelInfo(modelId);
      const content = `✅ Model changed to: ${modelId}${modelInfo ? ` (${modelInfo.name})` : ''}`;
      
      return {
        content,
        type: 'command',
        confidence: 1.0,
        executionTime: 0,
        metadata: new Map([['newModel', modelId]]),
        success: true
      };
    } catch (error) {
      return this.createErrorResponse('command', `Failed to change model: ${error.message}`);
    }
  }
}
```

#### Status Command Implementation

```typescript
private handleStatusCommand(): AgentResponse {
  const state = this.stateManager.getState();
  const currentModelInfo = this.stateManager.getModelInfo(state.currentModel);
  
  let content = '📊 Agent Status:\n';
  content += `  Model: ${state.currentModel}`;
  if (currentModelInfo) {
    content += ` (${currentModelInfo.name})`;
  }
  content += `\n  Mode: ${state.currentMode}`;
  content += `\n  Session: ${state.session.id}`;
  content += `\n  Conversation History: ${state.session.conversationHistory.length} entries`;
  content += `\n  Requests Processed: ${this.requestCount}`;
  content += `\n  Average Response Time: ${this.requestCount > 0 ? Math.round(this.totalResponseTime / this.requestCount) : 0}ms`;
  if (this.lastActivity) {
    content += `\n  Last Activity: ${this.lastActivity.toISOString()}`;
  }
  
  return {
    content,
    type: 'command',
    confidence: 1.0,
    executionTime: 0,
    metadata: new Map([
      ['model', state.currentModel],
      ['mode', state.currentMode],
      ['sessionId', state.session.id],
      ['historyLength', state.session.conversationHistory.length.toString()]
    ]),
    success: true
  };
}
```

### Handler Routing Implementation

#### Command Handler Routing

```typescript
private async handleCommand(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  if (!this.config.enableCommands) {
    return this.createDisabledResponse('command', 'Command processing is disabled');
  }

  if (!this.commandHandler) {
    return this.createErrorResponse('command', 'Command handler not available');
  }

  // Map agent request to command request
  const commandRequest: CommandRequest = {
    commandName: this.extractCommandName(request.input),
    parameters: this.extractCommandParameters(request.input),
    rawInput: request.input,
    context: request.context.environmentContext
  };

  const result = await this.commandHandler.executeCommand(commandRequest);

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

#### Prompt Handler Routing

```typescript
private async handlePrompt(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  if (!this.config.enablePrompts) {
    return this.createDisabledResponse('prompt', 'Prompt processing is disabled');
  }

  if (!this.promptHandler) {
    return this.createErrorResponse('prompt', 'Prompt handler not available');
  }

  // TODO: Implement real prompt processing integration
  // This is where we would integrate with the PromptHandler
  // Design decisions needed:
  // 1. How AgentRequest maps to PromptHandler input format
  // 2. How PromptHandler response maps back to AgentResponse
  // 3. Context passing strategy between agent and prompt handler
  // 4. Error handling and timeout strategy for prompt processing
  
  throw new Error('Prompt processing not implemented - design incomplete');
}
```

#### Workflow Handler Routing

```typescript
private async handleWorkflow(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  if (!this.config.enableWorkflows) {
    return this.createDisabledResponse('workflow', 'Workflow processing is disabled');
  }

  if (!this.workflowExtractor || !this.workflowEngine) {
    return this.createErrorResponse('workflow', 'Workflow components not available');
  }

  // TODO: Implement real workflow processing integration
  // This is where we would integrate WorkflowExtractor + WorkflowEngine
  // Design decisions needed:
  // 1. How AgentRequest maps to WorkflowExtractor input for task analysis
  // 2. How WorkflowExtractor output (WorkflowSpec) feeds into WorkflowEngine
  // 3. How WorkflowEngine execution results map back to AgentResponse
  // 4. Context and state management across workflow steps
  // 5. Error handling and recovery strategy for workflow execution
  // 6. Progress tracking and streaming for long-running workflows
  
  throw new Error('Workflow processing not implemented - design incomplete');
}
```

## Streaming Implementation

```typescript
async *stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk> {
  if (!this.isInitialized) {
    throw new Error('Agent not initialized. Call initialize() first.');
  }

  try {
    // Classification phase
    yield {
      type: 'classification',
      content: 'Classifying input...',
      isComplete: false
    };

    if (!this.classifier) {
      throw new Error('Classifier not available');
    }

    const classification = await this.classifier.classify(request.input);

    yield {
      type: 'classification',
      content: `Classified as: ${classification.type} (${(classification.confidence * 100).toFixed(1)}% confidence)`,
      isComplete: true,
      metadata: new Map([['classification', classification]])
    };

    // Processing phase
    yield {
      type: 'processing',
      content: `Processing ${classification.type}...`,
      isComplete: false
    };

    // Route and execute (reuses main process method)
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

## Status and Metrics Implementation

```typescript
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

async shutdown(): Promise<void> {
  // Cleanup resources if needed
  // Currently minimal cleanup required
  this.isInitialized = false;
}
```

## Helper Methods Implementation

### Response Creation Helpers

```typescript
private createDisabledResponse(
  type: 'command' | 'prompt' | 'workflow', 
  message: string
): AgentResponse {
  return {
    content: message,
    type,
    confidence: 0,
    executionTime: 0,
    metadata: new Map([['disabled', true]]),
    success: false,
    error: message
  };
}

private createErrorResponse(
  type: 'command' | 'prompt' | 'workflow', 
  message: string
): AgentResponse {
  return {
    content: message,
    type,
    confidence: 0,
    executionTime: 0,
    metadata: new Map([['errorType', 'component-unavailable']]),
    success: false,
    error: message
  };
}
```

### Command Parsing Helpers

```typescript
private extractCommandName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('/')) {
    return trimmed.slice(1).split(' ')[0];
  }
  return '';
}

private extractCommandParameters(input: string): ReadonlyMap<string, unknown> {
  const trimmed = input.trim();
  if (trimmed.startsWith('/')) {
    const parts = trimmed.slice(1).split(' ').slice(1);
    const params = new Map<string, unknown>();
    parts.forEach((part, index) => {
      params.set(index.toString(), part);
    });
    return params;
  }
  return new Map();
}
```

## Current Implementation Status

### ✅ Fully Implemented

1. **Core Agent Structure**
   - Complete IAgent interface implementation
   - Dependency injection with StateManager ownership
   - Initialization and lifecycle management

2. **Request Processing Pipeline**
   - Input validation and metrics tracking
   - State command processing (highest priority)
   - Classification and routing logic
   - Error handling with graceful degradation

3. **Built-in State Commands**
   - `/model` - Model selection and information display
   - `/status` - Complete agent and system status
   - `/config` - Configuration display and management
   - `/session` - Session information and history
   - `/mode` - Application mode management

4. **Streaming Support**
   - Classification phase streaming
   - Processing phase streaming
   - Result streaming with metadata
   - Error streaming

5. **Metrics and Status**
   - Request counting and timing
   - Uptime tracking
   - Average response time calculation
   - Last activity tracking

### 🔄 Partially Implemented

1. **Handler Integration**
   - CommandHandler routing logic complete
   - PromptHandler routing structure ready (integration TODO)
   - WorkflowEngine routing structure ready (integration TODO)

### 📋 TODO Items

1. **PromptHandler Integration**
   - Define AgentRequest → PromptHandler mapping
   - Implement response transformation
   - Add context passing strategy
   - Error handling and timeouts

2. **WorkflowEngine Integration**
   - Define WorkflowExtractor integration
   - Implement WorkflowSpec → WorkflowEngine flow
   - Add progress tracking for long-running workflows
   - Context and state management across workflow steps

3. **Enhanced Features**
   - Advanced streaming with progress updates
   - Performance optimization and caching
   - Plugin system for custom handlers
   - Advanced error recovery

## Testing

The implementation includes comprehensive error handling and graceful degradation:

```typescript
// Current test results show:
// ✅ Agent created and initialized: true
// ✅ Command processed: 📊 Agent Status... (shows working state commands)
// ✅ State management: Conversation history tracking working
```

## Integration Points

### StateManager Integration
```typescript
// Direct ownership and access
const state = this.stateManager.getState();
const model = this.stateManager.getCurrentModel();
this.stateManager.addConversationEntry(entry);
```

### Factory Integration
```typescript
// Created via factory with dependency injection
const agent = createAgent(stateManager, {
  domain: 'qi-code',
  classifier: new InputClassifier(),
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: true
});
```

This implementation provides a robust, extensible foundation for our AI coding assistant with clear separation of concerns and practical real-world functionality.