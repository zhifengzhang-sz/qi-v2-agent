/**
 * @qi/workflow - ReWOO (Reasoning Without Observations) Pattern Implementation
 *
 * ReWOO generates a complete plan upfront, then executes all actions, and finally
 * solves based on collected evidence. This reduces token consumption and improves efficiency.
 *
 * Architecture: Planner -> Worker -> Solver
 */

import { Annotation, StateGraph } from '@langchain/langgraph';
import { fromAsyncTryCatch } from '@qi/base';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type { WorkflowToolResult } from '../interfaces/index.js';
import type { WorkflowToolExecutor } from '../services/WorkflowToolExecutor.js';

/**
 * ReWOO Plan Step
 */
export interface ReWOOPlanStep {
  id: string;
  action: string;
  input: Record<string, unknown>;
  description: string;
  dependencies: string[]; // IDs of steps this depends on
}

/**
 * ReWOO Evidence Entry
 */
export interface ReWOOEvidence {
  stepId: string;
  action: string;
  input: Record<string, unknown>;
  result: unknown;
  success: boolean;
  executionTime: number;
}

/**
 * ReWOO State that flows through the graph
 */
const ReWOOStateAnnotation = Annotation.Root({
  // Core input/output
  input: Annotation<string>,
  output: Annotation<string>,

  // ReWOO-specific state
  plan: Annotation<ReWOOPlanStep[]>,
  evidence: Annotation<ReWOOEvidence[]>,
  currentPhase: Annotation<'planning' | 'working' | 'solving' | 'complete'>,

  // Tool results
  toolResults: Annotation<WorkflowToolResult[]>,

  // Metadata
  metadata: Annotation<{
    startTime: number;
    pattern: string;
    sessionId: string;
    planningTime: number;
    workingTime: number;
    solvingTime: number;
  }>,
});

type ReWOOState = typeof ReWOOStateAnnotation.State;

/**
 * ReWOO Pattern Configuration
 */
export interface ReWOOConfig {
  maxPlanSteps: number;
  planningPrompt: string;
  solvingPrompt: string;
  enableParallelExecution: boolean;
  timeoutMs: number;
}

/**
 * Default ReWOO configuration
 */
const DEFAULT_REWOO_CONFIG: ReWOOConfig = {
  maxPlanSteps: 8,
  planningPrompt: 'Create a step-by-step plan to solve this problem efficiently',
  solvingPrompt: 'Based on the collected evidence, provide the final solution',
  enableParallelExecution: true,
  timeoutMs: 30000,
};

/**
 * ReWOO Pattern Implementation using LangGraph StateGraph
 */
export class ReWOOPattern {
  private logger: SimpleLogger;
  private toolExecutor?: WorkflowToolExecutor;
  private config: ReWOOConfig;
  private graph: any;

  constructor(toolExecutor?: WorkflowToolExecutor, config: Partial<ReWOOConfig> = {}) {
    this.toolExecutor = toolExecutor;
    this.config = { ...DEFAULT_REWOO_CONFIG, ...config };
    this.logger = createQiLogger({
      name: 'ReWOOPattern',
      level: 'info',
    });

    this.graph = this.createReWOOGraph();
  }

  /**
   * Execute the ReWOO pattern
   */
  async execute(
    input: string,
    sessionId: string = 'rewoo-session'
  ): Promise<{
    output: string;
    plan: ReWOOPlanStep[];
    evidence: ReWOOEvidence[];
    toolResults: WorkflowToolResult[];
    performance: {
      planningTime: number;
      workingTime: number;
      solvingTime: number;
      totalTime: number;
    };
  }> {
    this.logger.info('🗺️ Starting ReWOO pattern execution', undefined, {
      component: 'ReWOOPattern',
      method: 'execute',
      input: input.substring(0, 100),
      sessionId,
    });

    const startTime = Date.now();
    const initialState: Partial<ReWOOState> = {
      input,
      output: '',
      plan: [],
      evidence: [],
      currentPhase: 'planning',
      toolResults: [],
      metadata: {
        startTime,
        pattern: 'ReWOO',
        sessionId,
        planningTime: 0,
        workingTime: 0,
        solvingTime: 0,
      },
    };

    const result = await this.graph.invoke(initialState);

    const totalTime = Date.now() - startTime;

    this.logger.info('✅ ReWOO pattern execution completed', undefined, {
      component: 'ReWOOPattern',
      method: 'execute',
      planSteps: result.plan?.length || 0,
      evidenceCount: result.evidence?.length || 0,
      sessionId,
      totalTime,
    });

    return {
      output: result.output || 'No output generated',
      plan: result.plan || [],
      evidence: result.evidence || [],
      toolResults: result.toolResults || [],
      performance: {
        planningTime: result.metadata?.planningTime || 0,
        workingTime: result.metadata?.workingTime || 0,
        solvingTime: result.metadata?.solvingTime || 0,
        totalTime,
      },
    };
  }

