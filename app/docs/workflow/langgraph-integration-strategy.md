# LangGraph Integration Strategy for qi-v2-agent Workflows

## Overview

Based on 2025 LangGraph capabilities, we can integrate LangGraph's StateGraph workflow execution with our existing three-type agent architecture while leveraging both systems' strengths.

## Current Architecture Analysis

### Our Existing System (v0.3.0)
- **Context Manager**: Session-based conversation contexts with security isolation
- **Agent Coordination**: Three-type classification (Command/Prompt/Workflow) 
- **LangChain Templates**: Structured prompt handling with conversation history
- **State Management**: Application state with model selection and configuration

### LangGraph Capabilities (2025)
- **StateGraph**: Graph-based workflow orchestration with nodes and edges
- **Memory Management**: Built-in persistence with checkpointing and thread management
- **Functional API**: Traditional programming paradigm with decorators
- **Human-in-the-Loop**: Interrupts and approvals at any workflow step
- **Streaming**: Token-by-token and intermediate step streaming
- **Durable Execution**: Resume from failures and long-running processes

## Integration Strategy

### 1. Architecture Integration Points

#### Current Agent Flow
```
User Input → Classifier → (Command|Prompt|Workflow) → Handler → Response
```

#### Enhanced Flow with LangGraph
```
User Input → Classifier → Command/Prompt (existing) | Workflow → LangGraph StateGraph → Response
                                                    ↓
                                          Context Manager Integration
                                          LangChain Template Integration
                                          Memory Synchronization
```

### 2. LangGraph Integration Patterns

#### Pattern A: Workflow-Only Integration (Recommended)
- **Current System**: Handles Commands and Prompts as-is
- **LangGraph**: Only handles Workflow classification type
- **Memory Sync**: Bridge between our Context Manager and LangGraph's memory
- **Benefits**: Minimal disruption, leverages both systems' strengths

#### Pattern B: Hybrid Integration 
- **LangGraph**: Handles all complex multi-step interactions
- **Current System**: Provides context management and security isolation
- **Integration**: Bidirectional state synchronization

#### Pattern C: Full Migration
- **Replace**: Agent coordination with LangGraph StateGraph
- **Keep**: Context Manager, LangChain templates, three-type classification
- **Risk**: Higher complexity, potential feature loss

## Recommended Implementation (Pattern A)

### 1. Enhanced Workflow Handler

