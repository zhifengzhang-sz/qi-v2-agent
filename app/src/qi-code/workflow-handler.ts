/**
 * CLI Workflow Handler Implementation
 * 
 * Handles workflow execution within the CLI system
 */

import { 
  createWorkflowEngine, 
  createWorkflowExtractor,
  type IWorkflowEngine,
  type IWorkflowExtractor,
  type WorkflowState,
  type ProcessingContext 
} from '../workflow/index.js';

// ============================================================================
// Workflow Handler Interface
// ============================================================================

export interface IWorkflowHandler {
  /**
   * Execute a workflow from natural language input
   */
  executeWorkflow(input: string, context?: ProcessingContext): Promise<WorkflowExecutionResult>;
  
  /**
   * Stream workflow execution for real-time updates
   */
  streamWorkflow(input: string, context?: ProcessingContext): AsyncIterableIterator<WorkflowStreamUpdate>;
  
  /**
   * Get supported workflow patterns
   */
  getSupportedPatterns(): readonly string[];
  
  /**
   * Check if input appears to be a workflow
   */
  isWorkflowInput(input: string): Promise<boolean>;
}

export interface WorkflowExecutionResult {
  readonly success: boolean;
  readonly output: string;
  readonly executionTime: number;
  readonly pattern: string;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly error?: string;
}

export interface WorkflowStreamUpdate {
  readonly nodeId: string;
  readonly stage: string;
  readonly output: string;
  readonly isComplete: boolean;
  readonly error?: string;
}

// ============================================================================
// CLI Workflow Handler Implementation
// ============================================================================

export class CLIWorkflowHandler implements IWorkflowHandler {
  private workflowEngine: IWorkflowEngine;
  private workflowExtractor: IWorkflowExtractor;
  
  constructor() {
    this.workflowEngine = createWorkflowEngine({
      enableStreaming: true,
      maxExecutionTime: 30000
    });
    
    this.workflowExtractor = createWorkflowExtractor();
  }
  
  async executeWorkflow(
    input: string, 
    context?: ProcessingContext
  ): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    
    try {
      // 1. Extract workflow from input
      const extractionResult = await this.workflowExtractor.extractWorkflow(input, context);
      
      if (!extractionResult.success || !extractionResult.workflowSpec) {
        return {
          success: false,
          output: `Failed to extract workflow: ${extractionResult.error || 'Unknown error'}`,
          executionTime: Date.now() - startTime,
          pattern: extractionResult.pattern,
          metadata: extractionResult.metadata,
          error: extractionResult.error
        };
      }
      
      // 2. Create executable workflow
      const executableWorkflow = this.workflowEngine.createWorkflow(extractionResult.pattern);
      
      // 3. Create initial state
      const initialState: WorkflowState = {
        input,
        pattern: extractionResult.pattern,
        domain: context?.environmentContext?.get('domain') as string || 'general',
        context: context?.environmentContext || new Map(),
        toolResults: [],
        reasoningOutput: '',
        output: '',
        metadata: {
          startTime: Date.now(),
          processingSteps: [],
          performance: new Map()
        }
      };
      
      // 4. Execute workflow
      const result = await this.workflowEngine.execute(executableWorkflow, initialState);
      
      return {
        success: true,
        output: result.finalState.output,
        executionTime: Date.now() - startTime,
        pattern: extractionResult.pattern,
        metadata: new Map([
          ['extractionTime', extractionResult.metadata.get('extractionTime') || '0'],
          ['nodeCount', (extractionResult.workflowSpec.nodes.length).toString()],
          ['executionPath', result.executionPath.join(' → ')],
          ['totalTime', result.performance.totalTime.toString()],
          ['toolExecutionTime', result.performance.toolExecutionTime.toString()],
          ['reasoningTime', result.performance.reasoningTime.toString()]
        ])
      };
      
    } catch (error) {
      return {
        success: false,
        output: `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
        pattern: 'unknown',
        metadata: new Map([
          ['error', error instanceof Error ? error.message : String(error)],
          ['errorType', 'execution-failure']
        ]),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  async *streamWorkflow(
    input: string, 
    context?: ProcessingContext
  ): AsyncIterableIterator<WorkflowStreamUpdate> {
    try {
      // 1. Extract workflow
      const extractionResult = await this.workflowExtractor.extractWorkflow(input, context);
      
      if (!extractionResult.success || !extractionResult.workflowSpec) {
        yield {
          nodeId: 'extraction',
          stage: 'error',
          output: `Failed to extract workflow: ${extractionResult.error || 'Unknown error'}`,
          isComplete: true,
          error: extractionResult.error
        };
        return;
      }
      
      yield {
        nodeId: 'extraction',
        stage: 'complete',
        output: `Workflow extracted: ${extractionResult.workflowSpec.name}`,
        isComplete: false
      };
      
      // 2. Create and execute workflow
      const executableWorkflow = this.workflowEngine.createWorkflow(extractionResult.pattern);
      
      const initialState: WorkflowState = {
        input,
        pattern: extractionResult.pattern,
        domain: context?.environmentContext?.get('domain') as string || 'general',
        context: context?.environmentContext || new Map(),
        toolResults: [],
        reasoningOutput: '',
        output: '',
        metadata: {
          startTime: Date.now(),
          processingSteps: [],
          performance: new Map()
        }
      };
      
      // 3. Stream workflow execution
      for await (const chunk of this.workflowEngine.stream(executableWorkflow, initialState)) {
        yield {
          nodeId: chunk.nodeId,
          stage: chunk.state.metadata.currentStage || 'processing',
          output: chunk.state.output || chunk.state.reasoningOutput || `Processing ${chunk.nodeId}...`,
          isComplete: chunk.isComplete,
          error: chunk.error?.error.message
        };
        
        if (chunk.isComplete) {
          break;
        }
      }
      
    } catch (error) {
      yield {
        nodeId: 'stream',
        stage: 'error',
        output: `Streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        isComplete: true,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  getSupportedPatterns(): readonly string[] {
    return ['general', 'analytical', 'creative', 'problem-solving', 'informational'];
  }
  
  async isWorkflowInput(input: string): Promise<boolean> {
    try {
      const extractionResult = await this.workflowExtractor.extractWorkflow(input);
      return extractionResult.success && extractionResult.confidence > 0.6;
    } catch (error) {
      return false;
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create workflow handler with default configuration
 */
export function createWorkflowHandler(): CLIWorkflowHandler {
  return new CLIWorkflowHandler();
}

/**
 * Create workflow handler for development/testing
 */
export function createTestWorkflowHandler(): CLIWorkflowHandler {
  return new CLIWorkflowHandler();
}