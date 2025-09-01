/**
 * @qi/workflow - Qi Workflow Engine Implementation
 *
 * Simplified workflow engine adapted for app layer without LangGraph dependency
 */

import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type {
  ExecutableWorkflow,
  IWorkflowEngine,
  IWorkflowEngineConfig,
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
} from '../interfaces/index.js';

export class QiWorkflowEngine implements IWorkflowEngine {
  private config: IWorkflowEngineConfig;
  private compiledWorkflows = new Map<string, ExecutableWorkflow>();
  private logger: SimpleLogger;

  constructor(config: IWorkflowEngineConfig = {}) {
    this.config = config;
    this.logger = createQiLogger({
      name: 'QiWorkflowEngine',
      level: 'info',
    });
  }

  createWorkflow(pattern: string, customizations?: WorkflowCustomization[]): ExecutableWorkflow {
    // Create base workflow nodes
    const nodes = this.createBaseNodes(pattern);

    // Create base workflow edges
    const edges = this.createBaseEdges(pattern);

    // Apply customizations if provided
    const finalNodes = [...nodes];
    const finalEdges = [...edges];

    if (customizations) {
      for (const customization of customizations) {
        switch (customization.type) {
          case 'add-node':
            if (customization.nodeDefinition) {
              finalNodes.push(customization.nodeDefinition);
            }
            break;
          case 'add-edge':
            if (customization.edgeDefinition) {
              finalEdges.push(customization.edgeDefinition);
            }
            break;
        }
      }
    }

    const executable: ExecutableWorkflow = {
      id: `${pattern}-workflow-${Date.now()}`,
      pattern,
      nodes: finalNodes,
      edges: finalEdges,
    };

    // Cache compiled workflow
    this.compiledWorkflows.set(pattern, executable);

    return executable;
  }

