# qi-prompt v-0.8.0 Workflow API Reference

## Core Interfaces

### IWorkflowEngine

The main interface for workflow execution engines.

```typescript
interface IWorkflowEngine {
  // Create a workflow from a pattern name
  createWorkflow(
    pattern: string, 
    customizations?: WorkflowCustomization[]
  ): ExecutableWorkflow;

  // Execute a workflow with given initial state
  execute(
    workflow: ExecutableWorkflow, 
    initialState: WorkflowState
  ): Promise<WorkflowResult>;

  // Stream workflow execution for real-time updates
  stream(
    workflow: ExecutableWorkflow, 
    initialState: WorkflowState
  ): AsyncIterableIterator<WorkflowStreamChunk>;

  // Precompile workflows for better performance
  precompileWorkflows(patterns: readonly string[]): Promise<void>;
}
```

### IWorkflowExtractor

Interface for extracting workflow specifications from natural language.

```typescript
interface IWorkflowExtractor {
  // Extract workflow from input description
  extractWorkflow(
    input: string, 
    context?: ProcessingContext
  ): Promise<WorkflowExtractionResult>;

  // Get supported extraction modes
  getSupportedModes(): WorkflowMode[];

  // Validate a workflow specification
  validateWorkflowSpec(spec: WorkflowSpec): boolean;

  // Get predefined workflow templates
  getWorkflowTemplates(mode: WorkflowMode): WorkflowSpec[];
}
```

## State Management

### WorkflowState

The core state structure that flows through workflows.

```typescript
interface WorkflowState {
  // Input data
  readonly input: string;
  readonly pattern: string;
  readonly domain: string;
  readonly context: Map<string, unknown>;

  // Execution results
  readonly toolResults: ToolResult[];
  readonly reasoningOutput: string;
  readonly output: string;

  // Metadata
  readonly metadata: WorkflowMetadata;
}

interface WorkflowMetadata {
  readonly startTime: number;
  readonly currentStage: string;
  readonly processingSteps: string[];
  readonly performance: Map<string, number>;
}
```

### LangGraph State Annotations

#### Base Workflow State
```typescript
const WorkflowStateAnnotation = Annotation.Root({
  // Core workflow inputs/outputs
  input: Annotation<string>,
  pattern: Annotation<string>,
  domain: Annotation<string>,
  context: Annotation<Map<string, unknown>>,
  toolResults: Annotation<ToolResult[]>,
  reasoningOutput: Annotation<string>,
  output: Annotation<string>,

  // LangGraph-specific state
  currentNodeId: Annotation<string>,
  executionPath: Annotation<string[]>,
  isComplete: Annotation<boolean>,
  error: Annotation<string | null>,

  // Metadata
  metadata: Annotation<{
    startTime: number;
    currentStage: string;
    processingSteps: string[];
    performance: Map<string, number>;
  }>
});
```

#### ReAct Pattern State
```typescript
const ReActStateAnnotation = Annotation.Root({
  // Core input/output
  input: Annotation<string>,
  output: Annotation<string>,

  // ReAct-specific state
  currentStep: Annotation<number>,
  maxSteps: Annotation<number>,
  thought: Annotation<string>,
  action: Annotation<string>,
  actionInput: Annotation<Record<string, unknown>>,
  observation: Annotation<string>,
  isComplete: Annotation<boolean>,

  // History tracking
  thoughtHistory: Annotation<string[]>,
  actionHistory: Annotation<Array<{
    action: string;
    input: Record<string, unknown>;
    observation: string;
  }>>,

  // Tool results and metadata
  toolResults: Annotation<WorkflowToolResult[]>,
  metadata: Annotation<{
    startTime: number;
    pattern: string;
    sessionId: string;
  }>
});
```

#### ReWOO Pattern State
```typescript
const ReWOOStateAnnotation = Annotation.Root({
  // Core input/output
  input: Annotation<string>,
  output: Annotation<string>,

  // ReWOO-specific state
  plan: Annotation<ReWOOPlanStep[]>,
  planningComplete: Annotation<boolean>,
  evidence: Annotation<ReWOOEvidence[]>,
  workersComplete: Annotation<boolean>,
  activeWorkers: Annotation<string[]>,
  solution: Annotation<string>,
  currentPhase: Annotation<'planning' | 'working' | 'solving' | 'complete'>,
  isComplete: Annotation<boolean>,

  // Tool results and metadata
  toolResults: Annotation<WorkflowToolResult[]>,
  metadata: Annotation<{
    startTime: number;
    pattern: string;
    sessionId: string;
    planSteps: number;
    workersSpawned: number;
  }>
});
```

