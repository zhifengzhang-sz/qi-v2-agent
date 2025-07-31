# qi-v2 Agent Implementation

## What is an Agent?

**Agent = Toolbox + Workflow Executor + NLP Capability**

An agent is a system that combines:
- **Toolbox**: A collection of specialized tools for different tasks (file operations, search, execution, etc.)
- **Workflow Executor (WE)**: The capability to orchestrate multi-step workflows and coordinate tool usage
- **NLP Capability**: The ability to map natural language instructions into executable workflow steps

This definition captures the essence of what makes an AI agent intelligent: it's not just about having tools, but having the intelligence to understand natural language requests and translate them into coordinated tool executions that accomplish complex tasks.

## Overview

The qi-v2 Agent is our main AI coding assistant implementation that embodies this agent definition. It follows an **agent-centric architecture** where the agent owns and coordinates StateManager, ContextManager, and other components through well-defined contracts.

## Architecture

```
QiCodeAgent (Central Orchestrator)
├── StateManager (owned)      - Configuration, sessions, conversation history
├── ContextManager (owned)    - Context isolation and security boundaries  
├── Classifier (owned)        - Three-type input classification
├── CommandHandler (optional) - Built-in system commands
├── PromptHandler (optional)  - LLM integration for simple requests
├── WorkflowEngine (optional) - Complex multi-step task orchestration
└── WorkflowExtractor (optional) - Natural language to workflow spec
```

## Core Components

### 1. Agent Interface (`IAgent`)
### 2. Agent Implementation (`QiCodeAgent`)
### 3. Agent Factory (`createAgent`)
### 4. Request Processing Pipeline
### 5. State Integration Patterns

## Documentation Structure

- **[Agent Design](agent.design.md)** - Core design principles and interfaces
- **[Agent Implementation](agent.impl.md)** - QiCodeAgent implementation details
- **[Integration Patterns](integration.patterns.md)** - How components work together
- **[Request Processing](request.processing.md)** - Complete request lifecycle
- **[Factory Patterns](factory.patterns.md)** - Agent creation and configuration

## Quick Start

```typescript
import { createStateManager } from '../state/index.js';
import { createAgent } from './index.js';
import { InputClassifier } from '../classifier/impl/input-classifier.js';

// Create dependencies
const stateManager = createStateManager();
const classifier = new InputClassifier();

// Create agent
const agent = createAgent(stateManager, {
  domain: 'coding-assistant',
  classifier,
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: true
});

// Initialize and use
await agent.initialize();

const response = await agent.process({
  input: "write a quicksort function in TypeScript",
  context: {
    sessionId: stateManager.getCurrentSession().id,
    timestamp: new Date(),
    source: 'cli'
  }
});
```

## Key Features

### 1. **Agent-Centric Design**
- Agent owns and coordinates all components
- Contract-based interactions prevent tight coupling
- Clear separation of concerns

### 2. **Three-Type Classification with NLP Capability**
- **Commands**: Built-in system operations (`/help`, `/config`)
- **Prompts**: Simple conversational requests (`"hi"`, `"write quicksort"`)
- **Workflows**: Complex multi-step tasks (`"fix bug and run tests"`) - demonstrates NLP→workflow mapping

### 3. **State Integration**
- Direct StateManager ownership and access
- Automatic conversation history tracking
- Configuration and model management

### 4. **Toolbox Integration**
- Comprehensive tool collection (file ops, search, execution, memory, web)
- Optional handler injection for different tool capabilities
- Graceful degradation when tools unavailable
- Easy extensibility for new tools and request types

### 5. **Workflow Execution Capability**
- Natural language to workflow specification mapping
- Multi-step task orchestration with tool coordination
- Sub-agent delegation with context isolation
- Progress tracking and error recovery

### 6. **Built-in State Commands**
- `/model` - Model selection and information
- `/status` - Complete agent and system status
- `/config` - Configuration display and management
- `/session` - Session information and history

## Integration with Other Components

### StateManager Integration
```typescript
// Agent owns StateManager and uses it directly
constructor(stateManager: IStateManager, config: AgentConfig) {
  this.stateManager = stateManager; // Direct ownership
}

// Direct access to state via contracts
const currentModel = this.stateManager.getCurrentModel();
const session = this.stateManager.getCurrentSession();
```

### Classifier Integration
```typescript
// Agent uses classifier to determine request type
const classification = await this.classifier.classify(request.input);

// Route based on classification
switch (classification.type) {
  case 'command': return await this.handleCommand(request, classification);
  case 'prompt': return await this.handlePrompt(request, classification);  
  case 'workflow': return await this.handleWorkflow(request, classification);
}
```

### Handler Integration
```typescript
// Optional handler injection with graceful fallback
if (!this.promptHandler) {
  return this.createErrorResponse('prompt', 'Prompt handler not available');
}

const result = await this.promptHandler.process(promptRequest);
```

## Current Implementation Status

### ✅ Completed
- Core agent architecture and interfaces
- StateManager integration and ownership
- Three-type input classification and routing
- Built-in state management commands (`/model`, `/status`, `/config`, `/session`)
- Agent factory with dependency injection
- Request lifecycle management
- Error handling and response formatting
- Status tracking and metrics

### 🔄 In Progress
- PromptHandler integration for LLM requests
- WorkflowEngine integration for complex tasks
- ContextManager integration for sub-agent isolation

### 📋 Planned
- Advanced streaming support
- Performance metrics and monitoring
- Advanced error recovery
- Plugin system for custom handlers

## Testing

Our agent implementation includes comprehensive testing:

```bash
# Test the complete agent architecture
bun run qi-code:test

# Test specific components
bun test src/agent/
```

See the test results in our current implementation - the agent successfully:
- Creates and initializes with StateManager integration
- Processes state commands and returns detailed information
- Tracks metrics (requests processed, response times)
- Manages conversation history through StateManager

---

**Next**: See the detailed documentation files for complete implementation details and usage patterns.