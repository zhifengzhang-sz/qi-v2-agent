/**
 * @qi/workflow - Real LangGraph StateGraph Implementation
 *
 * Proper LangGraph integration using StateGraph for v-0.8.0
 * Implements actual LangGraph patterns with state management
 */

import { Annotation, StateGraph } from '@langchain/langgraph';
import { fromAsyncTryCatch } from '@qi/base';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type {
  ExecutableWorkflow,
  IWorkflowEngine,
  IWorkflowEngineConfig,
  ToolResult,
  WorkflowCondition,
  WorkflowCustomization,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeHandler,
  WorkflowNodeSpec,
  WorkflowResult,
  WorkflowSpec,
  WorkflowState,
  WorkflowStreamChunk,
  WorkflowToolResult,
} from '../interfaces/index.js';
import type { WorkflowToolExecutor } from '../services/WorkflowToolExecutor.js';

/**
 * LangGraph State Annotation
 * Defines the structure of the state that flows through the graph
 */
const WorkflowStateAnnotation = Annotation.Root({
  // Core workflow inputs/outputs
  input: Annotation<string>,
  pattern: Annotation<string>,
  domain: Annotation<string>,
  context: Annotation<Map<string, unknown>>,
  toolResults: Annotation<ToolResult[]>,
  reasoningOutput: Annotation<string>,
  output: Annotation<string>,

  // Metadata and execution tracking
  metadata: Annotation<{
    startTime: number;
    currentStage: string;
    processingSteps: string[];
    performance: Map<string, number>;
  }>,

  // LangGraph-specific state
  currentNodeId: Annotation<string>,
  executionPath: Annotation<string[]>,
  isComplete: Annotation<boolean>,
  error: Annotation<string | null>,
});

type LangGraphState = typeof WorkflowStateAnnotation.State;

/**
 * Real LangGraph Workflow Engine using StateGraph
 */
export class LangGraphWorkflowEngine implements IWorkflowEngine {
  private config: IWorkflowEngineConfig;
  private logger: SimpleLogger;
  private toolExecutor?: WorkflowToolExecutor;
  private compiledGraphs = new Map<string, any>();

  constructor(config: IWorkflowEngineConfig = {}, toolExecutor?: WorkflowToolExecutor) {
    this.config = config;
    this.toolExecutor = toolExecutor;
    this.logger = createQiLogger({
      name: 'LangGraphWorkflowEngine',
      level: 'info',
    });
  }

  createWorkflow(pattern: string, customizations?: WorkflowCustomization[]): ExecutableWorkflow {
    this.logger.info('🏗️ Creating LangGraph StateGraph workflow', undefined, {
      component: 'LangGraphWorkflowEngine',
      method: 'createWorkflow',
      pattern,
    });

    // Create the actual LangGraph StateGraph
    const graph = this.createStateGraph(pattern);

    // Store compiled graph for reuse
    this.compiledGraphs.set(pattern, graph);

    // Convert to ExecutableWorkflow format
    const nodes = this.createNodeSpecs(pattern);
    const edges = this.createEdgeSpecs(pattern);

    const executable: ExecutableWorkflow = {
      id: `langgraph-${pattern}-${Date.now()}`,
      pattern,
      nodes,
      edges,
    };

    return executable;
  }

