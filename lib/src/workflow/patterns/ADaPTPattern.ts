/**
 * @qi/workflow - ADaPT (As-Needed Decomposition and Planning) Pattern Implementation
 *
 * ADaPT recursively decomposes complex sub-tasks as-needed when the LLM is unable to execute them.
 * Uses logical operators (And/Or) to combine sub-tasks and adapts to both task complexity and LLM capability.
 */

import { Annotation, StateGraph } from '@langchain/langgraph';
import { fromAsyncTryCatch } from '@qi/base';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type { WorkflowToolResult } from '../interfaces/index.js';
import type { WorkflowToolExecutor } from '../services/WorkflowToolExecutor.js';

/**
 * ADaPT Task representation
 */
export interface ADaPTTask {
  id: string;
  description: string;
  complexity: 'simple' | 'medium' | 'complex';
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'decomposed';
  parent?: string;
  children: string[];
  logicalOperator?: 'And' | 'Or';
  result?: unknown;
  error?: string;
  executionTime?: number;
  decompositionLevel: number;
}

/**
 * ADaPT State that flows through the graph
 */
const ADaPTStateAnnotation = Annotation.Root({
  // Core input/output
  input: Annotation<string>,
  output: Annotation<string>,

  // ADaPT-specific state
  tasks: Annotation<Map<string, ADaPTTask>>,
  currentTaskId: Annotation<string | null>,
  maxDecompositionLevel: Annotation<number>,
  currentPhase: Annotation<'decomposing' | 'executing' | 'combining' | 'complete'>,

  // Execution tracking
  completedTasks: Annotation<string[]>,
  failedTasks: Annotation<string[]>,

  // Tool results
  toolResults: Annotation<WorkflowToolResult[]>,

  // Metadata
  metadata: Annotation<{
    startTime: number;
    pattern: string;
    sessionId: string;
    decompositionCount: number;
    totalExecutions: number;
  }>,
});

type ADaPTState = typeof ADaPTStateAnnotation.State;

/**
 * ADaPT Pattern Configuration
 */
export interface ADaPTConfig {
  maxDecompositionLevel: number;
  complexityThreshold: 'simple' | 'medium' | 'complex';
  enableAdaptiveDecomposition: boolean;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Default ADaPT configuration
 */
const DEFAULT_ADAPT_CONFIG: ADaPTConfig = {
  maxDecompositionLevel: 4,
  complexityThreshold: 'medium',
  enableAdaptiveDecomposition: true,
  maxRetries: 3,
  timeoutMs: 60000,
};

/**
 * ADaPT Pattern Implementation using LangGraph StateGraph
 */
export class ADaPTPattern {
  private logger: SimpleLogger;
  private toolExecutor?: WorkflowToolExecutor;
  private config: ADaPTConfig;
  private graph: any;

  constructor(toolExecutor?: WorkflowToolExecutor, config: Partial<ADaPTConfig> = {}) {
    this.toolExecutor = toolExecutor;
    this.config = { ...DEFAULT_ADAPT_CONFIG, ...config };
    this.logger = createQiLogger({
      name: 'ADaPTPattern',
      level: 'info',
    });

    this.graph = this.createADaPTGraph();
  }

