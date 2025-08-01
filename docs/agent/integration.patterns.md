# qi-v2 Agent Integration Patterns

## Overview

This document describes how the qi-v2 Agent integrates with other system components. The agent follows an **ownership-based integration pattern** where it owns and coordinates other components through well-defined contracts.

## Core Integration Architecture

```
QiCodeAgent (Owner/Coordinator)
├── StateManager (Owned) ──contracts──> State Operations
├── ContextManager (Owned) ──contracts──> Context Operations  
├── Classifier (Owned) ──contracts──> Classification Operations
├── CommandHandler (Optional) ──contracts──> Command Operations
├── PromptHandler (Optional) ──contracts──> Prompt Operations
└── WorkflowEngine (Optional) ──contracts──> Workflow Operations
```

## StateManager Integration

### Ownership Pattern

The agent **owns** the StateManager and accesses it directly through contracts:

```typescript
class QiCodeAgent implements IAgent {
  private stateManager: IStateManager; // Direct ownership
  
  constructor(stateManager: IStateManager, config: AgentConfig) {
    this.stateManager = stateManager; // Agent takes ownership
  }
  
  // Direct contract-based access
  async process(request: AgentRequest): Promise<AgentResponse> {
    // Get current context from owned StateManager
    const context = this.stateManager.getContext();
    const session = this.stateManager.getCurrentSession();
    const model = this.stateManager.getCurrentModel();
    
    // Process request...
    
    // Update state through owned StateManager
    this.stateManager.addConversationEntry({
      type: 'user_input',
      content: request.input,
      metadata: new Map([['source', request.context.source]])
    });
    
    this.stateManager.addConversationEntry({
      type: 'agent_response',
      content: response.content,
      metadata: new Map([['executionTime', response.executionTime]])
    });
  }
}
```

### State Command Integration

Built-in commands directly interact with the StateManager:

```typescript
// Model management through StateManager
private handleModelCommand(args: string[]): AgentResponse {
  if (args.length === 0) {
    // Show current model information
    const currentModel = this.stateManager.getCurrentModel();
    const currentModelInfo = this.stateManager.getModelInfo(currentModel);
    const availableModels = this.stateManager.getAvailableModels();
    
    // Format response with model information
    let content = `📋 Current Model: ${currentModel}`;
    if (currentModelInfo) {
      content += ` (${currentModelInfo.name})`;
    }
    
    content += '\n\nAvailable Models:';
    for (const model of availableModels) {
      const status = model.available ? '✅' : '❌';
      content += `\n  ${status} ${model.id} - ${model.name}`;
    }
    
    return { content, type: 'command', success: true, /* ... */ };
  } else {
    // Change model through StateManager
    const modelId = args[0];
    this.stateManager.setCurrentModel(modelId);
    return { content: `✅ Model changed to: ${modelId}`, /* ... */ };
  }
}

// Status command showing StateManager data
private handleStatusCommand(): AgentResponse {
  const state = this.stateManager.getState();
  
  let content = '📊 Agent Status:\n';
  content += `  Model: ${state.currentModel}\n`;
  content += `  Mode: ${state.currentMode}\n`;  
  content += `  Session: ${state.session.id}\n`;
  content += `  Conversation History: ${state.session.conversationHistory.length} entries\n`;
  content += `  Requests Processed: ${this.requestCount}`;
  
  return { content, type: 'command', success: true, /* ... */ };
}
```

### State Flow Integration

```
User Request → Agent → StateManager.getContext() → Process Request → StateManager.addConversationEntry() → Response
     ↓              ↓           ↓                      ↓                    ↓                             ↓
  CLI Input → QiCodeAgent → Get Session/Model → Classification → Update History → CLI Output
```

## Classifier Integration

### Dependency Injection Pattern

```typescript
class QiCodeAgent implements IAgent {
  private classifier?: IClassifier; // Optional dependency
  
  constructor(stateManager: IStateManager, config: AgentConfig, dependencies: {
    classifier?: IClassifier; // Injected dependency
  }) {
    this.classifier = dependencies.classifier;
  }
  
  async process(request: AgentRequest): Promise<AgentResponse> {
    // Check availability with graceful fallback
    if (!this.classifier) {
      throw new Error('Classifier not available');
    }
    
    // Use classifier through contract
    const classification = await this.classifier.classify(request.input, {
      userId: request.context.sessionId,
      sessionId: request.context.sessionId,
      timestamp: request.context.timestamp,
      metadata: request.context.environmentContext || new Map()
    });
    
    // Route based on classification
    switch (classification.type) {
      case 'command': return await this.handleCommand(request, classification);
      case 'prompt': return await this.handlePrompt(request, classification);
      case 'workflow': return await this.handleWorkflow(request, classification);
    }
  }
}
```

