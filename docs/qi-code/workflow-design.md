# qi-code Workflow Design

**Document Version**: 1.0  
**Date**: 2025-01-24  
**Status**: Implementation Complete  
**Target**: v-0.10.x Advanced Workflow Orchestration

## Overview

qi-code implements advanced workflow orchestration through the QiCodeAgent orchestrator, which provides intelligent pattern selection, multi-agent coordination, and comprehensive workflow execution. This document details the workflow design patterns and orchestration capabilities implemented in qi-code.

## Workflow Architecture

### **QiCodeAgent Orchestration Flow**

```
Input → Classification → Routing → Execution → Learning
  ↓         ↓           ↓         ↓        ↓
User   →  Command   →  Command  →  Tool   →  Performance
Input     Prompt       Handler     Exec     Metrics
          Workflow      Prompt      Sub-    
                       Handler     Agent    
                       Workflow    MCP      
                       Engine      Service  
```

### **Three-Tier Workflow Processing**

#### **Tier 1: Input Classification**
The QiCodeAgent uses intelligent classification to route inputs:

```typescript
// lib/src/agent/impl/QiCodeAgent.ts:172-199
private async processClassificationInternal(
  request: AgentRequest & { startTime: number }
): Promise<Result<AgentResponse>> {
  const classification = await this.classifier!.classify(request.input);
  
  switch (classification.type) {
    case 'command':
      return await this.handleCommandInternal(request, classification);
    case 'prompt':
      return await this.handlePromptInternal(request, classification);
    case 'workflow':
      return await this.handleWorkflowInternal(request, classification);
  }
}
```

#### **Tier 2: Execution Routing**
Based on classification, requests are routed to specialized handlers:

- **Command Handler**: Direct command execution with tool integration
- **Prompt Handler**: LLM-based processing with context awareness
- **Workflow Engine**: Complex multi-step workflow orchestration

#### **Tier 3: Sub-Agent Coordination**
Tool-specialized sub-agents handle specific capabilities:

- **FileOpsSubAgent**: File system operations
- **SearchSubAgent**: Content and pattern search
- **GitSubAgent**: Version control operations
- **WebSubAgent**: Web operations and research

## Implemented Workflow Patterns

### **1. ReAct Pattern (Reasoning + Acting)**

The QiCodeAgent implements ReAct through its workflow engine:

```typescript
// Workflow execution with reasoning
const workflowEngine = createWorkflowEngine({
  stateManager: this.stateManager,
  contextManager: this.contextManager,
  mcpServices: this.mcpServiceManager,
  subAgentRegistry: this.subAgentRegistry,
});

// ReAct cycle: Think → Act → Observe
async executeReActPattern(task: CodingTask): Promise<CodingResult> {
  let currentState = this.initializeState(task);
  
  while (!currentState.isComplete) {
    // Reasoning step
    const reasoning = await this.reasonAboutNextAction(currentState);
    
    // Action step  
    const action = await this.selectAction(reasoning);
    const result = await this.executeAction(action);
    
    // Observation step
    currentState = await this.updateStateWithObservation(result);
  }
  
  return currentState.result;
}
```

### **2. ReWOO Pattern (Reasoning Without Observation)**

Planning-first approach for complex coding tasks:

```typescript
// Pre-planning workflow execution
async executeReWOOPattern(task: ComplexCodingTask): Promise<CodingResult> {
  // Step 1: Complete planning phase
  const plan = await this.workflowExtractor.extractWorkflow(task.description);
  
  // Step 2: Parallel execution of planned steps
  const plannedActions = plan.steps.map(step => ({
    subAgent: this.selectSubAgentForStep(step),
    action: this.convertStepToAction(step)
  }));
  
  // Step 3: Execute all actions
  const results = await Promise.all(
    plannedActions.map(({ subAgent, action }) => 
      subAgent.executeTask(action)
    )
  );
  
  // Step 4: Synthesize results
  return this.synthesizeResults(results);
}
```

### **3. ADaPT Pattern (Adaptive Planning)**

Dynamic adaptation based on execution context:

```typescript
// Adaptive workflow with learning
async executeADaPTPattern(task: CodingTask): Promise<CodingResult> {
  let currentPlan = await this.generateInitialPlan(task);
  let executionContext = this.initializeContext(task);
  
  for (const step of currentPlan.steps) {
    // Execute current step
    const stepResult = await this.executeStep(step, executionContext);
    
    // Adaptive planning based on results
    if (stepResult.requiresAdaptation) {
      currentPlan = await this.adaptPlan(currentPlan, stepResult, executionContext);
      executionContext = await this.updateContext(executionContext, stepResult);
    }
    
    // Learn from execution
    await this.learningSystem.observeStepExecution(step, stepResult);
  }
  
  return executionContext.finalResult;
}
```

## Sub-Agent Workflow Integration

### **Sub-Agent Task Distribution**

The QiCodeAgent coordinates sub-agents for specialized tasks:

