# Workflow Module Examples

## Basic Usage Examples

### Simple Workflow Extraction

```typescript
import { createWorkflowExtractor } from '@qi/workflow';

async function basicExtractionExample() {
  const extractor = createWorkflowExtractor();
  
  const result = await extractor.extractWorkflow(
    'create a React component and write tests for it'
  );
  
  console.log('Success:', result.success);
  console.log('Pattern:', result.pattern);
  console.log('Confidence:', result.confidence);
  
  if (result.workflowSpec) {
    console.log('Nodes:', result.workflowSpec.nodes.length);
    console.log('Workflow Name:', result.workflowSpec.name);
  }
}
```

### Simple Workflow Execution

```typescript
import { createWorkflowEngine, createWorkflowExtractor } from '@qi/workflow';

async function basicExecutionExample() {
  const extractor = createWorkflowExtractor();
  const engine = createWorkflowEngine();
  
  // Extract workflow
  const extraction = await extractor.extractWorkflow(
    'analyze the performance of my application'
  );
  
  if (!extraction.success) {
    console.error('Extraction failed:', extraction.error);
    return;
  }
  
  // Create executable workflow
  const workflow = engine.createWorkflow(extraction.pattern);
  
  // Create initial state
  const initialState = {
    input: 'analyze the performance of my application',
    pattern: extraction.pattern,
    domain: 'development',
    context: new Map([
      ['projectType', 'web-application'],
      ['framework', 'react']
    ]),
    toolResults: [],
    reasoningOutput: '',
    output: '',
    metadata: {
      startTime: Date.now(),
      processingSteps: [],
      performance: new Map()
    }
  };
  
  // Execute workflow
  const result = await engine.execute(workflow, initialState);
  
  console.log('Final Output:', result.finalState.output);
  console.log('Execution Path:', result.executionPath.join(' → '));
  console.log('Total Time:', result.performance.totalTime, 'ms');
}
```

## CLI Integration Examples

### Enhanced CLI with Workflow Support

```typescript
import { 
  createWorkflowParser, 
  createWorkflowHandler,
  createStateManager 
} from '@qi/cli';

class WorkflowCLI {
  private parser = createWorkflowParser();
  private workflowHandler = createWorkflowHandler();
  private stateManager = createStateManager();
  
  async processUserInput(input: string): Promise<void> {
    const context = {
      sessionId: 'user-session',
      environmentContext: new Map([
        ['domain', 'development'],
        ['userRole', 'developer']
      ])
    };
    
    // Classify input
    const classification = await this.parser.classifyInput(input, undefined, context);
    
    console.log(`Detected: ${classification.type} (${(classification.confidence * 100).toFixed(1)}%)`);
    
    switch (classification.type) {
      case 'command':
        await this.handleCommand(classification);
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
  
  private async handleWorkflow(input: string, context: any): Promise<void> {
    console.log('🔄 Executing workflow...');
    this.stateManager.setBusy('Processing workflow');
    
    try {
      const result = await this.workflowHandler.executeWorkflow(input, context);
      
      if (result.success) {
        console.log('\n✅ Workflow completed successfully!');
        console.log(`Pattern: ${result.pattern}`);
        console.log(`Execution time: ${result.executionTime}ms`);
        console.log('\nOutput:');
        console.log(result.output);
      } else {
        console.log('\n❌ Workflow failed');
        console.log('Error:', result.error);
      }
    } finally {
      this.stateManager.setReady();
    }
  }
  
  private async handleCommand(classification: any): Promise<void> {
    const command = classification.extractedData.get('command');
    const args = classification.extractedData.get('args');
    console.log(`Executing command: ${command} ${args.join(' ')}`);
  }
  
  private async handlePrompt(input: string, context: any): Promise<void> {
    console.log(`Processing prompt: ${input}`);
  }
}

// Usage
const cli = new WorkflowCLI();
await cli.processUserInput('create a new API endpoint and write tests for it');
```

### Streaming Workflow Execution

