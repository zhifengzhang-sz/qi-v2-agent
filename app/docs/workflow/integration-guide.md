# Workflow CLI Integration Guide

## Overview

This guide covers integrating the workflow module with the CLI system, including parser enhancement, handler setup, and practical usage patterns.

## Integration Architecture

```
CLI Input → Enhanced Parser → Classification → Handler → Execution
           (workflow detection)  (command/prompt/workflow)  (workflow engine)
```

## Setup and Configuration

### 1. Enhanced Parser Setup

Replace the basic CLI parser with the workflow-enabled parser:

```typescript
import { createWorkflowParser } from '@qi/cli';

// Basic setup
const parser = createWorkflowParser();

// Advanced setup
const advancedParser = createWorkflowParser({
  confidenceThreshold: 0.8,
  workflowThreshold: 0.6,
  enableWorkflowExtraction: true,
  customPatterns: []
});
```

### 2. Workflow Handler Integration

Add workflow handling capability to your CLI application:

```typescript
import { createWorkflowHandler } from '@qi/cli';

const workflowHandler = createWorkflowHandler();

// Check if input should be handled as workflow
const isWorkflow = await workflowHandler.isWorkflowInput(userInput);

if (isWorkflow) {
  const result = await workflowHandler.executeWorkflow(userInput, context);
  console.log(result.output);
}
```

### 3. Complete CLI Integration

Here's a complete example of CLI integration:

```typescript
import { 
  createWorkflowParser, 
  createWorkflowHandler,
  createStateManager,
  createCommandHandler 
} from '@qi/cli';

class WorkflowEnabledCLI {
  private parser = createWorkflowParser();
  private workflowHandler = createWorkflowHandler();
  private stateManager = createStateManager();
  private commandHandler = createCommandHandler();
  
  async processInput(input: string): Promise<void> {
    const context = this.createProcessingContext();
    
    // Classify input
    const classification = await this.parser.classifyInput(input, undefined, context);
    
    switch (classification.type) {
      case 'command':
        await this.handleCommand(classification.extractedData.get('command'), 
                                 classification.extractedData.get('args'));
        break;
        
      case 'workflow':
        await this.handleWorkflow(input, context);
        break;
        
      case 'prompt':
      default:
        await this.handlePrompt(input, context);
        break;
    }
  }
  
  private async handleWorkflow(input: string, context: ProcessingContext): Promise<void> {
    this.stateManager.setBusy('Executing workflow');
    
    try {
      const result = await this.workflowHandler.executeWorkflow(input, context);
      
      if (result.success) {
        console.log(result.output);
        console.log(`Completed in ${result.executionTime}ms using ${result.pattern} pattern`);
      } else {
        console.error(`Workflow failed: ${result.error}`);
      }
    } finally {
      this.stateManager.setReady();
    }
  }
}
```

## Workflow Detection Patterns

### Detection Rules

The workflow parser uses several indicators to detect workflows:

#### Multi-step Indicators
- "then", "after", "next", "followed by"
- "first", "second", "finally"
- "step", "steps"

#### Tool Indicators  
- "create", "build", "generate", "implement"
- "file", "write", "run", "execute"
- "compile", "install", "deploy"

#### File Operation Indicators
- File extensions: ".js", ".ts", ".py", etc.
- File operations: "save to", "write to", "create file"

#### Complexity Keywords
- "architecture", "system", "integration"
- "workflow", "pipeline", "process"

### Example Classifications

```typescript
// Commands (100% confidence)
"/help" → command
"/config set model ollama" → command

// Simple prompts (90% confidence)  
"hi" → prompt
"write a quicksort in haskell" → prompt

// Workflows (60-90% confidence)
"create a React component and write tests" → workflow (creative mode)
"analyze performance issues and fix them" → workflow (analytical mode)
"debug auth system, update config, restart service" → workflow (problem-solving mode)
```

## Streaming Workflow Execution

For long-running workflows, use streaming execution for real-time feedback:

```typescript
async function streamWorkflowExecution(input: string, context: ProcessingContext): Promise<void> {
  console.log(`🌊 Starting workflow: ${input}`);
  
  let stepCount = 0;
  for await (const update of workflowHandler.streamWorkflow(input, context)) {
    stepCount++;
    
    console.log(`Step ${stepCount}: [${update.nodeId}] ${update.stage}`);
    console.log(`  ${update.output}`);
    
    if (update.error) {
      console.error(`  Error: ${update.error}`);
    }
    
    if (update.isComplete) {
      console.log('✅ Workflow completed');
      break;
    }
  }
}
```

## Error Handling Strategies

### Graceful Degradation

