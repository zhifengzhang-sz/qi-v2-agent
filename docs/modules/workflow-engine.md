# Workflow Engine Module

Multi-agent workflow orchestration with intelligent planning, coordination patterns, and AutoGen framework integration.

## Overview

The Workflow Engine module provides clean abstractions over Microsoft's AutoGen framework, enabling sophisticated multi-agent collaboration patterns. It features intelligent workflow planning, agent coordination, and streaming execution with progress monitoring.

## Key Features

- **AutoGen Integration**: Clean abstraction over Microsoft AutoGen framework
- **Planning Strategies**: ReAct, ReWOO, and ADaPT reasoning patterns
- **Agent Coordination**: Multi-agent task distribution and collaboration  
- **Workflow Management**: State tracking, progress monitoring, error recovery

## Interface

```typescript
import { IWorkflowEngine } from '@qi/agent/workflow-engine';

const workflowEngine: IWorkflowEngine = createWorkflowEngine({
  defaultStrategy: 'react',
  maxAgentsPerWorkflow: 5,
  autoGenConfig: {
    endpoint: 'https://api.autogen.example.com',
    apiKey: process.env.AUTOGEN_API_KEY,
    model: 'gpt-4'
  }
});
```

## Core Methods

### executeWorkflow()
Execute complex multi-agent workflow with streaming progress updates.

```typescript
const task = {
  id: 'analysis-task',
  description: 'Analyze codebase and suggest improvements',
  context: projectContext,
  priority: 'high'
};

for await (const progress of workflowEngine.executeWorkflow(task)) {
  console.log(`Progress: ${progress.progress * 100}%`);
  console.log(`Current step: ${progress.message}`);
  console.log(`Active agents: ${progress.activeAgents.join(', ')}`);
}
```

### planWorkflow()
Generate intelligent workflow execution plan.

```typescript
const plan = await workflowEngine.planWorkflow(task);
if (plan.isOk()) {
  console.log(`Strategy: ${plan.value.strategy}`);
  console.log(`Steps: ${plan.value.steps.length}`);
  console.log(`Estimated time: ${plan.value.totalEstimatedTime}ms`);
}
```

### coordinateAgents()
Coordinate multiple agents for optimal task execution.

```typescript
const agents = [
  { id: 'code-reviewer', capabilities: ['review', 'analysis'] },
  { id: 'docs-writer', capabilities: ['documentation', 'writing'] },
  { id: 'tester', capabilities: ['testing', 'validation'] }
];

const coordination = await workflowEngine.coordinateAgents(agents, task);
```

### registerAgent()
Register available agents for workflow execution.

```typescript
const agent = {
  id: 'security-auditor',
  name: 'Security Auditor',
  capabilities: ['security', 'vulnerability-analysis'],
  specialization: 'cybersecurity',
  maxConcurrentTasks: 3,
  isAvailable: true
};

workflowEngine.registerAgent(agent);
```

## Planning Strategies

### ReAct (Reasoning and Acting)
Sequential reasoning and action execution pattern.

```typescript
const workflowEngine = createWorkflowEngine({
  defaultStrategy: 'react',
  coordination: {
    algorithm: 'capability-based',
    maxRetries: 3
  }
});
```

### ReWOO (Reasoning WithOut Observation)  
Plan-first execution without intermediate observations.

### ADaPT (Adaptive Planning and Thinking)
Dynamic planning that adapts based on intermediate results.

## Configuration

```typescript
interface WorkflowEngineConfig {
  readonly maxConcurrentWorkflows?: number;
  readonly defaultStrategy?: 'react' | 'rewoo' | 'adapt';
  readonly maxAgentsPerWorkflow?: number;
  readonly defaultTimeout?: number;
  readonly autoGenConfig?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
  };
  readonly coordination?: {
    algorithm: 'round-robin' | 'capability-based' | 'load-balanced';
    maxRetries: number;
  };
}
```

## Agent Coordination Algorithms

- **round-robin**: Sequential agent assignment
- **capability-based**: Match agents to task requirements
- **load-balanced**: Distribute tasks based on current load

## Streaming Execution

Monitor workflow progress in real-time:

```typescript
for await (const progress of workflowEngine.executeWorkflow(task)) {
  // Real-time progress updates
  updateUI({
    progress: progress.progress,
    currentStep: progress.currentStep,
    completedSteps: progress.completedSteps,
    activeAgents: progress.activeAgents
  });
}
```

## Integration with QiCore

```typescript
import { Result } from '@qi/base';

// All methods return Result<T, QiError>
const planResult: Result<WorkflowPlan, QiError> = 
  await workflowEngine.planWorkflow(task);

planResult.match(
  (plan) => console.log(`Workflow planned with ${plan.steps.length} steps`),
  (error) => console.error('Planning failed:', error.message)
);
```

## Error Handling and Recovery

The Workflow Engine provides robust error handling:

```typescript
// Automatic retry on agent failures
const coordination = await workflowEngine.coordinateAgents(agents, task);
if (coordination.isErr()) {
  console.error('Coordination failed:', coordination.error.message);
}

// Cancel running workflows
await workflowEngine.cancelWorkflow(taskId);
```

## Monitoring and Status

Track workflow execution status:

```typescript
const status = workflowEngine.getWorkflowStatus(taskId);
if (status.isOk() && status.value) {
  console.log(`Current step: ${status.value.currentStep}`);
  console.log(`Progress: ${status.value.progress * 100}%`);
}
```