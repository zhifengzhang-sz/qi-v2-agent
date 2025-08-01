# Workflow Module API Reference

## Core Interfaces

### IWorkflowExtractor

Abstract interface for extracting workflows from natural language.

```typescript
interface IWorkflowExtractor {
  extractWorkflow(input: string, context?: ProcessingContext): Promise<WorkflowExtractionResult>;
  getSupportedModes(): readonly WorkflowMode[];
  validateWorkflowSpec(spec: WorkflowSpec): Promise<boolean>;
  getWorkflowTemplates(mode: string): Promise<readonly WorkflowSpec[]>;
}
```

#### Methods

##### extractWorkflow(input, context?)
- **Purpose**: Extract workflow specification from natural language
- **Parameters**: 
  - `input: string` - Natural language input to analyze
  - `context?: ProcessingContext` - Optional execution context
- **Returns**: `Promise<WorkflowExtractionResult>`
- **Example**:
```typescript
const result = await extractor.extractWorkflow(
  'create a React component and write tests',
  { sessionId: 'user-123' }
);
```

##### getSupportedModes()
- **Purpose**: Get list of supported workflow modes
- **Returns**: `readonly WorkflowMode[]`
- **Example**:
```typescript
const modes = extractor.getSupportedModes();
// ['general', 'analytical', 'creative', 'problem-solving']
```

##### validateWorkflowSpec(spec)
- **Purpose**: Validate workflow specification structure
- **Parameters**: `spec: WorkflowSpec` - Workflow to validate
- **Returns**: `Promise<boolean>`
- **Example**:
```typescript
const isValid = await extractor.validateWorkflowSpec(workflowSpec);
```

### IWorkflowEngine

Abstract interface for executing workflows.

```typescript
interface IWorkflowEngine {
  createWorkflow(pattern: string, customizations?: WorkflowCustomization[]): ExecutableWorkflow;
  execute(workflow: ExecutableWorkflow, initialState: WorkflowState): Promise<WorkflowResult>;
  stream(workflow: ExecutableWorkflow, initialState: WorkflowState): AsyncIterableIterator<WorkflowStreamChunk>;
  precompileWorkflows(patterns: readonly string[]): Promise<void>;
  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null;
}
```

#### Methods

##### createWorkflow(pattern, customizations?)
- **Purpose**: Create executable workflow from pattern
- **Parameters**:
  - `pattern: string` - Workflow pattern name
  - `customizations?: WorkflowCustomization[]` - Optional customizations
- **Returns**: `ExecutableWorkflow`
- **Example**:
```typescript
const workflow = engine.createWorkflow('analytical', [
  {
    type: 'add-node',
    nodeDefinition: customNode
  }
]);
```

##### execute(workflow, initialState)
- **Purpose**: Execute workflow synchronously
- **Parameters**:
  - `workflow: ExecutableWorkflow` - Workflow to execute
  - `initialState: WorkflowState` - Starting state
- **Returns**: `Promise<WorkflowResult>`
- **Example**:
```typescript
const result = await engine.execute(workflow, {
  input: 'user input',
  pattern: 'analytical',
  domain: 'development',
  context: new Map(),
  toolResults: [],
  reasoningOutput: '',
  output: '',
  metadata: { startTime: Date.now(), processingSteps: [], performance: new Map() }
});
```

##### stream(workflow, initialState)
- **Purpose**: Execute workflow with real-time updates
- **Returns**: `AsyncIterableIterator<WorkflowStreamChunk>`
- **Example**:
```typescript
for await (const chunk of engine.stream(workflow, initialState)) {
  console.log(`${chunk.nodeId}: ${chunk.state.output}`);
  if (chunk.isComplete) break;
}
```

## Data Types

### WorkflowSpec

Complete workflow specification.

```typescript
interface WorkflowSpec {
  readonly id: string;                          // Unique identifier
  readonly name: string;                        // Human-readable name  
  readonly description: string;                 // Workflow description
  readonly nodes: readonly WorkflowNodeSpec[];  // Workflow nodes
  readonly edges: readonly WorkflowEdgeSpec[];  // Node connections
  readonly parameters: ReadonlyMap<string, unknown>; // Configuration
  readonly steps: readonly WorkflowNodeSpec[];  // Alias for nodes
}
```

### WorkflowNodeSpec

Individual workflow node specification.

```typescript
interface WorkflowNodeSpec {
  readonly id: string;                          // Unique node ID
  readonly name: string;                        // Display name
  readonly type: 'input' | 'processing' | 'tool' | 'reasoning' | 'output' | 'decision' | 'validation';
  readonly parameters: ReadonlyMap<string, unknown>; // Node parameters
  readonly requiredTools?: readonly string[];   // Required tools
  readonly conditions?: readonly WorkflowConditionSpec[]; // Execution conditions
  readonly dependencies?: readonly string[];    // Node dependencies
}
```

### WorkflowState

Current workflow execution state.

```typescript
interface WorkflowState {
  readonly input: string;                       // Original input
  readonly pattern: string;                     // Workflow pattern
  readonly domain: string;                      // Domain context
  readonly context: ReadonlyMap<string, unknown>; // Execution context
  readonly toolResults: readonly ToolResult[]; // Tool execution results
  readonly reasoningOutput: string;             // Reasoning content
  readonly output: string;                      // Current output
  readonly metadata: WorkflowMetadata;          // Execution metadata
}
```

### WorkflowResult

Workflow execution result.

```typescript
interface WorkflowResult {
  readonly finalState: WorkflowState;           // Final execution state
  readonly executionPath: readonly string[];   // Nodes executed
  readonly performance: WorkflowPerformance;   // Performance metrics
}
```

### WorkflowExtractionResult

Result of workflow extraction from natural language.