```typescript
async function robustWorkflowHandling(input: string, context: ProcessingContext): Promise<void> {
  try {
    // Try workflow execution first
    const result = await workflowHandler.executeWorkflow(input, context);
    
    if (result.success) {
      console.log(result.output);
      return;
    }
    
    // If workflow fails, check if we can fall back to prompt
    console.warn(`Workflow failed: ${result.error}`);
    console.log('Falling back to prompt processing...');
    
    // Fall back to prompt handler
    await handleAsPrompt(input, context);
    
  } catch (error) {
    console.error('Complete workflow system failure:', error);
    
    // Ultimate fallback
    console.log('Processing as simple text input...');
    console.log(`Input: ${input}`);
  }
}
```

### Error Context Preservation

```typescript
interface WorkflowErrorContext {
  originalInput: string;
  classification: InputClassificationResult;
  partialExecution?: Partial<WorkflowResult>;
  errorDetails: string;
  suggestedAction: string;
}

function createErrorContext(
  input: string, 
  classification: InputClassificationResult,
  error: Error
): WorkflowErrorContext {
  return {
    originalInput: input,
    classification,
    errorDetails: error.message,
    suggestedAction: determineSuggestedAction(classification, error)
  };
}
```

## Performance Optimization

### Precompilation

For frequently used patterns, precompile workflows:

```typescript
// At startup
const commonPatterns = ['analytical', 'creative', 'problem-solving'];
await workflowHandler.precompileWorkflows?.(commonPatterns);

// Runtime usage
const precompiledWorkflow = workflowHandler.getCompiledWorkflow?.('analytical');
if (precompiledWorkflow) {
  // Use precompiled workflow for faster execution
}
```

### Caching

Implement result caching for similar inputs:

```typescript
class CachedWorkflowHandler {
  private cache = new Map<string, WorkflowExecutionResult>();
  
  async executeWorkflow(input: string, context: ProcessingContext): Promise<WorkflowExecutionResult> {
    const cacheKey = this.generateCacheKey(input, context);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const result = await this.workflowHandler.executeWorkflow(input, context);
    this.cache.set(cacheKey, result);
    
    return result;
  }
}
```

## Testing Integration

### Unit Testing

```typescript
describe('Workflow CLI Integration', () => {
  let parser: WorkflowCLIParser;
  let handler: CLIWorkflowHandler;
  
  beforeEach(() => {
    parser = createWorkflowParser({ enableWorkflowExtraction: false }); // Skip LLM for tests
    handler = createTestWorkflowHandler();
  });
  
  it('should detect workflow inputs correctly', async () => {
    const result = await parser.classifyInput(
      'create a React component and write tests for it'
    );
    
    expect(result.type).toBe('workflow');
    expect(result.confidence).toBeGreaterThan(0.6);
  });
  
  it('should handle workflow execution gracefully', async () => {
    const result = await handler.executeWorkflow(
      'simple test workflow',
      { sessionId: 'test' }
    );
    
    expect(result.success).toBeDefined();
    expect(result.executionTime).toBeGreaterThan(0);
  });
});
```

### Integration Testing

```typescript
describe('Full CLI Workflow Integration', () => {
  it('should process workflow end-to-end', async () => {
    const cli = new WorkflowEnabledCLI();
    
    // Mock console output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    await cli.processInput('create a simple web page and add styling');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('workflow')
    );
  });
});
```

## Configuration Examples

### Development Configuration

```typescript
const devConfig = {
  parser: createWorkflowParser({
    confidenceThreshold: 0.7,
    workflowThreshold: 0.5, // Lower threshold for development
    enableWorkflowExtraction: false // Skip LLM for faster iteration
  }),
  
  handler: createWorkflowHandler({
    enableStreaming: true,
    maxExecutionTime: 60000 // Longer timeout for development
  })
};
```

### Production Configuration

```typescript
const prodConfig = {
  parser: createWorkflowParser({
    confidenceThreshold: 0.8,
    workflowThreshold: 0.7, // Higher threshold for production
    enableWorkflowExtraction: true // Full LLM integration
  }),
  
  handler: createWorkflowHandler({
    enableStreaming: true,
    maxExecutionTime: 30000, // Reasonable timeout
    persistenceStore: 'database' // Persistent storage
  })
};
```

## Troubleshooting

### Common Issues

1. **LLM Model Not Found**
   - Ensure Ollama is running: `ollama serve`
   - Pull required model: `ollama pull qwen2.5:7b`

2. **Low Workflow Detection Rate**
   - Lower `workflowThreshold` in parser config
   - Add custom patterns for your domain
   - Check input preprocessing

3. **Slow Execution Performance**
   - Enable workflow precompilation
   - Implement result caching
   - Optimize node handlers

4. **Memory Usage Issues**
   - Limit concurrent workflow executions
   - Implement workflow result cleanup
   - Monitor LLM model memory usage

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const debugParser = createWorkflowParser({
  // ... other config
  enableDebugLogging: true
});

// Check classification details
const result = await debugParser.classifyInput(input);
console.log('Classification details:', result.metadata);
```