  async execute(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    let currentState = { ...initialState };
    const executionPath: string[] = [];
    const nodeExecutionTimes = new Map<string, number>();

    try {
      // Execute workflow nodes in topological order
      const sortedNodes = this.topologicalSort(workflow.nodes, workflow.edges);

      for (const node of sortedNodes) {
        const nodeStartTime = Date.now();
        executionPath.push(node.id);

        // Execute node handler
        currentState = await node.handler(currentState);

        // Update metadata
        currentState = {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            currentStage: node.id,
            processingSteps: [...currentState.metadata.processingSteps, node.id],
          },
        };

        const nodeExecutionTime = Date.now() - nodeStartTime;
        nodeExecutionTimes.set(node.id, nodeExecutionTime);
      }

      const totalTime = Date.now() - startTime;
      const toolExecutionTime = currentState.toolResults.reduce(
        (sum, result) => sum + result.executionTime,
        0
      );
      const reasoningTime = nodeExecutionTimes.get('reasoning') || 0;

      return {
        finalState: currentState,
        executionPath,
        performance: {
          totalTime,
          nodeExecutionTimes,
          toolExecutionTime,
          reasoningTime,
        },
      };
    } catch (error) {
      // Convert error to proper WorkflowResult failure format
      const failureTime = Date.now() - startTime;
      const failureResult: WorkflowResult = {
        finalState: {
          ...currentState,
          output: `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
          reasoningOutput: 'Execution failed due to error',
        },
        executionPath,
        performance: {
          totalTime: failureTime,
          nodeExecutionTimes: nodeExecutionTimes,
          toolExecutionTime: 0,
          reasoningTime: 0,
        },
      };
      return failureResult;
    }
  }

  async *stream(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): AsyncIterableIterator<WorkflowStreamChunk> {
    let currentState = { ...initialState };
    const sortedNodes = this.topologicalSort(workflow.nodes, workflow.edges);

    try {
      for (const node of sortedNodes) {
        // Yield before node execution
        yield {
          nodeId: node.id,
          state: currentState,
          isComplete: false,
        };

        // Execute node
        currentState = await node.handler(currentState);

        // Update metadata
        currentState = {
          ...currentState,
          metadata: {
            ...currentState.metadata,
            currentStage: node.id,
            processingSteps: [...currentState.metadata.processingSteps, node.id],
          },
        };

        // Yield after node execution
        yield {
          nodeId: node.id,
          state: currentState,
          isComplete: false,
        };
      }

      // Final completion chunk
      yield {
        nodeId: 'complete',
        state: currentState,
        isComplete: true,
      };
    } catch (error) {
      yield {
        nodeId: 'error',
        state: currentState,
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
    this.logger.info('🔧 Starting workflow precompilation', undefined, {
      component: 'QiWorkflowEngine',
      method: 'precompileWorkflows',
      patternCount: patterns.length,
      patterns: patterns.slice(0, 5), // Log first 5 patterns to avoid spam
    });

    for (const pattern of patterns) {
      try {
        this.createWorkflow(pattern);
        this.logger.debug('✓ Compiled workflow for pattern', undefined, {
          component: 'QiWorkflowEngine',
          method: 'precompileWorkflows',
          pattern,
          operationType: 'workflow_compilation',
        });
      } catch (error) {
        this.logger.error('✗ Failed to compile workflow for pattern', undefined, {
          component: 'QiWorkflowEngine',
          method: 'precompileWorkflows',
          pattern,
          errorMessage: error instanceof Error ? error.message : String(error),
          operationType: 'workflow_compilation_error',
        });
      }
    }

    this.logger.info('🎯 Workflow precompilation complete', undefined, {
      component: 'QiWorkflowEngine',
      method: 'precompileWorkflows',
      compiledCount: this.compiledWorkflows.size,
      operationType: 'precompilation_complete',
    });
  }

  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null {
    return this.compiledWorkflows.get(patternName) || null;
  }

  // Private methods

  private createBaseNodes(pattern: string): WorkflowNode[] {
    const baseNodes: WorkflowNode[] = [
      {
        id: 'processInput',
        name: 'Process Input',
        type: 'input',
        handler: this.createProcessInputHandler(),
      },
      {
        id: 'enrichContext',
        name: 'Enrich Context',
        type: 'processing',
        handler: this.createEnrichContextHandler(),
      },
      {
        id: 'executeTools',
        name: 'Execute Tools',
        type: 'tool',
        handler: this.createExecuteToolsHandler(),
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        type: 'reasoning',
        handler: this.createReasoningHandler(pattern),
      },
      {
        id: 'synthesizeResults',
        name: 'Synthesize Results',
        type: 'processing',
        handler: this.createSynthesizeResultsHandler(),
      },
      {
        id: 'formatOutput',
        name: 'Format Output',
        type: 'output',
        handler: this.createFormatOutputHandler(pattern),
      },
    ];

    return baseNodes;
  }

  private createBaseEdges(_pattern: string): WorkflowEdge[] {
    return [
      { from: 'processInput', to: 'enrichContext' },
      { from: 'enrichContext', to: 'executeTools' },
      { from: 'executeTools', to: 'reasoning' },
      { from: 'reasoning', to: 'synthesizeResults' },
      { from: 'synthesizeResults', to: 'formatOutput' },
    ];
  }

  private createProcessInputHandler(): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      return {
        ...state,
        input: state.input.trim(),
        metadata: {
          ...state.metadata,
          currentStage: 'processInput',
          processingSteps: [...state.metadata.processingSteps, 'input-processed'],
        },
      };
    };
  }

  private createEnrichContextHandler(): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      const enrichedContext = new Map(state.context);
      enrichedContext.set('pattern', state.pattern);
      enrichedContext.set('timestamp', new Date().toISOString());
      enrichedContext.set('domain', state.domain);
      enrichedContext.set('workflowId', `${state.pattern}-${Date.now()}`);

      return {
        ...state,
        context: enrichedContext,
        metadata: {
          ...state.metadata,
          currentStage: 'enrichContext',
          processingSteps: [...state.metadata.processingSteps, 'context-enriched'],
        },
      };
    };
  }

  private createExecuteToolsHandler(): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      // For now, simulate tool execution - will be integrated with real tools later
      const mockToolResults = [
        {
          toolName: 'mock-tool',
          status: 'success' as const,
          data: `Mock tool executed for: ${state.input}`,
          executionTime: 100,
          metadata: new Map([['pattern', state.pattern]]),
        },
      ];

      return {
        ...state,
        toolResults: mockToolResults,
        metadata: {
          ...state.metadata,
          currentStage: 'executeTools',
          processingSteps: [...state.metadata.processingSteps, 'tools-executed'],
        },
      };
    };
  }

  private createReasoningHandler(pattern: string): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      let reasoning = '';
      const hasTools = state.toolResults.length > 0;
      const toolInfo = hasTools
        ? `Tools used: ${state.toolResults.map((tr) => tr.toolName).join(', ')}`
        : 'No tools available';

      switch (pattern) {
        case 'analytical':
          reasoning = `Systematic analysis of: ${state.input}\nContext keys: ${Array.from(state.context.keys()).join(', ')}\n${toolInfo}`;
          break;
        case 'creative':
          reasoning = `Creative synthesis for: ${state.input}\nGenerating innovative solutions.`;
          break;
        case 'problem-solving':
          reasoning = `Problem diagnosis: ${state.input}\nAnalyzing issues and solutions.`;
          break;
        case 'informational':
          reasoning = `Knowledge synthesis for: ${state.input}\nStructuring educational content.`;
          break;
        default:
          reasoning = `Processing ${pattern} pattern for: ${state.input}\n${toolInfo}`;
      }

      return {
        ...state,
        reasoningOutput: reasoning,
        metadata: {
          ...state.metadata,
          currentStage: 'reasoning',
          processingSteps: [...state.metadata.processingSteps, 'reasoning-complete'],
        },
      };
    };
  }

  private createSynthesizeResultsHandler(): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      let synthesis = state.reasoningOutput;

      if (state.toolResults.length > 0) {
        synthesis += '\n\n🔧 Tool Results:\n';
        synthesis += state.toolResults
          .map((result) => `• ${result.toolName}: ${result.status} (${result.executionTime}ms)`)
          .join('\n');
      }

      // Add context insights
      const contextKeys = Array.from(state.context.keys()).filter(
        (key) => !['pattern', 'timestamp', 'domain', 'workflowId'].includes(key)
      );

      if (contextKeys.length > 0) {
        synthesis += '\n\n📋 Context Insights:\n';
        synthesis += contextKeys.map((key) => `• ${key}: ${state.context.get(key)}`).join('\n');
      }

      return {
        ...state,
        output: synthesis,
        metadata: {
          ...state.metadata,
          currentStage: 'synthesizeResults',
          processingSteps: [...state.metadata.processingSteps, 'results-synthesized'],
        },
      };
    };
  }

  private createFormatOutputHandler(pattern: string): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      const patternIcon = this.getPatternIcon(pattern);
      const formattedOutput = `${patternIcon} [${pattern.toUpperCase()}]\n\n${state.output}`;

      return {
        ...state,
        output: formattedOutput,
        metadata: {
          ...state.metadata,
          currentStage: 'formatOutput',
          processingSteps: [...state.metadata.processingSteps, 'output-formatted'],
        },
      };
    };
  }

  private topologicalSort(
    nodes: readonly WorkflowNode[],
    edges: readonly WorkflowEdge[]
  ): WorkflowNode[] {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjList.set(node.id, []);
    }

    // Build graph
    for (const edge of edges) {
      adjList.get(edge.from)?.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    const result: WorkflowNode[] = [];

    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodeMap.get(nodeId);
      if (node) {
        result.push(node);
      }

      for (const neighbor of adjList.get(nodeId) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    return result;
  }

  private getPatternIcon(pattern: string): string {
    const icons: Record<string, string> = {
      analytical: '📊',
      creative: '🎨',
      informational: '📚',
      'problem-solving': '🔧',
      conversational: '💬',
    };
    return icons[pattern] || '🤖';
  }

  /**
   * Execute workflow from specification with configuration
   */
  async executeWorkflow(
    spec: WorkflowSpec,
    _config: {
      sessionId: string;
      contextId: string;
      streamingEnabled?: boolean;
      checkpointingEnabled?: boolean;
      progressCallback?: (nodeId: string, progress: any) => void;
    }
  ): Promise<WorkflowResult> {
    // Create executable workflow from spec
    const executableWorkflow: ExecutableWorkflow = {
      id: spec.id,
      pattern: spec.name,
      nodes: spec.nodes.map((node: WorkflowNodeSpec) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        handler: this.createNodeHandlerFromSpec(node),
      })),
      edges: spec.edges.map((edge: any) => ({
        from: edge.from,
        to: edge.to,
        condition: edge.condition ? this.createConditionFromSpec(edge.condition) : undefined,
      })),
    };

    // Create initial state
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

    // Execute the workflow
    return this.execute(executableWorkflow, initialState);
  }

  private createNodeHandlerFromSpec(nodeSpec: WorkflowNodeSpec): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      // Simple handler that simulates execution based on node type
      const result = { ...state };

      switch (nodeSpec.type) {
        case 'reasoning':
          result.reasoningOutput = `Reasoning completed for ${nodeSpec.name}`;
          break;
        case 'tool':
          result.toolResults = [
            ...state.toolResults,
            {
              toolName: nodeSpec.name,
              status: 'success' as const,
              data: `Tool ${nodeSpec.name} executed successfully`,
              executionTime: 100,
              metadata: new Map([['nodeId', nodeSpec.id]]),
            },
          ];
          break;
        case 'output':
          result.output = `Final output from ${nodeSpec.name}`;
          break;
      }

      return result;
    };
  }

  private createConditionFromSpec(conditionSpec: any): WorkflowCondition {
    return (state: WorkflowState): boolean => {
      // Simple condition evaluation
      switch (conditionSpec.type) {
        case 'always':
          return true;
        case 'success':
          return !state.output.includes('error');
        case 'error':
          return state.output.includes('error');
        default:
          return true;
      }
    };
  }
}