```typescript
interface WorkflowExtractionResult {
  readonly success: boolean;                    // Extraction success
  readonly mode: string;                        // Detected mode
  readonly pattern: string;                     // Workflow pattern
  readonly workflowSpec?: WorkflowSpec;         // Extracted spec
  readonly confidence: number;                  // Confidence (0-1)
  readonly extractionMethod: 'template-based' | 'llm-based' | 'hybrid';
  readonly error?: string;                      // Error message
  readonly metadata: ReadonlyMap<string, unknown>; // Extraction metadata
}
```

## Implementation Classes

### QiWorkflowExtractor

LangChain-based workflow extractor implementation.

```typescript
class QiWorkflowExtractor implements IWorkflowExtractor {
  constructor(config: IWorkflowExtractorConfig);
}
```

#### Configuration

```typescript
interface IWorkflowExtractorConfig {
  readonly supportedModes: readonly WorkflowMode[];
  readonly patternMapping: readonly [string, string][];
  readonly baseUrl?: string;        // Ollama base URL
  readonly modelId?: string;        // LLM model ID
  readonly temperature?: number;    // LLM temperature
  readonly maxTokens?: number;      // Max tokens
}
```

### QiWorkflowEngine

Simplified workflow execution engine.

```typescript
class QiWorkflowEngine implements IWorkflowEngine {
  constructor(config?: IWorkflowEngineConfig);
}
```

#### Configuration

```typescript
interface IWorkflowEngineConfig {
  readonly toolProvider?: any;           // Tool provider instance
  readonly enableCheckpointing?: boolean; // State checkpointing
  readonly maxExecutionTime?: number;    // Timeout (ms)
  readonly enableStreaming?: boolean;    // Streaming support
  readonly persistenceStore?: 'memory' | 'file' | 'database';
}
```

## CLI Integration Types

### WorkflowCLIParser

Enhanced CLI parser with workflow detection.

```typescript
class WorkflowCLIParser implements IInputClassifier {
  constructor(config?: Partial<WorkflowParserConfig>);
}
```

### CLIWorkflowHandler

Workflow execution handler for CLI integration.

```typescript
class CLIWorkflowHandler implements IWorkflowHandler {
  constructor();
  
  executeWorkflow(input: string, context?: ProcessingContext): Promise<WorkflowExecutionResult>;
  streamWorkflow(input: string, context?: ProcessingContext): AsyncIterableIterator<WorkflowStreamUpdate>;
  getSupportedPatterns(): readonly string[];
  isWorkflowInput(input: string): Promise<boolean>;
}
```

#### WorkflowExecutionResult

```typescript
interface WorkflowExecutionResult {
  readonly success: boolean;        // Execution success
  readonly output: string;          // Final output
  readonly executionTime: number;   // Execution time (ms)
  readonly pattern: string;         // Used pattern
  readonly metadata: ReadonlyMap<string, unknown>; // Execution metadata
  readonly error?: string;          // Error message
}
```

#### WorkflowStreamUpdate

```typescript
interface WorkflowStreamUpdate {
  readonly nodeId: string;          // Current node ID
  readonly stage: string;           // Execution stage
  readonly output: string;          // Current output
  readonly isComplete: boolean;     // Completion status
  readonly error?: string;          // Error message
}
```

## Factory Functions

### createWorkflowExtractor(config?)

Create workflow extractor with default configuration.

```typescript
function createWorkflowExtractor(config?: Partial<IWorkflowExtractorConfig>): QiWorkflowExtractor
```

**Default Configuration**:
```typescript
{
  supportedModes: [/* default modes */],
  patternMapping: [/* default mappings */],
  baseUrl: 'http://localhost:11434',
  modelId: 'qwen2.5:7b',
  temperature: 0.2
}
```

### createWorkflowEngine(config?)

Create workflow engine with default configuration.

```typescript
function createWorkflowEngine(config?: IWorkflowEngineConfig): QiWorkflowEngine
```

**Default Configuration**:
```typescript
{
  enableCheckpointing: false,
  maxExecutionTime: 30000,
  enableStreaming: true,
  persistenceStore: 'memory'
}
```

### createWorkflowParser(config?)

Create workflow-enabled CLI parser.

```typescript
function createWorkflowParser(config?: Partial<WorkflowParserConfig>): WorkflowCLIParser
```

### createWorkflowHandler()

Create CLI workflow handler.

```typescript
function createWorkflowHandler(): CLIWorkflowHandler
```

## Error Handling

### Common Error Types

```typescript
// Extraction errors
'model-not-found'       // LLM model unavailable
'extraction-failed'     // LLM extraction error
'validation-failed'     // Workflow validation error
'parsing-error'         // Input parsing error

// Execution errors  
'execution-timeout'     // Workflow timeout
'node-execution-failed' // Individual node failure
'state-corruption'      // Invalid state transition
'resource-unavailable'  // Required resource missing
```

### Error Context

All errors include contextual information:

```typescript
interface ErrorContext {
  readonly errorType: string;
  readonly originalInput: string;
  readonly processingStage: string;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly suggestedAction?: string;
}
```

## Performance Considerations

### Memory Usage
- **Extractor**: ~50-100MB (LLM model)
- **Engine**: ~5-20MB per workflow
- **State**: ~1-5MB per session

### Execution Times
- **Simple workflows**: 50-200ms
- **Complex workflows**: 200-1000ms  
- **LLM extraction**: 500-2000ms

### Optimization Tips
1. **Precompile** frequently used patterns
2. **Cache** extraction results for similar inputs
3. **Limit** concurrent workflow executions
4. **Monitor** memory usage with long-running workflows

## Version Compatibility

- **Node.js**: 18+
- **TypeScript**: 5.0+
- **Bun**: 1.0+
- **Dependencies**: See package.json

Current version: 0.2.5