#### ADaPT Pattern State
```typescript
const ADaPTStateAnnotation = Annotation.Root({
  // Core input/output
  input: Annotation<string>,
  output: Annotation<string>,

  // ADaPT-specific state
  tasks: Annotation<Map<string, ADaPTTask>>,
  currentTaskId: Annotation<string | null>,
  maxDecompositionLevel: Annotation<number>,
  currentPhase: Annotation<'decomposing' | 'executing' | 'combining' | 'complete'>,

  // Execution tracking
  completedTasks: Annotation<string[]>,
  failedTasks: Annotation<string[]>,

  // Tool results and metadata
  toolResults: Annotation<WorkflowToolResult[]>,
  metadata: Annotation<{
    startTime: number;
    pattern: string;
    sessionId: string;
    decompositionCount: number;
    totalExecutions: number;
  }>
});
```

## Workflow Components

### ExecutableWorkflow

```typescript
interface ExecutableWorkflow {
  readonly id: string;
  readonly pattern: string;
  readonly nodes: WorkflowNode[];
  readonly edges: WorkflowEdge[];
}

interface WorkflowNode {
  readonly id: string;
  readonly name: string;
  readonly type: WorkflowNodeType;
  readonly handler: WorkflowNodeHandler;
}

type WorkflowNodeType = 
  | 'input'      // Data ingestion and validation
  | 'processing' // Computational operations
  | 'tool'       // External tool invocation
  | 'reasoning'  // LLM-based analysis
  | 'output'     // Result formatting and delivery
  | 'control';   // Conditional logic and branching

interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: WorkflowCondition;
}
```

### WorkflowResult

```typescript
interface WorkflowResult {
  readonly finalState: WorkflowState;
  readonly executionPath: string[];
  readonly performance: WorkflowPerformance;
}

interface WorkflowPerformance {
  readonly totalTime: number;
  readonly nodeExecutionTimes: Map<string, number>;
  readonly toolExecutionTime: number;
  readonly reasoningTime: number;
}
```

## Research Pattern APIs

### ReAct Pattern

```typescript
class ReActPattern {
  constructor(
    toolExecutor?: WorkflowToolExecutor, 
    config: Partial<ReActConfig> = {}
  );

  // Execute the ReAct pattern
  async execute(
    input: string,
    sessionId?: string,
    maxSteps?: number
  ): Promise<{
    output: string;
    thoughtHistory: string[];
    actionHistory: Array<{
      action: string;
      input: Record<string, unknown>;
      observation: string;
    }>;
    toolResults: WorkflowToolResult[];
    totalSteps: number;
  }>;

  // Stream execution with real-time updates
  async *stream(
    input: string,
    sessionId?: string,
    maxSteps?: number
  ): AsyncIterable<{
    step: number;
    thought: string;
    action: string;
    observation: string;
    isComplete: boolean;
  }>;
}

interface ReActConfig {
  maxSteps: number;
  thinkingPrompt: string;
  actionPrompt: string;
  observationPrompt: string;
  completionCriteria: (state: ReActState) => boolean;
}
```

### ReWOO Pattern

```typescript
class ReWOOPattern {
  constructor(
    toolExecutor?: WorkflowToolExecutor, 
    config: Partial<ReWOOConfig> = {}
  );

  // Execute the ReWOO pattern
  async execute(
    input: string,
    sessionId?: string
  ): Promise<{
    output: string;
    plan: ReWOOPlanStep[];
    evidence: ReWOOEvidence[];
    solution: string;
    toolResults: WorkflowToolResult[];
    performance: {
      planningTime: number;
      workingTime: number;
      solvingTime: number;
      totalTime: number;
    };
  }>;

  // Stream execution with phase updates
  async *stream(
    input: string,
    sessionId?: string
  ): AsyncIterable<{
    phase: 'planning' | 'working' | 'solving' | 'complete';
    plan: ReWOOPlanStep[];
    evidence: ReWOOEvidence[];
    activeWorkers: string[];
    progress: number;
  }>;
}

interface ReWOOConfig {
  maxPlanSteps: number;
  maxWorkers: number;
  evidenceThreshold: number;
  timeoutMs: number;
  parallelExecution: boolean;
}

interface ReWOOPlanStep {
  id: string;
  description: string;
  toolName?: string;
  dependencies: string[];
  priority: number;
}

interface ReWOOEvidence {
  stepId: string;
  content: string;
  confidence: number;
  source: string;
  timestamp: number;
}
```