  /**
   * Execute the ADaPT pattern
   */
  async execute(
    input: string,
    sessionId: string = 'adapt-session'
  ): Promise<{
    output: string;
    tasks: ADaPTTask[];
    completedTasks: string[];
    failedTasks: string[];
    toolResults: WorkflowToolResult[];
    performance: {
      decompositionCount: number;
      totalExecutions: number;
      totalTime: number;
    };
  }> {
    this.logger.info('🌳 Starting ADaPT pattern execution', undefined, {
      component: 'ADaPTPattern',
      method: 'execute',
      input: input.substring(0, 100),
      sessionId,
    });

    const startTime = Date.now();

    // Create initial root task
    const rootTask: ADaPTTask = {
      id: 'root',
      description: input,
      complexity: this.assessComplexity(input),
      status: 'pending',
      children: [],
      decompositionLevel: 0,
    };

    const initialState: Partial<ADaPTState> = {
      input,
      output: '',
      tasks: new Map([['root', rootTask]]),
      currentTaskId: 'root',
      maxDecompositionLevel: this.config.maxDecompositionLevel,
      currentPhase: 'decomposing',
      completedTasks: [],
      failedTasks: [],
      toolResults: [],
      metadata: {
        startTime,
        pattern: 'ADaPT',
        sessionId,
        decompositionCount: 0,
        totalExecutions: 0,
      },
    };

    const result = await this.graph.invoke(initialState);

    const totalTime = Date.now() - startTime;
    const tasks = Array.from(result.tasks?.values() || []) as ADaPTTask[];

    this.logger.info('✅ ADaPT pattern execution completed', undefined, {
      component: 'ADaPTPattern',
      method: 'execute',
      totalTasks: tasks.length,
      completedTasks: result.completedTasks?.length || 0,
      sessionId,
      totalTime,
    });

    return {
      output: result.output || 'No output generated',
      tasks,
      completedTasks: result.completedTasks || [],
      failedTasks: result.failedTasks || [],
      toolResults: result.toolResults || [],
      performance: {
        decompositionCount: result.metadata?.decompositionCount || 0,
        totalExecutions: result.metadata?.totalExecutions || 0,
        totalTime,
      },
    };
  }

  /**
   * Stream the ADaPT pattern execution
   */
  async *stream(
    input: string,
    sessionId: string = 'adapt-session'
  ): AsyncIterable<{
    phase: 'decomposing' | 'executing' | 'combining' | 'complete';
    currentTask?: ADaPTTask;
    tasks: ADaPTTask[];
    completedCount: number;
    progress: number;
  }> {
    this.logger.info('🌊 Starting ADaPT pattern stream', undefined, {
      component: 'ADaPTPattern',
      method: 'stream',
      input: input.substring(0, 100),
      sessionId,
    });

    const rootTask: ADaPTTask = {
      id: 'root',
      description: input,
      complexity: this.assessComplexity(input),
      status: 'pending',
      children: [],
      decompositionLevel: 0,
    };

    const initialState: Partial<ADaPTState> = {
      input,
      output: '',
      tasks: new Map([['root', rootTask]]),
      currentTaskId: 'root',
      maxDecompositionLevel: this.config.maxDecompositionLevel,
      currentPhase: 'decomposing',
      completedTasks: [],
      failedTasks: [],
      toolResults: [],
      metadata: {
        startTime: Date.now(),
        pattern: 'ADaPT',
        sessionId,
        decompositionCount: 0,
        totalExecutions: 0,
      },
    };

    for await (const chunk of this.graph.stream(initialState)) {
      const nodeId = Object.keys(chunk)[0];
      const state = chunk[nodeId];

      const tasks = Array.from(state.tasks?.values() || []) as ADaPTTask[];
      const currentTask = state.currentTaskId ? state.tasks?.get(state.currentTaskId) : undefined;

      yield {
        phase: state.currentPhase || 'decomposing',
        currentTask,
        tasks,
        completedCount: state.completedTasks?.length || 0,
        progress: this.calculateProgress(state),
      };

      if (state.currentPhase === 'complete') break;
    }
  }

  /**
   * Create the ADaPT StateGraph
   */
  private createADaPTGraph() {
    const graph = new StateGraph(ADaPTStateAnnotation);

    // Add ADaPT nodes
    graph.addNode('analyze', this.createAnalyzeNode());
    graph.addNode('decompose', this.createDecomposeNode());
    graph.addNode('execute', this.createExecuteNode());
    graph.addNode('combine', this.createCombineNode());
    graph.addNode('complete', this.createCompleteNode());

    // Define ADaPT flow
    graph.addEdge('__start__', 'analyze' as any);

    // Conditional edges based on task analysis
    graph.addConditionalEdges('analyze' as any, this.shouldDecompose, {
      decompose: 'decompose' as any,
      execute: 'execute' as any,
      complete: 'complete' as any,
    });

    graph.addEdge('decompose' as any, 'analyze' as any); // Loop back to analyze sub-tasks
    graph.addEdge('execute' as any, 'combine' as any);

    graph.addConditionalEdges('combine' as any, this.shouldContinue, {
      continue: 'analyze' as any,
      complete: 'complete' as any,
    });

    graph.addEdge('complete' as any, '__end__');

    return graph.compile();
  }