  async execute(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    this.logger.info('▶️ Executing LangGraph StateGraph', undefined, {
      component: 'LangGraphWorkflowEngine',
      method: 'execute',
      workflowId: workflow.id,
      pattern: workflow.pattern,
    });

    try {
      // Get or create the compiled graph
      let graph = this.compiledGraphs.get(workflow.pattern);
      if (!graph) {
        graph = this.createStateGraph(workflow.pattern);
        this.compiledGraphs.set(workflow.pattern, graph);
      }

      // Convert WorkflowState to LangGraph state format
      const langGraphState: Partial<LangGraphState> = {
        input: initialState.input,
        pattern: initialState.pattern,
        domain: initialState.domain,
        context: new Map(initialState.context.entries()),
        toolResults: [...initialState.toolResults],
        reasoningOutput: initialState.reasoningOutput,
        output: initialState.output,
        metadata: {
          startTime: initialState.metadata.startTime,
          currentStage: initialState.metadata.currentStage || 'starting',
          processingSteps: [...initialState.metadata.processingSteps],
          performance: new Map(initialState.metadata.performance.entries()),
        },
        currentNodeId: 'start',
        executionPath: [],
        isComplete: false,
        error: null,
      };

      // Execute the graph with LangGraph
      const result = await graph.invoke(langGraphState);

      const totalTime = Date.now() - startTime;

      this.logger.info('✅ LangGraph workflow completed', undefined, {
        component: 'LangGraphWorkflowEngine',
        method: 'execute',
        workflowId: workflow.id,
        duration: totalTime,
        executionPath: result.executionPath,
      });

      // Convert back to WorkflowResult format
      const finalState: WorkflowState = {
        input: result.input || initialState.input,
        pattern: result.pattern || initialState.pattern,
        domain: result.domain || initialState.domain,
        context: result.context || initialState.context,
        toolResults: result.toolResults || [],
        reasoningOutput: result.reasoningOutput || '',
        output: result.output || '',
        metadata: {
          startTime: result.metadata?.startTime || startTime,
          currentStage: result.metadata?.currentStage || 'completed',
          processingSteps: result.metadata?.processingSteps || [],
          performance: result.metadata?.performance || new Map(),
        },
      };

      return {
        finalState,
        executionPath: result.executionPath || [],
        performance: {
          totalTime,
          nodeExecutionTimes: result.metadata?.performance || new Map(),
          toolExecutionTime: this.calculateToolTime(result.toolResults || []),
          reasoningTime: totalTime - this.calculateToolTime(result.toolResults || []),
        },
      };
    } catch (error) {
      const failureTime = Date.now() - startTime;

      this.logger.error('❌ LangGraph workflow execution failed', undefined, {
        component: 'LangGraphWorkflowEngine',
        method: 'execute',
        workflowId: workflow.id,
        errorMessage: error instanceof Error ? error.message : String(error),
        duration: failureTime,
      });

      return {
        finalState: {
          ...initialState,
          output: `LangGraph execution failed: ${error instanceof Error ? error.message : String(error)}`,
          reasoningOutput: 'Execution failed due to error',
        },
        executionPath: [],
        performance: {
          totalTime: failureTime,
          nodeExecutionTimes: new Map(),
          toolExecutionTime: 0,
          reasoningTime: 0,
        },
      };
    }
  }