```typescript
// qi-code.ts: Sub-agent registration and coordination
async initializeSubAgents(): Promise<void> {
  this.subAgentRegistry = new SubAgentRegistry();
  
  // Register specialized sub-agents
  await this.subAgentRegistry.register('fileops', FileOpsSubAgent);
  await this.subAgentRegistry.register('search', SearchSubAgent);
  await this.subAgentRegistry.register('git', GitSubAgent);
  await this.subAgentRegistry.register('web', WebSubAgent);
}

// Intelligent task routing
async routeTaskToSubAgent(task: SubAgentTask): Promise<SubAgentResult> {
  // Analyze task capabilities required
  const requiredCapabilities = this.analyzeTaskCapabilities(task);
  
  // Select optimal sub-agent
  const subAgent = await this.subAgentRegistry.getAgentByCapability(
    requiredCapabilities
  );
  
  // Execute with monitoring
  return await subAgent.executeTask(task);
}
```

### **Sub-Agent Workflow Patterns**

Each sub-agent implements specialized workflow patterns:

#### **FileOpsSubAgent Workflows**
```typescript
// File operation workflows
async executeFileWorkflow(task: FileOpsTask): Promise<FileOpsResult> {
  switch (task.type) {
    case 'file_analysis':
      return await this.executeAnalysisWorkflow(task);
    case 'batch_operations':
      return await this.executeBatchWorkflow(task);
    case 'search_and_modify':
      return await this.executeSearchModifyWorkflow(task);
  }
}
```

#### **SearchSubAgent Workflows**
```typescript
// Multi-pattern search workflows
async executeSearchWorkflow(task: SearchTask): Promise<SearchResult> {
  if (task.type === 'multi_pattern_search') {
    // Parallel search execution
    const searchPromises = task.patterns.map(pattern =>
      this.executePatternSearch(pattern, task.scope)
    );
    
    const results = await Promise.all(searchPromises);
    return this.aggregateSearchResults(results);
  }
  
  return await this.executeSingleSearch(task);
}
```

## MCP Service Integration Workflows

### **MCP-Enhanced Workflow Execution**

MCP services provide additional capabilities to workflows:

```typescript
// qi-code.ts: MCP service integration
async initializeMCPServices(): Promise<void> {
  this.mcpServiceManager = new MCPServiceManager();
  
  const services = [
    'chroma',     // Vector database for context
    'web-search', // Web search capabilities
    'database',   // Database operations
    'memory',     // Persistent memory
    'sqlite',     // SQLite operations
  ];
  
  // Dynamic service discovery
  for (const service of services) {
    try {
      await this.mcpServiceManager.initializeService(service);
    } catch (error) {
      this.logger.warn(`⚠️ MCP service unavailable: ${service}`);
    }
  }
}
```

### **Context-Aware Workflow Execution**

Integration with RAG and context management:

```typescript
// Context-enhanced workflow processing
async executeWithContext(request: AgentRequest): Promise<AgentResponse> {
  // 1. Load relevant context
  const context = await this.contextManager.getRelevantContext(request);
  
  // 2. Enhance with RAG if available
  if (this.ragIntegration) {
    const ragContext = await this.ragIntegration.retrieveRelevantContext(request);
    context.merge(ragContext);
  }
  
  // 3. Execute with enriched context
  const enrichedRequest = { ...request, context };
  return await this.orchestrator.process(enrichedRequest);
}
```

## Learning and Adaptation

### **Workflow Performance Learning**

The QiCodeAgent learns from workflow execution:

```typescript
// Performance monitoring and learning
async learnFromExecution(
  task: CodingTask, 
  result: CodingResult, 
  executionMetrics: ExecutionMetrics
): Promise<void> {
  // 1. Record performance metrics
  await this.learningSystem.recordExecution({
    task,
    result,
    executionTime: executionMetrics.duration,
    success: result.success,
    workflowPattern: executionMetrics.pattern
  });
  
  // 2. Update pattern selection weights
  if (result.success) {
    await this.patternSelector.reinforcePattern(
      executionMetrics.pattern,
      task.complexity
    );
  }
  
  // 3. Update sub-agent performance models
  for (const subAgentMetric of executionMetrics.subAgentMetrics) {
    await this.subAgentRegistry.updatePerformanceModel(
      subAgentMetric.agentId,
      subAgentMetric.performance
    );
  }
}
```

### **Adaptive Workflow Selection**

Intelligent pattern selection based on learned performance:

```typescript
// ML-based workflow pattern selection
async selectOptimalWorkflowPattern(task: CodingTask): Promise<WorkflowPattern> {
  // Analyze task characteristics
  const taskFeatures = this.extractTaskFeatures(task);
  
  // Get historical performance for similar tasks
  const historicalPerformance = await this.learningSystem
    .getPatternPerformance(taskFeatures);
  
  // Select pattern with highest expected performance
  const optimalPattern = this.patternSelector
    .selectPattern(taskFeatures, historicalPerformance);
  
  return optimalPattern;
}
```