  /**
   * Analyze Node - Assess current task and determine next action
   */
  private createAnalyzeNode() {
    return async (state: ADaPTState): Promise<Partial<ADaPTState>> => {
      this.logger.debug('🔍 Analyzing current task', undefined, {
        component: 'ADaPTPattern',
        phase: 'analyzing',
        currentTaskId: state.currentTaskId,
      });

      const currentTask = state.currentTaskId ? state.tasks?.get(state.currentTaskId) : null;

      if (!currentTask) {
        // No current task - find next pending task
        const nextTask = this.findNextPendingTask(state.tasks || new Map());

        return {
          ...state,
          currentTaskId: nextTask?.id || null,
          currentPhase: nextTask ? 'decomposing' : 'complete',
        };
      }

      // Assess if current task needs decomposition
      const needsDecomposition = this.needsDecomposition(currentTask);
      const canExecute = this.canExecuteDirectly(currentTask);

      return {
        ...state,
        currentPhase: needsDecomposition ? 'decomposing' : canExecute ? 'executing' : 'complete',
      };
    };
  }

  /**
   * Decompose Node - Break down complex tasks into simpler sub-tasks
   */
  private createDecomposeNode() {
    return async (state: ADaPTState): Promise<Partial<ADaPTState>> => {
      this.logger.info('🔨 Decomposing task', undefined, {
        component: 'ADaPTPattern',
        phase: 'decomposing',
        currentTaskId: state.currentTaskId,
      });

      const currentTask = state.currentTaskId ? state.tasks?.get(state.currentTaskId) : null;
      if (!currentTask) {
        return state;
      }

      // Decompose the current task
      const subTasks = this.decomposeTask(currentTask);
      const updatedTasks = new Map(state.tasks);

      // Add sub-tasks to the task map
      subTasks.forEach((subTask) => {
        updatedTasks.set(subTask.id, subTask);
      });

      // Update parent task
      const updatedParentTask: ADaPTTask = {
        ...currentTask,
        status: 'decomposed',
        children: subTasks.map((t) => t.id),
      };
      updatedTasks.set(currentTask.id, updatedParentTask);

      const decompositionCount = (state.metadata?.decompositionCount || 0) + 1;

      return {
        ...state,
        tasks: updatedTasks,
        currentTaskId: subTasks[0]?.id || null, // Start with first sub-task
        metadata: {
          ...state.metadata,
          decompositionCount,
        },
      };
    };
  }

  /**
   * Execute Node - Execute a simple task
   */
  private createExecuteNode() {
    return async (state: ADaPTState): Promise<Partial<ADaPTState>> => {
      this.logger.debug('⚡ Executing task', undefined, {
        component: 'ADaPTPattern',
        phase: 'executing',
        currentTaskId: state.currentTaskId,
      });

      const currentTask = state.currentTaskId ? state.tasks?.get(state.currentTaskId) : null;
      if (!currentTask) {
        return state;
      }

      const executionResult = await this.executeTask(currentTask);
      const updatedTasks = new Map(state.tasks);

      // Update task with execution result
      const updatedTask: ADaPTTask = {
        ...currentTask,
        status: executionResult.success ? 'completed' : 'failed',
        result: executionResult.result,
        error: executionResult.error,
        executionTime: executionResult.executionTime,
      };
      updatedTasks.set(currentTask.id, updatedTask);

      const completedTasks = executionResult.success
        ? [...(state.completedTasks || []), currentTask.id]
        : state.completedTasks || [];

      const failedTasks = !executionResult.success
        ? [...(state.failedTasks || []), currentTask.id]
        : state.failedTasks || [];

      const toolResults = executionResult.toolResult
        ? [...(state.toolResults || []), executionResult.toolResult]
        : state.toolResults || [];

      const totalExecutions = (state.metadata?.totalExecutions || 0) + 1;

      return {
        ...state,
        tasks: updatedTasks,
        completedTasks,
        failedTasks,
        toolResults,
        currentPhase: 'combining',
        metadata: {
          ...state.metadata,
          totalExecutions,
        },
      };
    };
  }