```typescript
import { createWorkflowHandler } from '@qi/cli';

async function streamingWorkflowExample() {
  const handler = createWorkflowHandler();
  
  const input = 'build a REST API with authentication and deploy it';
  const context = {
    sessionId: 'streaming-demo',
    environmentContext: new Map([
      ['domain', 'web-development'],
      ['deployment', 'staging']
    ])
  };
  
  console.log(`🌊 Streaming workflow: ${input}\n`);
  
  let stepCount = 0;
  for await (const update of handler.streamWorkflow(input, context)) {
    stepCount++;
    
    // Format output
    const status = update.isComplete ? '✅' : '⏳';
    console.log(`${status} Step ${stepCount}: [${update.nodeId}] ${update.stage}`);
    
    // Show progress
    if (update.output) {
      const preview = update.output.length > 100 
        ? update.output.substring(0, 100) + '...'
        : update.output;
      console.log(`   ${preview}`);
    }
    
    // Handle errors
    if (update.error) {
      console.log(`   ❌ Error: ${update.error}`);
    }
    
    console.log(''); // Spacing
    
    if (update.isComplete) break;
  }
  
  console.log('🎉 Streaming completed!');
}
```

## Advanced Usage Examples

### Custom Workflow Patterns

```typescript
import { createWorkflowExtractor, createWorkflowEngine } from '@qi/workflow';

// Custom workflow mode
const customModes = [
  {
    name: 'data-processing',
    description: 'Data processing and analysis workflows',
    category: 'data',
    keywords: ['process', 'analyze', 'transform', 'data'],
    commonNodes: ['input', 'validation', 'processing', 'analysis', 'output'],
    requiredTools: ['data-tools', 'analysis-tools']
  }
];

// Custom pattern mapping
const customPatterns = [
  ['data-processing', 'data-processing'],
  ['machine-learning', 'analytical'],
  ['data-visualization', 'creative']
];

async function customPatternsExample() {
  const extractor = createWorkflowExtractor({
    supportedModes: customModes,
    patternMapping: customPatterns,
    temperature: 0.1 // Lower temperature for more consistent results
  });
  
  const result = await extractor.extractWorkflow(
    'process the sales data, analyze trends, and create visualizations'
  );
  
  console.log('Custom pattern detection:', result.pattern);
}
```

### Workflow Customization

```typescript
import { createWorkflowEngine } from '@qi/workflow';

async function workflowCustomizationExample() {
  const engine = createWorkflowEngine();
  
  // Custom node handler
  const customValidationNode = {
    id: 'custom-validation',
    name: 'Custom Validation',
    type: 'validation' as const,
    handler: async (state: any) => {
      // Custom validation logic
      const validationResults = performCustomValidation(state.output);
      
      return {
        ...state,
        output: state.output + '\n\nValidation Results:\n' + validationResults,
        metadata: {
          ...state.metadata,
          currentStage: 'custom-validation',
          processingSteps: [...state.metadata.processingSteps, 'custom-validation']
        }
      };
    }
  };
  
  // Create workflow with customizations
  const workflow = engine.createWorkflow('analytical', [
    {
      type: 'add-node',
      nodeDefinition: customValidationNode
    },
    {
      type: 'add-edge',
      edgeDefinition: {
        from: 'synthesizeResults',
        to: 'custom-validation'
      }
    },
    {
      type: 'add-edge',
      edgeDefinition: {
        from: 'custom-validation',
        to: 'formatOutput'
      }
    }
  ]);
  
  console.log('Custom workflow created with', workflow.nodes.length, 'nodes');
}

function performCustomValidation(output: string): string {
  // Mock validation
  return 'All checks passed ✅';
}
```

### Error Handling and Recovery

