# Workflow Module - Implementation Guide

## 🎯 Implementation Overview

This guide provides step-by-step instructions for implementing the Workflow module using modern AI frameworks. The implementation is split into two main components: **Workflow Extraction** (natural language → WorkflowSpec) and **Workflow Execution** (WorkflowSpec → results).

## 📦 Package Selection and Justification

### Core Dependencies

#### 1. LangChain Ecosystem
```json
{
  "@langchain/core": "^0.3.0",
  "@langchain/ollama": "^0.1.0",
  "@langchain/langgraph": "^0.2.0"
}
```

**What LangChain provides**:
- **Structured Output**: `model.withStructuredOutput()` forces LLM to return valid JSON
- **Local Model Support**: `ChatOllama` for local LLM integration
- **Automatic Retries**: Built-in retry logic for failed model calls
- **Streaming Support**: Real-time response processing

**Why chosen over alternatives**:
- **vs OpenAI Functions**: Works with local models (Ollama)
- **vs Custom JSON parsing**: Eliminates parsing errors and validation issues
- **vs LlamaIndex**: Better TypeScript support and structured output handling
- **vs Direct API calls**: Built-in error handling, retries, and abstractions

#### 2. LangGraph StateGraph
```json
{
  "@langchain/langgraph": "^0.2.0"
}
```

**What LangGraph provides**:
- **StateGraph Class**: Workflow orchestration with nodes and edges
- **State Annotations**: Type-safe state management with automatic merging
- **Persistence**: `MemorySaver` for workflow state checkpointing
- **Streaming**: Real-time workflow progress with `stream()` method
- **Visual Debugging**: Graph visualization for development

**Why chosen over alternatives**:
- **vs Temporal**: Lighter weight, better for AI workflows, native LangChain integration
- **vs Custom State Machines**: Production-ready with persistence and streaming
- **vs Conductor**: Simpler setup, TypeScript-first, AI-optimized
- **vs Step Functions**: Local execution, no AWS dependency

#### 3. Zod Schema Validation
```json
{
  "zod": "^3.22.0"
}
```

**What Zod provides**:
- **Runtime Validation**: Type-safe validation at runtime
- **TypeScript Integration**: Automatic type inference from schemas
- **Structured Output Compatibility**: Works seamlessly with LangChain
- **Clear Error Messages**: Detailed validation error reporting

**Why chosen over alternatives**:
- **vs Joi**: Better TypeScript support and automatic type inference
- **vs Yup**: More modern API and better tree-shaking
- **vs io-ts**: Simpler syntax and better LangChain integration

## 🔧 Implementation Steps

### Step 1: Workflow Extraction Implementation

#### 1.1 Define Zod Schemas

```typescript
// File: workflow-schemas.ts
import { z } from 'zod'

// Workflow condition schema
const WorkflowConditionSchema = z.object({
  type: z.enum(['always', 'success', 'error', 'custom']).describe('Condition type'),
  expression: z.string().optional().describe('Optional condition expression'),
  parameters: z.record(z.unknown()).optional().describe('Optional condition parameters')
})

// Workflow node schema
const WorkflowNodeSchema = z.object({
  id: z.string().describe('Unique node identifier'),
  name: z.string().describe('Human-readable node name'),
  type: z.enum(['input', 'processing', 'tool', 'reasoning', 'output', 'decision', 'validation']).describe('Node type'),
  parameters: z.record(z.unknown()).describe('Node parameters'),
  requiredTools: z.array(z.string()).optional().describe('Required tools for this node'),
  conditions: z.array(WorkflowConditionSchema).optional().describe('Node execution conditions'),
  dependencies: z.array(z.string()).optional().describe('Node dependencies')
})

// Complete workflow specification schema
export const WorkflowSpecSchema = z.object({
  id: z.string().describe('Unique workflow identifier'),
  name: z.string().describe('Human-readable workflow name'),
  description: z.string().describe('Workflow description'),
  nodes: z.array(WorkflowNodeSchema).describe('Workflow nodes'),
  edges: z.array(WorkflowEdgeSchema).describe('Workflow edges'),
  parameters: z.record(z.unknown()).describe('Workflow parameters')
})
```