### Classification Flow Integration

```
Agent.process() → Classifier.classify() → Classification Result → Handler Routing
      ↓                    ↓                     ↓                    ↓
  User Input → Three-Type Analysis → {type, confidence} → Command/Prompt/Workflow Handler
```

### Integration Example

```typescript
// Factory creates agent with classifier
const classifier = new InputClassifier({
  defaultMethod: 'rule-based',
  confidenceThreshold: 0.8,
  commandPrefix: '/'
});

const agent = createAgent(stateManager, {
  domain: 'qi-code',
  classifier,  // Injected classifier
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: true
});

// Agent uses classifier in processing pipeline
await agent.initialize();
const response = await agent.process({
  input: "write a quicksort function",
  context: {
    sessionId: stateManager.getCurrentSession().id,
    timestamp: new Date(),
    source: 'cli'
  }
});
// → Classifier determines this is a 'prompt'
// → Agent routes to prompt handler
```

## Handler Integration Patterns

### Optional Handler Pattern

All handlers except StateManager are optional with graceful degradation:

```typescript
private async handlePrompt(
  request: AgentRequest, 
  classification: ClassificationResult
): Promise<AgentResponse> {
  
  // Feature flag check
  if (!this.config.enablePrompts) {
    return this.createDisabledResponse('prompt', 'Prompt processing is disabled');
  }

  // Availability check with graceful fallback
  if (!this.promptHandler) {
    return this.createErrorResponse('prompt', 'Prompt handler not available');
  }

  // Use handler through contract
  const result = await this.promptHandler.process({
    input: request.input,
    context: request.context,
    classification
  });

  return this.mapToAgentResponse(result, 'prompt', classification);
}
```

### Handler Factory Integration

```typescript
// Create agent with specific handlers
const agent = createAgent(stateManager, {
  domain: 'qi-code',
  classifier: new InputClassifier(),
  commandHandler: new BuiltInCommandHandler(),
  promptHandler: new OllamaPromptHandler(),
  workflowEngine: new LangGraphWorkflowEngine(),
  workflowExtractor: new NLPWorkflowExtractor()
});

// Or create with minimal configuration
const minimalAgent = createAgent(stateManager, {
  domain: 'qi-code',
  classifier: new InputClassifier(),
  // Only commands and prompts available
  // Workflows will gracefully degrade
});
```

## CLI Integration Pattern

### CLI to Agent Flow

```typescript
// CLI creates and owns agent
class QiCodeApp {
  private stateManager: IStateManager;
  private agent: IAgent;
  
  constructor() {
    // Create StateManager
    this.stateManager = createStateManager();
    
    // Create agent with StateManager ownership
    this.agent = createAgent(this.stateManager, {
      domain: 'qi-code',
      classifier: new InputClassifier()
    });
  }
  
  private async processUserInput(userInput: string): Promise<void> {
    // Create agent request
    const request: AgentRequest = {
      input: userInput,
      context: {
        sessionId: this.stateManager.getCurrentSession().id,
        timestamp: new Date(),
        source: 'qi-code-cli',
        environmentContext: new Map([
          ['workingDirectory', process.cwd()],
          ['userId', 'local-user']
        ])
      }
    };
    
    // Process through agent
    const response = await this.agent.process(request);
    
    // Display result
    console.log(response.content);
  }
}
```

### CLI Flow Diagram

```
User Input → CLI → Agent.process() → StateManager/Classifier/Handlers → Response → CLI → User
     ↓         ↓          ↓                    ↓                          ↓         ↓      ↓
  "hi" → QiCodeApp → QiCodeAgent → StateManager.getContext() → PromptHandler → CLI → "Hello!"
```

## Error Handling Integration

### Graceful Degradation Pattern

```typescript
// Component unavailable - graceful error response
if (!this.workflowEngine) {
  return {
    content: 'Workflow processing not available - workflow engine not configured',
    type: 'workflow',
    confidence: 0,
    executionTime: 0,
    metadata: new Map([['error', 'component-unavailable']]),
    success: false,
    error: 'Workflow engine not available'
  };
}

// Feature disabled - clear user feedback
if (!this.config.enableWorkflows) {
  return {
    content: 'Workflow processing is disabled in configuration',
    type: 'workflow',
    confidence: 0,
    executionTime: 0,
    metadata: new Map([['disabled', true]]),
    success: false,
    error: 'Workflow processing disabled'
  };
}
```