  async *stream(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): AsyncIterableIterator<WorkflowStreamChunk> {
    this.logger.info('🌊 Starting LangGraph workflow stream', undefined, {
      component: 'LangGraphWorkflowEngine',
      method: 'stream',
      workflowId: workflow.id,
    });

    try {
      // Get or create the compiled graph
      let graph = this.compiledGraphs.get(workflow.pattern);
      if (!graph) {
        graph = this.createStateGraph(workflow.pattern);
        this.compiledGraphs.set(workflow.pattern, graph);
      }

      // Convert WorkflowState to LangGraph state format
      const langGraphState: Partial<LangGraphState> = {
        input: initialState.input,
        pattern: initialState.pattern,
        domain: initialState.domain,
        context: new Map(initialState.context.entries()),
        toolResults: [...initialState.toolResults],
        reasoningOutput: initialState.reasoningOutput,
        output: initialState.output,
        metadata: {
          startTime: initialState.metadata.startTime,
          currentStage: initialState.metadata.currentStage || 'starting',
          processingSteps: [...initialState.metadata.processingSteps],
          performance: new Map(initialState.metadata.performance.entries()),
        },
        currentNodeId: 'start',
        executionPath: [],
        isComplete: false,
        error: null,
      };

      // Stream execution with LangGraph
      for await (const chunk of graph.stream(langGraphState)) {
        const nodeId = Object.keys(chunk)[0];
        const nodeState = chunk[nodeId];

        // Convert LangGraph state back to WorkflowState
        const currentState: WorkflowState = {
          input: nodeState.input || initialState.input,
          pattern: nodeState.pattern || initialState.pattern,
          domain: nodeState.domain || initialState.domain,
          context: nodeState.context || initialState.context,
          toolResults: nodeState.toolResults || [],
          reasoningOutput: nodeState.reasoningOutput || '',
          output: nodeState.output || '',
          metadata: {
            startTime: nodeState.metadata?.startTime || initialState.metadata.startTime,
            currentStage: nodeId,
            processingSteps: nodeState.metadata?.processingSteps || [],
            performance: nodeState.metadata?.performance || new Map(),
          },
        };

        yield {
          nodeId,
          state: currentState,
          isComplete: nodeState.isComplete || false,
        };
      }
    } catch (error) {
      this.logger.error('❌ LangGraph workflow stream failed', undefined, {
        component: 'LangGraphWorkflowEngine',
        method: 'stream',
        workflowId: workflow.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      yield {
        nodeId: 'error',
        state: initialState,
        isComplete: true,
        error: {
          nodeId: 'unknown',
          error: error instanceof Error ? error : new Error(String(error)),
          retryable: false,
        },
      };
    }
  }

  async precompileWorkflows(patterns: readonly string[]): Promise<void> {
    this.logger.info('⚙️ Precompiling LangGraph workflows', undefined, {
      component: 'LangGraphWorkflowEngine',
      method: 'precompileWorkflows',
      patternCount: patterns.length,
    });

    for (const pattern of patterns) {
      try {
        const graph = this.createStateGraph(pattern);
        this.compiledGraphs.set(pattern, graph);

        this.logger.debug('✓ Compiled LangGraph for pattern', undefined, {
          component: 'LangGraphWorkflowEngine',
          method: 'precompileWorkflows',
          pattern,
        });
      } catch (error) {
        this.logger.error('✗ Failed to compile LangGraph for pattern', undefined, {
          component: 'LangGraphWorkflowEngine',
          method: 'precompileWorkflows',
          pattern,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.info('🎯 LangGraph workflow precompilation complete', undefined, {
      component: 'LangGraphWorkflowEngine',
      method: 'precompileWorkflows',
      compiledCount: this.compiledGraphs.size,
    });
  }

  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null {
    if (this.compiledGraphs.has(patternName)) {
      return this.createWorkflow(patternName);
    }
    return null;
  }

  async executeWorkflow(
    spec: WorkflowSpec,
    config: {
      sessionId: string;
      contextId: string;
      streamingEnabled?: boolean;
      checkpointingEnabled?: boolean;
      progressCallback?: (nodeId: string, progress: any) => void;
    }
  ): Promise<WorkflowResult> {
    this.logger.info('🔄 Executing workflow from specification', undefined, {
      component: 'LangGraphWorkflowEngine',
      method: 'executeWorkflow',
      workflowId: spec.id,
      sessionId: config.sessionId,
    });

    // Create executable workflow from spec
    const executable = this.createWorkflowFromSpec(spec);

    // Create initial state from spec parameters
    const initialState: WorkflowState = {
      input: (spec.parameters.get('input') as string) || '',
      pattern: spec.name,
      domain: (spec.parameters.get('domain') as string) || 'general',
      context: new Map(spec.parameters),
      toolResults: [],
      reasoningOutput: '',
      output: '',
      metadata: {
        startTime: Date.now(),
        currentStage: 'starting',
        processingSteps: [],
        performance: new Map(),
      },
    };

    return this.execute(executable, initialState);
  }

  // Private helper methods

  /**
   * Create actual LangGraph StateGraph
   */
  private createStateGraph(pattern: string) {
    const graph = new StateGraph(WorkflowStateAnnotation);

    // Add nodes with their handlers
    graph.addNode('input', this.createInputNodeHandler());
    graph.addNode('reasoning', this.createReasoningNodeHandler(pattern));
    graph.addNode('output', this.createOutputNodeHandler());

    // Define edges
    graph.addEdge('__start__', 'input' as any);
    graph.addEdge('input' as any, 'reasoning' as any);
    graph.addEdge('reasoning' as any, 'output' as any);
    graph.addEdge('output' as any, '__end__');

    // Compile the graph
    return graph.compile();
  }

  /**
   * Input node handler for LangGraph
   */
  private createInputNodeHandler() {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      this.logger.debug('🔍 Processing input node', undefined, {
        component: 'LangGraphWorkflowEngine',
        method: 'inputNode',
      });

      return {
        ...state,
        input: state.input?.trim() || '',
        currentNodeId: 'input',
        executionPath: [...(state.executionPath || []), 'input'],
        metadata: {
          ...state.metadata,
          currentStage: 'input',
          processingSteps: [...(state.metadata?.processingSteps || []), 'input-processed'],
        },
      };
    };
  }

  /**
   * Reasoning node handler for LangGraph with tool execution
   */
  private createReasoningNodeHandler(pattern: string) {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      this.logger.debug('🧠 Processing reasoning node', undefined, {
        component: 'LangGraphWorkflowEngine',
        method: 'reasoningNode',
        pattern,
      });

      let reasoning = `LangGraph StateGraph reasoning for ${pattern}: ${state.input}`;
      let toolResults: ToolResult[] = [...(state.toolResults || [])];

      // Execute tools if available and pattern requires them
      if (this.toolExecutor && this.shouldUseTools(pattern)) {
        const workflowToolResults = await this.executePatternTools(pattern, state);
        if (workflowToolResults.length > 0) {
          const newToolResults = workflowToolResults.map(this.convertToToolResult);
          toolResults = [...toolResults, ...newToolResults];
          reasoning += `\n\n🔧 Tool Results:\n${workflowToolResults
            .map(
              (tr) =>
                `- ${tr.toolName}: ${tr.success ? '✅ Success' : '❌ Failed'} (${tr.executionTime}ms)`
            )
            .join('\n')}`;
        }
      }

      return {
        ...state,
        reasoningOutput: reasoning,
        toolResults,
        currentNodeId: 'reasoning',
        executionPath: [...(state.executionPath || []), 'reasoning'],
        metadata: {
          ...state.metadata,
          currentStage: 'reasoning',
          processingSteps: [...(state.metadata?.processingSteps || []), 'reasoning-complete'],
        },
      };
    };
  }

  /**
   * Output node handler for LangGraph
   */
  private createOutputNodeHandler() {
    return async (state: LangGraphState): Promise<Partial<LangGraphState>> => {
      this.logger.debug('📤 Processing output node', undefined, {
        component: 'LangGraphWorkflowEngine',
        method: 'outputNode',
      });

      const output = `${state.reasoningOutput}\n\n✅ Processed via LangGraph StateGraph`;

      return {
        ...state,
        output,
        isComplete: true,
        currentNodeId: 'output',
        executionPath: [...(state.executionPath || []), 'output'],
        metadata: {
          ...state.metadata,
          currentStage: 'output',
          processingSteps: [...(state.metadata?.processingSteps || []), 'output-generated'],
        },
      };
    };
  }

  /**
   * Create node specifications for ExecutableWorkflow compatibility
   */
  private createNodeSpecs(pattern: string): WorkflowNode[] {
    return [
      {
        id: 'input',
        name: 'Input Processing',
        type: 'input',
        handler: async (state) => state, // Placeholder - actual logic is in StateGraph
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        type: 'reasoning',
        handler: async (state) => state, // Placeholder - actual logic is in StateGraph
      },
      {
        id: 'output',
        name: 'Output Generation',
        type: 'output',
        handler: async (state) => state, // Placeholder - actual logic is in StateGraph
      },
    ];
  }

  /**
   * Create edge specifications for ExecutableWorkflow compatibility
   */
  private createEdgeSpecs(pattern: string): WorkflowEdge[] {
    return [
      { from: 'input', to: 'reasoning' },
      { from: 'reasoning', to: 'output' },
    ];
  }

  private createWorkflowFromSpec(spec: WorkflowSpec): ExecutableWorkflow {
    return {
      id: spec.id,
      pattern: spec.name,
      nodes: this.createNodeSpecs(spec.name),
      edges: this.createEdgeSpecs(spec.name),
    };
  }

  private shouldUseTools(pattern: string): boolean {
    const toolPatterns = ['analysis', 'research', 'processing', 'data', 'file', 'system'];
    return toolPatterns.some((p) => pattern.toLowerCase().includes(p));
  }

  private async executePatternTools(
    pattern: string,
    state: LangGraphState
  ): Promise<WorkflowToolResult[]> {
    if (!this.toolExecutor) return [];

    try {
      const toolsToExecute = this.selectToolsForPattern(pattern, state);

      if (toolsToExecute.length === 0) {
        return [];
      }

      const results = await this.toolExecutor.executeToolSequence(toolsToExecute);

      if (results.tag === 'success') {
        return results.value;
      } else {
        this.logger.error('Tool execution failed in LangGraph', undefined, {
          component: 'LangGraphWorkflowEngine',
          method: 'executePatternTools',
          pattern,
          errorMessage: results.error.message,
        });
        return [];
      }
    } catch (error) {
      this.logger.error('Pattern tool execution error in LangGraph', undefined, {
        component: 'LangGraphWorkflowEngine',
        method: 'executePatternTools',
        pattern,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private selectToolsForPattern(
    pattern: string,
    state: LangGraphState
  ): Array<{
    toolName: string;
    input: Record<string, unknown>;
    nodeId: string;
    workflowId: string;
    sessionId: string;
  }> {
    if (!this.toolExecutor) return [];

    const availableTools = this.toolExecutor.getAvailableTools();
    const selectedTools: Array<{
      toolName: string;
      input: Record<string, unknown>;
      nodeId: string;
      workflowId: string;
      sessionId: string;
    }> = [];

    if (pattern.includes('file') && availableTools.includes('Read')) {
      selectedTools.push({
        toolName: 'Read',
        input: { file_path: '/tmp/sample.txt' },
        nodeId: 'reasoning',
        workflowId: state.pattern || 'unknown',
        sessionId: (state.context?.get('sessionId') as string) || 'langgraph-session',
      });
    }

    if (pattern.includes('analysis') && availableTools.includes('Grep')) {
      selectedTools.push({
        toolName: 'Grep',
        input: { pattern: state.input?.substring(0, 50) || 'search', output_mode: 'content' },
        nodeId: 'reasoning',
        workflowId: state.pattern || 'unknown',
        sessionId: (state.context?.get('sessionId') as string) || 'langgraph-session',
      });
    }

    return selectedTools;
  }

  private convertToToolResult = (workflowResult: WorkflowToolResult): ToolResult => ({
    toolName: workflowResult.toolName,
    status: workflowResult.success ? 'success' : 'error',
    data: workflowResult.output,
    executionTime: workflowResult.executionTime,
    metadata: workflowResult.metadata,
  });

  private calculateToolTime(toolResults: ToolResult[]): number {
    return toolResults.reduce((total, result) => total + result.executionTime, 0);
  }
}