**Why this schema structure**:
- **Descriptive Fields**: Help LLM understand what each field should contain
- **Enums for Types**: Constrain LLM output to valid node types
- **Optional Fields**: Allow flexibility while requiring core fields
- **Nested Validation**: Ensure edges reference valid nodes

#### 1.2 Implement Workflow Extractor

```typescript
// File: workflow-extractor.ts
import { ChatOllama } from '@langchain/ollama'
import { WorkflowSpecSchema } from './workflow-schemas.js'

export class HybridWorkflowExtractor implements IWorkflowExtractor {
  private model: ChatOllama
  private structuredModel: any

  constructor(config: WorkflowExtractorConfig) {
    // Initialize base model
    this.model = new ChatOllama({
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.modelId || 'qwen2.5:7b',
      temperature: 0.2, // Low temperature for consistent output
      numCtx: 4096
    })

    // Bind structured output schema - this is the key feature
    this.structuredModel = this.model.withStructuredOutput(WorkflowSpecSchema, {
      name: 'workflow_extraction'
    })
  }

  async extractWorkflow(
    input: string,
    context?: ProcessingContext
  ): Promise<WorkflowExtractionResult> {
    const startTime = Date.now()

    try {
      // 1. Analyze input complexity to determine approach
      const analysis = this.analyzeComplexity(input, context)
      const mode = analysis.detectedMode

      // 2. Build extraction prompt with examples and constraints
      const prompt = this.buildExtractionPrompt(input, mode, context)

      // 3. Generate workflow using structured output - guaranteed valid JSON
      const workflowSpec = await this.structuredModel.invoke(prompt)

      // 4. Post-process to convert plain objects to Maps (interface requirement)
      const processedSpec = this.postProcessWorkflowSpec(workflowSpec)

      // 5. Final validation for business logic (beyond schema)
      const isValid = await this.validateWorkflowSpec(processedSpec)

      return {
        success: isValid,
        mode,
        workflowSpec: processedSpec,
        confidence: 0.9, // High confidence with structured output
        extractionMethod: 'llm-based',
        metadata: new Map([
          ['extractionTime', (Date.now() - startTime).toString()],
          ['nodeCount', processedSpec.nodes.length.toString()],
          ['complexity', analysis.level]
        ])
      }

    } catch (error) {
      return {
        success: false,
        mode: 'unknown',
        confidence: 0.0,
        extractionMethod: 'llm-based',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
```

**Key implementation details**:
- **Structured Output**: `withStructuredOutput()` eliminates JSON parsing errors
- **Error Handling**: Comprehensive try/catch with detailed error information
- **Performance Tracking**: Metadata includes timing and complexity metrics
- **Post-Processing**: Convert between schema format and interface requirements

#### 1.3 Complexity Analysis Implementation

```typescript
private analyzeComplexity(input: string, context?: ProcessingContext): ComplexityAnalysis {
  const wordCount = input.split(/\s+/).length
  const lowerInput = input.toLowerCase()

  // Define indicator patterns
  const indicators = {
    multiStep: ['then', 'after', 'next', 'followed by', 'and then', 'subsequently'],
    tools: ['create', 'build', 'generate', 'implement', 'deploy', 'test', 'debug'],
    files: ['.js', '.ts', '.py', '.java', '.html', '.css', '.md'],
    complexity: ['architecture', 'system', 'integration', 'workflow', 'pipeline']
  }

  // Count indicator matches
  const counts = {
    multiStep: indicators.multiStep.filter(i => lowerInput.includes(i)).length,
    tools: indicators.tools.filter(i => lowerInput.includes(i)).length,
    files: indicators.files.filter(i => lowerInput.includes(i)).length,
    complexity: indicators.complexity.filter(i => lowerInput.includes(i)).length
  }

  // Determine complexity level using scoring algorithm
  let level: 'simple' | 'moderate' | 'complex'
  let detectedMode = 'general'

  if (wordCount < 20 && counts.multiStep <= 1 && counts.tools <= 2) {
    level = 'simple'
    detectedMode = this.detectSimpleMode(lowerInput)
  } else if (wordCount > 50 || counts.multiStep > 3 || counts.complexity > 1) {
    level = 'complex'
    detectedMode = this.detectComplexMode(lowerInput)
  } else {
    level = 'moderate'
    detectedMode = this.detectModeFromTools(lowerInput, counts.tools, counts.files)
  }

  return { level, detectedMode, indicators: counts }
}
```

