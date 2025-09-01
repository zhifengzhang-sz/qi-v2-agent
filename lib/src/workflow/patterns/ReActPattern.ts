/**
 * @qi/workflow - ReAct (Reasoning and Acting) Pattern Implementation
 *
 * ReAct combines chain-of-thought reasoning with action execution in an interleaved manner.
 * Creates a continuous loop of Think-Act-Observe-Adapt for dynamic workflow execution.
 */

import { Annotation, StateGraph } from '@langchain/langgraph';
import { fromAsyncTryCatch, match } from '@qi/base';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type { WorkflowToolResult } from '../interfaces/index.js';
import type { WorkflowToolExecutor } from '../services/WorkflowToolExecutor.js';

/**
 * ReAct State that flows through the graph
 */
const ReActStateAnnotation = Annotation.Root({
  // Core input/output
  input: Annotation<string>,
  output: Annotation<string>,

  // ReAct-specific state
  currentStep: Annotation<number>,
  maxSteps: Annotation<number>,
  thought: Annotation<string>,
  action: Annotation<string>,
  actionInput: Annotation<Record<string, unknown>>,
  observation: Annotation<string>,
  isComplete: Annotation<boolean>,

  // History tracking
  thoughtHistory: Annotation<string[]>,
  actionHistory: Annotation<
    Array<{ action: string; input: Record<string, unknown>; observation: string }>
  >,

  // Tool results
  toolResults: Annotation<WorkflowToolResult[]>,

  // Metadata
  metadata: Annotation<{
    startTime: number;
    pattern: string;
    sessionId: string;
  }>,
});

type ReActState = typeof ReActStateAnnotation.State;

/**
 * ReAct Pattern Configuration
 */
export interface ReActConfig {
  maxSteps: number;
  thinkingPrompt: string;
  actionPrompt: string;
  observationPrompt: string;
  completionCriteria: (state: ReActState) => boolean;
}

/**
 * Default ReAct configuration
 */
const DEFAULT_REACT_CONFIG: ReActConfig = {
  maxSteps: 10,
  thinkingPrompt: 'Think: What should I do next to solve this problem?',
  actionPrompt: 'Action: What action should I take based on my thinking?',
  observationPrompt: 'Observation: What did I learn from this action?',
  completionCriteria: (state) =>
    state.isComplete ||
    state.currentStep >= state.maxSteps ||
    state.thought.toLowerCase().includes('final answer') ||
    state.output.length > 0,
};

/**
 * ReAct Pattern Implementation using LangGraph StateGraph
 */
export class ReActPattern {
  private logger: SimpleLogger;
  private toolExecutor?: WorkflowToolExecutor;
  private config: ReActConfig;
  private graph: any;

  constructor(toolExecutor?: WorkflowToolExecutor, config: Partial<ReActConfig> = {}) {
    this.toolExecutor = toolExecutor;
    this.config = { ...DEFAULT_REACT_CONFIG, ...config };
    this.logger = createQiLogger({
      name: 'ReActPattern',
      level: 'info',
    });

    this.graph = this.createReActGraph();
  }

  /**
   * Execute the ReAct pattern
   */
  async execute(
    input: string,
    sessionId: string = 'react-session',
    maxSteps?: number
  ): Promise<{
    output: string;
    thoughtHistory: string[];
    actionHistory: Array<{ action: string; input: Record<string, unknown>; observation: string }>;
    toolResults: WorkflowToolResult[];
    totalSteps: number;
  }> {
    this.logger.info('🔄 Starting ReAct pattern execution', undefined, {
      component: 'ReActPattern',
      method: 'execute',
      input: input.substring(0, 100),
      sessionId,
    });

    const initialState: Partial<ReActState> = {
      input,
      output: '',
      currentStep: 0,
      maxSteps: maxSteps || this.config.maxSteps,
      thought: '',
      action: '',
      actionInput: {},
      observation: '',
      isComplete: false,
      thoughtHistory: [],
      actionHistory: [],
      toolResults: [],
      metadata: {
        startTime: Date.now(),
        pattern: 'ReAct',
        sessionId,
      },
    };

    const result = await this.graph.invoke(initialState);

    this.logger.info('✅ ReAct pattern execution completed', undefined, {
      component: 'ReActPattern',
      method: 'execute',
      totalSteps: result.currentStep,
      sessionId,
      executionTime: Date.now() - result.metadata.startTime,
    });

    return {
      output: result.output || 'No output generated',
      thoughtHistory: result.thoughtHistory || [],
      actionHistory: result.actionHistory || [],
      toolResults: result.toolResults || [],
      totalSteps: result.currentStep || 0,
    };
  }