  /**
   * Combine Node - Combine results from sub-tasks
   */
  private createCombineNode() {
    return async (state: ADaPTState): Promise<Partial<ADaPTState>> => {
      this.logger.debug('🔗 Combining results', undefined, {
        component: 'ADaPTPattern',
        phase: 'combining',
        currentTaskId: state.currentTaskId,
      });

      const currentTask = state.currentTaskId ? state.tasks?.get(state.currentTaskId) : null;
      if (!currentTask) {
        return { ...state, currentPhase: 'complete' };
      }

      // Check if parent task can be marked as complete
      const parentTask = currentTask.parent ? state.tasks?.get(currentTask.parent) : null;
      if (parentTask) {
        const siblingResults = this.checkSiblingCompletion(parentTask, state.tasks || new Map());

        if (siblingResults.canCombine) {
          // Combine results and update parent
          const combinedResult = this.combineSiblingResults(parentTask, state.tasks || new Map());
          const updatedTasks = new Map(state.tasks);

          const updatedParentTask: ADaPTTask = {
            ...parentTask,
            status: combinedResult.success ? 'completed' : 'failed',
            result: combinedResult.result,
            error: combinedResult.error,
          };
          updatedTasks.set(parentTask.id, updatedParentTask);

          return {
            ...state,
            tasks: updatedTasks,
            currentTaskId: parentTask.id,
            completedTasks: combinedResult.success
              ? [...(state.completedTasks || []), parentTask.id]
              : state.completedTasks,
            failedTasks: !combinedResult.success
              ? [...(state.failedTasks || []), parentTask.id]
              : state.failedTasks,
          };
        }
      }

      // Find next pending task
      const nextTask = this.findNextPendingTask(state.tasks || new Map());

      return {
        ...state,
        currentTaskId: nextTask?.id || null,
        currentPhase: nextTask ? 'decomposing' : 'complete',
      };
    };
  }

  /**
   * Complete Node - Generate final output
   */
  private createCompleteNode() {
    return async (state: ADaPTState): Promise<Partial<ADaPTState>> => {
      this.logger.info('🎯 Completing ADaPT execution', undefined, {
        component: 'ADaPTPattern',
        phase: 'completing',
      });

      const output = this.generateFinalOutput(state);

      return {
        ...state,
        output,
        currentPhase: 'complete',
      };
    };
  }

  /**
   * Conditional function to determine if decomposition is needed
   */
  private shouldDecompose = (state: ADaPTState): string => {
    const currentTask = state.currentTaskId ? state.tasks?.get(state.currentTaskId) : null;

    if (!currentTask) {
      return 'complete';
    }

    if (this.needsDecomposition(currentTask)) {
      return 'decompose';
    } else if (this.canExecuteDirectly(currentTask)) {
      return 'execute';
    } else {
      return 'complete';
    }
  };

  /**
   * Conditional function to determine if execution should continue
   */
  private shouldContinue = (state: ADaPTState): string => {
    const nextTask = this.findNextPendingTask(state.tasks || new Map());
    return nextTask ? 'continue' : 'complete';
  };

  /**
   * Assess task complexity
   */
  private assessComplexity(description: string): 'simple' | 'medium' | 'complex' {
    const words = description.split(' ').length;
    const hasMultipleActions = description.includes(' and ') || description.includes(' then ');
    const hasComplexTerms = ['analyze', 'optimize', 'design', 'implement'].some((term) =>
      description.toLowerCase().includes(term)
    );

    if (words <= 5 && !hasMultipleActions && !hasComplexTerms) {
      return 'simple';
    } else if (words <= 15 && (!hasMultipleActions || !hasComplexTerms)) {
      return 'medium';
    } else {
      return 'complex';
    }
  }