### Error Propagation Pattern

```typescript
try {
  // Process request through handlers
  const result = await this.promptHandler.process(promptRequest);
  return this.mapToAgentResponse(result, 'prompt', classification);
} catch (error) {
  // Convert handler errors to agent response format
  return {
    content: `Prompt processing failed: ${error.message}`,
    type: 'prompt',
    confidence: 0,
    executionTime: 0,
    metadata: new Map([
      ['error', error.message],
      ['errorType', 'handler-error'],
      ['handlerName', 'PromptHandler']
    ]),
    success: false,
    error: error.message
  };
}
```

## Testing Integration Patterns

### Mock Integration

```typescript
describe('QiCodeAgent Integration', () => {
  let mockStateManager: jest.Mocked<IStateManager>;
  let mockClassifier: jest.Mocked<IClassifier>;
  let agent: QiCodeAgent;
  
  beforeEach(() => {
    mockStateManager = {
      getCurrentModel: jest.fn().mockReturnValue('ollama'),
      getCurrentSession: jest.fn().mockReturnValue({ id: 'test-session' }),
      addConversationEntry: jest.fn()
    };
    
    mockClassifier = {
      classify: jest.fn().mockResolvedValue({
        type: 'prompt',
        confidence: 0.9,
        method: 'rule-based'
      })
    };
    
    agent = new QiCodeAgent(mockStateManager, { domain: 'test' }, {
      classifier: mockClassifier
    });
  });
  
  test('should integrate with StateManager for conversation tracking', async () => {
    await agent.initialize();
    
    const response = await agent.process({
      input: 'test input',
      context: {
        sessionId: 'test-session',
        timestamp: new Date(),
        source: 'test'
      }
    });
    
    // Verify StateManager integration
    expect(mockStateManager.addConversationEntry).toHaveBeenCalledWith({
      type: 'agent_response',
      content: response.content,
      metadata: expect.any(Map)
    });
  });
});
```

### Integration Test Pattern

```typescript
// Real integration test with actual components
test('complete agent integration', async () => {
  const stateManager = createStateManager();
  const classifier = new InputClassifier();
  
  const agent = createAgent(stateManager, {
    domain: 'integration-test',
    classifier,
    enableCommands: true
  });
  
  await agent.initialize();
  
  // Test state command integration
  const statusResponse = await agent.process({
    input: '/status',
    context: {
      sessionId: stateManager.getCurrentSession().id,
      timestamp: new Date(),
      source: 'integration-test'
    }
  });
  
  expect(statusResponse.success).toBe(true);
  expect(statusResponse.content).toContain('Agent Status');
  expect(statusResponse.type).toBe('command');
});
```

## Performance Integration

### Metrics Integration

```typescript
class QiCodeAgent implements IAgent {
  private requestCount = 0;
  private totalResponseTime = 0;
  
  async process(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    this.requestCount++; // Track requests
    
    try {
      // Process request...
      const response = await this.processRequest(request);
      
      const executionTime = Date.now() - startTime;
      this.totalResponseTime += executionTime; // Track timing
      
      return { ...response, executionTime };
    } catch (error) {
      // Track failed requests in metrics
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

## Future Integration Patterns

### ContextManager Integration (Planned)

```typescript
class QiCodeAgent implements IAgent {
  private contextManager: IContextManager; // Future integration
  
  async delegateToSubAgent(task: string): Promise<string> {
    // Create isolated context for sub-agent
    const isolatedContext = this.contextManager.createIsolatedContext({
      parentContextId: this.mainContext.id,
      task,
      restrictions: { readOnlyMode: true, timeLimit: 300000 }
    });
    
    // Create sub-agent with isolated context
    const subAgent = new SubAgent(isolatedContext);
    return await subAgent.execute(task);
  }
}
```

### Plugin Integration (Planned)

```typescript
interface PluginIntegration {
  loadPlugin(pluginName: string): Promise<IHandler>;
  registerHandler(type: string, handler: IHandler): void;
  unloadPlugin(pluginName: string): Promise<void>;
}
```

---

This integration pattern provides clear ownership boundaries, graceful degradation, and flexible extensibility while maintaining the agent-centric architecture that makes our system superior to traditional flow-through designs.