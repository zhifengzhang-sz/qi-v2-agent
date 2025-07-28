// LangGraph StateGraph Workflow Engine Implementation
//
// Modern 2025 implementation using LangGraph StateGraph for robust workflow orchestration
// Provides state management, persistence, streaming, and complex workflow patterns

import { StateGraph, CompiledGraph, Annotation, START, END } from '@langchain/langgraph';
import { MemorySaver } from '@langchain/langgraph';
import type { 
  IWorkflowEngine,
  CognitivePattern,
  ExecutableWorkflow,
  WorkflowState,
  WorkflowResult,
  WorkflowStreamChunk,
  WorkflowCustomization,
  WorkflowNode,
  WorkflowEdge,
  ToolResult
} from '../core/interfaces.js';

// Proper LangGraph State Annotation following the documented API patterns
const WorkflowStateAnnotation = Annotation.Root({
  input: Annotation<string>,
  patternName: Annotation<string>,
  domain: Annotation<string>,
  context: Annotation<Record<string, unknown>>,
  toolResults: Annotation<Array<{
    toolName: string;
    status: 'success' | 'error' | 'timeout' | 'cancelled';
    data: unknown;
    executionTime: number;
    metadata: Record<string, unknown>;
  }>>({
    reducer: (current, update) => current.concat(update),
    default: () => []
  }),
  reasoning: Annotation<string>,
  output: Annotation<string>,
  metadata: Annotation<{
    startTime: number;
    currentStage?: string;
    processingSteps: string[];
    performance: Record<string, number>;
  }>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      startTime: Date.now(),
      processingSteps: [],
      performance: {}
    })
  })
});

type LangGraphState = typeof WorkflowStateAnnotation.State;

export class LangGraphWorkflowEngine implements IWorkflowEngine {
  private compiledWorkflows = new Map<string, any>();
  private memorySaver: MemorySaver;

  constructor(config: LangGraphWorkflowConfig = {}) {
    this.memorySaver = new MemorySaver();
  }

  createWorkflow(
    pattern: CognitivePattern,
    customizations?: WorkflowCustomization[]
  ): ExecutableWorkflow {
    // Create LangGraph StateGraph with proper state annotation
    const workflow = new StateGraph(WorkflowStateAnnotation);
    
    // Add standard workflow nodes
    workflow.addNode('processInput', this.processInputNode);
    workflow.addNode('enrichContext', this.enrichContextNode);
    workflow.addNode('executeTools', this.executeToolsNode);
    workflow.addNode('reasoning', this.reasoningNode);
    workflow.addNode('synthesizeResults', this.synthesizeResultsNode);
    workflow.addNode('formatOutput', this.formatOutputNode);

    // Apply pattern-specific customizations
    this.applyPatternCustomizations(workflow, pattern);

    // Apply additional customizations if provided
    if (customizations) {
      this.applyWorkflowCustomizations(workflow, customizations);
    }

    // Set up workflow flow
    this.setupWorkflowFlow(workflow, pattern);

    // Set entry and finish points via edges
    (workflow as any).addEdge('__start__', 'processInput');
    (workflow as any).addEdge('formatOutput', '__end__');

    // Compile the workflow with persistence
    const compiled = workflow.compile({
      checkpointer: this.memorySaver
    });

    // Create executable workflow representation
    const executable: ExecutableWorkflow = {
      id: `${pattern.name}-workflow-${Date.now()}`,
      pattern,
      nodes: this.extractNodes(pattern),
      edges: this.extractEdges(pattern)
    };

    // Cache compiled workflow
    this.compiledWorkflows.set(pattern.name, compiled);

    return executable;
  }