```typescript
import { createWorkflowHandler } from '@qi/cli';

class RobustWorkflowExecutor {
  private handler = createWorkflowHandler();
  private maxRetries = 3;
  
  async executeWithRetry(input: string, context: any): Promise<any> {
    let lastError: string | undefined;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt}/${this.maxRetries}: ${input}`);
        
        const result = await this.handler.executeWorkflow(input, context);
        
        if (result.success) {
          console.log(`✅ Success on attempt ${attempt}`);
          return result;
        }
        
        lastError = result.error;
        console.log(`❌ Attempt ${attempt} failed: ${result.error}`);
        
        // Implement backoff strategy
        if (attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.log(`💥 Exception on attempt ${attempt}: ${lastError}`);
      }
    }
    
    // All attempts failed
    console.log(`🚫 All ${this.maxRetries} attempts failed. Last error: ${lastError}`);
    return {
      success: false,
      error: `Failed after ${this.maxRetries} attempts: ${lastError}`,
      executionTime: 0,
      pattern: 'unknown',
      metadata: new Map([['attemptsMade', this.maxRetries]])
    };
  }
  
  async executeWithFallback(input: string, context: any): Promise<any> {
    // Try workflow execution first
    const workflowResult = await this.handler.executeWorkflow(input, context);
    
    if (workflowResult.success) {
      return workflowResult;
    }
    
    console.log('Workflow failed, attempting graceful degradation...');
    
    // Fallback strategies
    const fallbackStrategies = [
      () => this.trySimplifiedWorkflow(input, context),
      () => this.tryPromptFallback(input, context),
      () => this.tryStaticResponse(input)
    ];
    
    for (const strategy of fallbackStrategies) {
      try {
        const result = await strategy();
        if (result.success) {
          console.log('✅ Fallback strategy succeeded');
          return result;
        }
      } catch (error) {
        console.log('Fallback strategy failed:', error);
      }
    }
    
    // Ultimate fallback
    return {
      success: false,
      error: 'All execution strategies failed',
      output: `Unable to process: ${input}`,
      executionTime: 0,
      pattern: 'fallback',
      metadata: new Map([['fallbackUsed', 'true']])
    };
  }
  
  private async trySimplifiedWorkflow(input: string, context: any): Promise<any> {
    // Implement simplified workflow logic
    return {
      success: true,
      output: `Simplified processing of: ${input}`,
      executionTime: 100,
      pattern: 'simplified',
      metadata: new Map([['strategy', 'simplified-workflow']])
    };
  }
  
  private async tryPromptFallback(input: string, context: any): Promise<any> {
    // Fallback to simple prompt processing
    return {
      success: true,
      output: `Prompt-style response to: ${input}`,
      executionTime: 50,
      pattern: 'prompt',
      metadata: new Map([['strategy', 'prompt-fallback']])
    };
  }
  
  private async tryStaticResponse(input: string): Promise<any> {
    // Last resort static response
    return {
      success: true,
      output: `I understand you want to: ${input}. However, I'm currently unable to process complex workflows. Please try a simpler request.`,
      executionTime: 1,
      pattern: 'static',
      metadata: new Map([['strategy', 'static-response']])
    };
  }
}

// Usage
const executor = new RobustWorkflowExecutor();
const result = await executor.executeWithFallback(
  'create a complex microservices architecture',
  { sessionId: 'robust-test' }
);
```

## Testing Examples

### Unit Testing Workflows

```typescript
import { createWorkflowExtractor, createWorkflowEngine } from '@qi/workflow';

