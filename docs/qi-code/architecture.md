# qi-code Architecture Design

**Document Version**: 2.0  
**Date**: 2025-01-24  
**Status**: Implementation Complete  
**Target**: v-0.10.x Milestone Achieved

## Overview

qi-code is a sophisticated full coding agent that leverages the QiCodeAgent orchestrator for advanced workflow orchestration, tool-specialized sub-agents, and comprehensive MCP integration. This document defines the implemented architectural patterns and system design for the complete qi-code application.

## System Architecture

### **Implemented Layered Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                     QiCodeApp CLI Layer                     │
│                  (app/src/qi-code.ts)                       │
├─────────────────────────────────────────────────────────────┤
│              QiCodeAgent Orchestrator Layer                 │
│        (lib/src/agent/impl/QiCodeAgent.ts - 1161 lines)     │
├─────────────────────────────────────────────────────────────┤
│    Tool-Specialized Sub-Agents  │  Workflow Orchestration  │
│  FileOps │ Search │ Git │ Web    │  ReAct │ ReWOO │ ADaPT   │
├─────────────────────────────────────────────────────────────┤
│  Enhanced Core Infrastructure (Completed v-0.8.x + v-0.9.x) │
│  State Manager │ Context Manager │ Provider Manager │ MCP    │
├─────────────────────────────────────────────────────────────┤
│  External MCP Services (Chroma, Web, DB, Memory, SQLite)   │
└─────────────────────────────────────────────────────────────┘
```

### **Implemented Core Components**

#### **1. QiCodeApp CLI Layer (`app/src/qi-code.ts`)**
- **QiCodeApp**: Main application orchestrating all components
- **CLI Interface**: Command-line argument parsing with professional options
- **Initialization Pipeline**: Sequential component initialization with error handling
- **MCP Service Integration**: Dynamic service discovery and initialization

#### **2. QiCodeAgent Orchestrator (`lib/src/agent/impl/QiCodeAgent.ts`)**
- **QiCodeAgent**: Complete 1161-line orchestrator with full capabilities
- **Classification Pipeline**: Input classification for commands, prompts, and workflows
- **Execution Engine**: Multi-threaded execution with Result<T, QiError> patterns
- **Context Management**: Session-aware context continuation and state persistence

#### **3. Tool-Specialized Sub-Agents (`lib/src/agent/sub-agents/tool-specialized/`)**
- **FileOpsSubAgent**: File operations (read, write, edit, search, analysis)
- **SearchSubAgent**: Content and pattern search (multi-pattern, code search)
- **GitSubAgent**: Version control operations (status, commit, branch, diff)
- **WebSubAgent**: Web operations (fetch, search, content extraction, research)

#### **4. Sub-Agent Coordination System**
- **SubAgentRegistry**: Dynamic registration and lifecycle management
- **SubAgentFactory**: Type-safe instantiation with capability validation
- **BaseSubAgent**: Common patterns with QiCore Result<T, QiError> integration
- **Task Distribution**: Intelligent task routing based on sub-agent capabilities

#### **5. Advanced Workflow System (Completed v-0.9.x)**
- **IntelligentPatternSelector**: ML-based workflow pattern selection
- **WorkflowEngine**: Production-ready execution with monitoring
- **HybridPatternOrchestrator**: Multi-pattern coordination
- **WorkflowLearningSystem**: Performance optimization and adaptation

## Implementation Patterns

### **1. Factory Pattern with `@qi/agent` Aliasing**

```typescript
// qi-code uses the createAgent factory function
import { createAgent } from '@qi/agent';
import { FileOpsSubAgent, SearchSubAgent, GitSubAgent, WebSubAgent } from '@qi/agent/sub-agents';

// All imports use @qi/agent aliasing - no relative imports allowed
const orchestrator = createAgent(stateManager, contextManager, {
  domain: 'coding-agent',
  enableCommands: true,
  enablePrompts: true,
  enableWorkflows: true,
  sessionPersistence: true,
  classifier,
  commandHandler,
  promptHandler,
  workflowEngine,
  workflowExtractor,
});
```

### **2. QiCore Result<T, QiError> Functional Patterns**

```typescript
// All operations use QiCore functional programming patterns
async processInternal(request: AgentRequest): Promise<Result<AgentResponse>> {
  return await fromAsyncTryCatch(async () => {
    // Implementation with automatic error wrapping
    const result = await this.orchestrator.process(request);
    return success(result);
  });
}

// Error handling with match pattern
return match(
  (success) => handleSuccess(success),
  (error) => handleError(error),
  result
);
```

### **3. Sub-Agent Registry Pattern**

```typescript
// Dynamic sub-agent registration
const subAgentRegistry = new SubAgentRegistry();
await subAgentRegistry.register('fileops', FileOpsSubAgent);
await subAgentRegistry.register('search', SearchSubAgent);
await subAgentRegistry.register('git', GitSubAgent);
await subAgentRegistry.register('web', WebSubAgent);

// Type-safe task routing
const subAgent = await subAgentRegistry.getAgent('fileops');
const result = await subAgent.executeTask(task);
```

### **2. Strategy Pattern for Workflow Selection**

```typescript
interface WorkflowStrategy {
  canHandle(task: CodingTask): boolean;
  execute(task: CodingTask, context: ExecutionContext): Promise<WorkflowResult>;
}