  async execute(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): Promise<WorkflowResult> {
    const compiled = this.compiledWorkflows.get(workflow.pattern.name);
    if (!compiled) {
      throw new Error(`Workflow not compiled for pattern: ${workflow.pattern.name}`);
    }

    const startTime = Date.now();
    const langGraphState = this.convertToLangGraphState(initialState);

    try {
      const result = await compiled.invoke(langGraphState, {
        configurable: { thread_id: `execution-${Date.now()}` }
      });
      
      const finalState = this.convertFromLangGraphState(result);
      const executionPath = this.extractExecutionPath(result);

      return {
        finalState,
        executionPath,
        performance: {
          totalTime: Date.now() - startTime,
          nodeExecutionTimes: new Map([['total', Date.now() - startTime]]),
          toolExecutionTime: finalState.toolResults.reduce((sum, tr) => sum + tr.executionTime, 0),
          reasoningTime: result.metadata?.reasoningTime || 0
        }
      };
    } catch (error) {
      throw new Error(`Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async *stream(
    workflow: ExecutableWorkflow,
    initialState: WorkflowState
  ): AsyncIterableIterator<WorkflowStreamChunk> {
    const compiled = this.compiledWorkflows.get(workflow.pattern.name);
    if (!compiled) {
      throw new Error(`Workflow not compiled for pattern: ${workflow.pattern.name}`);
    }

    const langGraphState = this.convertToLangGraphState(initialState);
    const threadId = `stream-${Date.now()}`;

    try {
      const stream = compiled.stream(langGraphState, {
        configurable: { thread_id: threadId },
        streamMode: 'values'
      });

      for await (const chunk of stream) {
        const currentState = this.convertFromLangGraphState(chunk);
        const nodeId = this.getCurrentNodeFromChunk(chunk);
        const isComplete = this.isStreamComplete(chunk);

        yield {
          nodeId,
          state: currentState,
          isComplete
        };

        if (isComplete) break;
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
      };
    }
  }

  async precompileWorkflows(patterns: readonly CognitivePattern[]): Promise<void> {
    console.log(`🔧 Precompiling LangGraph workflows for ${patterns.length} patterns...`);
    
    const compilationPromises = patterns.map(async (pattern) => {
      try {
        this.createWorkflow(pattern);
        console.log(`✓ Compiled LangGraph workflow for pattern: ${pattern.name}`);
      } catch (error) {
        console.error(`✗ Failed to compile workflow for pattern ${pattern.name}:`, error);
      }
    });

    await Promise.all(compilationPromises);
    console.log('🎯 LangGraph workflow precompilation complete');
  }

  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null {
    const compiled = this.compiledWorkflows.get(patternName);
    return compiled ? {
      id: `${patternName}-workflow`,
      pattern: { name: patternName } as CognitivePattern,
      nodes: this.extractNodes({ name: patternName } as CognitivePattern),
      edges: this.extractEdges({ name: patternName } as CognitivePattern)
    } : null;
  }

  // =============================================================================
  // State Conversion - Interface boundary conversion only
  // =============================================================================

  // =============================================================================
  // Node Handlers - Core workflow processing steps
  // =============================================================================

  private processInputNode = async (state: LangGraphState) => {
    return {
      input: state.input.trim(),
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'processInput',
        processingSteps: [...state.metadata.processingSteps, 'input-processed'],
        performance: state.metadata.performance
      }
    };
  };

  private enrichContextNode = async (state: LangGraphState) => {
    return {
      context: {
        ...state.context,
        pattern: state.patternName,
        timestamp: new Date().toISOString(),
        domain: state.domain,
        workflowId: `${state.patternName}-${Date.now()}`
      },
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'enrichContext',
        processingSteps: [...state.metadata.processingSteps, 'context-enriched'],
        performance: state.metadata.performance
      }
    };
  };

  private executeToolsNode = async (state: LangGraphState) => {
    const newToolResult = {
      toolName: `${state.patternName}-tool`,
      status: 'success' as const,
      data: `Tool execution for ${state.patternName} pattern`,
      executionTime: 100,
      metadata: { pattern: state.patternName }
    };
    
    return {
      toolResults: [newToolResult],
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'executeTools',
        processingSteps: [...state.metadata.processingSteps, 'tools-executed'],
        performance: {
          ...state.metadata.performance,
          toolExecutionTime: newToolResult.executionTime
        }
      }
    };
  };

  private reasoningNode = async (state: LangGraphState) => {
    const reasoningStartTime = Date.now();
    
    // Pattern-specific reasoning
    let reasoning = '';
    switch (state.patternName) {
      case 'analytical':
        reasoning = `Systematic analysis of: ${state.input}\nContext keys: ${Object.keys(state.context).join(', ')}\nTools used: ${state.toolResults.map(tr => tr.toolName).join(', ')}`;
        break;
      case 'creative':
        reasoning = `Creative synthesis for: ${state.input}\nGenerating innovative solutions based on available context and tools.`;
        break;
      case 'problem-solving':
        reasoning = `Problem diagnosis: ${state.input}\nAnalyzing issues and formulating solutions.`;
        break;
      case 'informational':
        reasoning = `Knowledge synthesis for: ${state.input}\nStructuring educational content for clear understanding.`;
        break;
      default:
        reasoning = `Processing ${state.patternName} pattern for: ${state.input}`;
    }
    
    const reasoningTime = Date.now() - reasoningStartTime;
    
    return {
      reasoning,
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'reasoning',
        processingSteps: [...state.metadata.processingSteps, 'reasoning-complete'],
        performance: {
          ...state.metadata.performance,
          reasoningTime
        }
      }
    };
  };

  private synthesizeResultsNode = async (state: LangGraphState) => {
    // Combine reasoning with tool results
    let synthesis = state.reasoning;
    
    if (state.toolResults.length > 0) {
      synthesis += '\n\n🔧 Tool Results:\n';
      synthesis += state.toolResults.map(result => 
        `• ${result.toolName}: ${result.status} (${result.executionTime}ms)`
      ).join('\n');
    }

    // Add context insights
    const contextKeys = Object.keys(state.context).filter(key => 
      !['pattern', 'timestamp', 'domain', 'workflowId'].includes(key)
    );
    
    if (contextKeys.length > 0) {
      synthesis += '\n\n📋 Context Insights:\n';
      synthesis += contextKeys.map(key => `• ${key}: ${state.context[key]}`).join('\n');
    }
    
    return {
      output: synthesis,
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'synthesizeResults',
        processingSteps: [...state.metadata.processingSteps, 'results-synthesized'],
        performance: state.metadata.performance
      }
    };
  };

  private formatOutputNode = async (state: LangGraphState) => {
    const patternIcon = this.getPatternIcon(state.patternName);
    const formattedOutput = `${patternIcon} [${state.patternName.toUpperCase()}]\n\n${state.output}`;
    
    return {
      output: formattedOutput,
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'formatOutput',
        processingSteps: [...state.metadata.processingSteps, 'output-formatted'],
        performance: {
          ...state.metadata.performance,
          totalTime: Date.now() - state.metadata.startTime
        }
      }
    };
  };

  // =============================================================================
  // Pattern-Specific Customizations
  // =============================================================================

  private applyPatternCustomizations(workflow: any, pattern: CognitivePattern): void {
    switch (pattern.name) {
      case 'analytical':
        // Add sequential thinking for analytical pattern
        workflow.addNode('sequentialThinking', this.sequentialThinkingNode);
        break;
        
      case 'creative':
        // Add ideation step for creative pattern
        workflow.addNode('ideation', this.ideationNode);
        break;
        
      case 'problem-solving':
        // Add diagnostic step for problem-solving
        workflow.addNode('diagnostics', this.diagnosticsNode);
        break;
        
      default:
        // Standard flow for other patterns
        break;
    }
  }

  private setupWorkflowFlow(workflow: any, pattern: CognitivePattern): void {
    // Base flow
    workflow.addEdge('processInput', 'enrichContext');
    
    // Pattern-specific flow
    switch (pattern.name) {
      case 'analytical':
        workflow.addEdge('enrichContext', 'sequentialThinking');
        workflow.addEdge('sequentialThinking', 'executeTools');
        break;
        
      case 'creative':
        workflow.addEdge('enrichContext', 'ideation');
        workflow.addEdge('ideation', 'executeTools');
        break;
        
      case 'problem-solving':
        workflow.addEdge('enrichContext', 'diagnostics');
        workflow.addEdge('diagnostics', 'executeTools');
        break;
        
      default:
        workflow.addEdge('enrichContext', 'executeTools');
    }
    
    // Common flow
    workflow.addEdge('executeTools', 'reasoning');
    workflow.addEdge('reasoning', 'synthesizeResults');
    workflow.addEdge('synthesizeResults', 'formatOutput');
  }

  // =============================================================================
  // Specialized Node Handlers
  // =============================================================================

  private sequentialThinkingNode = async (state: LangGraphState) => {
    const thinking = `🧠 Sequential Analysis:\n1. Problem decomposition\n2. Context evaluation\n3. Solution methodology\nInput: ${state.input}`;
    
    return {
      context: {
        ...state.context,
        sequentialThinking: thinking
      },
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'sequentialThinking',
        processingSteps: [...state.metadata.processingSteps, 'sequential-thinking-applied'],
        performance: state.metadata.performance
      }
    };
  };

  private ideationNode = async (state: LangGraphState) => {
    const ideas = `💡 Ideation Phase:\n• Creative exploration of: ${state.input}\n• Innovation opportunities\n• Implementation approaches`;
    
    return {
      context: {
        ...state.context,
        ideation: ideas
      },
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'ideation',
        processingSteps: [...state.metadata.processingSteps, 'ideation-complete'],
        performance: state.metadata.performance
      }
    };
  };

  private diagnosticsNode = async (state: LangGraphState) => {
    const diagnostics = `🔍 Diagnostic Analysis:\n• Issue identification: ${state.input}\n• Root cause analysis\n• Solution pathways`;
    
    return {
      context: {
        ...state.context,
        diagnostics: diagnostics
      },
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: 'diagnostics',
        processingSteps: [...state.metadata.processingSteps, 'diagnostics-complete'],
        performance: state.metadata.performance
      }
    };
  };

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private applyWorkflowCustomizations(
    workflow: any,
    customizations: WorkflowCustomization[]
  ): void {
    for (const customization of customizations) {
      switch (customization.type) {
        case 'add-node':
          if (customization.nodeDefinition) {
            workflow.addNode(customization.nodeDefinition.id, async (state: any) => {
              const workflowState = this.convertFromLangGraphState(state);
              const newState = await customization.nodeDefinition!.handler(workflowState);
              return this.convertToLangGraphState(newState);
            });
          }
          break;
          
        case 'add-edge':
          if (customization.edgeDefinition) {
            workflow.addEdge(
              customization.edgeDefinition.from,
              customization.edgeDefinition.to
            );
          }
          break;
      }
    }
  }

  private convertToLangGraphState(state: WorkflowState): LangGraphState {
    return {
      input: state.input,
      patternName: state.pattern.name,
      domain: state.domain,
      context: Object.fromEntries(state.context),
      toolResults: state.toolResults.map(tr => ({
        toolName: tr.toolName,
        status: tr.status,
        data: tr.data,
        executionTime: tr.executionTime,
        metadata: Object.fromEntries(tr.metadata || new Map())
      })),
      reasoning: state.reasoning,
      output: state.output,
      metadata: {
        startTime: state.metadata.startTime,
        currentStage: state.metadata.currentStage,
        processingSteps: [...state.metadata.processingSteps],
        performance: Object.fromEntries(state.metadata.performance)
      }
    };
  }

  private convertFromLangGraphState(state: LangGraphState): WorkflowState {
    return {
      input: state.input,
      pattern: { name: state.patternName } as CognitivePattern,
      domain: state.domain,
      context: new Map(Object.entries(state.context || {})),
      toolResults: (state.toolResults || []).map(tr => ({
        toolName: tr.toolName,
        status: tr.status,
        data: tr.data,
        executionTime: tr.executionTime,
        metadata: new Map(Object.entries(tr.metadata || {}))
      })),
      reasoning: state.reasoning || '',
      output: state.output || '',
      metadata: {
        startTime: state.metadata?.startTime || Date.now(),
        currentStage: state.metadata?.currentStage,
        processingSteps: state.metadata?.processingSteps || [],
        performance: new Map(Object.entries(state.metadata?.performance || {}))
      }
    };
  }

  private getCurrentNodeFromChunk(chunk: any): string {
    // Extract current node from LangGraph chunk
    return chunk.__priv_stream_writer?.name || 'unknown';
  }

  private isStreamComplete(chunk: any): boolean {
    // Determine if stream is complete
    return chunk.output !== undefined;
  }

  private extractExecutionPath(result: any): readonly string[] {
    // Extract execution path from result metadata
    return result.metadata?.processingSteps || [];
  }

  private extractNodes(pattern: CognitivePattern): readonly WorkflowNode[] {
    // Return standard node definitions
    const baseNodes: WorkflowNode[] = [
      {
        id: 'processInput',
        name: 'Process Input',
        type: 'input',
        handler: async (state) => state
      },
      {
        id: 'enrichContext',
        name: 'Enrich Context',
        type: 'processing',
        handler: async (state) => state
      },
      {
        id: 'executeTools',
        name: 'Execute Tools',
        type: 'tool',
        handler: async (state) => state
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        type: 'reasoning',
        handler: async (state) => state
      },
      {
        id: 'synthesizeResults',
        name: 'Synthesize Results',
        type: 'processing',
        handler: async (state) => state
      },
      {
        id: 'formatOutput',
        name: 'Format Output',
        type: 'output',
        handler: async (state) => state
      }
    ];

    // Add pattern-specific nodes
    switch (pattern.name) {
      case 'analytical':
        baseNodes.splice(2, 0, {
          id: 'sequentialThinking',
          name: 'Sequential Thinking',
          type: 'processing',
          handler: async (state) => state
        });
        break;
      case 'creative':
        baseNodes.splice(2, 0, {
          id: 'ideation',
          name: 'Ideation',
          type: 'processing',
          handler: async (state) => state
        });
        break;
      case 'problem-solving':
        baseNodes.splice(2, 0, {
          id: 'diagnostics',
          name: 'Diagnostics',
          type: 'processing',
          handler: async (state) => state
        });
        break;
    }

    return baseNodes;
  }

  private extractEdges(pattern: CognitivePattern): readonly WorkflowEdge[] {
    const baseEdges: WorkflowEdge[] = [
      { from: 'processInput', to: 'enrichContext' },
      { from: 'executeTools', to: 'reasoning' },
      { from: 'reasoning', to: 'synthesizeResults' },
      { from: 'synthesizeResults', to: 'formatOutput' }
    ];

    // Add pattern-specific edges
    switch (pattern.name) {
      case 'analytical':
        baseEdges.push(
          { from: 'enrichContext', to: 'sequentialThinking' },
          { from: 'sequentialThinking', to: 'executeTools' }
        );
        break;
      case 'creative':
        baseEdges.push(
          { from: 'enrichContext', to: 'ideation' },
          { from: 'ideation', to: 'executeTools' }
        );
        break;
      case 'problem-solving':
        baseEdges.push(
          { from: 'enrichContext', to: 'diagnostics' },
          { from: 'diagnostics', to: 'executeTools' }
        );
        break;
      default:
        baseEdges.push({ from: 'enrichContext', to: 'executeTools' });
    }

    return baseEdges;
  }

  private async addDomainContext(
    context: Map<string, unknown>,
    pattern: CognitivePattern,
    input: string
  ): Promise<void> {
    // Add domain-specific context based on pattern
    context.set('patternCharacteristics', pattern.characteristics);
    context.set('inputLength', input.length);
    context.set('processingMode', 'langgraph-stateful');
  }

  private getPatternIcon(patternName: string): string {
    const icons: Record<string, string> = {
      analytical: '📊',
      creative: '🎨',
      informational: '📚',
      'problem-solving': '🔧',
      conversational: '💬'
    };
    return icons[patternName] || '🤖';
  }

}

export interface LangGraphWorkflowConfig {
  enableCheckpointing?: boolean;
  maxExecutionTime?: number;
  enableStreaming?: boolean;
  persistenceStore?: 'memory' | 'file' | 'database';
}