### ADaPT Pattern

```typescript
class ADaPTPattern {
  constructor(
    toolExecutor?: WorkflowToolExecutor, 
    config: Partial<ADaPTConfig> = {}
  );

  // Execute the ADaPT pattern
  async execute(
    input: string,
    sessionId?: string
  ): Promise<{
    output: string;
    tasks: ADaPTTask[];
    completedTasks: string[];
    failedTasks: string[];
    toolResults: WorkflowToolResult[];
    performance: {
      decompositionCount: number;
      totalExecutions: number;
      totalTime: number;
    };
  }>;

  // Stream execution with task progress
  async *stream(
    input: string,
    sessionId?: string
  ): AsyncIterable<{
    phase: 'decomposing' | 'executing' | 'combining' | 'complete';
    currentTask?: ADaPTTask;
    tasks: ADaPTTask[];
    completedCount: number;
    progress: number;
  }>;
}

interface ADaPTConfig {
  maxDecompositionLevel: number;
  complexityThreshold: 'simple' | 'medium' | 'complex';
  enableAdaptiveDecomposition: boolean;
  maxRetries: number;
  timeoutMs: number;
}

interface ADaPTTask {
  id: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'decomposed';
  parent?: string;
  children: string[];
  logicalOperator?: 'And' | 'Or';
  result?: unknown;
  error?: string;
  executionTime?: number;
  decompositionLevel: number;
}
```

## Tool Integration

### WorkflowToolExecutor

```typescript
class WorkflowToolExecutor {
  constructor(config?: WorkflowToolExecutorConfig);

  // Single tool execution
  async executeTool(
    request: WorkflowToolExecutionRequest
  ): Promise<Result<WorkflowToolResult, QiError>>;

  // Sequential tool execution
  async executeToolSequence(
    requests: WorkflowToolExecutionRequest[]
  ): Promise<Result<WorkflowToolResult[], QiError>>;

  // Concurrent tool execution
  async executeToolsBatch(
    requests: WorkflowToolExecutionRequest[]
  ): Promise<Result<WorkflowToolResult[], QiError>>;

  // Check tool availability
  isToolAvailable(toolName: string): boolean;
  
  // Get all available tools
  getAvailableTools(): string[];
}

interface WorkflowToolExecutorConfig {
  timeoutMs?: number;
  maxConcurrentTools?: number;
  enableRetry?: boolean;
  retryAttempts?: number;
}

interface WorkflowToolExecutionRequest {
  toolName: string;
  input: Record<string, unknown>;
  nodeId: string;
  workflowId: string;
  sessionId: string;
}

interface WorkflowToolResult {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  error?: string;
  executionTime: number;
  metadata: {
    nodeId: string;
    workflowId: string;
    sessionId: string;
    timestamp: number;
  };
}
```

## LLM Integration

### LLMWorkflowPlanner

```typescript
class LLMWorkflowPlanner {
  constructor(config: LLMWorkflowPlannerConfig);

  // Generate workflow from natural language
  async generateWorkflow(
    description: string,
    options?: WorkflowGenerationOptions
  ): Promise<Result<WorkflowPlan, QiError>>;

  // Execute a generated workflow plan
  async executeWorkflow(
    plan: WorkflowPlan,
    config: {
      sessionId: string;
      input: string;
      domain: string;
      contextId?: string;
      streamingEnabled?: boolean;
    }
  ): Promise<Result<WorkflowResult, QiError>>;

  // Validate a workflow plan
  validatePlan(plan: WorkflowPlan): Result<boolean, string>;
}

interface LLMWorkflowPlannerConfig {
  provider: 'openai' | 'anthropic';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackToTemplate?: boolean;
  templatePatterns?: string[];
}

interface WorkflowGenerationOptions {
  domain?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  preferredPattern?: 'react' | 'rewoo' | 'adapt';
  maxNodes?: number;
  includeMocks?: boolean;
}

interface WorkflowPlan {
  name: string;
  description: string;
  nodes: WorkflowPlanNode[];
  edges: WorkflowPlanEdge[];
  estimatedComplexity: 'simple' | 'medium' | 'complex';
  suggestedPattern?: 'react' | 'rewoo' | 'adapt';
  metadata: {
    planningMethod: 'llm' | 'template' | 'hybrid';
    generatedAt: number;
    confidence: number;
  };
}

interface WorkflowPlanNode {
  id: string;
  name: string;
  type: 'input' | 'processing' | 'tool' | 'reasoning' | 'output' | 'control';
  description: string;
  dependencies?: string[];
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

interface WorkflowPlanEdge {
  from: string;
  to: string;
  condition?: string;
}
```