```typescript
// app/src/workflow/impl/LangGraphWorkflowEngine.ts
import { StateGraph, Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { IWorkflowEngine, WorkflowSpec, WorkflowResult } from '../abstractions/index.js';
import type { IContextManager } from '../../context/index.js';

const WorkflowStateAnnotation = Annotation.Root({
  // Bridge with our context system
  contextId: Annotation<string>,
  sessionId: Annotation<string>,
  
  // LangGraph workflow state
  messages: MessagesAnnotation.spec.messages,
  currentStep: Annotation<string>,
  stepResults: Annotation<Map<string, any>>,
  
  // Integration with our agent system
  agentConfig: Annotation<object>,
  templateType: Annotation<string>,
  
  // Workflow metadata
  workflowId: Annotation<string>,
  isComplete: Annotation<boolean>,
  error: Annotation<string | null>
});

export class LangGraphWorkflowEngine implements IWorkflowEngine {
  constructor(
    private contextManager: IContextManager,
    private agentFactory: any // Reference to our agent system
  ) {}

  async executeWorkflow(spec: WorkflowSpec, contextId: string): Promise<WorkflowResult> {
    // Create LangGraph workflow
    const workflow = new StateGraph(WorkflowStateAnnotation)
      .addNode("initialize", this.initializeWorkflow.bind(this))
      .addNode("executeStep", this.executeWorkflowStep.bind(this))
      .addNode("syncContext", this.syncWithContextManager.bind(this))
      .addNode("finalize", this.finalizeWorkflow.bind(this))
      
      .addEdge("__start__", "initialize")
      .addEdge("initialize", "executeStep")
      .addConditionalEdges("executeStep", this.shouldContinueWorkflow.bind(this))
      .addEdge("syncContext", "executeStep")
      .addEdge("finalize", "__end__");

    const app = workflow.compile({
      // Use LangGraph's checkpointing for persistence
      checkpointer: new MemorySaver(),
    });

    // Execute with our context integration
    const result = await app.invoke({
      contextId,
      sessionId: this.extractSessionId(contextId),
      workflowId: spec.id,
      messages: await this.getConversationHistory(contextId),
      agentConfig: await this.getAgentConfig(),
      isComplete: false,
      error: null
    }, {
      configurable: { thread_id: contextId }
    });

    return this.convertToWorkflowResult(result);
  }

  private async initializeWorkflow(state: typeof WorkflowStateAnnotation.State) {
    // Sync with our context manager
    const context = this.contextManager.getConversationContext(state.contextId);
    
    return {
      currentStep: "step_1",
      stepResults: new Map()
    };
  }

  private async executeWorkflowStep(state: typeof WorkflowStateAnnotation.State) {
    // Execute individual workflow step using our agent system
    const stepPrompt = this.buildStepPrompt(state);
    
    // Use our existing agent for step execution
    const agent = this.agentFactory.createForWorkflow(state.agentConfig);
    const stepResult = await agent.process({
      input: stepPrompt,
      context: {
        sessionId: state.sessionId,
        timestamp: new Date(),
        source: 'workflow'
      }
    });

    // Update workflow state
    const newResults = new Map(state.stepResults);
    newResults.set(state.currentStep, stepResult);

    return {
      stepResults: newResults,
      currentStep: this.getNextStep(state.currentStep),
      messages: [...state.messages, stepResult.content]
    };
  }

  private async syncWithContextManager(state: typeof WorkflowStateAnnotation.State) {
    // Sync workflow progress with our context manager
    this.contextManager.addMessageToContext(state.contextId, {
      id: `workflow_${Date.now()}`,
      role: 'system',
      content: `Workflow step ${state.currentStep} completed`,
      timestamp: new Date(),
      metadata: new Map([
        ['workflowId', state.workflowId],
        ['step', state.currentStep]
      ])
    });

    return {}; // No state changes needed
  }

  private shouldContinueWorkflow(state: typeof WorkflowStateAnnotation.State) {
    if (state.error) return "finalize";
    if (state.isComplete) return "finalize";
    if (this.needsContextSync(state)) return "syncContext";
    
    return "executeStep";
  }
}
```

### 2. Memory Integration Bridge

```typescript
// app/src/workflow/impl/LangGraphMemoryBridge.ts
export class LangGraphMemoryBridge {
  constructor(
    private contextManager: IContextManager,
    private langGraphCheckpointer: any
  ) {}

  async syncContextToLangGraph(contextId: string, threadId: string) {
    const context = this.contextManager.getConversationContext(contextId);
    if (!context) return;

    // Convert our context messages to LangGraph format
    const langGraphMessages = context.messages.map(msg => 
      this.convertToLangGraphMessage(msg)
    );

    // Update LangGraph's checkpointer
    await this.langGraphCheckpointer.put({
      configurable: { thread_id: threadId }
    }, {
      messages: langGraphMessages,
      contextMetadata: Object.fromEntries(context.metadata || new Map())
    });
  }

  async syncLangGraphToContext(threadId: string, contextId: string) {
    const langGraphState = await this.langGraphCheckpointer.get({
      configurable: { thread_id: threadId }
    });

    if (!langGraphState) return;

    // Update our context manager with LangGraph state
    langGraphState.messages.forEach(msg => {
      this.contextManager.addMessageToContext(contextId, 
        this.convertToContextMessage(msg)
      );
    });
  }
}
```

### 3. Enhanced Agent Factory