### Step 2: Workflow Engine Implementation

#### 2.1 LangGraph State Annotation

```typescript
// File: workflow-state.ts
import { Annotation } from '@langchain/langgraph'

// Define workflow state structure with proper annotations
export const WorkflowStateAnnotation = Annotation.Root({
  // Input and pattern information
  input: Annotation<string>,
  patternName: Annotation<string>,
  domain: Annotation<string>,
  context: Annotation<Record<string, unknown>>,

  // Tool execution results with reducer for appending
  toolResults: Annotation<Array<{
    toolName: string
    status: 'success' | 'error' | 'timeout' | 'cancelled'
    data: unknown
    executionTime: number
    metadata: Record<string, unknown>
  }>>({
    reducer: (current, update) => current.concat(update), // Append new results
    default: () => []
  }),

  // Processing outputs
  reasoningOutput: Annotation<string>,
  output: Annotation<string>,

  // Execution metadata with merger for updates
  metadata: Annotation<{
    startTime: number
    currentStage?: string
    processingSteps: string[]
    performance: Record<string, number>
  }>({
    reducer: (current, update) => ({ ...current, ...update }), // Merge metadata
    default: () => ({
      startTime: Date.now(),
      processingSteps: [],
      performance: {}
    })
  })
})

export type LangGraphState = typeof WorkflowStateAnnotation.State
```

**Why this annotation structure**:
- **Reducers**: Enable proper state merging across nodes
- **Defaults**: Provide initial values for clean state initialization  
- **Type Safety**: Automatic TypeScript inference from annotations
- **Array Handling**: Special reducer for accumulating tool results

#### 2.2 Workflow Engine Core Implementation

```typescript
// File: langgraph-workflow-engine.ts
import { StateGraph, CompiledGraph } from '@langchain/langgraph'
import { MemorySaver } from '@langchain/langgraph'
import { WorkflowStateAnnotation, LangGraphState } from './workflow-state.js'

export class LangGraphWorkflowEngine implements IWorkflowEngine {
  private compiledWorkflows = new Map<string, CompiledGraph>()
  private memorySaver: MemorySaver
  private toolProvider?: IToolProvider

  constructor(config: LangGraphWorkflowConfig = {}) {
    this.memorySaver = new MemorySaver() // Enables workflow persistence
    this.toolProvider = config.toolProvider
  }

  createWorkflow(
    pattern: CognitivePattern,
    customizations?: WorkflowCustomization[]
  ): ExecutableWorkflow {
    // Create StateGraph with our state annotation
    const workflow = new StateGraph(WorkflowStateAnnotation)
    
    // Add standard workflow nodes
    workflow.addNode('processInput', this.processInputNode)
    workflow.addNode('enrichContext', this.enrichContextNode)
    workflow.addNode('executeTools', this.executeToolsNode)
    workflow.addNode('reasoning', this.reasoningNode)
    workflow.addNode('synthesizeResults', this.synthesizeResultsNode)
    workflow.addNode('formatOutput', this.formatOutputNode)

    // Apply pattern-specific customizations
    this.applyPatternCustomizations(workflow, pattern)

    // Set up workflow edges (execution flow)
    this.setupWorkflowFlow(workflow, pattern)

    // Set entry and exit points
    workflow.addEdge('__start__', 'processInput')
    workflow.addEdge('formatOutput', '__end__')

    // Compile with persistence enabled
    const compiled = workflow.compile({
      checkpointer: this.memorySaver // Enables state persistence
    })

    // Cache compiled workflow for reuse
    this.compiledWorkflows.set(pattern.name, compiled)

    return {
      id: `${pattern.name}-workflow-${Date.now()}`,
      pattern,
      nodes: this.extractNodes(pattern),
      edges: this.extractEdges(pattern)
    }
  }
}
```