  /**
   * Stream the ReWOO pattern execution
   */
  async *stream(
    input: string,
    sessionId: string = 'rewoo-session'
  ): AsyncIterable<{
    phase: 'planning' | 'working' | 'solving' | 'complete';
    plan?: ReWOOPlanStep[];
    evidence?: ReWOOEvidence[];
    currentStep?: string;
    progress?: number;
  }> {
    this.logger.info('🌊 Starting ReWOO pattern stream', undefined, {
      component: 'ReWOOPattern',
      method: 'stream',
      input: input.substring(0, 100),
      sessionId,
    });

    const initialState: Partial<ReWOOState> = {
      input,
      output: '',
      plan: [],
      evidence: [],
      currentPhase: 'planning',
      toolResults: [],
      metadata: {
        startTime: Date.now(),
        pattern: 'ReWOO',
        sessionId,
        planningTime: 0,
        workingTime: 0,
        solvingTime: 0,
      },
    };

    for await (const chunk of this.graph.stream(initialState)) {
      const nodeId = Object.keys(chunk)[0];
      const state = chunk[nodeId];

      yield {
        phase: state.currentPhase || 'planning',
        plan: state.plan,
        evidence: state.evidence,
        currentStep: nodeId,
        progress: this.calculateProgress(state),
      };

      if (state.currentPhase === 'complete') break;
    }
  }

  /**
   * Create the ReWOO StateGraph
   */
  private createReWOOGraph() {
    const graph = new StateGraph(ReWOOStateAnnotation);

    // Add ReWOO nodes: Planner -> Worker -> Solver
    graph.addNode('planner', this.createPlannerNode());
    graph.addNode('worker', this.createWorkerNode());
    graph.addNode('solver', this.createSolverNode());

    // Define ReWOO sequential edges
    graph.addEdge('__start__', 'planner' as any);
    graph.addEdge('planner' as any, 'worker' as any);
    graph.addEdge('worker' as any, 'solver' as any);
    graph.addEdge('solver' as any, '__end__');

    return graph.compile();
  }

  /**
   * Planner Node - Generate complete execution plan upfront
   */
  private createPlannerNode() {
    return async (state: ReWOOState): Promise<Partial<ReWOOState>> => {
      const planningStart = Date.now();

      this.logger.info('📋 Planning phase', undefined, {
        component: 'ReWOOPattern',
        phase: 'planning',
      });

      // Generate the plan based on input
      const plan = this.generatePlan(state.input || '');

      const planningTime = Date.now() - planningStart;

      return {
        ...state,
        plan,
        currentPhase: 'working',
        metadata: {
          ...state.metadata,
          planningTime,
        },
      };
    };
  }

  /**
   * Worker Node - Execute all planned actions and collect evidence
   */
  private createWorkerNode() {
    return async (state: ReWOOState): Promise<Partial<ReWOOState>> => {
      const workingStart = Date.now();

      this.logger.info('⚙️ Working phase', undefined, {
        component: 'ReWOOPattern',
        phase: 'working',
        planSteps: state.plan?.length || 0,
      });

      // Execute all planned steps and collect evidence
      const { evidence, toolResults } = await this.executePlan(state.plan || []);

      const workingTime = Date.now() - workingStart;

      return {
        ...state,
        evidence,
        toolResults: [...(state.toolResults || []), ...toolResults],
        currentPhase: 'solving',
        metadata: {
          ...state.metadata,
          workingTime,
        },
      };
    };
  }