```typescript
// app/src/agent/impl/WorkflowCapableAgent.ts
export class WorkflowCapableAgent extends QiCodeAgent {
  constructor(
    stateManager: IStateManager,
    contextManager: IContextManager,
    private workflowEngine: LangGraphWorkflowEngine,
    config: AgentConfig,
    dependencies: any
  ) {
    super(stateManager, contextManager, config, dependencies);
  }

  protected async handleWorkflow(
    request: AgentRequest, 
    classification: ClassificationResult
  ): Promise<AgentResponse> {
    if (!this.config.enableWorkflows) {
      return this.createDisabledResponse('workflow', 'Workflow processing is disabled');
    }

    try {
      // Extract workflow specification from the request
      const workflowSpec = await this.workflowExtractor.extractWorkflow(
        request.input,
        request.context
      );

      // Get or create context for this workflow
      const sessionId = request.context.sessionId;
      let contextId = this.sessionContextMap.get(sessionId);
      
      if (!contextId) {
        const newContext = this.contextManager.createConversationContext('workflow');
        contextId = newContext.id;
        this.sessionContextMap.set(sessionId, contextId);
      }

      // Execute workflow using LangGraph
      const workflowResult = await this.workflowEngine.executeWorkflow(
        workflowSpec,
        contextId
      );

      return {
        content: workflowResult.summary,
        type: 'workflow',
        confidence: classification.confidence,
        executionTime: 0,
        metadata: new Map([
          ['workflowId', workflowResult.id],
          ['stepsCompleted', workflowResult.steps.length.toString()],
          ['workflowDuration', workflowResult.duration.toString()],
          ['usedLangGraph', 'true']
        ]),
        success: workflowResult.success,
        error: workflowResult.error
      };

    } catch (error) {
      return this.createErrorResponse('workflow', 
        `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
```

## Integration Benefits

### 1. **Best of Both Worlds**
- **Our System**: Context management, security, LangChain templates, three-type classification
- **LangGraph**: Workflow orchestration, memory persistence, human-in-the-loop, streaming

### 2. **Minimal Disruption**
- Commands and Prompts continue working as-is
- Workflows get powerful LangGraph capabilities
- Existing context management remains intact

### 3. **Enhanced Capabilities**
- **Workflow Persistence**: Resume workflows across sessions
- **Human Intervention**: Approval steps in complex workflows
- **Streaming Workflows**: Real-time workflow progress
- **Durable Execution**: Fault-tolerant workflow execution

### 4. **Memory Synchronization**
- Our Context Manager handles conversation continuity
- LangGraph handles workflow state persistence
- Bridge ensures consistency between both systems

## Implementation Phases

### Phase 1: Foundation
1. Install LangGraph dependencies
2. Create LangGraphWorkflowEngine implementation
3. Build memory bridge between systems
4. Update WorkflowCapableAgent

### Phase 2: Integration
1. Enhanced workflow classification and extraction
2. Streaming workflow execution
3. Human-in-the-loop workflow steps
4. Comprehensive testing

### Phase 3: Advanced Features
1. Workflow templates and reusable patterns
2. Background workflow execution
3. Workflow monitoring and analytics
4. Multi-user workflow collaboration

## Testing Strategy

```typescript
// app/src/demos/workflow/langgraph-workflow-test.ts
async function testLangGraphWorkflowIntegration() {
  const agent = createWorkflowCapableAgent(/*...*/);
  
  // Test 1: Simple workflow
  const response1 = await agent.process({
    input: "Create a new TypeScript project with tests and documentation",
    context: { sessionId: 'workflow-test-1', /*...*/ }
  });
  
  // Test 2: Human-in-the-loop workflow
  const response2 = await agent.process({
    input: "Refactor this codebase but ask for approval before making changes",
    context: { sessionId: 'workflow-test-2', /*...*/ }
  });
  
  // Test 3: Context continuation across workflow steps
  const response3 = await agent.process({
    input: "Continue with the next step",
    context: { sessionId: 'workflow-test-1', /*...*/ }
  });
}
```

This integration strategy leverages LangGraph's powerful workflow capabilities while preserving our existing context management and agent coordination systems, providing a robust foundation for complex multi-step AI workflows.