## Error Handling and Recovery

### **QiCore Error Patterns**

All workflow operations use QiCore Result<T, QiError> patterns:

```typescript
// Functional error handling in workflows
async executeWorkflowStep(step: WorkflowStep): Promise<Result<StepResult, QiError>> {
  return await fromAsyncTryCatch(async () => {
    const subAgent = await this.subAgentRegistry.getAgent(step.agentType);
    const result = await subAgent.executeTask(step.task);
    
    return success(result);
  });
}

// Error recovery with match pattern
const stepResult = await this.executeWorkflowStep(step);
return match(
  (success) => this.continueWorkflow(success),
  (error) => this.handleWorkflowError(error, step),
  stepResult
);
```

### **Workflow Recovery Strategies**

Intelligent error recovery and retry logic:

```typescript
// Multi-level error recovery
async handleWorkflowError(
  error: QiError, 
  failedStep: WorkflowStep
): Promise<WorkflowRecovery> {
  // Level 1: Retry with same sub-agent
  if (error.category === 'TRANSIENT') {
    return { strategy: 'retry', agent: failedStep.agentType };
  }
  
  // Level 2: Try alternative sub-agent
  if (error.category === 'CAPABILITY') {
    const alternativeAgent = await this.findAlternativeAgent(failedStep);
    return { strategy: 'reroute', agent: alternativeAgent };
  }
  
  // Level 3: Workflow adaptation
  if (error.category === 'WORKFLOW') {
    const adaptedWorkflow = await this.adaptWorkflow(failedStep);
    return { strategy: 'adapt', newWorkflow: adaptedWorkflow };
  }
  
  // Level 4: Human intervention
  return { strategy: 'escalate', error };
}
```

## Performance Optimization

### **Parallel Workflow Execution**

Multi-agent parallel processing:

```typescript
// Parallel sub-agent execution
async executeParallelWorkflow(workflow: ParallelWorkflow): Promise<WorkflowResult> {
  // Identify independent workflow steps
  const independentSteps = this.identifyParallelSteps(workflow);
  
  // Execute steps in parallel
  const parallelPromises = independentSteps.map(async (stepGroup) => {
    const subAgentTasks = stepGroup.map(step => ({
      agent: await this.subAgentRegistry.getAgent(step.agentType),
      task: step.task
    }));
    
    // Execute sub-agent tasks in parallel
    return await Promise.all(
      subAgentTasks.map(({ agent, task }) => agent.executeTask(task))
    );
  });
  
  const parallelResults = await Promise.all(parallelPromises);
  return this.synthesizeParallelResults(parallelResults);
}
```

### **Caching and Optimization**

Intelligent caching for performance:

```typescript
// Context-aware result caching
async executeWithCaching(task: CodingTask): Promise<CodingResult> {
  // Check cache for similar tasks
  const cacheKey = this.generateCacheKey(task);
  const cachedResult = await this.cacheManager.get(cacheKey);
  
  if (cachedResult && this.isCacheValid(cachedResult, task)) {
    return cachedResult;
  }
  
  // Execute workflow
  const result = await this.executeWorkflow(task);
  
  // Cache successful results
  if (result.success) {
    await this.cacheManager.set(cacheKey, result, {
      ttl: this.calculateCacheTTL(task),
      tags: this.generateCacheTags(task)
    });
  }
  
  return result;
}
```

## Integration with qi-prompt

### **Shared Infrastructure**

qi-code leverages the same infrastructure as qi-prompt:

- **StateManager**: Shared state management
- **ContextManager**: Common context handling  
- **ProviderManager**: LLM provider management
- **MCPServiceManager**: External service integration

### **Differentiated Capabilities**

| Feature | qi-prompt | qi-code |
|---------|-----------|---------|
| **Orchestrator** | PromptAppOrchestrator | QiCodeAgent (full) |
| **Workflow Patterns** | Basic workflow handler | ReAct, ReWOO, ADaPT |
| **Sub-Agents** | None | FileOps, Search, Git, Web |
| **Task Complexity** | Simple to moderate | Complex multi-step |
| **Learning** | Basic | Advanced pattern learning |

## Summary

qi-code implements a sophisticated workflow orchestration system through:

1. **QiCodeAgent Orchestrator**: Complete 1161-line implementation with classification, routing, and execution
2. **Tool-Specialized Sub-Agents**: Four specialized agents with comprehensive capabilities
3. **Advanced Workflow Patterns**: ReAct, ReWOO, and ADaPT implementations
4. **MCP Service Integration**: Dynamic service discovery and integration
5. **Learning and Adaptation**: Performance-based pattern optimization
6. **Error Recovery**: Multi-level error handling and recovery strategies

The implementation successfully achieves the v-0.10.x milestone for advanced workflow orchestration and multi-agent coordination in a full coding agent context.

---

**Next**: [API Reference](./api-reference.md) - qi-code interfaces and contracts