  /**
   * Solver Node - Synthesize evidence into final solution
   */
  private createSolverNode() {
    return async (state: ReWOOState): Promise<Partial<ReWOOState>> => {
      const solvingStart = Date.now();

      this.logger.info('🎯 Solving phase', undefined, {
        component: 'ReWOOPattern',
        phase: 'solving',
        evidenceCount: state.evidence?.length || 0,
      });

      // Generate final solution based on collected evidence
      const output = this.synthesizeSolution(state.input || '', state.evidence || []);

      const solvingTime = Date.now() - solvingStart;

      return {
        ...state,
        output,
        currentPhase: 'complete',
        metadata: {
          ...state.metadata,
          solvingTime,
        },
      };
    };
  }

  /**
   * Generate execution plan based on input
   */
  private generatePlan(input: string): ReWOOPlanStep[] {
    const plan: ReWOOPlanStep[] = [];
    const availableTools = this.toolExecutor?.getAvailableTools() || [];

    // Simple plan generation logic - in real implementation, this would use an LLM
    if (input.toLowerCase().includes('file') && availableTools.includes('Read')) {
      plan.push({
        id: 'step-1',
        action: 'Read',
        input: { file_path: '/tmp/sample.txt' },
        description: 'Read file to understand the content',
        dependencies: [],
      });
    }

    if (input.toLowerCase().includes('search') || input.toLowerCase().includes('find')) {
      plan.push({
        id: 'step-2',
        action: 'Grep',
        input: {
          pattern: input.substring(0, 50),
          output_mode: 'content',
        },
        description: 'Search for relevant information',
        dependencies: availableTools.includes('Read') ? ['step-1'] : [],
      });
    }

    // Add a reasoning step if we have evidence
    if (plan.length > 0) {
      plan.push({
        id: 'step-final',
        action: 'reason',
        input: { task: input },
        description: 'Analyze collected evidence and provide conclusion',
        dependencies: plan.map((step) => step.id),
      });
    } else {
      // Fallback plan if no tools are available
      plan.push({
        id: 'step-1',
        action: 'reason',
        input: { task: input },
        description: 'Analyze the problem and provide solution',
        dependencies: [],
      });
    }

    this.logger.debug('Plan generated', undefined, {
      component: 'ReWOOPattern',
      method: 'generatePlan',
      stepCount: plan.length,
      steps: plan.map((s) => s.description),
    });

    return plan;
  }

  /**
   * Execute the plan and collect evidence
   */
  private async executePlan(plan: ReWOOPlanStep[]): Promise<{
    evidence: ReWOOEvidence[];
    toolResults: WorkflowToolResult[];
  }> {
    const evidence: ReWOOEvidence[] = [];
    const toolResults: WorkflowToolResult[] = [];

    // Execute steps based on dependencies
    const completed = new Set<string>();
    const pending = [...plan];

    while (pending.length > 0) {
      // Find steps that can be executed (all dependencies completed)
      const ready = pending.filter((step) => step.dependencies.every((dep) => completed.has(dep)));

      if (ready.length === 0) {
        this.logger.warn('No ready steps found - possible circular dependency', undefined, {
          component: 'ReWOOPattern',
          method: 'executePlan',
          pendingSteps: pending.map((s) => s.id),
          completedSteps: Array.from(completed),
        });
        break;
      }

      // Execute ready steps (parallel if enabled and safe)
      const executionPromises = ready.map((step) => this.executeStep(step));
      const results = await Promise.allSettled(executionPromises);

      // Process results
      for (let i = 0; i < ready.length; i++) {
        const step = ready[i];
        const result = results[i];

        if (result.status === 'fulfilled') {
          evidence.push(result.value.evidence);
          if (result.value.toolResult) {
            toolResults.push(result.value.toolResult);
          }
          completed.add(step.id);
        } else {
          // Handle failed step
          evidence.push({
            stepId: step.id,
            action: step.action,
            input: step.input,
            result: `Error: ${result.reason}`,
            success: false,
            executionTime: 0,
          });
          completed.add(step.id); // Mark as completed to avoid blocking
        }

        // Remove from pending
        const index = pending.findIndex((p) => p.id === step.id);
        if (index >= 0) {
          pending.splice(index, 1);
        }
      }
    }

    return { evidence, toolResults };
  }