  /**
   * Stream the ReAct pattern execution
   */
  async *stream(
    input: string,
    sessionId: string = 'react-session',
    maxSteps?: number
  ): AsyncIterable<{
    step: number;
    thought: string;
    action: string;
    observation: string;
    isComplete: boolean;
  }> {
    this.logger.info('🌊 Starting ReAct pattern stream', undefined, {
      component: 'ReActPattern',
      method: 'stream',
      input: input.substring(0, 100),
      sessionId,
    });

    const initialState: Partial<ReActState> = {
      input,
      output: '',
      currentStep: 0,
      maxSteps: maxSteps || this.config.maxSteps,
      thought: '',
      action: '',
      actionInput: {},
      observation: '',
      isComplete: false,
      thoughtHistory: [],
      actionHistory: [],
      toolResults: [],
      metadata: {
        startTime: Date.now(),
        pattern: 'ReAct',
        sessionId,
      },
    };

    for await (const chunk of this.graph.stream(initialState)) {
      const nodeId = Object.keys(chunk)[0];
      const state = chunk[nodeId];

      yield {
        step: state.currentStep || 0,
        thought: state.thought || '',
        action: state.action || '',
        observation: state.observation || '',
        isComplete: state.isComplete || false,
      };

      if (state.isComplete) break;
    }
  }

  /**
   * Create the ReAct StateGraph
   */
  private createReActGraph() {
    const graph = new StateGraph(ReActStateAnnotation);

    // Add ReAct nodes
    graph.addNode('think', this.createThinkNode());
    graph.addNode('act', this.createActNode());
    graph.addNode('observe', this.createObserveNode());
    graph.addNode('decide', this.createDecideNode());

    // Define ReAct loop edges
    graph.addEdge('__start__', 'think' as any);
    graph.addEdge('think' as any, 'act' as any);
    graph.addEdge('act' as any, 'observe' as any);

    // Conditional edge: decide whether to continue loop or end
    graph.addConditionalEdges('observe' as any, this.shouldContinue, {
      continue: 'decide' as any,
      finish: '__end__',
    });
    graph.addEdge('decide' as any, 'think' as any);

    return graph.compile();
  }

  /**
   * Think node - Generate reasoning thoughts
   */
  private createThinkNode() {
    return async (state: ReActState): Promise<Partial<ReActState>> => {
      this.logger.debug('🤔 Think step', undefined, {
        component: 'ReActPattern',
        step: state.currentStep,
      });

      // Simple thinking logic - in real implementation, this would use an LLM
      const thought = this.generateThought(state);

      return {
        ...state,
        thought,
        thoughtHistory: [...(state.thoughtHistory || []), thought],
        currentStep: (state.currentStep || 0) + 1,
      };
    };
  }

  /**
   * Act node - Determine and plan action
   */
  private createActNode() {
    return async (state: ReActState): Promise<Partial<ReActState>> => {
      this.logger.debug('⚡ Act step', undefined, {
        component: 'ReActPattern',
        step: state.currentStep,
      });

      const { action, actionInput } = this.generateAction(state);

      return {
        ...state,
        action,
        actionInput,
      };
    };
  }

  /**
   * Observe node - Execute action and gather observations
   */
  private createObserveNode() {
    return async (state: ReActState): Promise<Partial<ReActState>> => {
      this.logger.debug('👁️ Observe step', undefined, {
        component: 'ReActPattern',
        step: state.currentStep,
      });

      const observation = await this.executeActionAndObserve(state);

      // Record the action-observation pair
      const actionRecord = {
        action: state.action || '',
        input: state.actionInput || {},
        observation,
      };

      return {
        ...state,
        observation,
        actionHistory: [...(state.actionHistory || []), actionRecord],
      };
    };
  }

  /**
   * Decide node - Evaluate if task is complete or needs continuation
   */
  private createDecideNode() {
    return async (state: ReActState): Promise<Partial<ReActState>> => {
      this.logger.debug('🎯 Decide step', undefined, {
        component: 'ReActPattern',
        step: state.currentStep,
      });

      const isComplete = this.config.completionCriteria(state) || this.evaluateCompletion(state);

      return {
        ...state,
        isComplete,
        output: isComplete ? this.generateFinalOutput(state) : state.output,
      };
    };
  }