describe('Workflow System', () => {
  let extractor: any;
  let engine: any;
  
  beforeEach(() => {
    extractor = createWorkflowExtractor({
      enableWorkflowExtraction: false // Skip LLM for unit tests
    });
    engine = createWorkflowEngine();
  });
  
  describe('Workflow Extraction', () => {
    it('should detect analytical workflows', async () => {
      const result = await extractor.extractWorkflow(
        'analyze the performance issues in the application and provide recommendations'
      );
      
      expect(result.pattern).toBe('analytical');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
    
    it('should detect creative workflows', async () => {
      const result = await extractor.extractWorkflow(
        'create a new user interface design and implement the components'
      );
      
      expect(result.pattern).toBe('creative');
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });
  
  describe('Workflow Execution', () => {
    it('should execute simple workflows', async () => {
      const workflow = engine.createWorkflow('general');
      const initialState = createTestState();
      
      const result = await engine.execute(workflow, initialState);
      
      expect(result.finalState.output).toBeDefined();
      expect(result.executionPath.length).toBeGreaterThan(0);
      expect(result.performance.totalTime).toBeGreaterThan(0);
    });
    
    it('should handle workflow streaming', async () => {
      const workflow = engine.createWorkflow('analytical');
      const initialState = createTestState();
      
      const chunks = [];
      for await (const chunk of engine.stream(workflow, initialState)) {
        chunks.push(chunk);
        if (chunk.isComplete) break;
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });
  });
});

function createTestState() {
  return {
    input: 'test input',
    pattern: 'general',
    domain: 'test',
    context: new Map(),
    toolResults: [],
    reasoningOutput: '',
    output: '',
    metadata: {
      startTime: Date.now(),
      processingSteps: [],
      performance: new Map()
    }
  };
}
```

### Integration Testing

```typescript
import { createWorkflowParser, createWorkflowHandler } from '@qi/cli';

describe('Workflow CLI Integration', () => {
  let parser: any;
  let handler: any;
  
  beforeEach(() => {
    parser = createWorkflowParser({ enableWorkflowExtraction: false });
    handler = createWorkflowHandler();
  });
  
  it('should integrate parser and handler correctly', async () => {
    const input = 'create a simple web application with user authentication';
    
    // Test classification
    const classification = await parser.classifyInput(input);
    expect(classification.type).toBe('workflow');
    
    // Test execution
    const result = await handler.executeWorkflow(input, { sessionId: 'test' });
    expect(result.success).toBeDefined();
    expect(result.pattern).toBeDefined();
  });
  
  it('should handle command vs workflow distinction', async () => {
    const testCases = [
      { input: '/help', expectedType: 'command' },
      { input: 'hello', expectedType: 'prompt' },
      { input: 'create a component and test it', expectedType: 'workflow' }
    ];
    
    for (const testCase of testCases) {
      const result = await parser.classifyInput(testCase.input);
      expect(result.type).toBe(testCase.expectedType);
    }
  });
});
```

## Performance Examples

### Workflow Precompilation

```typescript
import { createWorkflowEngine } from '@qi/workflow';

async function precompilationExample() {
  const engine = createWorkflowEngine();
  
  // Precompile common patterns at startup
  const commonPatterns = [
    'analytical',
    'creative', 
    'problem-solving',
    'informational'
  ];
  
  console.log('🔧 Precompiling workflows...');
  const startTime = Date.now();
  
  await engine.precompileWorkflows(commonPatterns);
  
  const precompileTime = Date.now() - startTime;
  console.log(`✅ Precompiled ${commonPatterns.length} workflows in ${precompileTime}ms`);
  
  // Use precompiled workflow
  const workflow = engine.getCompiledWorkflow('analytical');
  if (workflow) {
    console.log('📦 Using precompiled analytical workflow');
  }
}
```

### Result Caching

```typescript
class CachedWorkflowHandler {
  private cache = new Map<string, any>();
  private cacheHits = 0;
  private cacheMisses = 0;
  
  constructor(private handler: any) {}
  
  async executeWorkflow(input: string, context: any): Promise<any> {
    const cacheKey = this.generateCacheKey(input, context);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      console.log(`📋 Cache hit for: ${input.substring(0, 50)}...`);
      return { ...this.cache.get(cacheKey), fromCache: true };
    }
    
    // Execute workflow
    this.cacheMisses++;
    const result = await this.handler.executeWorkflow(input, context);
    
    // Cache successful results
    if (result.success) {
      this.cache.set(cacheKey, result);
      console.log(`💾 Cached result for: ${input.substring(0, 50)}...`);
    }
    
    return result;
  }
  
  private generateCacheKey(input: string, context: any): string {
    const contextKey = context.sessionId || 'default';
    return `${input.toLowerCase().trim()}-${contextKey}`;
  }
  
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(1) : '0';
    
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size
    };
  }
}

// Usage
const baseHandler = createWorkflowHandler();
const cachedHandler = new CachedWorkflowHandler(baseHandler);

// Execute same workflow multiple times
await cachedHandler.executeWorkflow('analyze data trends', { sessionId: 'user1' });
await cachedHandler.executeWorkflow('analyze data trends', { sessionId: 'user1' }); // Cache hit

console.log('Cache stats:', cachedHandler.getCacheStats());
```

These examples demonstrate the full range of workflow module capabilities, from basic usage to advanced customization and performance optimization.