  /**
   * Execute a single plan step
   */
  private async executeStep(step: ReWOOPlanStep): Promise<{
    evidence: ReWOOEvidence;
    toolResult?: WorkflowToolResult;
  }> {
    const startTime = Date.now();

    this.logger.debug('Executing step', undefined, {
      component: 'ReWOOPattern',
      method: 'executeStep',
      stepId: step.id,
      action: step.action,
    });

    // If it's a tool action and we have a tool executor
    if (this.toolExecutor && this.toolExecutor.isToolAvailable(step.action)) {
      const toolExecutionResult = await fromAsyncTryCatch(
        async (): Promise<{
          evidence: ReWOOEvidence;
          toolResult?: WorkflowToolResult;
        }> => {
          const result = await this.toolExecutor!.executeTool({
            toolName: step.action,
            input: step.input,
            nodeId: 'rewoo-worker',
            workflowId: `rewoo-${Date.now()}`,
            sessionId: 'rewoo-session',
          });

          const executionTime = Date.now() - startTime;

          if (result.tag === 'success') {
            return {
              evidence: {
                stepId: step.id,
                action: step.action,
                input: step.input,
                result: result.value.output,
                success: true,
                executionTime,
              },
              toolResult: result.value,
            };
          } else {
            return {
              evidence: {
                stepId: step.id,
                action: step.action,
                input: step.input,
                result: `Tool failed: ${result.error.message}`,
                success: false,
                executionTime,
              },
            };
          }
        },
        (error: unknown) => ({
          code: 'REWOO_TOOL_EXECUTION_ERROR',
          message: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
          category: 'SYSTEM' as const,
          context: { stepId: step.id, action: step.action },
        })
      );

      if (toolExecutionResult.tag === 'success') {
        return toolExecutionResult.value;
      } else {
        return {
          evidence: {
            stepId: step.id,
            action: step.action,
            input: step.input,
            result: `Execution error: ${toolExecutionResult.error.message}`,
            success: false,
            executionTime: Date.now() - startTime,
          },
        };
      }
    } else {
      // Non-tool action - reasoning step
      const executionTime = Date.now() - startTime;
      return {
        evidence: {
          stepId: step.id,
          action: step.action,
          input: step.input,
          result: `Reasoning step: ${step.description}`,
          success: true,
          executionTime,
        },
      };
    }
  }

  /**
   * Synthesize final solution from collected evidence
   */
  private synthesizeSolution(input: string, evidence: ReWOOEvidence[]): string {
    let solution = `ReWOO Pattern Solution for: "${input}"\n\n`;

    solution += `Execution Plan Results:\n`;
    solution += `Total Steps: ${evidence.length}\n`;
    solution += `Successful Steps: ${evidence.filter((e) => e.success).length}\n`;
    solution += `Failed Steps: ${evidence.filter((e) => !e.success).length}\n\n`;

    solution += `Evidence Collected:\n`;
    evidence.forEach((item, i) => {
      solution += `${i + 1}. Step: ${item.stepId} (${item.action})\n`;
      solution += `   Result: ${JSON.stringify(item.result)}\n`;
      solution += `   Success: ${item.success ? '✅' : '❌'} (${item.executionTime}ms)\n\n`;
    });

    // Simple synthesis logic - in real implementation, this would use an LLM
    const successfulEvidence = evidence.filter((e) => e.success);
    if (successfulEvidence.length > 0) {
      solution += `Final Analysis: Successfully executed ${successfulEvidence.length} steps. `;
      solution += `The collected evidence provides comprehensive information to address the original query.`;
    } else {
      solution += `Final Analysis: No successful steps executed. Unable to collect sufficient evidence to provide a complete solution.`;
    }

    return solution;
  }

  /**
   * Calculate execution progress
   */
  private calculateProgress(state: ReWOOState): number {
    switch (state.currentPhase) {
      case 'planning':
        return 0.1;
      case 'working': {
        const planSize = state.plan?.length || 1;
        const evidenceSize = state.evidence?.length || 0;
        return 0.1 + 0.7 * (evidenceSize / planSize);
      }
      case 'solving':
        return 0.9;
      case 'complete':
        return 1.0;
      default:
        return 0;
    }
  }
}