class IntelligentWorkflowSelector {
  selectStrategy(task: CodingTask): WorkflowStrategy {
    // Intelligent selection logic using MCP knowledge
  }
}
```

### **3. Observer Pattern for Learning**

```typescript
interface LearningObserver {
  onTaskCompleted(task: CodingTask, result: CodingResult): void;
  onPatternUsed(pattern: WorkflowPattern, effectiveness: number): void;
  onDecisionMade(decision: AgentDecision, outcome: DecisionOutcome): void;
}
```

## Implementation Architecture

### **Application Layer (qi-code vs qi-prompt)**

| Aspect | qi-prompt | qi-code |
|--------|-----------|---------|
| **Entry Point** | `app/src/prompt/qi-prompt.ts` | `app/src/qi-code.ts` |
| **Orchestrator** | `PromptAppOrchestrator` | `QiCodeAgent` (full orchestrator) |
| **Capabilities** | Commands + Prompts + Simple Workflows | Full orchestration with advanced workflows |
| **Sub-Agents** | None | FileOps, Search, Git, Web sub-agents |
| **Workflow Patterns** | Basic workflow handler | ReAct, ReWOO, ADaPT with intelligent selection |
| **Target Use Case** | Prompt engineering, simple tasks | Complex coding, multi-step projects |

### **Orchestrator Integration (Completed)**

qi-code leverages the complete QiCodeAgent orchestrator:

```typescript
// lib/src/agent/impl/QiCodeAgent.ts - 1161 lines of complete implementation
export class QiCodeAgent implements IAgent {
  async process(request: AgentRequest): Promise<AgentResponse> {
    // 1. Classification: Determine if input is command, prompt, or workflow
    // 2. Routing: Route to appropriate handler
    // 3. Execution: Execute with full context awareness
    // 4. Learning: Update knowledge and performance metrics
  }
}
```

### **Sub-Agent Integration (v-0.10.0 Complete)**

Tool-specialized sub-agents provide enhanced capabilities:

- **FileOpsSubAgent**: Complete file system operations with Result<T> patterns
- **SearchSubAgent**: Advanced content and pattern search capabilities
- **GitSubAgent**: Full version control operations with error handling
- **WebSubAgent**: Web fetching, search, and content extraction

### **MCP Service Integration**

Dynamic MCP service discovery and integration:

```typescript
// Automatic service discovery
const services = ['chroma', 'web-search', 'database', 'memory', 'sqlite'];
for (const service of services) {
  try {
    await this.mcpServiceManager.initializeService(service);
    this.logger.info(`✅ MCP service initialized: ${service}`);
  } catch (error) {
    this.logger.warn(`⚠️ MCP service unavailable: ${service}`, error);
  }
}
```

## Component Interactions

### **Task Processing Flow**

```
1. ComplexCodingTask → QiCodeAgent
2. QiCodeAgent → TaskPlanner (decomposition)
3. TaskPlanner → WorkflowSelector (pattern selection)
4. WorkflowSelector → WorkflowExecutor (execution)
5. WorkflowExecutor → MultiAgentCoordinator (if needed)
6. Results → LearningManager (improvement)
7. LearningManager → KnowledgeUpdate (evolution)
```

### **Decision Making Flow**

```
1. DecisionContext → AdvancedDecisionEngine
2. AdvancedDecisionEngine → CausalReasoner (analysis)
3. CausalReasoner → GoalManager (goal alignment)
4. GoalManager → DecisionOptimizer (optimization)
5. Decision → ExecutionEngine (implementation)
6. Outcome → LearningObserver (learning)
```

## Data Architecture

### **Knowledge Representation**

- **Task Knowledge**: Complex coding task patterns and solutions
- **Pattern Knowledge**: Workflow pattern effectiveness and optimization
- **Agent Knowledge**: Multi-agent coordination strategies and outcomes
- **Learning Knowledge**: Continuous improvement insights and adaptations

### **State Management**

- **Task State**: Current coding task context and progress
- **Agent State**: Multi-agent coordination state and communication
- **Learning State**: Knowledge evolution and capability development
- **Execution State**: Workflow execution status and monitoring

## Security Architecture

### **Multi-Layer Security**

1. **Input Validation**: Complex task validation and sanitization
2. **Agent Isolation**: Secure multi-agent execution boundaries
3. **Resource Control**: Tool execution limits and monitoring
4. **Audit Logging**: Comprehensive security event tracking
5. **MCP Security**: Secure external service integration

### **Trust Management**

- **Agent Trust Levels**: Dynamic trust scoring for multi-agent coordination
- **Tool Trust Verification**: MCP service validation and monitoring
- **Decision Auditing**: Transparent decision making and accountability
- **Learning Validation**: Knowledge update verification and rollback

## Performance Architecture

### **Scalability Design**

- **Horizontal Scaling**: Multi-agent distribution across resources
- **Vertical Scaling**: Enhanced capability utilization within agents
- **Caching Strategy**: Intelligent caching of patterns and decisions
- **Resource Optimization**: Dynamic resource allocation and management

### **Performance Monitoring**

- **Task Performance**: Coding task completion metrics and optimization
- **Agent Performance**: Multi-agent coordination efficiency and bottlenecks
- **Learning Performance**: Knowledge evolution effectiveness and convergence
- **System Performance**: Overall qi-code agent responsiveness and reliability

## Deployment Architecture

### **Development Deployment**

- **Local Development**: Full qi-code agent with local MCP services
- **Testing Environment**: Comprehensive testing with mocked external services
- **Integration Testing**: End-to-end validation with real MCP services

### **Production Deployment**

- **Containerized Deployment**: Docker containers with resource management
- **Service Orchestration**: Kubernetes orchestration for scalability
- **Monitoring Integration**: Comprehensive observability and alerting
- **Backup and Recovery**: State persistence and disaster recovery

---

**Next**: [Workflow Design](./workflow-design.md) - Advanced workflow orchestration patterns for qi-code