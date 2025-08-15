# Workflow Orchestration Module

## Architectural Framework

### Workflow Extraction Problem
**Input**: Natural language description $L$  
**Output**: Executable workflow specification $W = (N, E, P)$ where:
- $N$: Set of workflow nodes (tasks)
- $E$: Set of directed edges (dependencies) 
- $P$: Cognitive pattern classification

### Graph-Based Execution Model

Workflows represented as directed acyclic graphs (DAGs) with topological ordering for execution:

**Execution Algorithm**: Modified Kahn's algorithm with streaming support
1. Initialize in-degree count for all nodes
2. Enqueue nodes with in-degree = 0  
3. For each dequeued node: execute, update dependents, stream results
4. Continue until all nodes processed or cycle detected

**Time Complexity**: $O(|N| + |E|)$  
**Space Complexity**: $O(|N|)$

### Interface Specifications

```typescript
interface IWorkflowExtractor {
  extractWorkflow(input: string, context?: ProcessingContext): Promise<WorkflowExtractionResult>
  getSupportedModes(): WorkflowMode[]
  validateWorkflowSpec(spec: WorkflowSpec): boolean
  getWorkflowTemplates(mode: WorkflowMode): WorkflowSpec[]
}

interface IWorkflowEngine {
  createWorkflow(pattern: string, customizations?: WorkflowCustomization[]): ExecutableWorkflow
  execute(workflow: ExecutableWorkflow, initialState: WorkflowState): Promise<WorkflowResult>
  stream(workflow: ExecutableWorkflow, initialState: WorkflowState): AsyncIterable<WorkflowStreamChunk>
  precompileWorkflows(patterns: string[]): Promise<void>
}
```

### Cognitive Pattern Recognition

Workflows classified by cognitive patterns affecting execution strategy:

- **Analytical**: Systematic analysis with detailed logging
- **Creative**: Exploratory execution with multiple solution paths  
- **Problem-solving**: Error recovery and alternative approaches
- **Informational**: Documentation and explanation focus

### Node Type Taxonomy

```typescript
type WorkflowNodeType = 
  | 'input'      // Data ingestion and validation
  | 'processing' // Computational operations  
  | 'tool'       // External tool invocation
  | 'reasoning'  // LLM-based analysis
  | 'output'     // Result formatting and delivery
  | 'control'    // Conditional logic and branching
```

### State Management

**State Vector**: $S_t = (input, context, results, metadata)$  
**State Transition**: $S_{t+1} = f(S_t, N_i, output_i)$

```typescript
interface WorkflowState {
  readonly input: string
  readonly pattern: string  
  readonly context: ProcessingContext
  readonly results: Map<string, unknown>
  readonly metadata: WorkflowMetadata
  readonly performance: WorkflowPerformance
}
```

### Performance Characteristics

- **Extraction Latency**: 100-500ms (LLM dependent)
- **Execution Overhead**: ~5ms per node + tool execution time
- **Memory Usage**: Linear with workflow complexity
- **Throughput**: Concurrent workflow support with resource limits

### Error Handling Strategy

- **Node Failure**: Attempt retry with exponential backoff
- **Dependency Failure**: Skip dependent nodes, continue with available paths
- **Resource Exhaustion**: Graceful degradation with partial results
- **Timeout Management**: Per-node and total workflow timeouts

## v-0.8.0 Implementation

### Complete Documentation Suite

- **[Design Guide](./v-0.8.0-design-guide.md)**: Architectural principles, design patterns, and system overview
- **[Implementation Guide](./v-0.8.0-implementation-guide.md)**: Step-by-step usage instructions and code examples  
- **[Research Patterns](./research-patterns.md)**: Detailed coverage of ReAct, ReWOO, and ADaPT patterns
- **[API Reference](./api-reference.md)**: Complete API documentation with type definitions

### Key Features

- **Two-Layer Architecture**: Interface layer (simple Promise APIs) + Internal QiCore layer (Result<T> patterns)
- **QiCore Integration**: Complete Result<T> pattern usage with fromAsyncTryCatch(), match(), and create() error handling
- **Research-Backed Patterns**: Production-ready ReAct, ReWOO, and ADaPT pattern implementations with QiCore compliance
- **LangGraph StateGraph**: Real LangGraph implementations with `Annotation.Root()` state management
- **Tool System Integration**: WorkflowToolExecutor with 6-phase pipeline and proper QiCore Result<T> integration
- **Structured Logging**: createQiLogger integration throughout with zero console.log usage
- **Graceful Error Handling**: All errors use QiCore create() function with structured codes, messages, and context

### Migration from v-0.7.x

The v-0.8.0 system represents a complete rewrite with QiCore compliance and breaking changes:

**Architectural Changes:**
1. **Two-Layer Pattern**: Migrate from direct engine usage to createWorkflowHandler() factory
2. **QiCore Integration**: Replace all try/catch with fromAsyncTryCatch() and Result<T> patterns
3. **Error Handling**: Use QiCore create() function instead of manual error objects
4. **Logging**: Replace console.log with createQiLogger structured logging

**API Changes:**
1. **Factory Pattern**: Use `createWorkflowHandler()` instead of direct class instantiation
2. **Promise APIs**: Interface layer provides simple Promise-based methods
3. **Result<T> Access**: Advanced users can access QiCore layer directly for Result<T> patterns
4. **Tool Integration**: WorkflowToolExecutor now uses QiCore patterns throughout

### Quick Start

**Recommended: Two-Layer Architecture (QiCore Compliant)**

```typescript
import { createWorkflowHandler } from '@qi/workflow';

// Create workflow handler with QiCore two-layer architecture
const workflowHandler = await createWorkflowHandler({
  toolExecutor, // Optional: provide tool integration
  enableLogging: true,
  logLevel: 'info'
});

// Simple Promise-based API (Interface Layer)
const result = await workflowHandler.executeReAct('Analyze project structure');

// Stream execution with progress callbacks
await workflowHandler.streamWorkflow(
  'react',
  'Analyze project structure',
  (progress) => console.log(`${progress.stage}: ${progress.progress}%`)
);
```

**Advanced: Direct QiCore Layer Access**

```typescript
import { QiCoreWorkflowManager } from '@qi/workflow';

// Direct access to QiCore Result<T> patterns
const manager = new QiCoreWorkflowManager(toolExecutor);
await manager.initialize();

const result = await manager.executeReActPattern(input, context);
result.match(
  (success) => console.log('Workflow completed:', success.output),
  (error) => console.error('Workflow failed:', error.message)
);
```

## Implementation: `lib/src/workflow/`