  /**
   * Determine if task needs decomposition
   */
  private needsDecomposition(task: ADaPTTask): boolean {
    return (
      task.complexity === 'complex' &&
      task.decompositionLevel < this.config.maxDecompositionLevel &&
      task.status === 'pending'
    );
  }

  /**
   * Determine if task can be executed directly
   */
  private canExecuteDirectly(task: ADaPTTask): boolean {
    return (
      task.complexity === 'simple' || task.decompositionLevel >= this.config.maxDecompositionLevel
    );
  }

  /**
   * Decompose a complex task into sub-tasks
   */
  private decomposeTask(task: ADaPTTask): ADaPTTask[] {
    const subTasks: ADaPTTask[] = [];
    const description = task.description.toLowerCase();

    // Simple decomposition logic - in real implementation, this would use an LLM
    if (description.includes(' and ')) {
      // Split on "and" - sequential execution (And operator)
      const parts = task.description.split(' and ');
      parts.forEach((part, i) => {
        subTasks.push({
          id: `${task.id}-and-${i}`,
          description: part.trim(),
          complexity: this.assessComplexity(part.trim()),
          status: 'pending',
          parent: task.id,
          children: [],
          logicalOperator: 'And',
          decompositionLevel: task.decompositionLevel + 1,
        });
      });
    } else if (description.includes(' or ')) {
      // Split on "or" - alternative execution (Or operator)
      const parts = task.description.split(' or ');
      parts.forEach((part, i) => {
        subTasks.push({
          id: `${task.id}-or-${i}`,
          description: part.trim(),
          complexity: this.assessComplexity(part.trim()),
          status: 'pending',
          parent: task.id,
          children: [],
          logicalOperator: 'Or',
          decompositionLevel: task.decompositionLevel + 1,
        });
      });
    } else {
      // Default decomposition - break into logical steps
      const steps = [
        `Analyze: ${task.description}`,
        `Plan approach for: ${task.description}`,
        `Execute: ${task.description}`,
        `Verify results of: ${task.description}`,
      ];

      steps.forEach((step, i) => {
        subTasks.push({
          id: `${task.id}-step-${i}`,
          description: step,
          complexity: 'simple',
          status: 'pending',
          parent: task.id,
          children: [],
          logicalOperator: 'And',
          decompositionLevel: task.decompositionLevel + 1,
        });
      });
    }

    return subTasks;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: ADaPTTask): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    executionTime: number;
    toolResult?: WorkflowToolResult;
  }> {
    const startTime = Date.now();

    const executionResult = await fromAsyncTryCatch(
      async (): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
        executionTime: number;
        toolResult?: WorkflowToolResult;
      }> => {
        const description = task.description.toLowerCase();
        const availableTools = this.toolExecutor?.getAvailableTools() || [];

        // Determine if this should use a tool
        if (description.includes('file') && availableTools.includes('Read')) {
          const result = await this.toolExecutor!.executeTool({
            toolName: 'Read',
            input: { file_path: '/tmp/sample.txt' },
            nodeId: 'adapt-execute',
            workflowId: `adapt-${task.id}`,
            sessionId: 'adapt-session',
          });

          const executionTime = Date.now() - startTime;

          if (result.tag === 'success') {
            return {
              success: true,
              result: result.value.output,
              executionTime,
              toolResult: result.value,
            };
          } else {
            return {
              success: false,
              error: result.error.message,
              executionTime,
            };
          }
        } else {
          // Simple reasoning task
          const executionTime = Date.now() - startTime;
          return {
            success: true,
            result: `Completed task: ${task.description}`,
            executionTime,
          };
        }
      },
      (error: unknown) => ({
        code: 'ADAPT_TASK_EXECUTION_ERROR',
        message: `Task execution error: ${error instanceof Error ? error.message : String(error)}`,
        category: 'SYSTEM' as const,
        context: { taskId: task.id, description: task.description },
      })
    );