## Configuration

### Engine Configuration

```typescript
interface IWorkflowEngineConfig {
  defaultTimeoutMs?: number;         // Default workflow timeout (30000ms)
  maxConcurrentWorkflows?: number;   // Max concurrent workflows (5)
  enablePersistence?: boolean;       // Enable state persistence (false)
  enableMetrics?: boolean;           // Enable performance metrics (true)
  loggingLevel?: 'debug' | 'info' | 'warn' | 'error'; // Logging level ('info')
}
```

### Logging Integration

All workflow components use QiCore's structured logging:

```typescript
import { createQiLogger } from '@qi/workflow/utils/QiCoreLogger.js';

const logger = createQiLogger({
  name: 'WorkflowComponent',
  level: 'info'
});

// Structured logging with metadata
logger.info('Workflow execution started', undefined, {
  component: 'LangGraphWorkflowEngine',
  method: 'execute',
  workflowId: 'workflow-123',
  pattern: 'react'
});
```

## Error Handling

### QiCore Result Pattern

All APIs use QiCore's `Result<T>` pattern for type-safe error handling:

```typescript
import { Result, success, failure } from '@qi/base';

// Example function signature
async function executeWorkflow(
  pattern: string,
  input: string
): Promise<Result<WorkflowResult, QiError>> {
  try {
    const result = await engine.execute(workflow, state);
    return success(result);
  } catch (error) {
    return failure(new QiError('SYSTEM', 'WORKFLOW_EXECUTION_FAILED', error.message));
  }
}

// Usage
const result = await executeWorkflow('analysis', 'input data');
if (result.tag === 'success') {
  console.log('Output:', result.value.finalState.output);
} else {
  console.error('Error:', result.error.message);
}
```

### Error Categories

```typescript
type QiErrorCategory = 
  | 'VALIDATION'    // Input validation errors
  | 'SYSTEM'        // System/infrastructure errors
  | 'TOOL'          // Tool execution errors
  | 'TIMEOUT'       // Timeout errors
  | 'PERMISSION'    // Permission/access errors
  | 'RESOURCE';     // Resource exhaustion errors
```

## Stream Processing

### WorkflowStreamChunk

```typescript
interface WorkflowStreamChunk {
  nodeId: string;
  state: WorkflowState;
  isComplete: boolean;
  error?: {
    nodeId: string;
    error: Error;
    retryable: boolean;
  };
}
```

### Pattern-Specific Stream Types

#### ReAct Stream
```typescript
interface ReActStreamChunk {
  step: number;
  thought: string;
  action: string;
  observation: string;
  isComplete: boolean;
}
```

#### ReWOO Stream
```typescript
interface ReWOOStreamChunk {
  phase: 'planning' | 'working' | 'solving' | 'complete';
  plan: ReWOOPlanStep[];
  evidence: ReWOOEvidence[];
  activeWorkers: string[];
  progress: number;
}
```

#### ADaPT Stream
```typescript
interface ADaPTStreamChunk {
  phase: 'decomposing' | 'executing' | 'combining' | 'complete';
  currentTask?: ADaPTTask;
  tasks: ADaPTTask[];
  completedCount: number;
  progress: number;
}
```

## Factory Functions

### Pattern Factories

```typescript
// Factory functions for easy pattern instantiation
export const createReActPattern = (
  toolExecutor?: WorkflowToolExecutor, 
  config?: Partial<ReActConfig>
) => new ReActPattern(toolExecutor, config);

export const createReWOOPattern = (
  toolExecutor?: WorkflowToolExecutor, 
  config?: Partial<ReWOOConfig>
) => new ReWOOPattern(toolExecutor, config);

export const createADaPTPattern = (
  toolExecutor?: WorkflowToolExecutor, 
  config?: Partial<ADaPTConfig>
) => new ADaPTPattern(toolExecutor, config);
```

This comprehensive API reference provides all the type definitions, interfaces, and usage patterns needed to work with the qi-prompt v-0.8.0 workflow system. All APIs follow QiCore conventions for error handling, logging, and type safety.