  /**
   * Conditional function to determine if loop should continue
   */
  private shouldContinue = (state: ReActState): string => {
    if (this.config.completionCriteria(state)) {
      return 'finish';
    }

    if ((state.currentStep || 0) >= (state.maxSteps || 10)) {
      return 'finish';
    }

    return 'continue';
  };

  /**
   * Generate thought based on current state
   */
  private generateThought(state: ReActState): string {
    const step = state.currentStep || 0;
    const input = state.input || '';
    const lastObservation = state.observation || '';

    if (step === 1) {
      return `I need to solve: "${input}". Let me think about the best approach.`;
    } else {
      return `Based on my previous observation: "${lastObservation}", I should consider what to do next.`;
    }
  }

  /**
   * Generate action based on thought
   */
  private generateAction(state: ReActState): {
    action: string;
    actionInput: Record<string, unknown>;
  } {
    const thought = state.thought || '';
    const availableTools = this.toolExecutor?.getAvailableTools() || [];

    // Simple action selection logic - in real implementation, this would use an LLM
    if (thought.includes('file') && availableTools.includes('Read')) {
      return {
        action: 'Read',
        actionInput: { file_path: '/tmp/sample.txt' },
      };
    } else if (thought.includes('search') && availableTools.includes('Grep')) {
      return {
        action: 'Grep',
        actionInput: {
          pattern: state.input?.substring(0, 50) || 'search',
          output_mode: 'content',
        },
      };
    } else {
      return {
        action: 'reason',
        actionInput: { reasoning: thought },
      };
    }
  }

  /**
   * Execute action and return observation
   */
  private async executeActionAndObserve(state: ReActState): Promise<string> {
    const action = state.action || '';
    const actionInput = state.actionInput || {};

    // If it's a tool action and we have a tool executor
    if (this.toolExecutor?.isToolAvailable(action)) {
      const toolExecutionResult = await fromAsyncTryCatch(
        async (): Promise<string> => {
          if (!this.toolExecutor) {
            throw new Error('Tool executor not available');
          }
          const result = await this.toolExecutor.executeTool({
            toolName: action,
            input: actionInput,
            nodeId: 'react-observe',
            workflowId: `react-${state.metadata?.sessionId}`,
            sessionId: state.metadata?.sessionId || 'react-session',
          });

          return match(
            (toolResult) => {
              // Update tool results
              const _updatedResults = [...(state.toolResults || []), toolResult];
              // Note: This is a side effect, ideally we'd return this in state update
              return `Tool ${action} executed successfully: ${JSON.stringify(toolResult.output)}`;
            },
            (error) => `Tool ${action} failed: ${error.message}`,
            result
          );
        },
        (error: unknown) => ({
          code: 'REACT_TOOL_EXECUTION_ERROR',
          message: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
          category: 'SYSTEM' as const,
          context: { action, actionInput },
        })
      );

      if (toolExecutionResult.tag === 'success') {
        return toolExecutionResult.value;
      } else {
        return `Tool execution error: ${toolExecutionResult.error.message}`;
      }
    } else {
      // Non-tool action - just reason about it
      return `Reasoning action "${action}" with input: ${JSON.stringify(actionInput)}`;
    }
  }

  /**
   * Evaluate if the task should be considered complete
   */
  private evaluateCompletion(state: ReActState): boolean {
    const thought = (state.thought || '').toLowerCase();
    const observation = (state.observation || '').toLowerCase();

    // Simple completion detection
    return (
      thought.includes('done') ||
      thought.includes('finished') ||
      thought.includes('complete') ||
      observation.includes('success') ||
      (state.actionHistory?.length || 0) >= 3
    ); // Limit actions for demo
  }

  /**
   * Generate final output based on the ReAct history
   */
  private generateFinalOutput(state: ReActState): string {
    const thoughtHistory = state.thoughtHistory || [];
    const actionHistory = state.actionHistory || [];

    let output = `ReAct Pattern Execution Summary for: "${state.input}"\n\n`;

    output += `Total Steps: ${state.currentStep}\n\n`;

    output += `Thought Process:\n`;
    thoughtHistory.forEach((thought, i) => {
      output += `${i + 1}. ${thought}\n`;
    });

    output += `\nActions Taken:\n`;
    actionHistory.forEach((action, i) => {
      output += `${i + 1}. Action: ${action.action}\n`;
      output += `   Input: ${JSON.stringify(action.input)}\n`;
      output += `   Result: ${action.observation}\n\n`;
    });

    output += `Final Result: Task completed through ${thoughtHistory.length} reasoning steps and ${actionHistory.length} actions.`;

    return output;
  }
}