#### 2.3 Node Implementation Patterns

```typescript
// Example node implementation showing LangGraph patterns
private processInputNode = async (state: LangGraphState) => {
  // Node functions receive and return partial state updates
  return {
    input: state.input.trim(), // Process the input
    metadata: {
      currentStage: 'processInput',
      processingSteps: [...state.metadata.processingSteps, 'input-processed']
    }
  }
}

private executeToolsNode = async (state: LangGraphState) => {
  const toolResults: any[] = []
  const toolStartTime = Date.now()
  
  try {
    if (this.toolProvider) {
      const pattern = { name: state.patternName } as CognitivePattern
      const availableTools = await this.toolProvider.getAvailableTools(pattern)
      
      // Execute tools in parallel for better performance
      const toolPromises = availableTools.slice(0, 3).map(async (tool) => {
        const toolRequest = {
          toolName: tool.name,
          parameters: new Map([
            ['input', state.input],
            ['pattern', state.patternName]
          ])
        }
        
        return await this.toolProvider!.executeTool(toolRequest)
      })
      
      const results = await Promise.allSettled(toolPromises)
      
      // Process results and handle failures gracefully
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          toolResults.push({
            toolName: result.value.toolName,
            status: result.value.status,
            data: result.value.data,
            executionTime: result.value.executionTime
          })
        } else {
          toolResults.push({
            toolName: availableTools[index].name,
            status: 'error',
            data: null,
            executionTime: Date.now() - toolStartTime,
            metadata: { error: result.reason.message }
          })
        }
      })
    }
  } catch (error) {
    // Fallback error handling
    toolResults.push({
      toolName: 'error-handler',
      status: 'error',
      data: null,
      executionTime: Date.now() - toolStartTime,
      metadata: { error: error instanceof Error ? error.message : String(error) }
    })
  }
  
  return {
    toolResults, // This will be appended to existing results due to reducer
    metadata: {
      currentStage: 'executeTools',
      processingSteps: [...state.metadata.processingSteps, 
        toolResults.length > 0 ? 'tools-executed' : 'tools-skipped'],
      performance: {
        toolExecutionTime: toolResults.reduce((sum, tr) => sum + tr.executionTime, 0),
        toolsExecuted: toolResults.length
      }
    }
  }
}
```

### Step 3: Streaming Implementation

```typescript
async *stream(
  workflow: ExecutableWorkflow,
  initialState: WorkflowState
): AsyncIterableIterator<WorkflowStreamChunk> {
  const compiled = this.compiledWorkflows.get(workflow.pattern.name)
  if (!compiled) {
    throw new Error(`Workflow not compiled for pattern: ${workflow.pattern.name}`)
  }

  const langGraphState = this.convertToLangGraphState(initialState)
  const threadId = `stream-${Date.now()}`

  try {
    // LangGraph streaming with proper configuration
    const stream = compiled.stream(langGraphState, {
      configurable: { thread_id: threadId }, // Enables persistence
      streamMode: 'values' // Stream state values, not just events
    })

    for await (const chunk of stream) {
      const currentState = this.convertFromLangGraphState(chunk)
      const nodeId = this.getCurrentNodeFromChunk(chunk)
      const isComplete = this.isStreamComplete(chunk)

      yield {
        nodeId,
        state: currentState,
        isComplete,
        timestamp: Date.now()
      }

      if (isComplete) break
    }
  } catch (error) {
    yield {
      nodeId: 'error',
      state: initialState,
      isComplete: true,
      error: {
        nodeId: 'unknown',
        error: error instanceof Error ? error : new Error(String(error)),
        retryable: false
      }
    }
  }
}
```