    if (executionResult.tag === 'success') {
      return executionResult.value;
    } else {
      return {
        success: false,
        error: executionResult.error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Find the next pending task to execute
   */
  private findNextPendingTask(tasks: Map<string, ADaPTTask>): ADaPTTask | null {
    const pendingTasks = Array.from(tasks.values()).filter((task) => task.status === 'pending');

    // Prioritize by decomposition level (simpler tasks first)
    pendingTasks.sort((a, b) => b.decompositionLevel - a.decompositionLevel);

    return pendingTasks[0] || null;
  }

  /**
   * Check if all sibling tasks are complete
   */
  private checkSiblingCompletion(
    parentTask: ADaPTTask,
    tasks: Map<string, ADaPTTask>
  ): {
    canCombine: boolean;
    completedCount: number;
    totalCount: number;
  } {
    const children = parentTask.children.map((id) => tasks.get(id)).filter(Boolean) as ADaPTTask[];
    const completedChildren = children.filter(
      (task) => task.status === 'completed' || task.status === 'failed'
    );

    const logicalOperator = children[0]?.logicalOperator || 'And';

    if (logicalOperator === 'Or') {
      // For Or operator, we can combine if any child succeeded
      const anySucceeded = children.some((child) => child.status === 'completed');
      return {
        canCombine: anySucceeded || completedChildren.length === children.length,
        completedCount: completedChildren.length,
        totalCount: children.length,
      };
    } else {
      // For And operator, all children must be completed
      return {
        canCombine: completedChildren.length === children.length,
        completedCount: completedChildren.length,
        totalCount: children.length,
      };
    }
  }

  /**
   * Combine results from sibling tasks
   */
  private combineSiblingResults(
    parentTask: ADaPTTask,
    tasks: Map<string, ADaPTTask>
  ): {
    success: boolean;
    result: unknown;
    error?: string;
  } {
    const children = parentTask.children.map((id) => tasks.get(id)).filter(Boolean) as ADaPTTask[];
    const logicalOperator = children[0]?.logicalOperator || 'And';

    if (logicalOperator === 'Or') {
      // For Or operator, use the first successful result
      const successfulChild = children.find((child) => child.status === 'completed');
      if (successfulChild) {
        return {
          success: true,
          result: successfulChild.result,
        };
      } else {
        return {
          success: false,
          result: null,
          error: 'All alternative tasks failed',
        };
      }
    } else {
      // For And operator, combine all results
      const allSucceeded = children.every((child) => child.status === 'completed');
      const results = children.map((child) => child.result);

      return {
        success: allSucceeded,
        result: allSucceeded ? results : null,
        error: allSucceeded ? undefined : 'Some sequential tasks failed',
      };
    }
  }

  /**
   * Generate final output
   */
  private generateFinalOutput(state: ADaPTState): string {
    const tasks = Array.from(state.tasks?.values() || []);
    const rootTask = tasks.find((task) => task.id === 'root');

    let output = `ADaPT Pattern Execution Summary for: "${state.input}"\n\n`;

    output += `Task Hierarchy:\n`;
    output += `Total Tasks: ${tasks.length}\n`;
    output += `Completed: ${state.completedTasks?.length || 0}\n`;
    output += `Failed: ${state.failedTasks?.length || 0}\n`;
    output += `Decomposition Levels: ${Math.max(...tasks.map((t) => t.decompositionLevel))}\n`;
    output += `Total Decompositions: ${state.metadata?.decompositionCount || 0}\n\n`;

    if (rootTask?.status === 'completed') {
      output += `Final Result: ${JSON.stringify(rootTask.result)}\n`;
    } else {
      output += `Final Result: Task execution incomplete or failed.\n`;
    }

    return output;
  }

  /**
   * Calculate execution progress
   */
  private calculateProgress(state: ADaPTState): number {
    const totalTasks = state.tasks?.size || 1;
    const completedTasks = state.completedTasks?.length || 0;
    const failedTasks = state.failedTasks?.length || 0;

    return (completedTasks + failedTasks) / totalTasks;
  }
}
