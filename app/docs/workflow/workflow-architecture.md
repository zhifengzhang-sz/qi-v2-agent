# Workflow System Architecture

## Overview

The workflow module provides a complete system for extracting, validating, and executing multi-step workflows from natural language input. It follows the app layer's abstract/impl pattern for maximum flexibility and testability.

## Architecture Components

### 1. Core Interfaces (`interfaces/`)

#### IWorkflow.ts
- **WorkflowSpec**: Complete workflow specification with nodes and edges
- **WorkflowState**: Execution state with context and metadata
- **WorkflowResult**: Execution results with performance metrics
- **WorkflowStreamChunk**: Real-time execution updates

#### IWorkflowExtractor.ts
- **IWorkflowExtractor**: Abstract interface for workflow extraction
- **WorkflowExtractionResult**: Extraction outcome with confidence scoring
- **WorkflowMode**: Supported workflow patterns and capabilities

#### IWorkflowEngine.ts
- **IWorkflowEngine**: Abstract interface for workflow execution
- **ExecutableWorkflow**: Compiled workflow ready for execution
- **WorkflowCustomization**: Runtime workflow modifications

### 2. Implementation Layer (`impl/`)

#### QiWorkflowExtractor
- LangChain structured output for reliable extraction
- Zod schema validation for type safety
- Multi-mode pattern detection (analytical, creative, problem-solving)
- Complexity analysis and confidence scoring
- Ollama LLM integration for local processing

#### QiWorkflowEngine
- Simplified execution engine (no LangGraph dependency)
- Topological sorting for node execution order
- Pattern-specific workflow customization
- Streaming execution support
- Performance monitoring and metrics

## Data Flow

```
Natural Language Input
        ↓
   Input Analysis
   (complexity, mode detection)
        ↓
   Workflow Extraction
   (LLM-based with schema validation)
        ↓
   Workflow Validation
   (structure, dependencies, cycles)
        ↓
   Executable Workflow Creation
   (node handlers, edge conditions)
        ↓
   Workflow Execution
   (sequential or streaming)
        ↓
   Results & Performance Metrics
```

## Workflow Patterns

### Supported Modes

1. **General**: Basic workflow processing
2. **Analytical**: Systematic analysis with reasoning steps
3. **Creative**: Generation and synthesis workflows
4. **Problem-solving**: Diagnostic and solution workflows
5. **Informational**: Knowledge structuring and explanation

### Node Types

- **input**: Process initial user input
- **processing**: Data transformation and manipulation
- **tool**: External tool execution
- **reasoning**: Analysis and decision-making
- **output**: Result formatting and delivery
- **decision**: Conditional branching
- **validation**: Quality assurance and verification

## Integration Patterns

### CLI Integration

The workflow system integrates with the CLI through:

1. **WorkflowCLIParser**: Enhanced parser with workflow detection
2. **CLIWorkflowHandler**: Workflow execution coordinator
3. **Streaming Support**: Real-time progress updates
4. **Error Handling**: Graceful fallback and recovery

### Parser Enhancement

```typescript
// Standard parser
const basicParser = createParser();

// Workflow-enabled parser
const workflowParser = createWorkflowParser({
  workflowThreshold: 0.6,
  enableWorkflowExtraction: true
});
```

### Handler Integration

```typescript
const workflowHandler = createWorkflowHandler();

// Execute workflow
const result = await workflowHandler.executeWorkflow(input, context);

// Stream workflow
for await (const update of workflowHandler.streamWorkflow(input, context)) {
  console.log(`${update.nodeId}: ${update.output}`);
}
```

## Performance Characteristics

### Extraction Performance
- **Cold start**: ~500-2000ms with LLM
- **Validation**: ~10-50ms
- **Pattern detection**: ~1-5ms

### Execution Performance
- **Simple workflows**: ~50-200ms
- **Complex workflows**: ~200-1000ms
- **Streaming overhead**: ~10-20ms per chunk

### Memory Usage
- **Extraction**: ~50-100MB (LLM model loading)
- **Execution**: ~5-20MB per workflow
- **State management**: ~1-5MB per session

## Error Handling

### Graceful Degradation
1. **LLM unavailable**: Fall back to rule-based detection
2. **Extraction failure**: Return classification with low confidence
3. **Execution error**: Provide partial results with error context
4. **Validation failure**: Detailed error messages with suggestions

### Recovery Strategies
- **Retry with simpler patterns**: Reduce complexity on failure
- **Partial execution**: Complete successful nodes, report failures
- **State preservation**: Maintain workflow state for debugging
- **Fallback modes**: Switch to prompt mode when workflow fails

## Extensibility

### Adding New Patterns
1. Update `WorkflowMode` definitions
2. Add pattern-specific node types
3. Implement custom node handlers
4. Register pattern mappings

### Custom Node Types
```typescript
const customWorkflow = engine.createWorkflow('custom-pattern', [
  {
    type: 'add-node',
    nodeDefinition: {
      id: 'custom-node',
      name: 'Custom Processing',
      type: 'processing',
      handler: async (state) => {
        // Custom logic
        return modifiedState;
      }
    }
  }
]);
```

## Configuration

### Extractor Configuration
```typescript
const extractor = createWorkflowExtractor({
  baseUrl: 'http://localhost:11434',
  modelId: 'qwen2.5:7b',
  temperature: 0.2,
  supportedModes: customModes,
  patternMapping: customPatterns
});
```

### Engine Configuration
```typescript
const engine = createWorkflowEngine({
  enableStreaming: true,
  maxExecutionTime: 30000,
  persistenceStore: 'memory'
});
```

## Future Enhancements

### Planned Features
- **LangGraph Integration**: Advanced state management
- **Tool Provider Integration**: Real tool execution
- **Workflow Templates**: Pre-built workflow patterns
- **Visual Workflow Builder**: GUI workflow creation
- **Workflow Optimization**: Performance tuning and caching

### Extension Points
- **Custom Extractors**: Alternative extraction methods
- **Custom Engines**: Specialized execution environments
- **Plugin System**: Third-party workflow extensions
- **Monitoring Integration**: Performance and usage tracking