## 🔧 Deployment and Configuration

### Environment Setup

```bash
# Install required packages
npm install @langchain/core@^0.3.0 @langchain/ollama@^0.1.0 @langchain/langgraph@^0.2.0 zod@^3.22.0

# Ensure Ollama is running locally
ollama serve
ollama pull qwen2.5:7b
```

### Configuration File

```typescript
// workflow-config.ts
export const defaultWorkflowConfig: WorkflowExtractorConfig = {
  supportedModes: [
    { name: 'analytical', description: 'Systematic analysis and reasoning' },
    { name: 'creative', description: 'Innovation and creative solutions' },
    { name: 'problem-solving', description: 'Issue identification and resolution' }
  ],
  patternMapping: [
    ['analytical', { name: 'analytical', characteristics: ['methodical', 'structured'] }],
    ['creative', { name: 'creative', characteristics: ['innovative', 'flexible'] }],
    ['problem-solving', { name: 'problem-solving', characteristics: ['diagnostic', 'systematic'] }]
  ],
  baseUrl: 'http://localhost:11434',
  modelId: 'qwen2.5:7b',
  temperature: 0.2,
  maxTokens: 4096
}
```

## 🧪 Testing Implementation

### Unit Test Example

```typescript
// workflow-extractor.test.ts
import { HybridWorkflowExtractor } from '../workflow-extractor'
import { defaultWorkflowConfig } from '../workflow-config'

describe('HybridWorkflowExtractor', () => {
  let extractor: HybridWorkflowExtractor

  beforeEach(() => {
    extractor = new HybridWorkflowExtractor(defaultWorkflowConfig)
  })

  test('extracts simple workflow from natural language', async () => {
    const input = 'create authentication system with JWT tokens'
    const result = await extractor.extractWorkflow(input)
    
    expect(result.success).toBe(true)
    expect(result.workflowSpec).toBeDefined()
    expect(result.workflowSpec!.nodes).toHaveLength(5)
    expect(result.confidence).toBeGreaterThan(0.8)
  })

  test('validates workflow spec correctly', async () => {
    const validSpec = {
      id: 'test-workflow',
      name: 'Test Workflow',
      description: 'Test workflow for validation',
      nodes: [
        { id: 'input', name: 'Input', type: 'input', parameters: new Map() },
        { id: 'output', name: 'Output', type: 'output', parameters: new Map() }
      ],
      edges: [{ from: 'input', to: 'output' }],
      parameters: new Map()
    }
    
    const isValid = await extractor.validateWorkflowSpec(validSpec)
    expect(isValid).toBe(true)
  })
})
```

## 🚀 Performance Optimization

### Compilation Caching

```typescript
// Pre-compile workflows for better performance
async precompileWorkflows(patterns: readonly CognitivePattern[]): Promise<void> {
  console.log(`🔧 Precompiling LangGraph workflows for ${patterns.length} patterns...`)
  
  const compilationPromises = patterns.map(async (pattern) => {
    try {
      this.createWorkflow(pattern) // This caches the compiled workflow
      console.log(`✓ Compiled workflow for pattern: ${pattern.name}`)
    } catch (error) {
      console.error(`✗ Failed to compile workflow for pattern ${pattern.name}:`, error)
    }
  })

  await Promise.all(compilationPromises)
  console.log('🎯 Workflow precompilation complete')
}
```

### Memory Management

```typescript
// Clean up compiled workflows when not needed
cleanup(): void {
  this.compiledWorkflows.clear()
  this.memorySaver = new MemorySaver() // Reset persistence
}
```

This implementation guide provides all the necessary details to build a production-ready workflow system using modern AI frameworks. The key is leveraging LangChain's structured output for reliable extraction and LangGraph's StateGraph for robust execution orchestration.